import { createHmac, randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { doubleCsrf, type DoubleCsrfUtilities } from 'csrf-csrf';
import type { CookieOptions, NextFunction, Request, Response } from 'express';
import { BusinessException } from '../exceptions/business.exception';

const SESSION_COOKIE_PATTERN = /^[a-f0-9]{64}$/;
const TOKEN_COOKIE_PATTERN = /^[a-f0-9]{64}\.[a-f0-9]{64}$/;

@Injectable()
export class CsrfService {
  private readonly sessionCookieName: string;
  private readonly tokenCookieName: string;
  private readonly cookieOptions: CookieOptions;
  private readonly csrf: DoubleCsrfUtilities;

  constructor(configService: ConfigService) {
    const secure =
      configService.get<boolean>('CSRF_COOKIE_SECURE') ??
      configService.get<string>('NODE_ENV') === 'production';
    const prefix = secure ? '__Host-' : '';
    this.sessionCookieName = `${prefix}image_stack_csrf_session`;
    this.tokenCookieName = `${prefix}image_stack_csrf`;
    this.cookieOptions = {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    };

    const secret =
      configService.get<string>('CSRF_SECRET') ||
      createHmac('sha256', configService.getOrThrow<string>('JWT_SECRET'))
        .update('imageStack:csrf:v1')
        .digest('hex');

    this.csrf = doubleCsrf({
      getSecret: () => secret,
      getSessionIdentifier: (request) =>
        request.cookies[this.sessionCookieName] ?? '',
      getCsrfTokenFromRequest: (request) => request.get('x-csrf-token'),
      cookieName: this.tokenCookieName,
      cookieOptions: this.cookieOptions,
      size: 32,
      hmacAlgorithm: 'sha256',
      csrfTokenDelimiter: '.',
      ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    });
  }

  readonly protect = (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    this.hydrateCookies(request);
    this.csrf.doubleCsrfProtection(request, response, (error?: unknown) => {
      if (error === this.csrf.invalidCsrfTokenError) {
        next(
          new BusinessException(
            'CSRF_TOKEN_INVALID',
            'CSRF 校验失败，请重新获取安全令牌后重试',
            undefined,
            HttpStatus.FORBIDDEN,
          ),
        );
        return;
      }
      next(error);
    });
  };

  issueToken(request: Request, response: Response) {
    this.hydrateCookies(request);
    const sessionId =
      request.cookies[this.sessionCookieName] ||
      randomBytes(32).toString('hex');
    request.cookies[this.sessionCookieName] = sessionId;
    response.cookie(this.sessionCookieName, sessionId, this.cookieOptions);
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    response.setHeader('Pragma', 'no-cache');
    response.vary('Cookie');

    let csrfToken: string;
    try {
      csrfToken = this.csrf.generateCsrfToken(request, response, {
        overwrite: !request.cookies[this.tokenCookieName],
        validateOnReuse: true,
      });
    } catch (error) {
      if (error !== this.csrf.invalidCsrfTokenError) throw error;
      csrfToken = this.csrf.generateCsrfToken(request, response, {
        overwrite: true,
      });
    }

    return { csrfToken };
  }

  private hydrateCookies(request: Request) {
    request.cookies = {
      ...request.cookies,
      [this.sessionCookieName]: this.readCookie(
        request,
        this.sessionCookieName,
        SESSION_COOKIE_PATTERN,
      ),
      [this.tokenCookieName]: this.readCookie(
        request,
        this.tokenCookieName,
        TOKEN_COOKIE_PATTERN,
      ),
    };
  }

  private readCookie(request: Request, name: string, pattern: RegExp) {
    const matches = (request.headers.cookie ?? '')
      .split(';')
      .map((cookie) => cookie.trim())
      .filter((cookie) => cookie.startsWith(`${name}=`));
    if (matches.length !== 1) return undefined;
    const value = matches[0].slice(name.length + 1);
    return pattern.test(value) ? value : undefined;
  }
}
