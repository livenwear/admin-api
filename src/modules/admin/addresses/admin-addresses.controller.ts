import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { AdminAddressesService } from './admin-addresses.service';
import {
  AdminListAddressesQueryDto,
  AdminUpdateAddressDto,
} from './dto/admin-addresses.dto';

@ApiTags('admin-addresses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('admin')
@Roles(RoleSlug.ADMIN, RoleSlug.SUPER_ADMIN)
@Controller('admin/addresses')
export class AdminAddressesController {
  constructor(private readonly addressesService: AdminAddressesService) {}

  @Get()
  @ApiOperation({ summary: 'List all customer addresses' })
  list(@Query() query: AdminListAddressesQueryDto) {
    return this.addressesService.list(query);
  }

  @Patch(':uuid')
  @ApiOperation({ summary: 'Update an address' })
  update(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminUpdateAddressDto,
  ) {
    return this.addressesService.update(uuid, dto);
  }
}
