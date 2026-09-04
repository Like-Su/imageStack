export const RedisKey = {
  // 验证码
  captcha: (captchaId: string) => `captcha:${captchaId}`,
  // 激活 token -> email
  activate: (token: string) => `auth:activate:${token}`,
  // refresh token 白名单，存在才允许换 token
  refresh: (userId: string, jti: string) => `auth:refresh:${userId}:${jti}`,
  // 登出后的 access token 黑名单
  blacklist: (jti: string) => `auth:blacklist:${jti}`,
  // 用户权限快照缓存
  authUser: (userId: string) => `auth:user:${userId}`,
  // 忘记密码
  forgetPassword: (email: string) => `auth:forget:${email}`,
} as const;
