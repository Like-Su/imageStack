import { Module } from '@nestjs/common';
import { RequestLogService } from './request-log.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestLog } from './eneity/request-log';

@Module({
  imports: [TypeOrmModule.forFeature([RequestLog])],
  providers: [RequestLogService],
  exports: [RequestLogService],
})
export class RequestLogModule {}
