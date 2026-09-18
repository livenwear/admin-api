import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AddressCreateDto {
  @ApiProperty({ example: 'تهران' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  province: string;

  @ApiProperty({ example: 'تهران' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  city: string;

  @ApiProperty({ example: 'خیابان ولیعصر، کوچه بهار، پلاک نزدیک مترو' })
  @IsString()
  @MinLength(5)
  @MaxLength(400)
  addressLine1: string;

  @ApiProperty({ example: '12' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  plaque: string;

  @ApiPropertyOptional({ example: '3' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiProperty({ example: '1234567890', description: 'کد پستی ۱۰ رقمی' })
  @IsString()
  @Matches(/^\d{10}$/, { message: 'کد پستی باید دقیقاً ۱۰ رقم باشد' })
  postalCode: string;

  @ApiPropertyOptional({ example: 'منزل' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  title?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class AddressUpdateDto extends PartialType(AddressCreateDto) {}
