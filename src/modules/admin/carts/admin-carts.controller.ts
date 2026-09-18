import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleSlug } from 'src/entities';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import {
  AuthAudienceRequired,
  Roles,
} from 'src/modules/auth/shared/roles.decorator';
import { AdminCartsService } from './admin-carts.service';

@ApiTags('admin-carts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('admin')
@Roles(RoleSlug.ADMIN, RoleSlug.SUPER_ADMIN)
@Controller('admin/carts')
export class AdminCartsController {
  constructor(private readonly cartsService: AdminCartsService) {}

  @Get()
  @ApiOperation({ summary: 'List customer carts / pending baskets' })
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('status') status?: 'all' | 'active' | 'empty' | 'purchased',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.cartsService.list({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      q,
      status,
      dateFrom,
      dateTo,
    });
  }
}
