import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import {
  AdminLoginDto,
  LogoutDto,
  RefreshTokenDto,
} from './dto/admin-auth.dto';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Admin / super-admin login (email + password)' })
  login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    return this.adminAuthService.login(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh admin access token' })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.adminAuthService.refresh(dto.refreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke admin refresh token' })
  logout(@Body() dto: LogoutDto) {
    return this.adminAuthService.logout(dto.refreshToken);
  }
}
