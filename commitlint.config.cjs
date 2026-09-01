/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Commit 可以使用的类型
    'type-enum': [
      2,
      'always',
      [
        // 新功能
        'feat',
        // BUG 修复
        'fix',
        // 文档
        'docs',
        // 代码格式
        'style',
        // 重构
        'refactor',
        // 性能优化
        'perf',
        // 测试
        'test',
        // 构建
        'build',
        // CICD
        'ci',
        // 杂项
        'chore',
        // 回滚
        'revert',
      ]
    ],
    // 0 ignore, 1 warning, 2 error
    // type 不能为空
    'type-empty': [2, 'never'],
    // commit 的 description 不能为空否则报错
    'subject-empty': [2,'never'],
    // description 不允许以 . 结尾
    'subject-full-stop': [2,'never', '.'],
    // commit 的 description 最大长度不能超过 72 字符
    'subject-max-length': [2,'never', 72],
    // 整个 header 最多 100 字符
    'header-max-length': [2,'never', 100],
  }
}