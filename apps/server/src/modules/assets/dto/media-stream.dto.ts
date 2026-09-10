import { IsIn } from 'class-validator';

export class MediaStreamDto {
  @IsIn(['hls', 'original', 'download'])
  kind: 'hls' | 'original' | 'download';
}
