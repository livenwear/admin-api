import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const PERSON_NAME = /^[\u0600-\u06FFa-zA-Z\u200c\s]+$/;

export class CustomerProfileUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'نام حداقل ۲ حرف باشد' })
  @MaxLength(30, { message: 'نام حداکثر ۳۰ حرف است' })
  @Matches(PERSON_NAME, { message: 'نام فقط حروف فارسی یا انگلیسی باشد' })
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'نام خانوادگی حداقل ۲ حرف باشد' })
  @MaxLength(40, { message: 'نام خانوادگی حداکثر ۴۰ حرف است' })
  @Matches(PERSON_NAME, {
    message: 'نام خانوادگی فقط حروف فارسی یا انگلیسی باشد',
  })
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value != null && String(value).trim() !== '')
  @IsString()
  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  @MaxLength(80, { message: 'ایمیل حداکثر ۸۰ نویسه است' })
  email?: string | null;
}
