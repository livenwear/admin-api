import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, GetUsersDto, UpdateUserDto } from './dto/user.dto';
import { User } from '@liven/entities';
import { Roles } from 'src/main/auth/strategies/roles.decorator';
import { UserRole } from 'src/common/type';
import { JwtAuthGuard } from 'src/main/auth/strategies/jwt.strategy';


@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Post()
  async createUser(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.userService.createUser(createUserDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  async getAllUsers(@Query() query: GetUsersDto) {
    return this.userService.getAllUsers(query);
  }
  @Get(':id')
  async getUserById(@Param('id') id: number): Promise<User> {
    return this.userService.getUserById(id);
  }

  @Patch(':id')
  async updateUser(@Param('id') id: number, @Body() updateUserDto: UpdateUserDto): Promise<User> {
    return this.userService.updateUser(id, updateUserDto);
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: number): Promise<void> {
    return this.userService.deleteUser(id);
  }

  @Delete(':id/hard')
  async deleteUserHardDelete(@Param('id') id: number): Promise<void> {
    return this.userService.deleteUserHardDelete(id);
  }
}
