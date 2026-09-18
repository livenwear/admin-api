import {
  Body,
  Controller,
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
import { AdminOrdersService } from './admin-orders.service';
import { CommerceSettingsService } from './commerce-settings.service';
import {
  AdminListOrdersQueryDto,
  AdminRejectPaymentDto,
  AdminUpdateOrderStatusDto,
  UpdateCommerceSettingsDto,
} from './dto/admin-orders.dto';

@ApiTags('admin-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('admin')
@Roles(RoleSlug.ADMIN, RoleSlug.SUPER_ADMIN)
@Controller('admin')
export class AdminOrdersController {
  constructor(
    private readonly ordersService: AdminOrdersService,
    private readonly settingsService: CommerceSettingsService,
  ) {}

  @Get('orders')
  @ApiOperation({ summary: 'List orders' })
  list(@Query() query: AdminListOrdersQueryDto) {
    return this.ordersService.list(query);
  }

  @Get('orders/summary')
  @ApiOperation({ summary: 'Orders stats for list cards' })
  summary() {
    return this.ordersService.summary();
  }

  @Get('orders/:uuid')
  @ApiOperation({ summary: 'Order detail' })
  detail(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.ordersService.detail(uuid);
  }

  @Post('orders/:uuid/approve-card-payment')
  @ApiOperation({ summary: 'Approve card-to-card payment and commit stock' })
  approve(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @CurrentUser() admin: User,
  ) {
    return this.ordersService.approveCardPayment(uuid, admin);
  }

  @Post('orders/:uuid/reject-card-payment')
  @ApiOperation({ summary: 'Reject card-to-card payment and release stock' })
  reject(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminRejectPaymentDto,
    @CurrentUser() admin: User,
  ) {
    return this.ordersService.rejectCardPayment(uuid, dto, admin);
  }

  @Patch('orders/:uuid/status')
  @ApiOperation({ summary: 'Update order / shipment status' })
  updateStatus(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminUpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(uuid, dto);
  }

  @Get('settings/checkout')
  @ApiOperation({ summary: 'Get checkout / shipping / payment settings' })
  async getSettings() {
    return { success: true, data: await this.settingsService.get() };
  }

  @Patch('settings/checkout')
  @ApiOperation({ summary: 'Update checkout settings' })
  async saveSettings(@Body() dto: UpdateCommerceSettingsDto) {
    return {
      success: true,
      data: await this.settingsService.save({
        shippingMethods: dto.shippingMethods,
        cardTransfer: dto.cardTransfer,
        onlineGateway: dto.onlineGateway
          ? {
              enabled: dto.onlineGateway.enabled,
              provider: dto.onlineGateway.provider,
            }
          : undefined,
      }),
    };
  }
}
