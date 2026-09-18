import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleSlug } from 'src/entities';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import {
  AuthAudienceRequired,
  Roles,
} from 'src/modules/auth/shared/roles.decorator';
import { AdminWishlistService } from './admin-wishlist.service';

@ApiTags('admin-wishlist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('admin')
@Roles(RoleSlug.ADMIN, RoleSlug.SUPER_ADMIN)
@Controller('admin/wishlist')
export class AdminWishlistController {
  constructor(private readonly wishlistService: AdminWishlistService) {}

  @Get('popular')
  @ApiOperation({
    summary: 'Most-favorited products with users who saved them',
  })
  popular(@Query('limit') limit?: string) {
    return this.wishlistService.getPopular(
      limit ? Number(limit) : 40,
    );
  }
}
