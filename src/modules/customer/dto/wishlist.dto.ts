import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class WishlistToggleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productUuid: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  variantUuid?: string;
}

export class WishlistAddDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productUuid: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  variantUuid?: string;
}
