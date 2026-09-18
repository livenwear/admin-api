import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

const PHONE_REGEX = /^09\d{9}$/;

export class CustomerRegisterDto {
  @ApiProperty({ example: '09121234567' })
  @IsString()
  @Matches(PHONE_REGEX, { message: 'phone must be a valid Iranian mobile' })
  phone: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
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
  @Matches(PHONE_REGEX, { message: 'phone must be a valid Iranian mobile' })
  phone: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

export class CustomerOtpRequestDto {
  @ApiProperty({ example: '09121234567' })
  @IsString()
  @Matches(PHONE_REGEX, { message: 'phone must be a valid Iranian mobile' })
  phone: string;

  @ApiProperty({
    enum: ['login', 'register'],
    description: 'login = existing user, register = new user',
  })
  @IsIn(['login', 'register'])
  purpose: 'login' | 'register';
}

export class CustomerOtpVerifyDto {
  @ApiProperty({ example: '09121234567' })
  @IsString()
  @Matches(PHONE_REGEX)
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
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

