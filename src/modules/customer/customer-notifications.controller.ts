import {
  Controller,
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
import { CustomerNotificationsService } from './customer-notifications.service';

@ApiTags('customer-notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('customer')
@Controller('customer/notifications')
export class CustomerNotificationsController {
  constructor(
    private readonly notificationsService: CustomerNotificationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List my notifications' })
  list(@CurrentUser() user: User) {
    return this.notificationsService.list(user);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAll(@CurrentUser() user: User) {
    return this.notificationsService.markAllRead(user);
  }

  @Post(':uuid/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markOne(
    @CurrentUser() user: User,
    @Param('uuid', ParseUUIDPipe) uuid: string,
  ) {
    return this.notificationsService.markRead(user, uuid);
  }
}
