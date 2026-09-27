import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Torob Product API v3 request body.
 * Exactly one mode must be used — validated in the service.
 */
export class TorobProductsRequestDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  page_urls?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  page_uniques?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
