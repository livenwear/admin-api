import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PHONE_REGEX = /^09\d{9}$/;

export class CustomerRegisterDto {
  @ApiProperty({ example: '09121234567' })
  @IsString()
  @Matches(PHONE_REGEX, {
    message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود',
  })
  phone: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'رمز عبور حداقل ۶ کاراکتر باشد' })
  password: string;

  @ApiPropertyOptional({ example: 'Ali' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Rezaei' })
  @IsOptional()
  @IsString()
  lastName?: string;
}

export class CustomerPasswordLoginDto {
  @ApiProperty({ example: '09121234567' })
  @IsString()
  @Matches(PHONE_REGEX, {
    message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود',
  })
  phone: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'رمز عبور را وارد کنید' })
  @MinLength(6, { message: 'رمز عبور حداقل ۶ کاراکتر باشد' })
  password: string;
}

export class CustomerOtpRequestDto {
  @ApiProperty({ example: '09121234567' })
  @IsString()
  @Matches(PHONE_REGEX, {
    message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود',
  })
  phone: string;
}

export class CustomerOtpVerifyDto {
  @ApiProperty({ example: '09121234567' })
  @IsString()
  @Matches(PHONE_REGEX, {
    message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود',
  })
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty({ message: 'کد تأیید را وارد کنید' })
  @Matches(/^\d{6}$/, { message: 'کد تأیید باید ۶ رقم باشد' })
  @MaxLength(6)
  code: string;

  @ApiPropertyOptional({ example: 'Ali' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Rezaei' })
  @IsOptional()
  @IsString()
  lastName?: string;
}

export class CustomerRefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class CustomerLogoutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class CustomerImpersonateExchangeDto {
  @ApiProperty({ description: 'One-time impersonation code from admin panel' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class CustomerForgotPasswordRequestDto {
  @ApiProperty({ example: '09121234567' })
  @IsString()
  @Matches(PHONE_REGEX, {
    message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود',
  })
  phone: string;
}

export class CustomerForgotPasswordResetDto {
  @ApiProperty({ example: '09121234567' })
  @IsString()
  @Matches(PHONE_REGEX, {
    message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود',
  })
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty({ message: 'کد تأیید را وارد کنید' })
  @Matches(/^\d{6}$/, { message: 'کد تأیید باید ۶ رقم باشد' })
  @MaxLength(6)
  code: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'رمز عبور حداقل ۶ کاراکتر باشد' })
  password: string;
}

