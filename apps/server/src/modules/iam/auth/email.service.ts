import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type EmailType = 'site' | 'forget' | 'reset';
@Injectable()
export class EmailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  getType(type: EmailType, token: string) {
    // 策略模式来优化 多项选择 方式
    const strategy = {
      site: {
        subject: 'imageStack 激活您的账户',
        html: this.sendSite(token),
      },
      forget: {
        subject: 'imageStack 验证码<忘记密码>',
        html: this.sendToken(token),
      },
      reset: {
        subject: 'imageStack 验证码<重置密码>',
        html: this.sendToken(token),
      },
    } as Record<EmailType, { subject: string; html: string }>;

    return strategy[type];
  }

  sendSite(token: string) {
    return `
        <h1>激活您的账户</h1>
        <p>请前往 <a href="${this.configService.get<string>('APP_DOMAIN')}/auth/verify-activate?token=${token}">激活链接</a> 进行激活</p>
      `;
  }

  sendToken(token: string) {
    return `
        <h1>激活您的账户</h1>
        <p>您的激活码为：${token}</p>
      `;
  }

  async sendEmail(to: string, token: string, type: EmailType = 'site') {
    const { subject, html } = this.getType(type, token);
    await this.mailerService.sendMail({
      to,
      subject,
      from: this.configService.get<string>('MAIL_FROM'),
      html,
    });
    console.log('发送成功');
  }
}
