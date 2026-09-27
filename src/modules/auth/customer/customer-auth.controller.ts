import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CustomerAuthService } from './customer-auth.service';
import {
  CustomerForgotPasswordRequestDto,
  CustomerForgotPasswordResetDto,
  CustomerLogoutDto,
  CustomerOtpRequestDto,
  CustomerOtpVerifyDto,
  CustomerPasswordLoginDto,
  CustomerRefreshDto,
  CustomerRegisterDto,
  CustomerImpersonateExchangeDto,
} from './dto/customer-auth.dto';

@ApiTags('customer-auth')
@Controller('customer/auth')
export class CustomerAuthController {
  constructor(private readonly customerAuthService: CustomerAuthService) {}

  @Post('register')
  @ApiOperation({
    summary:
      'Start registration (inactive until OTP). Returns expiresIn — no tokens.',
  })
  register(@Body() dto: CustomerRegisterDto) {
    return this.customerAuthService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Customer login with phone + password' })
  login(@Body() dto: CustomerPasswordLoginDto, @Req() req: Request) {
    return this.customerAuthService.loginWithPassword(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Post('otp/request')
  @ApiOperation({
    summary: 'Request SMS OTP (stub — OTP is logged on server)',
  })
  requestOtp(@Body() dto: CustomerOtpRequestDto) {
    return this.customerAuthService.requestOtp(dto);
  }

  @Post('otp/verify')
  @ApiOperation({
    summary: 'Verify SMS OTP and login/register',
  })
  verifyOtp(@Body() dto: CustomerOtpVerifyDto, @Req() req: Request) {
    return this.customerAuthService.verifyOtp(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Post('forgot-password/request')
  @ApiOperation({
    summary: 'Request OTP to reset password (no user enumeration)',
  })
  forgotPasswordRequest(@Body() dto: CustomerForgotPasswordRequestDto) {
    return this.customerAuthService.forgotPasswordRequest(dto);
  }

  @Post('forgot-password/reset')
  @ApiOperation({
    summary: 'Verify OTP and set a new password (returns session)',
  })
  forgotPasswordReset(
    @Body() dto: CustomerForgotPasswordResetDto,
    @Req() req: Request,
  ) {
    return this.customerAuthService.forgotPasswordReset(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh customer access token' })
  refresh(@Body() dto: CustomerRefreshDto, @Req() req: Request) {
    return this.customerAuthService.refresh(dto.refreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke customer refresh token' })
  logout(@Body() dto: CustomerLogoutDto) {
    return this.customerAuthService.logout(dto.refreshToken);
  }

  @Post('impersonate/exchange')
  @ApiOperation({
    summary:
      'Exchange one-time admin impersonation code for a customer session',
  })
  exchangeImpersonation(
    @Body() dto: CustomerImpersonateExchangeDto,
    @Req() req: Request,
  ) {
    return this.customerAuthService.exchangeImpersonation(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }
}
