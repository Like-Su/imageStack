import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendEmail(to: string, code: string) {
    await this.mailerService.sendMail({
      to: 'to@qq.com',
      subject: '123',
      from: 'from@qq.com',
      text: 'hello world',
    });
    console.log('发送成功');
  }
}
