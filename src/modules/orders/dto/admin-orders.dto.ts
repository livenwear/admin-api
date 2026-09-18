import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { OrderStatus, PaymentStatus } from 'src/entities';

export class ShippingMethodAdminDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(40)
  code: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  title: string;

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fee: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tehranFee?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  otherCitiesFee?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  useRegionPricing?: boolean;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  etaText: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID()
  logoFileUuid?: string | null;

  /** Resolved URL from GET — accepted on PATCH but stripped before persist */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  logoUrl?: string | null;
}

export class CardTransferAdminDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty()
  @IsString()
  @MaxLength(40)
  cardNumber: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  cardHolderName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  bankName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(800)
  instructions: string;
}

export class OnlineGatewayAdminDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  /** Echoed from GET — only simulator is stored */
  @ApiPropertyOptional({ enum: ['simulator'] })
  @IsOptional()
  @IsIn(['simulator'])
  provider?: 'simulator';
}

export class UpdateCommerceSettingsDto {
  @ApiPropertyOptional({ type: [ShippingMethodAdminDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingMethodAdminDto)
  shippingMethods?: ShippingMethodAdminDto[];

  @ApiPropertyOptional({ type: CardTransferAdminDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CardTransferAdminDto)
  cardTransfer?: CardTransferAdminDto;

  @ApiPropertyOptional({ type: OnlineGatewayAdminDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OnlineGatewayAdminDto)
  onlineGateway?: OnlineGatewayAdminDto;
}

export class AdminListOrdersQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsIn(Object.values(OrderStatus))
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsIn(Object.values(PaymentStatus))
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['online', 'bank_transfer', 'card', 'cash_on_delivery', 'wallet'])
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['true', 'false'])
  awaitingCardReview?: string;
}

export class AdminRejectPaymentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class AdminUpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsIn(Object.values(OrderStatus))
  status: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  trackingNumber?: string;
}
