export class UpdateUserVo {
  id: number;
  email: string;
  nickname: string;
  picture?: string;
  password: string;
  roles: string[];
  permissions: string[];
  status: number;
  createTime: Date;
  updateTime: Date;
}
