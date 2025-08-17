// Redis
export const REDIS_CLIENT = 'REDIS_CLIENT';
export const MINIO_CLIENT = 'MINIO_CLIENT';
export const EMAIL_CLIENT = 'EMAIL_CLIENT';

// login and permissions
export const UN_NEED_LOGIN = 'UN_NEED_LOGIN';
export const NEED_PERMISSIONS = 'NEED_PERMISSIONS';
export const IS_EXPOSE = 'IS_EXPOSE';

// permissions
export enum PERMISSIONS {
  UPLOAD = '1001',
  MODIFIER = '1002',
  VIEW = '1003',
  DELETE = '1004',
}

export enum CAPTCHA_TYPE {
  LOGIN = 'login',
  REGISTER = 'register',
  FORGET = 'forget',
}

export enum PICTURE_STATUS {
  DELETE = 1,
  NORMAL = 2,
  TRASH = 3,
}
