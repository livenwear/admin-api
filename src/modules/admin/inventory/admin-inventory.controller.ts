import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { AdminInventoryService } from './admin-inventory.service';
import {
  AdminInventoryAdjustDto,
  AdminInventoryOutOfStockDto,
  AdminInventorySetDto,
  AdminListInventoryQueryDto,
} from './dto/admin-inventory.dto';

@ApiTags('admin-inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('admin')
@Roles(RoleSlug.ADMIN, RoleSlug.SUPER_ADMIN)
@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(private readonly inventoryService: AdminInventoryService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Inventory summary cards' })
  summary(@Query('lowThreshold') lowThreshold?: string) {
    return this.inventoryService.summary(
      lowThreshold ? Number(lowThreshold) : 5,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List variant inventory rows' })
  list(@Query() query: AdminListInventoryQueryDto) {
    return this.inventoryService.list(query);
  }

  @Get(':variantUuid/movements')
  @ApiOperation({ summary: 'Recent stock movements for a variant' })
  movements(
    @Param('variantUuid', ParseUUIDPipe) variantUuid: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.recentMovements(
      variantUuid,
      limit ? Number(limit) : 20,
    );
  }

  @Post(':variantUuid/adjust')
  @ApiOperation({ summary: 'Increase or decrease stock by delta' })
  adjust(
    @Param('variantUuid', ParseUUIDPipe) variantUuid: string,
    @Body() dto: AdminInventoryAdjustDto,
    @CurrentUser() actor: User,
  ) {
    return this.inventoryService.adjust(variantUuid, dto, actor);
  }

  @Post(':variantUuid/set')
  @ApiOperation({ summary: 'Set absolute stock quantity' })
  set(
    @Param('variantUuid', ParseUUIDPipe) variantUuid: string,
    @Body() dto: AdminInventorySetDto,
    @CurrentUser() actor: User,
  ) {
    return this.inventoryService.setQuantity(variantUuid, dto, actor);
  }

  @Post(':variantUuid/out-of-stock')
  @ApiOperation({ summary: 'Mark variant as out of stock (qty = 0)' })
  outOfStock(
    @Param('variantUuid', ParseUUIDPipe) variantUuid: string,
    @Body() dto: AdminInventoryOutOfStockDto,
    @CurrentUser() actor: User,
  ) {
    return this.inventoryService.markOutOfStock(variantUuid, dto, actor);
  }
}
