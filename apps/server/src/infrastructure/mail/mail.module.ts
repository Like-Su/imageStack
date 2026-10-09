import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { mailConfig } from './mail.config';
import { MailService } from './mail.service';

@Module({
  imports: [
    ConfigModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: mailConfig,
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
