import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class GenerateShortUrlDto {
  @IsString()
  @IsNotEmpty()
  longUrl: string;

  @IsNumber()
  @IsNotEmpty()
  imageId: number;
}
