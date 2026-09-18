import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from 'src/entities';
import { CurrentUser } from 'src/modules/auth/shared/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import { AuthAudienceRequired } from 'src/modules/auth/shared/roles.decorator';
import { CustomerReviewsService } from './customer-reviews.service';
import { CreateCustomerReviewDto } from './dto/customer-review.dto';

@ApiTags('customer-reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('customer')
@Controller('customer/products')
export class CustomerReviewsController {
  constructor(private readonly reviewsService: CustomerReviewsService) {}

  @Post(':productUuid/reviews')
  @ApiOperation({ summary: 'Submit a product review (authenticated customer)' })
  create(
    @Param('productUuid', ParseUUIDPipe) productUuid: string,
    @Body() dto: CreateCustomerReviewDto,
    @CurrentUser() user: User,
  ) {
    return this.reviewsService.create(user, productUuid, dto);
  }
}
