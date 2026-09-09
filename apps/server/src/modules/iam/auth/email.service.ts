import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PASSWORD_RESET_TTL_SECONDS } from 'src/common/constants/auth';

type EmailType = 'site' | 'forget' | 'reset';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class EmailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  private getType(
    type: EmailType,
    token: string,
    email: string,
    expiresIn: number,
  ) {
    const activation = type === 'site';
    const domain = this.configService
      .getOrThrow<string>('APP_DOMAIN')
      .replace(/\/+$/, '');
    const url = new URL(
      `${domain}/${activation ? 'auth/verify-activate' : 'forgot-password'}`,
    );
    if (activation) {
      url.searchParams.set('token', token);
    } else {
      url.searchParams.set('email', email);
      url.searchParams.set('emailCode', token);
    }

    const title = activation ? '激活您的账户' : '重置您的密码';
    const action = activation ? '激活账户' : '设置新密码';
    const minutes = Math.ceil(expiresIn / 60);
    const codeText = activation ? '' : `重置验证码：${token}\n`;
    const codeHtml = activation
      ? ''
      : `<p>重置验证码：</p><p><code style="word-break:break-all">${escapeHtml(token)}</code></p>`;

    return {
      subject: `imageStack ${title}`,
      text: `${title}\n${codeText}${action}：${url.toString()}\n链接与验证码 ${minutes} 分钟内有效，且只能使用一次。如非本人操作，请忽略本邮件。`,
      html: `
        <h1>${title}</h1>
        <p>请点击 <a href="${escapeHtml(url.toString())}">${action}</a>。</p>
        ${codeHtml}
        <p>链接与验证码 ${minutes} 分钟内有效，且只能使用一次。</p>
        <p>如非本人操作，请忽略本邮件。请勿向他人提供验证码或转发此链接。</p>
      `,
    };
  }

  async sendEmail(
    to: string,
    token: string,
    type: EmailType = 'site',
    expiresIn: number = PASSWORD_RESET_TTL_SECONDS,
  ) {
    const { subject, html, text } = this.getType(type, token, to, expiresIn);
    await this.mailerService.sendMail({
      to,
      subject,
      from: this.configService.getOrThrow<string>('MAIL_SEND_FROM'),
      html,
      text,
    });
  }
}
