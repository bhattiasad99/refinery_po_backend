import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

function parseCookieValue(cookieHeader: string | undefined, name: string): string {
  if (!cookieHeader) {
    return '';
  }

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName === name) {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return '';
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiExcludeEndpoint()
  @Post('login')
  async login(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    credentials: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(credentials);
    this.setRefreshCookie(response, result.refreshToken);
    return {
      body: {
        accessToken: result.accessToken,
        user: result.user,
      },
      message: 'Login successful',
    };
  }

  @ApiOperation({ summary: 'Refresh access token using refresh cookie' })
  @ApiCookieAuth('refresh-cookie')
  @ApiOkResponse({ description: 'Refresh successful' })
  @ApiUnauthorizedResponse({ description: 'Refresh token is missing/invalid' })
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookieName = this.authService.getRefreshCookieName();
    const refreshToken = parseCookieValue(request.headers.cookie, cookieName);
    const result = await this.authService.refresh(refreshToken);

    this.setRefreshCookie(response, result.refreshToken);
    return {
      body: {
        accessToken: result.accessToken,
        user: result.user,
      },
      message: 'Refresh successful',
    };
  }

  @ApiOperation({ summary: 'Logout current session and clear refresh cookie' })
  @ApiCookieAuth('refresh-cookie')
  @ApiOkResponse({ description: 'Logout successful' })
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookieName = this.authService.getRefreshCookieName();
    const refreshToken = parseCookieValue(request.headers.cookie, cookieName);
    const result = await this.authService.logout(refreshToken || null);

    this.clearRefreshCookie(response);
    return {
      body: result,
      message: 'Logout successful',
    };
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(this.authService.getRefreshCookieName(), refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: this.authService.getRefreshCookieMaxAgeMs(),
    });
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(this.authService.getRefreshCookieName(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }
}
