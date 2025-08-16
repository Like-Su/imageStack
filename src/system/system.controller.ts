import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { SystemService } from './system.service';
import { CreateSystemDto } from './dto/create-system.dto';
import { UpdateSystemDto } from './dto/update-system.dto';
import * as nodeDiskInfo from 'node-disk-info';
import { UnNeedLogin } from 'src/interface.guard.decorator';
import { distinct } from 'rxjs';

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}
  @Get('disk_info')
  async disk_info(@Query('dir_name') dirName: string) {
    return (await this.systemService.getDiskInfo()).filter((disk) => {
      return disk.dirName.toUpperCase() === dirName.toUpperCase();
    });
  }
}
