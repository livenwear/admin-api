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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RoleSlug, User } from 'src/entities';
import { CurrentUser } from 'src/modules/auth/shared/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import {
  AuthAudienceRequired,
  Roles,
} from 'src/modules/auth/shared/roles.decorator';
import { AdminUsersService } from './admin-users.service';
import {
  AdminCreateUserDto,
  AdminListUsersQueryDto,
  AdminUpdateUserDto,
} from './dto/admin-users.dto';

@ApiTags('admin-users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('admin')
@Roles(RoleSlug.ADMIN, RoleSlug.SUPER_ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users with professional pagination' })
  list(@Query() query: AdminListUsersQueryDto) {
    return this.adminUsersService.list(query);
  }

  @Get(':uuid/wishlist')
  @ApiOperation({ summary: 'Get products this user favorited' })
  getWishlist(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.adminUsersService.getWishlist(uuid);
  }

  @Get(':uuid/addresses')
  @ApiOperation({ summary: 'Get addresses for this user' })
  getAddresses(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.adminUsersService.getAddresses(uuid);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get user details' })
  getOne(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.adminUsersService.getOne(uuid);
  }

  @Post()
  @ApiOperation({ summary: 'Create user' })
  create(@Body() dto: AdminCreateUserDto, @CurrentUser() actor: User) {
    return this.adminUsersService.create(dto, actor);
  }

  @Patch(':uuid')
  @ApiOperation({ summary: 'Update user' })
  update(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() actor: User,
  ) {
    return this.adminUsersService.update(uuid, dto, actor);
  }

  @Delete(':uuid')
  @ApiOperation({ summary: 'Soft-delete user' })
  remove(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @CurrentUser() actor: User,
  ) {
    return this.adminUsersService.softDelete(uuid, actor);
  }

  @Post(':uuid/impersonate')
  @ApiOperation({
    summary:
      'Create one-time impersonation grant to open customer panel as this user',
  })
  impersonate(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @CurrentUser() actor: User,
    @Req() req: Request,
  ) {
    return this.adminUsersService.impersonate(uuid, actor, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }
}
