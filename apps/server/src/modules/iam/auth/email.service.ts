import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendEmail(to: string, token: string) {
    await this.mailerService.sendMail({
      to,
      subject: 'imageStack激活您的账户',
      from: 'from@qq.com',
      html: `
        <h1>激活您的账户</h1>
        <p>请前往 <a href="${this.configService.get<string>('APP_DOMAIN')}/auth/verify-activate?token=${token}">激活链接</a> 进行激活</p>
      `,
    });
    console.log('发送成功');
  }
}
