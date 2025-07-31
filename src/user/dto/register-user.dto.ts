import { IsNotEmpty } from 'class-validator';
import { LoginUserDto, PasswordValidators } from './login-user.dto';

export class RegisterUserDto extends LoginUserDto {
  @IsNotEmpty({
    message: '昵称不能为空',
  })
  nickname: string;

  @PasswordValidators()
  enter_password: string;
}
