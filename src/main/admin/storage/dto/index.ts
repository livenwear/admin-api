import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { StorageNamespace } from 'src/storage';

export class UploadStorageFileDto {
  @ApiProperty({ enum: StorageNamespace, example: StorageNamespace.PRODUCTS })
  @IsEnum(StorageNamespace)
  namespace: StorageNamespace;

  @ApiPropertyOptional({ example: 'product-uuid-here' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  entityId?: string;

  @ApiPropertyOptional({ example: 'featured' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  variant?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'false' || value === false) return false;
    if (value === 'true' || value === true) return true;
    return undefined;
  })
  @IsBoolean()
  generateThumbnails?: boolean;
}

export class ListStorageFilesDto {
  @ApiProperty({ enum: StorageNamespace })
  @IsEnum(StorageNamespace)
  namespace: StorageNamespace;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  entityId?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class DeleteStorageFileDto {
  @ApiProperty({ example: 'liven-images' })
  @IsString()
  bucket: string;

  @ApiProperty({ example: 'products/uuid/file-id.webp' })
  @IsString()
  objectKey: string;
}

export class StorageFileMetadataDto {
  @ApiProperty()
  fileId: string;

  @ApiProperty()
  publicUrl: string;

  @ApiPropertyOptional()
  thumbnails?: Array<{
    preset: string;
    publicUrl: string;
    width: number;
    height: number;
  }>;
}
