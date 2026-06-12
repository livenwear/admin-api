import { Transform } from 'class-transformer';
import { IsBooleanString, IsEmail, IsEnum, IsNotEmpty, IsNumberString, IsOptional, IsString, Length } from 'class-validator';
import { UserRole } from 'src/common/type';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 255)
  password: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @Length(2, 50)
  firstName?: string;

  @IsString()
  @IsOptional()
  @Length(2, 50)
  lastName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @Length(6, 255)
  password?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}


export class GetUsersDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBooleanString()
  isVerified?: string;

  @IsOptional()
  @IsBooleanString()
  isActive?: string;

  @IsOptional()
  @IsBooleanString()
  twoFactorEnabled?: string;

  @IsOptional()
  @IsString()
  phone?: string;

 

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';


  @IsOptional()
  @IsNumberString()
  @Transform(({ value }) => value ?? '1')
  page?: string;

  @IsOptional()
  @IsNumberString()
  @Transform(({ value }) => value ?? '10')
  limit?: string;
}