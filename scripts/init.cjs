const { spawn } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { createInterface } = require('node:readline');
const { Writable } = require('node:stream');

const serverDirectory = resolve(__dirname, '../apps/server');
const serverRequire = createRequire(resolve(serverDirectory, 'package.json'));
const sqlPath = resolve(__dirname, 'init.sql');

function parseArguments() {
  let forceAdmin = false;
  let help = false;
  for (const argument of process.argv.slice(2)) {
    if (argument === '--force-admin') forceAdmin = true;
    else if (argument === '--help' || argument === '-h') help = true;
    else if (argument !== '--') throw new Error('不支持该参数，请使用 --help 查看用法。');
  }
  return { forceAdmin, help };
}

function printHelp() {
  process.stdout.write(`imageStack 数据库基础数据初始化

用法：
  pnpm db:seed [--force-admin]
  bash scripts/init.sh [--force-admin]

选项：
  --force-admin  显式重置已有目标账户的昵称、密码、角色和状态，并撤销旧会话
  --help, -h     查看帮助，不连接数据库

配置优先读取外部环境变量，其次读取 apps/server/.env：
  DATABASE_URL         PostgreSQL 连接地址，必须先完成 Prisma 迁移
  ADMIN_USERNAME       管理员昵称，默认 admin
  ADMIN_EMAIL          管理员邮箱；未设置时在交互式终端询问
  ADMIN_PASSWORD       管理员密码，至少 8 位，UTF-8 不超过 72 字节
  ADMIN_PASSWORD_HASH  可选的 bcrypt 哈希（cost 10～14），不能与明文密码同时设置

未提供密码或哈希时会隐藏输入并要求确认密码。非交互环境必须提供凭据。
默认不会覆盖已有管理员密码，不会提升或激活已有普通、停用或删除的账户。
只初始化角色、权限、角色授权和管理员；不清空数据，不创建演示媒体文件。
`);
}

function loadEnvironment() {
  const envPath = resolve(serverDirectory, '.env');
  const { parse } = serverRequire('dotenv');
  const fileEnvironment = existsSync(envPath)
    ? parse(readFileSync(envPath, 'utf8'))
    : {};
  return { ...fileEnvironment, ...process.env };
}

async function prompt(message, hidden = false) {
  if (!process.stdin.isTTY || !process.stderr.isTTY)
    throw new Error('非交互环境请设置 ADMIN_EMAIL 及 ADMIN_PASSWORD 或 ADMIN_PASSWORD_HASH。');

  const output = hidden
    ? new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      })
    : process.stderr;
  const reader = createInterface({
    input: process.stdin,
    output,
    terminal: true,
    historySize: 0,
  });

  if (hidden) process.stderr.write(message);
  try {
    return await new Promise((resolveAnswer, reject) => {
      reader.once('SIGINT', () => reject(new Error('已取消初始化。')));
      reader.once('close', () => reject(new Error('输入已结束，未执行初始化。')));
      reader.question(hidden ? '' : message, resolveAnswer);
    });
  } finally {
    reader.close();
    if (hidden) {
      output.destroy();
      process.stderr.write('\n');
    }
  }
}

function databaseConnection(environment) {
  let connection;
  let password;
  try {
    connection = new URL(environment.DATABASE_URL || '');
    password = decodeURIComponent(connection.password);
  } catch {
    throw new Error('请配置有效的 PostgreSQL DATABASE_URL。');
  }
  if (!['postgres:', 'postgresql:'].includes(connection.protocol))
    throw new Error('DATABASE_URL 仅支持 PostgreSQL 连接地址。');
  if (!connection.pathname || connection.pathname === '/' || connection.hash)
    throw new Error('DATABASE_URL 必须指定数据库，且不能包含 URL 片段。');

  if (
    connection.searchParams.getAll('schema').length > 1 ||
    connection.searchParams.getAll('password').length > 1
  )
    throw new Error('DATABASE_URL 不能重复指定 schema 或 password 参数。');
  const schema = connection.searchParams.get('schema');
  if (schema && schema !== 'public')
    throw new Error('现有初始化 SQL 仅支持 public schema，请检查 DATABASE_URL。');
  if (connection.searchParams.has('sslpassword'))
    throw new Error('请通过数据库客户端的安全配置提供 TLS 私钥凭据，不要放入 URL 查询参数。');

  if (connection.searchParams.has('password')) {
    if (password) throw new Error('DATABASE_URL 中存在重复的数据库密码配置。');
    password = connection.searchParams.get('password');
    connection.searchParams.delete('password');
  }
  if (password?.includes('\u0000'))
    throw new Error('数据库密码不能包含空字符，请检查 DATABASE_URL。');
  connection.password = '';
  for (const option of [
    'schema',
    'connection_limit',
    'pool_timeout',
    'pgbouncer',
    'statement_cache_size',
  ])
    connection.searchParams.delete(option);
  connection.search = [...connection.searchParams]
    .map(
      ([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    )
    .join('&');

  const childEnvironment = { ...process.env };
  delete childEnvironment.DATABASE_URL;
  delete childEnvironment.ADMIN_PASSWORD;
  delete childEnvironment.ADMIN_PASSWORD_HASH;
  if (password) childEnvironment.PGPASSWORD = password;
  childEnvironment.PGCONNECT_TIMEOUT ||= '10';
  childEnvironment.PGAPPNAME = 'imageStack-init';

  return { url: connection.toString(), environment: childEnvironment };
}

async function administrator(environment) {
  const { z } = serverRequire('zod');
  const username = (environment.ADMIN_USERNAME || 'admin').trim();
  if (!username || username.length > 80 || /[\u0000-\u001f\u007f]/.test(username))
    throw new Error('ADMIN_USERNAME 必须为 1～80 位，且不能包含控制字符。');

  const emailInput = environment.ADMIN_EMAIL || (await prompt('管理员邮箱：'));
  const emailResult = z.string().trim().max(254).email().safeParse(emailInput);
  if (!emailResult.success) throw new Error('请提供有效的 ADMIN_EMAIL。');
  const email = emailResult.data.toLowerCase();

  const suppliedHash = environment.ADMIN_PASSWORD_HASH?.trim();
  let password = environment.ADMIN_PASSWORD;
  if (suppliedHash && password)
    throw new Error('ADMIN_PASSWORD 与 ADMIN_PASSWORD_HASH 只能设置一个。');

  if (suppliedHash) {
    if (!/^\$2[aby]\$1[0-4]\$[./A-Za-z0-9]{53}$/.test(suppliedHash))
      throw new Error('ADMIN_PASSWORD_HASH 必须为有效的 bcrypt 哈希，cost 为 10～14。');
    return { username, email, passwordHash: suppliedHash };
  }

  if (!password) {
    password = await prompt('管理员密码（隐藏输入）：', true);
    const confirmation = await prompt('再次输入管理员密码：', true);
    if (password !== confirmation) throw new Error('两次输入的管理员密码不一致。');
  }
  if (
    !password.trim() ||
    [...password].length < 8 ||
    Buffer.byteLength(password, 'utf8') > 72
  )
    throw new Error('管理员密码至少需要 8 位，且 UTF-8 编码不能超过 72 字节。');
  if (password.includes('\u0000')) throw new Error('管理员密码不能包含空字符。');

  const { hash } = serverRequire('bcryptjs');
  return { username, email, passwordHash: await hash(password, 10) };
}

function executeSql(connection, admin, forceAdmin) {
  const sql = readFileSync(sqlPath, 'utf8');
  return new Promise((resolveExecution, reject) => {
    const child = spawn(
      'psql',
      [
        '--no-psqlrc',
        '--no-password',
        '--quiet',
        '--dbname',
        connection.url,
        '--set',
        'ON_ERROR_STOP=1',
        '--set',
        'VERBOSITY=terse',
        '--set',
        'SHOW_CONTEXT=never',
        '--set',
        `admin_username=${admin.username}`,
        '--set',
        `admin_email=${admin.email}`,
        '--set',
        `force_admin=${forceAdmin ? '1' : '0'}`,
      ],
      { env: connection.environment, stdio: ['pipe', 'inherit', 'inherit'] },
    );
    const interrupt = () => child.kill('SIGTERM');
    const terminate = () => child.kill('SIGTERM');
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', terminate);
    child.once('error', (error) => {
      reject(
        new Error(
          error.code === 'ENOENT'
            ? '未找到 psql，请安装 PostgreSQL 客户端。'
            : '无法启动 PostgreSQL 客户端。',
        ),
      );
    });
    child.stdin.on('error', (error) => {
      if (error.code !== 'EPIPE') {
        child.kill();
        reject(new Error('向 PostgreSQL 客户端传入初始化数据失败。'));
      }
    });
    child.once('close', (code, signal) => {
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', terminate);
      if (code === 0) resolveExecution();
      else
        reject(
          new Error(
            signal
              ? '初始化进程被中断，请检查数据库状态。'
              : '数据库初始化失败，请检查迁移、连接配置及上方错误；未自动重试。',
          ),
        );
    });
    child.stdin.end(`\\set admin_password_hash '${admin.passwordHash}'\n${sql}`);
  });
}

async function main() {
  const options = parseArguments();
  if (options.help) return printHelp();
  const environment = loadEnvironment();
  const connection = databaseConnection(environment);
  const admin = await administrator(environment);
  if (options.forceAdmin)
    process.stderr.write('警告：--force-admin 将重置目标账户并撤销其旧会话；不会启用已禁用的管理员角色。\n');

  process.stdout.write('正在初始化角色、权限、角色授权和管理员账户…\n');
  await executeSql(connection, admin, options.forceAdmin);
  process.stdout.write('数据库基础数据初始化完成。已有账户的权限缓存可能仍需按部署流程清理。\n');
}

main().catch((error) => {
  const message =
    error.code === 'MODULE_NOT_FOUND'
      ? '缺少初始化依赖，请先在工作区安装项目依赖。'
      : error.message;
  process.stderr.write(`初始化失败：${message}\n`);
  process.exitCode = 1;
});
