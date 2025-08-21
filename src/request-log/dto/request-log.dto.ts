import { IsJSON, IsNumber, IsString } from 'class-validator';

export class RequestLogDto {
  @IsNumber()
  userId: number;
  @IsString()
  method: string;
  @IsString()
  url: string;
  @IsJSON()
  params: Record<string, any>;
  @IsString()
  userAgent: string;
  @IsNumber()
  statusCode: number;
  @IsString()
  duration: number;
  @IsString()
  errorMessage: string;
  @IsString()
  ip: string;
}
