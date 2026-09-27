import { Body, Controller, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { EmallsProductsRequestDto } from './dto/emalls-products.dto';
import { EmallsService } from './emalls.service';

@ApiTags('emalls')
@Controller('emalls_ext/v1')
export class EmallsController {
  constructor(private readonly emallsService: EmallsService) {}

  @SkipThrottle()
  @Post('products')
  @ApiOperation({
    summary:
      'Emalls Extraction API (official plugin contract) — product list for Emalls crawler',
  })
  async products(
    @Body() body: EmallsProductsRequestDto,
    @Query() query: EmallsProductsRequestDto,
    @Res() res: Response,
  ) {
    const merged: EmallsProductsRequestDto = {
      token: body?.token ?? query?.token,
      page: body?.page ?? query?.page,
      limit: body?.limit ?? query?.limit,
      variation: body?.variation ?? query?.variation,
    };
    const result = await this.emallsService.listProducts(merged);
    return res.status(result.status).json(result.body);
  }
}
