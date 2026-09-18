import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductStatus, ProductType } from 'src/entities';

export class ProductSpecDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  displayOrder?: number;
}

export class ProductLabelDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  colorCode?: string | null;

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

export class ProductRelatedDto {
  @ApiProperty()
  @IsUUID()
  productUuid: string;

  @ApiPropertyOptional({
    enum: ['related', 'upsell', 'cross_sell', 'accessory'],
    default: 'related',
  })
  @IsOptional()
  @IsString()
  relationType?: string;
}

export class ProductFileAttachDto {
  @ApiProperty()
  @IsUUID()
  fileUuid: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  displayOrder?: number;
}

export class ProductVariantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  uuid?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: 890000 })
  @Type(() => Number)
  @IsNumber()
  price: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  compareAtPrice?: number | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attributeValueUuids?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weight?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  length?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  width?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  height?: number | null;

  @ApiPropertyOptional({ description: 'Stock qty in default warehouse' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity?: number;
}

export class ProductImageDto {
  @ApiProperty()
  @IsUUID()
  fileUuid: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  altText?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  variantUuid?: string | null;
}

export class ProductImageReorderItemDto {
  @ApiProperty()
  @IsUUID()
  uuid: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class ProductImagesReorderDto {
  @ApiProperty({ type: [ProductImageReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageReorderItemDto)
  images: ProductImageReorderItemDto[];
}

export class AdminCreateProductDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ description: 'بررسی تخصصی' })
  @IsOptional()
  @IsString()
  expertReview?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shortDescription?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandUuid?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryUuids?: string[];

  @ApiPropertyOptional({ enum: ProductType })
  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metaTitle?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metaDescription?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metaKeywords?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'شگفت‌انگیز' })
  @IsOptional()
  @IsBoolean()
  isAmazing?: boolean;

  @ApiPropertyOptional({
    description:
      'تگ ناموجود فروش — مستقل از انبار؛ قیمت نمایش داده می‌شود ولی پرداخت مسدود است',
  })
  @IsOptional()
  @IsBoolean()
  isUnavailable?: boolean;

  @ApiPropertyOptional({ description: 'Average rating 0-5' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  ratingAvg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ratingCount?: number;

  @ApiPropertyOptional({ type: [ProductSpecDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductSpecDto)
  specifications?: ProductSpecDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagUuids?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  collectionUuids?: string[];

  @ApiPropertyOptional({ type: [ProductLabelDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductLabelDto)
  labels?: ProductLabelDto[];

  @ApiPropertyOptional({ type: [ProductRelatedDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductRelatedDto)
  relatedProducts?: ProductRelatedDto[];

  @ApiPropertyOptional({ type: [ProductFileAttachDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductFileAttachDto)
  files?: ProductFileAttachDto[];

  @ApiProperty({ type: [ProductVariantDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants: ProductVariantDto[];

  @ApiPropertyOptional({ type: [ProductImageDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];
}

export class AdminUpdateProductDto extends PartialType(AdminCreateProductDto) {}

export class AdminListProductsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandUuid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryUuid?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated attribute value UUIDs',
  })
  @IsOptional()
  @IsString()
  attributeValueUuids?: string;

  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsString()
  isFeatured?: string;

  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsString()
  isAmazing?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'updatedAt', 'name', 'status'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
