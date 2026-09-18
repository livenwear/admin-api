import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleSlug, User } from 'src/entities';
import { CurrentUser } from 'src/modules/auth/shared/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import {
  AuthAudienceRequired,
  Roles,
} from 'src/modules/auth/shared/roles.decorator';
import { AdminReviewsService } from './admin-reviews.service';
import {
  AdminListReviewsQueryDto,
  AdminReplyReviewDto,
  AdminUpdateReviewDto,
} from './dto/admin-reviews.dto';

@ApiTags('admin-reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('admin')
@Roles(RoleSlug.ADMIN, RoleSlug.SUPER_ADMIN)
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviewsService: AdminReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List product reviews / comments' })
  list(@Query() query: AdminListReviewsQueryDto) {
    return this.reviewsService.list(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Review stats for dashboard widgets' })
  async stats() {
    return {
      success: true,
      data: await this.reviewsService.getStats(),
    };
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get one review' })
  getOne(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.reviewsService.getOne(uuid);
  }

  @Patch(':uuid')
  @ApiOperation({ summary: 'Update review content / approval / reply' })
  update(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminUpdateReviewDto,
    @CurrentUser() actor: User,
  ) {
    return this.reviewsService.update(uuid, dto, actor);
  }

  @Post(':uuid/reply')
  @ApiOperation({ summary: 'Reply to a customer review' })
  reply(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminReplyReviewDto,
    @CurrentUser() actor: User,
  ) {
    return this.reviewsService.reply(uuid, dto, actor);
  }

  @Delete(':uuid')
  @ApiOperation({ summary: 'Soft-delete a review' })
  remove(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.reviewsService.remove(uuid);
  }
}
