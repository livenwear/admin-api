import { IsDateString, IsEnum, IsInt, IsNumberString, IsOptional, IsString, IsUrl, Matches, Max, Min } from 'class-validator/types';
import { AbstractDto } from 'src/common/dto/abstract.dto';
import { BlogStatus } from 'src/constant';

export class GetBlogsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsEnum(['ASC', 'DESC'], { message: 'sortOrder must be ASC or DESC' })
  sortOrder?: 'ASC' | 'DESC';

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  status?: string; // Comma-separated list, e.g., "draft,published"

  @IsOptional()
  @IsNumberString()
  authorId?: string;

  @IsOptional()
  @IsDateString()
  publishedAtFrom?: string;

  @IsOptional()
  @IsDateString()
  publishedAtTo?: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsString()
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsString()
  metaKeywords?: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsOptional()
  @IsUrl()
  featuredImage?: string;

  @IsOptional()
  @IsUrl()
  canonicalUrl?: string;

  @IsOptional()
  @Matches(/^[0-9a-fA-F-]{36}(?:,[0-9a-fA-F-]{36})*$/, { message: 'categoryIds must be a valid UUID or comma-separated UUIDs' })
  categoryIds?: string; // Single UUID or comma-separated UUIDs

  @IsOptional()
  @Matches(/^[0-9a-fA-F-]{36}(?:,[0-9a-fA-F-]{36})*$/, { message: 'tagIds must be a valid UUID or comma-separated UUIDs' })
  tagIds?: string; // Single UUID or comma-separated UUIDs
}
export class GetBlogsResponseDto {
  data: FetchAllBlogsDto[];
  statusCode: number;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    totalItem: number;
  };
}

export class FetchAllBlogsDto extends AbstractDto {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  featuredImage?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  status: BlogStatus;
  publishedAt?: Date;
  priority: number;
  canonicalUrl?: string;
  author: {
    id: number | string;
    username: string;
  };
  categories: {
    id: string;
    title: string;
    slug: string;
  }[];
  tags: {
    id: string;
    title: string; // Assuming Tag has a 'title' field; adjust if it's 'name' or similar
  }[];
}