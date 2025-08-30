import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Inject,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { PictureService } from './picture.service';
import { PERMISSIONS, PICTURE_STATUS, SEARCH_TYPE } from 'src/constants';
import { NeedPermissions, UnNeedLogin } from 'src/interface.guard.decorator';
import { MinioService } from 'src/minio/minio.service';
import { UserInfo } from 'src/user.decorator';
import { buildFileName } from 'src/utils';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { UserService } from 'src/user/user.service';
import { UpdatePictureDto } from './dto/update-picture.dto';
import { GenerateShortUrlDto } from './dto/generate-short-url.dto';

// @UnNeedLogin()
@Controller('picture')
export class PictureController {
  @Inject(MinioService)
  private readonly minioService: MinioService;
  @Inject(PictureService)
  private readonly pictureService: PictureService;
  @Inject(UserService)
  private readonly userService: UserService;

  constructor() {}

  @Get('init')
  async initData() {
    return await this.pictureService.initData();
  }

  // 上传图片(FormData, 以及信息)
  @Get('upload')
  @NeedPermissions(PERMISSIONS.UPLOAD)
  async uploadFile(
    @Query('file_name') fileName: string,
    @UserInfo('userId') userId: number,
  ) {
    const imageInfo = buildFileName(userId, fileName);

    return {
      url: await this.minioService.presignedPutObject(
        'images',
        imageInfo?.fileName,
      ),
      uploadInfo: imageInfo,
    };
  }

  // 通知上传完毕
  @Post('upload/confirm')
  // @NeedPermissions(PERMISSIONS.UPLOAD)
  async confirmUpload(
    @Body() confirmUploadDto: ConfirmUploadDto,
    @UserInfo('id') userId: number,
  ) {
    const user = await this.userService.findUserById(userId);
    const uploaded = await Promise.all(
      confirmUploadDto.pictures.map(async (picture) => {
        try {
          // 1_2ef2c9238688a8ff9ee581eab55e86b5_720w.webp_1755315485622

          // 获取文件信息
          const stat = await this.minioService.statObject(
            'images',
            picture.fileName,
          );
          return {
            name: picture.originname,
            size: stat.size,
            uri: picture.fileName,
            bucketName: 'images',
            owner: user,
            status: PICTURE_STATUS.NORMAL,
          };
        } catch (e) {
          return null;
        }
      }),
    );

    return await Promise.all(
      uploaded.map(
        async (picture) => await this.pictureService.uploadFile(picture),
      ),
    );
  }

  // 修改元数据
  @Post('update_image')
  @NeedPermissions(PERMISSIONS.MODIFIER)
  async updateImage(
    @Body() updatePictureDto: UpdatePictureDto,
    @Body('image_id') imageId,
    @UserInfo('userId') userId: number,
  ) {
    // 检查用户是否存在该图片
    await this.pictureService.existImage(userId, imageId);
    return await this.pictureService.updateImageInfo(imageId, updatePictureDto);
  }

  // 下载图片
  @Get('download')
  async download(@UserInfo('userId') userId, @Query('id') imageId: number) {
    return await this.pictureService.download(userId, imageId);
  }

  // 预览二维码
  @Get('qrcode')
  async generateQrcode(
    @Query('image_id') imageId,
    @UserInfo('userId') userId: number,
  ) {
    await this.pictureService.existImage(userId, imageId);
    console.log(userId);
    return await this.pictureService.generateQrcode(imageId);
  }

  // 下载二维码
  @Get('download/qrcode')
  async downloadQrcode(
    @UserInfo('userId') userId: number,
    @Query('image_id') imageId: number,
  ) {
    await this.pictureService.existImage(userId, imageId);
    return await this.pictureService.downloadQrcode(imageId);
  }

  // 删除图片
  @Post('delete')
  async deleteImage(
    @UserInfo('userId') userid: number,
    @Body('image_id') imageId: number,
  ) {
    await this.pictureService.existImage(userid, imageId);
    return await this.pictureService.deleteImage(
      imageId,
      PICTURE_STATUS.NORMAL,
      PICTURE_STATUS.DELETE,
    );
  }

  // 回收站列表
  @Get('recycle')
  async recycle(@UserInfo('userId') userId: number) {
    return await this.pictureService.recycle(userId);
  }

  @Post('recycle/restore')
  async restoreImageFromRecycle(
    @UserInfo('userId') userId: number,
    @Body('image_id') imageId: number,
  ) {
    await this.pictureService.existImage(
      userId,
      imageId,
      PICTURE_STATUS.DELETE,
    );
    return await this.pictureService.deleteImage(
      imageId,
      PICTURE_STATUS.DELETE,
      PICTURE_STATUS.NORMAL,
    );
  }

  // 删除图片
  @Post('recycle/delete')
  async deleteImageFromRecycle(
    @UserInfo('userId') userId: number,
    @Body('image_id') imageId: number,
  ) {
    await this.pictureService.existImage(
      userId,
      imageId,
      PICTURE_STATUS.DELETE,
    );
    return await this.pictureService.deleteImage(
      imageId,
      PICTURE_STATUS.DELETE,
      PICTURE_STATUS.TRASH,
    );
  }

  // 获取所有图片
  @Get('list_image')
  @NeedPermissions(PERMISSIONS.VIEW)
  async listImage(
    @UserInfo('id') userId: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    const user = await this.userService.findUserById(userId);
    return await this.pictureService.listImage(user, limit, page);
  }

  // 最近 7 天的图片上传趋势
  @Get('trend')
  async getTrend() {
    return await this.pictureService.getTrend();
  }

  // 短链生成
  @Post('generate_short_url')
  async generateShortUrl(@Body() generateShortUrlDto: GenerateShortUrlDto) {
    return await this.pictureService.generateShortUrl(
      generateShortUrlDto.longUrl,
      generateShortUrlDto.imageId,
    );
  }

  // 获取 标签
  @UnNeedLogin()
  @Get('tag_list')
  async getTagList(@UserInfo('userId') userId: number) {
    return await this.pictureService.getTagList(userId);
  }

  @UnNeedLogin()
  @Get('search')
  async search(
    @Query('type') type: SEARCH_TYPE = SEARCH_TYPE.ALL,
    @Query('keyword') keyword: string,
  ) {
    return await this.pictureService.search(type, keyword);
  }
}
