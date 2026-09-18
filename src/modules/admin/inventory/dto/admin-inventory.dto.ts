import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsOptional,
} from 'class-validator';

export class AdminListInventoryQueryDto {
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
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    enum: ['all', 'in_stock', 'low', 'out'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'in_stock', 'low', 'out'])
  stockStatus?: 'all' | 'in_stock' | 'low' | 'out' = 'all';

  @ApiPropertyOptional({ description: 'Low stock threshold', default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  lowThreshold?: number = 5;

  @ApiPropertyOptional({ default: 'updatedAt' })
  @IsOptional()
  @IsIn(['updatedAt', 'quantity', 'name', 'sku'])
  sortBy?: 'updatedAt' | 'quantity' | 'name' | 'sku' = 'updatedAt';

  @ApiPropertyOptional({ default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class AdminInventoryAdjustDto {
  @ApiProperty({
    description: 'Positive to increase, negative to decrease',
    example: 5,
  })
  @Type(() => Number)
  @IsInt()
  delta: number;

  @ApiProperty({ description: 'توضیح اجباری برای لاگ انبار' })
  @IsString()
  @MinLength(3, { message: 'یادداشت حداقل ۳ کاراکتر باشد' })
  @MaxLength(400)
  note: string;
}

export class AdminInventorySetDto {
  @ApiProperty({ example: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiProperty({ description: 'توضیح اجباری برای لاگ انبار' })
  @IsString()
  @MinLength(3, { message: 'یادداشت حداقل ۳ کاراکتر باشد' })
  @MaxLength(400)
  note: string;
}

export class AdminInventoryOutOfStockDto {
  @ApiProperty({ description: 'توضیح اجباری برای لاگ انبار' })
  @IsString()
  @MinLength(3, { message: 'یادداشت حداقل ۳ کاراکتر باشد' })
  @MaxLength(400)
  note: string;
}
