import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { RoleSlug } from 'src/entities';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import {
  AuthAudienceRequired,
  Roles,
} from 'src/modules/auth/shared/roles.decorator';
import { AppSettingsService } from './app-settings.service';

class UpdateAppFeaturesDto {
  @IsOptional()
  @IsBoolean()
  smsSendingEnabled?: boolean;
}

@ApiTags('admin-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('admin')
@Roles(RoleSlug.ADMIN, RoleSlug.SUPER_ADMIN)
@Controller('admin/settings')
export class AdminAppSettingsController {
  constructor(private readonly appSettings: AppSettingsService) {}

  @Get('features')
  @ApiOperation({ summary: 'Get Liven feature flags' })
  async getFeatures() {
    const data = await this.appSettings.getFeatures();
    return { success: true, data };
  }

  @Patch('features')
  @ApiOperation({ summary: 'Update Liven feature flags' })
  async updateFeatures(@Body() dto: UpdateAppFeaturesDto) {
    const data = await this.appSettings.saveFeatures(dto);
    return {
      success: true,
      message: 'تنظیمات ذخیره شد',
      data,
    };
  }
}
