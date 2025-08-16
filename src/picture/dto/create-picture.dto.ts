import { PICTURE_STATUS } from 'src/constants';
import { User } from 'src/user/entities/user.entity';

export class CreatePictureDto {
  name: string;
  size: number;
  uri: string;
  bucketName: string;
  owner: User;
  status: PICTURE_STATUS;
}
