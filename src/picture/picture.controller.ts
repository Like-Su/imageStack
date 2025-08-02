import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { PictureService } from './picture.service';
import * as Minio from 'minio';
import { MINIO_CLIENT, PICTURE_STATUS } from 'src/constants';
import { UnNeedLogin } from 'src/interface.guard.decorator';
import { MinioService } from 'src/minio/minio.service';
import { UserInfo } from 'src/user.decorator';
import { buildFileName } from 'src/utils';
import { CreatePictureDto } from './dto/create-picture.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { UserService } from 'src/user/user.service';
import { UpdatePictureDto } from './dto/update-picture.dto';

@UnNeedLogin()
@Controller('picture')
export class PictureController {
  @Inject(MinioService)
  private readonly minioService: MinioService;
  @Inject(PictureService)
  private readonly pictureService: PictureService;
  @Inject(UserService)
  private readonly userService: UserService;

  constructor() { }

  // 上传图片(FormData, 以及信息)
  @Get('upload')
  async uploadFile(@Query('file_name') fileName: string, @UserInfo('id') userId: number) {
    const imageInfo = buildFileName(userId, fileName);

    return {
      url: this.minioService.presignedPutObject('images', imageInfo.fileName),
      fullName: imageInfo
    };
  }

  // 通知上传完毕
  @Post('upload/confirm')
  async confirmUpload(
    @Body() confirmUploadDto: ConfirmUploadDto,
    @UserInfo('id') userId: number
  ) {
    const user = await this.userService.findUserById(userId);
    const uploaded = await Promise.all(
      confirmUploadDto.pictures.map(async (picture) => {
        try {
          // 获取文件信息
          const stat = await this.minioService.statObject('images', picture.fullName);


          return {
            name: picture.originname,
            size: stat.size,
            uri: picture.fullName,
            bucketName: 'images',
            owner: user,
            status: PICTURE_STATUS.NORMAL
          }
        } catch(e) {
          return null;
        }
      }));
    return await Promise.all(uploaded.map(picture => this.pictureService.uploadFile(picture)));
  }

  // 修改元数据
  @Post('update_image')
  async updateImage(@Body() updatePictureDto: UpdatePictureDto, @Body('id') imageId, @UserInfo('id') userId: number) {
    // 检查用户是否存在该图片 
    await this.pictureService.existImage(userId, imageId);
    return await this.pictureService.updateImageInfo(imageId, updatePictureDto);
  }

  // 删除图片

  // 获取所有图片
  @Get('list_image')
  async listImage(@UserInfo('id') userId: number) {
    const user = await this.userService.findUserById(userId);
    return await this.pictureService.listImage(user);
  }
}
