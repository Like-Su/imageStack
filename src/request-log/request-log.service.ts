import { Get, Inject, Injectable, Param } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import * as iconv from 'iconv-lite';
import { RequestLogDto } from './dto/request-log.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { RequestLog } from './eneity/request-log';
import { Repository } from 'typeorm';

@Injectable()
export class RequestLogService {
  @Inject(HttpService)
  private readonly httpService: HttpService;
  @InjectRepository(RequestLog)
  private readonly requestLogRepository: Repository<RequestLog>;

  private weatherUrl =
    'https://whois.pconline.com.cn/ipJson.jsp?ip={{ip}}&json=true';

  setUrl(ip: string) {
    return this.weatherUrl.replace('{{ip}}', ip);
  }

  transformCharsetToUtf8(data: any, charset: string) {
    const transformData = iconv.decode(data, charset);
    return JSON.parse(transformData);
  }

  // 获取城市
  async weather(ip: string) {
    const response = await this.httpService.axiosRef(this.setUrl(ip), {
      responseType: 'arraybuffer',
      transformResponse: [(data) => this.transformCharsetToUtf8(data, 'gbk')],
    });

    return response.data.addr;
  }

  // 保存到数据库
  async save(requestLogDto: RequestLogDto) {
    await this.requestLogRepository.save(requestLogDto);
  }

  // 获取请求日志
  async findRequestLog(limit: number, page: number) {
    return this.requestLogRepository.find({
      take: limit,
      skip: (page - 1) * limit,
      order: {
        id: 'DESC',
      },
    });
  }
}
