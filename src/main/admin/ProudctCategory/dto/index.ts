import { IsString, IsNumber, IsOptional, IsBoolean, IsArray, IsUUID, IsEnum, Min, MaxLength, IsPositive, IsInt, IsNotEmpty, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class BaseResponseDto<T> {
  @IsArray()
  data: T | T[];

  @Type(() => Object)
  meta: {
    status: number;
    message: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export class CreateProductDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @MaxLength(100)
  sku: string;

  @IsNumber()
  @IsPositive()
  regularPrice: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  salePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsBoolean()
  isInStock?: boolean;

  @IsOptional()
  @IsBoolean()
  allowBackorders?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  primaryImageUrl?: string;

  @IsOptional()
  @IsArray()
  additionalImages?: string[];

  @IsOptional()
  @IsNumber()
  @IsPositive()
  weight?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  length?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  width?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  height?: number;

  @IsOptional()
  @IsBoolean()
  isDigital?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  downloadUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsString()
  metaKeywords?: string;

  @IsOptional()
  @IsEnum(['active', 'draft', 'archived'])
  status?: 'active' | 'draft' | 'archived';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brandName?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  categoryUuids?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  tagUuids?: string[];
}

export class UpdateProductDto extends CreateProductDto {
  @IsUUID()
  uuid: string;
}



export class CreateProductCategoryDto {
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  primaryImageUrl?: string;

  @IsOptional()
  @IsUUID()
  parentCategoryUuid?: string;

  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  metaTitle: string;

  @IsString()
  @IsNotEmpty()
  metaDescription: string;

  @IsString()
  @IsNotEmpty()
  metaKeywords: string;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  displayOrder: number;

  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;

  @IsObject()
  @IsNotEmpty()
  metadata: Record<string, any>;
}


export class UpdateProductCategoryDto extends CreateProductCategoryDto {
  @IsUUID()
  uuid: string;
}


export class CreateCategoryAttributeDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsUUID()
  categoryUuid: string;

  @IsUUID()
  parentCategory: string;



  @IsOptional()
  @IsEnum(['text', 'select', 'multiselect', 'number', 'boolean'])
  attributeType?: 'text' | 'select' | 'multiselect' | 'number' | 'boolean';

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateCategoryAttributeDto extends CreateCategoryAttributeDto {
  @IsUUID()
  uuid: string;
}

export class CreateTagDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  colorCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTagDto extends CreateTagDto {
  @IsUUID()
  uuid: string;
}

export class PaginationQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
}


export class ProductCategoryQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  primaryImageUrl?: string;

  @IsOptional()
  @IsUUID()
  parentCategoryUuid?: string;

  @IsOptional()
  @IsUUID()
  subCategoryUuid?: string;

  @IsOptional()
  @IsUUID()
  categoryUuid?: string;


  @IsOptional()
  @IsString()
  @MaxLength(255)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsString()
  metaKeywords?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsString()
  metadata?: string;
}