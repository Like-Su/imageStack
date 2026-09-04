export interface User {
  id: string;
  username: string;
  email: string;
  roles: string;
  roleCode: string;
  permissions: string[];
}

export interface RequestUser extends User {
  tokenJti: string;
  tokenExp: number;
  sessionId?: string;
  sessionVersion?: number;
}

export type TokenType = 'access' | 'refresh';

// JWT 内容
export interface JwtPayload {
  sub: string;
  type: TokenType;
  jti: string;
  sid?: string;
  sv?: number;
  iat?: number;
  exp?: number;
}
