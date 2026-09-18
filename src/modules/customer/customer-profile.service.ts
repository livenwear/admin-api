import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/entities';
import { TokenService } from 'src/modules/auth/shared/token.service';
import { Repository } from 'typeorm';
import { CustomerProfileUpdateDto } from './dto/profile.dto';

@Injectable()
export class CustomerProfileService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly tokenService: TokenService,
  ) {}

  async me(user: User) {
    const full = await this.userRepo.findOne({
      where: { id: user.id },
      relations: ['userRoles', 'userRoles.role'],
    });
    if (!full) throw new NotFoundException('کاربر یافت نشد.');
    return { success: true, data: this.tokenService.toAuthUser(full) };
  }

  async update(user: User, dto: CustomerProfileUpdateDto) {
    const full = await this.userRepo.findOne({
      where: { id: user.id },
      relations: ['userRoles', 'userRoles.role'],
    });
    if (!full) throw new NotFoundException('کاربر یافت نشد.');

    if (dto.firstName !== undefined) full.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) full.lastName = dto.lastName.trim();
    if (dto.email !== undefined) {
      full.email = dto.email?.trim() || null;
    }

    await this.userRepo.save(full);
    const refreshed = await this.userRepo.findOne({
      where: { id: full.id },
      relations: ['userRoles', 'userRoles.role'],
    });

    return {
      success: true,
      message: 'پروفایل به‌روزرسانی شد',
      data: this.tokenService.toAuthUser(refreshed || full),
    };
  }
}
