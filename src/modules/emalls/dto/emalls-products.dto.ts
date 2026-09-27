import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

function toBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === '1' || value === 'true' || value === 'True') return true;
  if (value === '0' || value === 'false' || value === 'False') return false;
  return undefined;
}

/** Emalls official plugin request params (body and/or query). */
export class EmallsProductsRequestDto {
  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** Official plugin flag; we expose product-level rows (not WC variations). */
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  variation?: boolean;
}
