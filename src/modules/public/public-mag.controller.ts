import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PublicMagListQueryDto } from '../admin/blog/dto/blog.dto';
import { PublicMagService } from './public-mag.service';

class FeaturedQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  limit?: number = 4;
}

@ApiTags('public-mag')
@Controller('public/mag')
export class PublicMagController {
  constructor(private readonly magService: PublicMagService) {}

  @Get()
  @ApiOperation({ summary: 'List published magazine articles' })
  list(@Query() query: PublicMagListQueryDto) {
    return this.magService.list(query);
  }

  @Get('featured')
  featured(@Query() query: FeaturedQueryDto) {
    return this.magService.featured(query.limit);
  }

  @Get('categories')
  categories() {
    return this.magService.listCategories();
  }

  @Get('tags')
  tags() {
    return this.magService.listTags();
  }

  @Get('sitemap')
  sitemap() {
    return this.magService.listSlugsForSitemap();
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.magService.bySlug(slug);
  }
}
