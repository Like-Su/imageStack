import { IsNumber, IsString, IsNotEmpty, IsBoolean } from 'class-validator';

export class ConfirmUploadDto {
  @IsString()
  @IsNotEmpty()
  ext: string;
  @IsString()
  @IsNotEmpty()
  fullName: string;
  @IsString()
  @IsNotEmpty()
  fileName: string;
  @IsNumber()
  @IsNotEmpty()
  now: number;
  @IsBoolean()
  @IsNotEmpty()
  _is_suc: boolean;
}
