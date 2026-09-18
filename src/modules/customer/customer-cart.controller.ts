import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { User } from 'src/entities';
import { OptionalUser } from 'src/modules/auth/shared/current-user.decorator';
import { OptionalJwtAuthGuard } from 'src/modules/auth/shared/optional-jwt-auth.guard';
import { AuthAudienceRequired } from 'src/modules/auth/shared/roles.decorator';
import { CustomerCartService } from './customer-cart.service';
import { CartAddDto, CartSetQtyDto } from './dto/cart.dto';

@ApiTags('customer-cart')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Guest-Cart-Token',
  required: false,
  description: 'UUID guest cart token (required when not logged in)',
})
@UseGuards(OptionalJwtAuthGuard)
@AuthAudienceRequired('customer')
@Controller('customer/cart')
export class CustomerCartController {
  constructor(private readonly cartService: CustomerCartService) {}

  private guest(headers: Record<string, string | undefined>) {
    return (
      headers['x-guest-cart-token'] ||
      headers['X-Guest-Cart-Token'] ||
      null
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get cart with lines + recommendations' })
  get(
    @OptionalUser() user: User | null,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    return this.cartService.getCart(user, this.guest(headers));
  }

  @Get('summary')
  @ApiOperation({ summary: 'Cart badge + preview (last 3)' })
  summary(
    @OptionalUser() user: User | null,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    return this.cartService.summary(user, this.guest(headers));
  }

  @Post('items')
  @ApiOperation({ summary: 'Add variant to cart' })
  add(
    @OptionalUser() user: User | null,
    @Headers() headers: Record<string, string | undefined>,
    @Body() dto: CartAddDto,
  ) {
    return this.cartService.add(user, this.guest(headers), dto);
  }

  @Patch('items/:variantUuid')
  @ApiOperation({ summary: 'Set line quantity (0 removes)' })
  setQty(
    @OptionalUser() user: User | null,
    @Headers() headers: Record<string, string | undefined>,
    @Param('variantUuid', ParseUUIDPipe) variantUuid: string,
    @Body() dto: CartSetQtyDto,
  ) {
    return this.cartService.setQuantity(
      user,
      this.guest(headers),
      variantUuid,
      dto,
    );
  }

  @Delete('items/:variantUuid')
  @ApiOperation({ summary: 'Remove line from cart' })
  remove(
    @OptionalUser() user: User | null,
    @Headers() headers: Record<string, string | undefined>,
    @Param('variantUuid', ParseUUIDPipe) variantUuid: string,
  ) {
    return this.cartService.remove(user, this.guest(headers), variantUuid);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear cart' })
  clear(
    @OptionalUser() user: User | null,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    return this.cartService.clear(user, this.guest(headers));
  }

  @Post('merge')
  @ApiOperation({ summary: 'Merge guest cart into logged-in user cart' })
  merge(
    @OptionalUser() user: User | null,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    if (!user) {
      return this.cartService.getCart(null, this.guest(headers));
    }
    return this.cartService.mergeGuestIntoUser(user, this.guest(headers));
  }
}
