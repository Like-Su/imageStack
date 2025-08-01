import { Controller, Get, Inject } from '@nestjs/common';
import { PictureService } from './picture.service';
import * as Minio from 'minio';
import { MINIO_CLIENT } from 'src/constants';
import { UnNeedLogin } from 'src/interface.guard.decorator';

@Controller('picture')
export class PictureController {
  @Inject(MINIO_CLIENT)
  private minioClient: Minio.Client;
  constructor(private readonly pictureService: PictureService) { }

  @UnNeedLogin()
  @Get('test')
  async test() {

  }
  // 上传图片(FormData, 以及信息)

  // 修改元数据

  // 删除 到回收站 图片

  // 删除图片

  // 获取所有图片
}
