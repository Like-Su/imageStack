import type { MailerOptions } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

export function mailConfig(config: ConfigService): MailerOptions {
  const mailUser = config.get<string>('MAIL_USER');
  return {
    transport: {
      host: config.get<string>('MAIL_HOST'),
      port: Number(config.get<string>('MAIL_PORT')),
      secure: config.get<string>('MAIL_SECURE') === 'true',
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      auth: mailUser
        ? { user: mailUser, pass: config.get<string>('MAIL_PASS') }
        : undefined,
    },
    defaults: { from: config.get<string>('MAIL_SEND_FROM') },
  };
}
