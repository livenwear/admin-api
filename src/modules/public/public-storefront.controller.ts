import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import {
  PublicProductFilter,
  PublicProductSort,
  PublicStorefrontService,
} from './public-storefront.service';

@ApiTags('public-storefront')
@Controller('public')
export class PublicStorefrontController {
  constructor(private readonly storefront: PublicStorefrontService) {}

  @Get('banners')
  @ApiOperation({ summary: 'Active promo banners by position' })
  getBanners(@Query('position') position?: string) {
    return this.storefront.getBanners(position || 'top_promo');
  }

  @Get('sliders/:slug')
  @ApiOperation({ summary: 'Active slider by slug' })
  getSlider(@Param('slug') slug: string) {
    return this.storefront.getSliderBySlug(slug);
  }

  @Get('promo-card-rows')
  @ApiOperation({
    summary: 'Active homepage promo card rows (slot 1–5, interleaved)',
  })
  listPromoCardRows() {
    return this.storefront.listPromoCardRows();
  }

  @Get('categories/tree')
  @ApiOperation({ summary: 'Active category tree for mega menu' })
  getCategoryTree() {
    return this.storefront.getCategoryTree();
  }

  @Get('gallery')
  @ApiOperation({
    summary: 'Fashion gallery — product photos newest-first (infinite scroll)',
  })
  listGallery(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('categorySlug') categorySlug?: string,
  ) {
    return this.storefront.listGallery({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 24,
      categorySlug: categorySlug || undefined,
    });
  }

  @Get('products')
  @ApiOperation({
    summary:
      'Paginated catalog — filter/search/sort/price/attrs (shop + rails)',
  })
  listProducts(
    @Query('filter') filter?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('attrs') attrs?: string,
    @Query('onSale') onSale?: string,
  ) {
    const allowed: PublicProductFilter[] = [
      'amazing',
      'featured',
      'newest',
      'all',
    ];
    const sorts: PublicProductSort[] = [
      'newest',
      'popular',
      'price_asc',
      'price_desc',
      'discount',
    ];
    const f = (filter || 'all') as PublicProductFilter;
    const s = (sort || '') as PublicProductSort;
    return this.storefront.listProducts({
      filter: allowed.includes(f) ? f : 'all',
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      categorySlug: categorySlug || undefined,
      q: q || undefined,
      sort: sorts.includes(s) ? s : undefined,
      minPrice:
        minPrice != null && minPrice !== '' && Number.isFinite(Number(minPrice))
          ? Number(minPrice)
          : undefined,
      maxPrice:
        maxPrice != null && maxPrice !== '' && Number.isFinite(Number(maxPrice))
          ? Number(maxPrice)
          : undefined,
      attrs: attrs || undefined,
      onSale: onSale === '1' || onSale === 'true',
    });
  }

  @Get('products/facets')
  @ApiOperation({ summary: 'Catalog facets — price bounds + filterable attrs' })
  getCatalogFacets(
    @Query('categorySlug') categorySlug?: string,
    @Query('q') q?: string,
  ) {
    return this.storefront.getCatalogFacets({
      categorySlug: categorySlug || undefined,
      q: q || undefined,
    });
  }

  @Get('products/search')
  @ApiOperation({ summary: 'Search active products (relevance ranked)' })
  searchProducts(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : 12;
    return this.storefront.searchProducts(
      q || '',
      Number.isFinite(parsed) ? parsed : 12,
    );
  }

  @Get('products/:key/reviews')
  @ApiOperation({ summary: 'Approved reviews by product slug or UUID' })
  getProductReviews(
    @Param('key') key: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.storefront.getProductReviews(
      key,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @Get('products/:key')
  @ApiOperation({ summary: 'Public product detail by slug or UUID' })
  getProduct(@Param('key') key: string) {
    return this.storefront.getProductBySlug(key);
  }

  @SkipThrottle()
  @Get('media/:uuid')
  @ApiOperation({ summary: 'Stream public storefront media from MinIO' })
  async streamMedia(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Res() res: Response,
  ) {
    const { file, stream } = await this.storefront.streamMedia(uuid);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    stream.pipe(res);
  }
}
