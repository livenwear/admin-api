import { IsEmail, IsNotEmpty, MinLength, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignUpDto {
  @ApiProperty({ description: 'User email address', type: String })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password for the user', type: String, minLength: 6 })
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

export class SignInDto {
  @ApiProperty({ description: 'User email address', type: String })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password for the user', type: String })
  @IsNotEmpty()
  password: string;
}

export class TwoFactorDto {
  @ApiProperty({ description: 'User email address', type: String })
  @IsEmail()
  email: string;

  @ApiProperty({ description: '2FA code sent to user', type: String })
  @IsNotEmpty()
  code: string;
}

export class EnableTwoFactorDto {
  @ApiProperty({ description: 'User ID to enable 2FA for', type: Number })
  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @ApiProperty({ description: 'Verification code for enabling 2FA', type: String })
  @IsNotEmpty()
  code: string;
}
