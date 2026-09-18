import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class AdminBannerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fileUuid?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkUrl?: string | null;

  @ApiPropertyOptional({ example: 'top_promo' })
  @IsOptional()
  @IsString()
  position?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startsAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endsAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminUpdateBannerDto extends PartialType(AdminBannerDto) {}

export class AdminSliderItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  uuid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subtitle?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fileUuid?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buttonText?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  textColor?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  overlayColor?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminSliderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'homepage-hero' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [AdminSliderItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminSliderItemDto)
  items?: AdminSliderItemDto[];
}

export class AdminUpdateSliderDto extends PartialType(AdminSliderDto) {}

export class AdminPromoCardItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  uuid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsUUID()
  fileUuid?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Internal path (/amazing) or external (https://t.me/…)',
  })
  @IsOptional()
  @IsString()
  linkUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminPromoCardRowDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Interleave order 1–5 (first gap, second gap, …)',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  slot: number;

  @ApiPropertyOptional({
    description: 'How many cards to show (1–5)',
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  visibleCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [AdminPromoCardItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminPromoCardItemDto)
  cards?: AdminPromoCardItemDto[];
}

export class AdminUpdatePromoCardRowDto extends PartialType(
  AdminPromoCardRowDto,
) {}

export class CmsListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  position?: string;
}
