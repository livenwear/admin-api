import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from 'src/entities';
import { CurrentUser } from 'src/modules/auth/shared/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import { AuthAudienceRequired } from 'src/modules/auth/shared/roles.decorator';
import { CustomerReviewsService } from './customer-reviews.service';

@ApiTags('customer-reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('customer')
@Controller('customer/reviews')
export class CustomerMyReviewsController {
  constructor(private readonly reviewsService: CustomerReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List my product reviews' })
  list(@CurrentUser() user: User) {
    return this.reviewsService.listMine(user);
  }
}
