import { PartialType } from '@nestjs/mapped-types';
import { AssetIdsDto } from '../../assets/dto/asset-ids.dto';

export class QueueRecognitionDto extends PartialType(AssetIdsDto, {
  skipNullProperties: false,
}) {}
