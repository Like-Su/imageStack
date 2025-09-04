import { Inject, Injectable } from '@nestjs/common';
import { EMAIL_CLIENT } from 'src/constants';
import { createTransport, Transporter } from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  @Inject(ConfigService)
  private readonly configService: ConfigService;
  @Inject(EMAIL_CLIENT)
  private readonly emailClient: Transporter;

  async sendMail({ to, subject, text }) {
    await this.emailClient.sendMail({
      from: {
        name: this.configService.get('application.name'),
        address: this.configService.get('smtp.auth.user'),
      },
      to,
      subject,
      html: text,
    });

    // await this.emailClient.sendMail({
    //   from: {
    //     name: this.configService.get('application.name'),
    //     address: this.configService.get('smtp.auth.user'),
    //   },
    //   to,
    //   subject,
    //   html: '<p>test</p>',
    // });
  }
}
