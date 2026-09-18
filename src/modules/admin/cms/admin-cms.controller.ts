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
import { RoleSlug } from 'src/entities';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import {
  AuthAudienceRequired,
  Roles,
} from 'src/modules/auth/shared/roles.decorator';
import { AdminCmsService } from './admin-cms.service';
import {
  AdminBannerDto,
  AdminPromoCardRowDto,
  AdminSliderDto,
  AdminUpdateBannerDto,
  AdminUpdatePromoCardRowDto,
  AdminUpdateSliderDto,
  CmsListQueryDto,
} from './dto/cms.dto';

@ApiTags('admin-cms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('admin')
@Roles(RoleSlug.ADMIN, RoleSlug.SUPER_ADMIN)
@Controller('admin/cms')
export class AdminCmsController {
  constructor(private readonly cmsService: AdminCmsService) {}

  @Get('banners')
  @ApiOperation({ summary: 'List promo banners' })
  listBanners(@Query() query: CmsListQueryDto) {
    return this.cmsService.listBanners(query);
  }

  @Post('banners')
  createBanner(@Body() dto: AdminBannerDto) {
    return this.cmsService.createBanner(dto);
  }

  @Patch('banners/:uuid')
  updateBanner(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminUpdateBannerDto,
  ) {
    return this.cmsService.updateBanner(uuid, dto);
  }

  @Delete('banners/:uuid')
  deleteBanner(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.cmsService.deleteBanner(uuid);
  }

  @Get('sliders')
  listSliders() {
    return this.cmsService.listSliders();
  }

  @Get('sliders/:uuid')
  getSlider(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.cmsService.getSlider(uuid);
  }

  @Post('sliders')
  createSlider(@Body() dto: AdminSliderDto) {
    return this.cmsService.createSlider(dto);
  }

  @Patch('sliders/:uuid')
  updateSlider(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminUpdateSliderDto,
  ) {
    return this.cmsService.updateSlider(uuid, dto);
  }

  @Delete('sliders/:uuid')
  deleteSlider(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.cmsService.deleteSlider(uuid);
  }

  @Get('promo-card-rows')
  @ApiOperation({ summary: 'List homepage promo card rows (max 5)' })
  listPromoCardRows() {
    return this.cmsService.listPromoCardRows();
  }

  @Get('promo-card-rows/:uuid')
  getPromoCardRow(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.cmsService.getPromoCardRow(uuid);
  }

  @Post('promo-card-rows')
  createPromoCardRow(@Body() dto: AdminPromoCardRowDto) {
    return this.cmsService.createPromoCardRow(dto);
  }

  @Patch('promo-card-rows/:uuid')
  updatePromoCardRow(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminUpdatePromoCardRowDto,
  ) {
    return this.cmsService.updatePromoCardRow(uuid, dto);
  }

  @Delete('promo-card-rows/:uuid')
  deletePromoCardRow(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.cmsService.deletePromoCardRow(uuid);
  }
}
