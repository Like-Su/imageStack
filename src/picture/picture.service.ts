import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  StreamableFile,
} from '@nestjs/common';
import { CreatePictureDto } from './dto/create-picture.dto';
import { UpdatePictureDto } from './dto/update-picture.dto';
import { Picture } from './entities/picture.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { UserService } from 'src/user/user.service';
import { MinioService } from 'src/minio/minio.service';
import {
  PICTURE_STATUS,
  SEARCH_TYPE,
  UNIQUE_SHORT_URL_STATUS,
} from 'src/constants';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as dayjs from 'dayjs';
import * as base62 from 'base62';
import { UniqueShortUrl } from './entities/uniqueShortUrl.entity';
import { ShortLongUrl } from './entities/shortLongUrl.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as qrcode from 'qrcode';
import { Tags } from './entities/tags.entity';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { ExtractJwt } from 'passport-jwt';
import fromAuthHeaderWithScheme = ExtractJwt.fromAuthHeaderWithScheme;

@Injectable()
export class PictureService {
  @InjectRepository(Picture)
  private readonly pictureRepository: Repository<Picture>;
  @InjectRepository(Tags)
  private readonly tagRepository: Repository<Tags>;
  @InjectRepository(UniqueShortUrl)
  private readonly uniqueShortUrlRepository: Repository<UniqueShortUrl>;
  @InjectRepository(ShortLongUrl)
  private readonly shortLongUrlRepository: Repository<ShortLongUrl>;
  @Inject(UserService)
  private readonly userService: UserService;
  @Inject(MinioService)
  private readonly minioService: MinioService;
  // 短链接长度
  private readonly shortUrlLength = 6;
  // 批量生成短链 数量
  private readonly batchGenerateShortUrlCount = 100;

  async initData() {
    const user1 = await this.userService.findUserById(1);
    const dirPath = path.join(`E:\\desk\\图床`);
    const isImage = (fileName: string) => /\.(png|jpg|jpeg)$/i.test(fileName);
    const files = (await fs.readdir(dirPath))
      .filter(isImage)
      .map((fileName) => {
        return {
          fileName: fileName,
          path: path.join(dirPath, fileName),
          name: fileName.match(/^(.+)(?=\.)/)[1],
        };
      })
      .map(async (file) => {
        const picture = new Picture();
        picture.name = file.name;
        picture.description = file.name;
        picture.uri = file.fileName;
        picture.size = (await fs.stat(file.path)).size;
        picture.owner = user1;
        return picture;
      });
    const results = await Promise.all(files);

    await this.pictureRepository.save(results);

    await this.minioService.presignedUrl('GET', 'images', results[0].uri);

    return results;
  }

  async uploadFile(pictureInfo: CreatePictureDto) {
    const picture = new Picture();
    picture.name = pictureInfo.name;
    picture.size = pictureInfo.size;
    picture.uri = pictureInfo.uri;
    picture.owner = pictureInfo.owner;

    await this.pictureRepository.save(picture);
    return picture;
  }

  async updateImageInfo(id: number, updatePictureDto: UpdatePictureDto) {
    const image = await this.pictureById(id);
    if (updatePictureDto.name) {
      image.name = updatePictureDto.name;
    }
    if (updatePictureDto.description) {
      image.description = updatePictureDto.description;
    }
    if (updatePictureDto.tags.length) {
      image.tags = await this.tagRepository.findByIds(updatePictureDto.tags);
    }
    if (updatePictureDto.status) {
      image.status = updatePictureDto.status;
    }
    this.pictureRepository.save(image);
  }

  async download(userId: number, imageId: number) {
    const image = await this.pictureRepository.findOneBy({
      id: imageId,
      owner: { id: userId },
      status: PICTURE_STATUS.NORMAL,
    });

    const fileName = image.name.split('_')[1];
    const stream = await this.minioService.getObject('images', image.uri);

    return new StreamableFile(stream, {
      disposition: `attachment; filename=${Date.now()}-${encodeURIComponent(fileName)}`,
    });
  }

  async generateQrcode(imageId: number) {
    const image = await this.pictureById(imageId);
    const url = await this.minioService.presignedUrl(
      'GET',
      'images',
      image.uri,
    );
    const qrcodeBase64 = await qrcode.toDataURL(url);

    return qrcodeBase64;
  }

  async downloadQrcode(imageId: number) {
    const image = await this.pictureById(imageId);
    const imageUri = await this.minioService.presignedGetObject(
      'images',
      image.uri,
    );

    const qrcodeBase64 = await qrcode.toDataURL(imageUri);
    return qrcodeBase64;
  }

  async listImage(user: User, limit: number, page: number) {
    const images = await this.pictureRepository.find({
      where: { owner: { id: user.id }, status: PICTURE_STATUS.NORMAL },
      take: limit,
      skip: (page - 1) * limit,
      order: { createTime: 'DESC', updateTime: 'DESC' },
      relations: ['tags'],
    });

    const parserImages = await Promise.all(
      images.map(async (image) => {
        return {
          ...image,
          uri: await this.minioService.presignedUrl('GET', 'images', image.uri),
        };
      }),
    );

    return parserImages;
  }

  async pictureById(
    id: number,
    status: PICTURE_STATUS = PICTURE_STATUS.NORMAL,
  ) {
    return await this.pictureRepository.findOne({
      where: {
        id,
        status,
      },
      relations: ['owner'],
    });
  }

  async deleteImage(
    imageId: number,
    fromStatus: PICTURE_STATUS,
    toStatus: PICTURE_STATUS,
  ) {
    const image = await this.pictureRepository.findOneBy({
      id: imageId,
      status: fromStatus,
    });

    image.status = toStatus;

    console.log(image);
    await this.pictureRepository.save(image);

    return image;
  }

  // 回收站列表
  async recycle(userId: number) {
    const images = await this.pictureRepository.find({
      where: {
        owner: { id: userId },
        status: PICTURE_STATUS.DELETE,
      },
      order: {
        updateTime: 'DESC',
      },
    });

    const parserImages = await Promise.all(
      images.map(async (image) => {
        return {
          ...image,
          uri: await this.minioService.presignedUrl('GET', 'images', image.uri),
        };
      }),
    );

    return parserImages;
  }

  // 检查用户是否有该图片
  async existImage(
    userId: number,
    imageId: number,
    status: PICTURE_STATUS = PICTURE_STATUS.NORMAL,
  ) {
    const image = await this.pictureById(imageId, status);
    if (!image || userId !== image.owner.id) {
      throw new HttpException('图片不存在', HttpStatus.ACCEPTED);
    }
  }

  // 最近 7 天的图片上传趋势, 若当前没有上传则为 0
  async getTrend() {
    const trendQueryBuilder =
      await this.pictureRepository.createQueryBuilder('picture');

    const thred = await trendQueryBuilder
      .select('DATE_FORMAT(picture.createTime, "%Y-%m-%d")', 'date')
      .addSelect('COUNT(*) AS count')
      .where('picture.createTime >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)')
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    const trendMap = new Map<string, number>(
      thred.map((r) => [r.date, Number(r.count)]),
    );

    const currentDate = (i) =>
      dayjs()
        .subtract(6 - i, 'day')
        .format('YYYY-MM-DD');

    const trend = Array.from({ length: 7 }).map((_, i) => {
      const date = currentDate(i);
      return {
        date,
        count: trendMap.get(date) ?? 0,
      };
    });

    return trend;
  }

  // 短链生成
  async generateShortUrl(longUrl: string, imageId: number) {
    const picture = await this.pictureById(imageId);

    let uniqueCode = await this.uniqueShortUrlRepository.findOneBy({
      status: UNIQUE_SHORT_URL_STATUS.UNUSED,
    });
    if (!uniqueCode) {
      uniqueCode = await this.generateUniqueCode();
    }

    const shortLongUrl = new ShortLongUrl();
    shortLongUrl.longUrl = longUrl;
    shortLongUrl.shortUrl = uniqueCode.code;
    shortLongUrl.picture = picture;
    await this.shortLongUrlRepository.insert(shortLongUrl);
    await this.uniqueShortUrlRepository.update(
      { id: uniqueCode.id },
      { status: UNIQUE_SHORT_URL_STATUS.NORMAL },
    );
  }

  // 历史短链
  async getHistoryShortUrl(imageId: number) {
    return await this.shortLongUrlRepository.find({
      where: {
        picture: {
          id: imageId,
        },
      },
    });
  }

  // 生成短链接
  generateCode(length: number) {
    let shortUrl = '';
    for (let i = 0; i < length; i++) {
      shortUrl += base62.encode(Math.floor(Math.random() * 62));
    }
    return shortUrl;
  }

  async generateUniqueCode() {
    const code = this.generateCode(this.shortUrlLength);
    const uniqueCode = await this.uniqueShortUrlRepository.findOneBy({ code });

    // 没有重复短链
    if (!uniqueCode) {
      const uniqueCodeOnly = new UniqueShortUrl();
      uniqueCodeOnly.code = code;
      return await this.uniqueShortUrlRepository.insert(uniqueCodeOnly);
    }
    // 若短链重复则重新生成
    return this.generateUniqueCode();
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async batchGenerateShortUrl() {
    for (let i = 0; i < this.batchGenerateShortUrlCount; i++) {
      this.generateUniqueCode();
    }
  }

  // tag

  async getTagList(userId: number) {
    return await this.tagRepository.find({
      where: {
        owner_id: userId,
      },
    });
  }

  async search(type: SEARCH_TYPE, keyword: string) {
    const queryBuilder = this.pictureRepository
      .createQueryBuilder('picture')
      .leftJoinAndSelect('picture.tags', 'tag');

    let builderWhere = 'picture.name LIKE :keyword OR tag.name LIKE :keyword';

    if (type === SEARCH_TYPE.TAG) {
      builderWhere = 'tag.name LIKE :keyword';
    } else if (type === SEARCH_TYPE.NAME) {
      builderWhere = 'picture.name LIKE :keyword';
    }

    const results = await queryBuilder
      .where(builderWhere, {
        keyword: `%${keyword}%`,
      })
      .getMany();

    return results;
  }

  async createTag(userId: number, createTagDto: CreateTagDto) {
    if (await this.tagRepository.findOneBy({ name: createTagDto.name })) {
      throw new HttpException('标签已存在', HttpStatus.ACCEPTED);
    }
    const tag = new Tags();
    tag.name = createTagDto.name;
    tag.owner_id = userId;
    const results = await this.tagRepository.insert(tag);
    return results;
  }

  async updateTag(userId: number, updateTagDto: UpdateTagDto) {
    await this.tagRepository.findOneByOrFail({
      id: updateTagDto.id,
      owner_id: userId,
    });
    return await this.tagRepository.update(
      {
        id: updateTagDto.id,
        owner_id: userId,
      },
      {
        name: updateTagDto.name,
      },
    );
  }

  async removeTag(userId: number, tagId: number) {
    return await this.tagRepository.delete({
      id: tagId,
      owner_id: userId,
    });
  }
}
