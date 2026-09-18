import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from 'src/entities';
import { CurrentUser } from 'src/modules/auth/shared/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import { AuthAudienceRequired } from 'src/modules/auth/shared/roles.decorator';
import { CustomerWishlistService } from './customer-wishlist.service';
import { WishlistAddDto, WishlistToggleDto } from './dto/wishlist.dto';

@ApiTags('customer-wishlist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('customer')
@Controller('customer/wishlist')
export class CustomerWishlistController {
  constructor(private readonly wishlistService: CustomerWishlistService) {}

  @Get()
  @ApiOperation({ summary: 'List my wishlist products' })
  list(@CurrentUser() user: User) {
    return this.wishlistService.list(user);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Wishlist count + product UUIDs' })
  summary(@CurrentUser() user: User) {
    return this.wishlistService.summary(user);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add product to wishlist' })
  add(@CurrentUser() user: User, @Body() dto: WishlistAddDto) {
    return this.wishlistService.add(user, dto);
  }

  @Post('toggle')
  @ApiOperation({ summary: 'Toggle product in wishlist' })
  toggle(@CurrentUser() user: User, @Body() dto: WishlistToggleDto) {
    return this.wishlistService.toggle(user, dto);
  }

  @Delete('items/:productUuid')
  @ApiOperation({ summary: 'Remove product from wishlist' })
  remove(
    @CurrentUser() user: User,
    @Param('productUuid', ParseUUIDPipe) productUuid: string,
  ) {
    return this.wishlistService.remove(user, productUuid);
  }
}
