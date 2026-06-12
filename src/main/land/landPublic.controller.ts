import { Controller, Get, Query } from '@nestjs/common';
import { LandPublicService } from './landPublic.service';

@Controller('/public/category-best-sell')
export class LandPublicController {
  constructor(private readonly landPublicService: LandPublicService) {}

  // GET /land/category?page=1&limit=10
  @Get()
  async getAllCategories(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    return this.landPublicService.getAllCategories(pageNum, limitNum);
  }
}
