import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Length, Max, Min } from "class-validator";
import { AbstractDto } from "src/common/dto/abstract.dto";
import { BlogStatus } from "src/constant";
export class CreateBlogDto {
  @IsString()
  @Length(1, 255)
  title: string;

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

  @IsOptional()
  @IsEnum(BlogStatus)
  status?: BlogStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsUrl()
  @Length(0, 255)
  canonicalUrl?: string;
}

export class CreateBlogResponseDto {
  data: CreateSingleBlogDto;
  statusCode:number
}
export class CreateSingleBlogDto extends AbstractDto  {
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

}


