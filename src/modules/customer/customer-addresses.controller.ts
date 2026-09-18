import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from 'src/entities';
import { CurrentUser } from 'src/modules/auth/shared/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import { AuthAudienceRequired } from 'src/modules/auth/shared/roles.decorator';
import { CustomerAddressesService } from './customer-addresses.service';
import { AddressCreateDto, AddressUpdateDto } from './dto/address.dto';

@ApiTags('customer-addresses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('customer')
@Controller('customer/addresses')
export class CustomerAddressesController {
  constructor(private readonly addressesService: CustomerAddressesService) {}

  @Get()
  @ApiOperation({ summary: 'List my addresses' })
  list(@CurrentUser() user: User) {
    return this.addressesService.list(user);
  }

  @Post()
  @ApiOperation({ summary: 'Create address' })
  create(@CurrentUser() user: User, @Body() dto: AddressCreateDto) {
    return this.addressesService.create(user, dto);
  }

  @Patch(':uuid')
  @ApiOperation({ summary: 'Update address' })
  update(
    @CurrentUser() user: User,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AddressUpdateDto,
  ) {
    return this.addressesService.update(user, uuid, dto);
  }

  @Post(':uuid/default')
  @ApiOperation({ summary: 'Set address as default' })
  setDefault(
    @CurrentUser() user: User,
    @Param('uuid', ParseUUIDPipe) uuid: string,
  ) {
    return this.addressesService.setDefault(user, uuid);
  }

  @Delete(':uuid')
  @ApiOperation({ summary: 'Delete address' })
  remove(
    @CurrentUser() user: User,
    @Param('uuid', ParseUUIDPipe) uuid: string,
  ) {
    return this.addressesService.remove(user, uuid);
  }
}
