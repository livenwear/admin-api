import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from 'src/entities';
import { CurrentUser } from 'src/modules/auth/shared/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import { AuthAudienceRequired } from 'src/modules/auth/shared/roles.decorator';
import { CustomerProfileService } from './customer-profile.service';
import { CustomerProfileUpdateDto } from './dto/profile.dto';

@ApiTags('customer-profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('customer')
@Controller('customer/profile')
export class CustomerProfileController {
  constructor(private readonly profileService: CustomerProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get my profile' })
  me(@CurrentUser() user: User) {
    return this.profileService.me(user);
  }

  @Patch()
  @ApiOperation({ summary: 'Update my profile' })
  update(@CurrentUser() user: User, @Body() dto: CustomerProfileUpdateDto) {
    return this.profileService.update(user, dto);
  }
}
