import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PostStatus } from 'src/entities';

export class AdminBlogListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn(Object.values(PostStatus))
  status?: PostStatus;

  @IsOptional()
  @IsUUID()
  categoryUuid?: string;

  @IsOptional()
  @IsUUID()
  tagUuid?: string;
}

export class AdminBlogPostDto {
  @IsString()
  @MinLength(2)
  @MaxLength(220)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  slug?: string;

  @IsString()
  @MinLength(1)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  excerpt?: string;

  @IsOptional()
  @IsIn(Object.values(PostStatus))
  status?: PostStatus;

  @IsOptional()
  @IsDateString()
  publishedAt?: string | null;

  @IsOptional()
  @IsUUID()
  featuredImageUuid?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  featuredImageAlt?: string | null;

  @IsOptional()
  @IsUUID()
  ogImageUuid?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  metaTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaKeywords?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  canonicalUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryUuids?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagUuids?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productUuids?: string[];

  /** Storefront catalog categories — auto product shelves on the article */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  shopCategoryUuids?: string[];
}

export class AdminUpdateBlogPostDto extends PartialType(AdminBlogPostDto) {}

export class AdminBlogTaxonomyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  metaTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescription?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsUUID()
  imageUuid?: string | null;
}

export class AdminUpdateBlogTaxonomyDto extends PartialType(
  AdminBlogTaxonomyDto,
) {}

export class PublicMagListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 12;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  tag?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
