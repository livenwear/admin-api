import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AdminListReviewsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'true | false' })
  @IsOptional()
  @IsIn(['true', 'false', ''])
  isApproved?: string;

  @ApiPropertyOptional({ description: 'Filter reviews without admin reply' })
  @IsOptional()
  @IsIn(['true', 'false', ''])
  unanswered?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productUuid?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'updatedAt', 'rating', 'repliedAt'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'rating', 'repliedAt'])
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}

export class AdminUpdateReviewDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;

  @ApiPropertyOptional({ description: 'Set/clear admin reply' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminReply?: string | null;
}

export class AdminReplyReviewDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  body: string;
}
