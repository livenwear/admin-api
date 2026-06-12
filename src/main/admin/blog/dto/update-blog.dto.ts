import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Length, Max, Min, IsUUID, Matches } from 'class-validator/types';
import { AbstractDto } from 'src/common/dto/abstract.dto';
import { BlogStatus } from 'src/constant';
import { CreateSingleBlogDto } from './create-blog.dto';

export class UpdateBlogDto {
  @IsString()
  @Length(1, 255)
  title: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Invalid slug format: must be lowercase alphanumeric with optional hyphens, no spaces' })
  @Length(1, 255)
  slug: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  excerpt?: string;

  @IsOptional()
  @IsUrl()
  @Length(0, 255)
  featuredImage?: string;

  @IsOptional()
  @IsString()
  @Length(0, 160)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @Length(0, 160)
  metaDescription?: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  metaKeywords?: string;

  @IsEnum(BlogStatus)
  status: BlogStatus;

  @IsOptional()
  @IsString() // Assuming publishedAt is sent as ISO string
  publishedAt?: Date;

  @IsInt()
  @Min(0)
  @Max(100)
  priority: number;

  @IsOptional()
  @IsUrl()
  @Length(0, 255)
  canonicalUrl?: string;
}

export class AddCategoryDto {
  @IsUUID('4')
  categoryId: string;
}

export class RemoveCategoryDto {
  @IsUUID('4')
  categoryId: string;
}

export class UpdateBlogResponseDto {
  data: CreateSingleBlogDto;
  statusCode: number;
}