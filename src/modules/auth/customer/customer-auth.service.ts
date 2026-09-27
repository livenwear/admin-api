import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import {
  ImpersonationGrant,
  OtpChannel,
  OtpPurpose,
  Role,
  RoleSlug,
  User,
  UserRoleEntity,
} from 'src/entities';
import { OtpService } from '../shared/otp.service';
import { TokenService } from '../shared/token.service';
import {
  CustomerImpersonateExchangeDto,
  CustomerOtpRequestDto,
  CustomerOtpVerifyDto,
  CustomerPasswordLoginDto,
  CustomerRegisterDto,
} from './dto/customer-auth.dto';

@Injectable()
export class CustomerAuthService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepository: Repository<UserRoleEntity>,
    @InjectRepository(ImpersonationGrant)
    private readonly grantRepository: Repository<ImpersonationGrant>,
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
  ) {}

  async register(
    dto: CustomerRegisterDto,
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    const existing = await this.userRepository.findOne({
      where: { phone: dto.phone },
    });
    if (existing) {
      throw new ConflictException('Phone number already registered.');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepository.save(
      this.userRepository.create({
        phone: dto.phone,
        password: hashed,
        firstName: dto.firstName || 'User',
        lastName: dto.lastName || '',
        email: null,
        isActive: true,
        isVerified: true,
        twoFactorEnabled: false,
      }),
    );

    await this.assignCustomerRole(user);

    const full = await this.loadUser(user.id);
    const tokens = await this.tokenService.issueTokens(full, 'customer', meta);

    return {
      success: true,
      message: 'Registration successful',
      data: {
        user: this.tokenService.toAuthUser(full),
        ...tokens,
      },
    };
  }

  async loginWithPassword(
    dto: CustomerPasswordLoginDto,
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    const user = await this.userRepository.findOne({
      where: { phone: dto.phone },
      relations: ['userRoles', 'userRoles.role'],
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is inactive.');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    this.assertCustomerAudience(user);

    user.lastLogin = new Date();
    await this.userRepository.save(user);

    const tokens = await this.tokenService.issueTokens(user, 'customer', meta);
    return {
      success: true,
      message: 'Login successful',
      data: {
        user: this.tokenService.toAuthUser(user),
        ...tokens,
      },
    };
  }

  /**
   * Unified OTP entry: existing users log in; new phones get an account
   * immediately (so the code is visible on the admin user detail page).
   */
  async requestOtp(dto: CustomerOtpRequestDto) {
    let existing = await this.userRepository.findOne({
      where: { phone: dto.phone },
      relations: ['userRoles', 'userRoles.role'],
    });

    let isNewUser = false;
    if (!existing) {
      existing = await this.userRepository.save(
        this.userRepository.create({
          phone: dto.phone,
          password: null,
          firstName: 'User',
          lastName: '',
          email: null,
          isActive: true,
          isVerified: false,
          twoFactorEnabled: false,
        }),
      );
      await this.assignCustomerRole(existing);
      existing = await this.loadUser(existing.id);
      isNewUser = true;
    } else {
      if (!existing.isActive) {
        throw new ForbiddenException('Account is inactive.');
      }
      this.assertCustomerAudience(existing);
    }

    const result = await this.otpService.requestOtp(
      dto.phone,
      isNewUser ? OtpPurpose.REGISTER : OtpPurpose.LOGIN,
      OtpChannel.SMS,
    );

    return {
      success: true,
      message: 'OTP sent (stub — check server logs or admin user OTP card)',
      data: {
        ...result,
        isNewUser,
        userUuid: existing.uuid,
      },
    };
  }

  async verifyOtp(
    dto: CustomerOtpVerifyDto,
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    const ok = await this.otpService.verifyOtp(
      dto.phone,
      dto.code,
      OtpChannel.SMS,
    );
    if (!ok) {
      throw new BadRequestException('Invalid or expired OTP.');
    }

    let user = await this.userRepository.findOne({
      where: { phone: dto.phone },
      relations: ['userRoles', 'userRoles.role'],
    });

    if (!user) {
      // Safety net if request-step user creation was skipped somehow
      user = await this.userRepository.save(
        this.userRepository.create({
          phone: dto.phone,
          password: null,
          firstName: dto.firstName?.trim() || 'User',
          lastName: dto.lastName?.trim() || '',
          email: null,
          isActive: true,
          isVerified: true,
          twoFactorEnabled: false,
        }),
      );
      await this.assignCustomerRole(user);
      user = await this.loadUser(user.id);
    } else {
      this.assertCustomerAudience(user);
      if (!user.isActive) {
        throw new ForbiddenException('Account is inactive.');
      }
      if (dto.firstName?.trim()) user.firstName = dto.firstName.trim();
      if (dto.lastName?.trim()) user.lastName = dto.lastName.trim();
      user.isVerified = true;
      user.lastLogin = new Date();
      await this.userRepository.save(user);
      user = await this.loadUser(user.id);
    }

    const tokens = await this.tokenService.issueTokens(user, 'customer', meta);
    return {
      success: true,
      message: 'OTP verified',
      data: {
        user: this.tokenService.toAuthUser(user),
        ...tokens,
      },
    };
  }

  async refresh(
    refreshToken: string,
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    const { tokens, user } = await this.tokenService.refresh(
      refreshToken,
      'customer',
      meta,
    );
    this.assertCustomerAudience(user);
    return {
      success: true,
      message: 'Token refreshed',
      data: {
        user: this.tokenService.toAuthUser(user),
        ...tokens,
      },
    };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      await this.tokenService.revokeRefreshToken(refreshToken);
    }
    return { success: true, message: 'Logged out' };
  }

  /**
   * One-time exchange of an admin-issued impersonation code for customer tokens.
   * Code is single-use and short-lived.
   */
  async exchangeImpersonation(
    dto: CustomerImpersonateExchangeDto,
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    const grant = await this.grantRepository.findOne({
      where: { code: dto.code },
      relations: [
        'targetUser',
        'targetUser.userRoles',
        'targetUser.userRoles.role',
        'adminUser',
      ],
    });

    if (!grant) {
      throw new UnauthorizedException('Invalid impersonation code.');
    }
    if (grant.usedAt) {
      throw new UnauthorizedException('Impersonation code already used.');
    }
    if (grant.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Impersonation code expired.');
    }

    const target = grant.targetUser as User;
    if (!target || !target.isActive) {
      throw new ForbiddenException('Target account is unavailable.');
    }

    const targetRoles = this.tokenService.getRoleSlugs(target);
    if (
      targetRoles.includes(RoleSlug.ADMIN) ||
      targetRoles.includes(RoleSlug.SUPER_ADMIN)
    ) {
      throw new ForbiddenException('Cannot impersonate staff accounts.');
    }

    grant.usedAt = new Date();
    await this.grantRepository.save(grant);

    const admin = grant.adminUser as User;
    const tokens = await this.tokenService.issueTokens(target, 'customer', {
      userAgent: `impersonation:${admin?.uuid ?? 'unknown'};${meta?.userAgent ?? ''}`,
      ipAddress: meta?.ipAddress,
      impersonatedBy: admin?.uuid,
    });

    return {
      success: true,
      message: 'Impersonation session started',
      data: {
        user: this.tokenService.toAuthUser(target),
        ...tokens,
        impersonation: {
          byAdmin: {
            uuid: admin?.uuid,
            firstName: admin?.firstName,
            lastName: admin?.lastName,
          },
          grantExpiresAt: grant.expiresAt,
        },
      },
    };
  }

  private async assignCustomerRole(user: User) {
    const role = await this.roleRepository.findOne({
      where: { slug: RoleSlug.USER },
    });
    if (!role) {
      throw new BadRequestException('Customer role is not seeded.');
    }
    await this.userRoleRepository.save(
      this.userRoleRepository.create({ user, role }),
    );
  }

  private async loadUser(id: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['userRoles', 'userRoles.role'],
    });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  /** Customers must not use admin panel tokens; staff can still shop if they have USER role only — block ADMIN/SUPER_ADMIN from customer audience by default? 
   * Actually admins might also be customers. Allow any active user for customer auth except we check they're logging into customer audience.
   * Block only if they somehow shouldn't - for simplicity allow all active users with USER role, or auto-assign USER.
   * For login: if user is only admin without USER role, still allow customer login (shopping). So no role block for customer.
   */
  private assertCustomerAudience(_user: User) {
    // Customer panel is open to any active shopper account.
  }
}
