import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UpdateTagDto {
  @IsNumber()
  @IsNotEmpty()
  id: number;
  @IsString()
  @IsNotEmpty()
  name: string;
}
