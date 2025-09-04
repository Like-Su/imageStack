import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EMAIL_CLIENT } from 'src/constants';
import { createTransport } from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Module({
  providers: [
    EmailService,
    {
      provide: EMAIL_CLIENT,
      useFactory(configService: ConfigService) {
        const transporter = createTransport({
          host: configService.get('smtp.host'),
          port: configService.get('smtp.port'),
          secure: configService.get('smtp.secure'),
          auth: configService.get('smtp.auth'),
        });
        return transporter;
      },
      inject: [ConfigService],
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}
