import { Type } from "class-transformer";
import { IsArray, IsString, ValidateNested } from "class-validator";

export class ConfirmUploadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PictureInfo)
  pictures: PictureInfo[];
}

class PictureInfo {
  @IsString()
  fullName: string;
  @IsString()
  originname: string;

}