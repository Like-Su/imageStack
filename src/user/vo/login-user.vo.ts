import { RefreshToken } from './refresh-token.vo';

export class UserInfo {
  id: number;
  nickname: string;
  email: string;
  picture: string;
  status: number;
  createTime: number;
  updateTime: number;
  roles: string[];
  permissions: string[];
}

export class LoginUserVo extends RefreshToken {
  userInfo: UserInfo;
  access_token: string;
  refresh_token: string;
}
