import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CartAddDto {
  @ApiPropertyOptional({ description: 'Product variant UUID' })
  @ValidateIf((o: CartAddDto) => !o.productUuid)
  @IsUUID()
  variantUuid?: string;

  @ApiPropertyOptional({
    description: 'Product UUID — uses default/active variant when no variantUuid',
  })
  @ValidateIf((o: CartAddDto) => !o.variantUuid)
  @IsUUID()
  productUuid?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;
}

export class CartSetQtyDto {
  @ApiPropertyOptional({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99)
  quantity: number;
}
