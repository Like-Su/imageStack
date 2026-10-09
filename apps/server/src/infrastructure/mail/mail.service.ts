import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

@Injectable()
export class MailService {
  constructor(
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  async send(message: MailMessage): Promise<void> {
    await this.mailer.sendMail({
      ...message,
      from: this.config.getOrThrow<string>('MAIL_SEND_FROM'),
    });
  }
}
