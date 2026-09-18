import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class PlaceOrderDto {
  @ApiProperty()
  @IsUUID()
  addressUuid: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9\u0600-\u06ff_-]{0,39}$/i)
  shippingMethodCode: string;

  @ApiProperty({ enum: ['online', 'bank_transfer'] })
  @IsIn(['online', 'bank_transfer'])
  paymentMethod: 'online' | 'bank_transfer';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class QuoteShippingDto {
  @ApiProperty()
  @IsUUID()
  addressUuid: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9\u0600-\u06ff_-]{0,39}$/i)
  shippingMethodCode: string;
}

export class SimulatorCompleteDto {
  @ApiProperty({ enum: ['success', 'fail'] })
  @IsIn(['success', 'fail'])
  result: 'success' | 'fail';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  tokenExp: number;
}

export class SubmitReceiptDto {
  @ApiProperty()
  @IsUUID()
  fileUuid: string;
}
