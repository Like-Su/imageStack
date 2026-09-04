import { UserStatus } from 'src/prisma/generated/prisma/enums';

export class CreateUserDto {
  username: string;
  email: string;
  password: string;
  status: UserStatus;
}

export class DeleteUserDto {
  id: string;
}
