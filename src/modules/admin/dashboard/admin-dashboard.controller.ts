import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleSlug } from 'src/entities';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import {
  AuthAudienceRequired,
  Roles,
} from 'src/modules/auth/shared/roles.decorator';
import {
  AdminDashboardService,
  DASHBOARD_RANGES,
  type DashboardRange,
} from './admin-dashboard.service';
import { DashboardSectionsService } from './dashboard-sections.service';

@ApiTags('admin-dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('admin')
@Roles(RoleSlug.ADMIN, RoleSlug.SUPER_ADMIN)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(
    private readonly dashboardService: AdminDashboardService,
    private readonly sectionsService: DashboardSectionsService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Admin dashboard overview metrics' })
  overview() {
    return this.dashboardService.getOverview();
  }

  @Get('customers')
  @ApiOperation({ summary: 'Customer analytics for a time range' })
  customers(@Query('range') range?: string) {
    const key = (range || 'today') as DashboardRange;
    if (!DASHBOARD_RANGES.includes(key)) {
      throw new BadRequestException('بازه زمانی نامعتبر است.');
    }
    return this.dashboardService.getCustomerAnalytics(key);
  }

  @Get('sections/:key')
  @ApiOperation({ summary: 'Dashboard section analytics for a time range' })
  section(@Param('key') key: string, @Query('range') range?: string) {
    const windowKey = (range || 'today') as DashboardRange;
    if (!DASHBOARD_RANGES.includes(windowKey)) {
      throw new BadRequestException('بازه زمانی نامعتبر است.');
    }
    return this.sectionsService.get(key, windowKey);
  }
}
