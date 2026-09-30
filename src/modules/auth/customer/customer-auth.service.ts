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
  CustomerForgotPasswordRequestDto,
  CustomerForgotPasswordResetDto,
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

  /**
   * Password registration — account stays inactive until SMS OTP is verified.
   * Does NOT issue tokens; client must call otp/verify next.
   */
  async register(dto: CustomerRegisterDto) {
    const existing = await this.userRepository.findOne({
      where: { phone: dto.phone },
      relations: ['userRoles', 'userRoles.role'],
    });

    if (existing?.isVerified) {
      throw new ConflictException('Phone number already registered.');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    let user: User;

    if (existing && !existing.isVerified) {
      // Resume incomplete registration (same phone, never verified)
      existing.password = hashed;
      existing.firstName = dto.firstName?.trim() || existing.firstName || 'User';
      existing.lastName = dto.lastName?.trim() || existing.lastName || '';
      existing.isActive = false;
      existing.isVerified = false;
      user = await this.userRepository.save(existing);
      if (!existing.userRoles?.length) {
        await this.assignCustomerRole(user);
      }
    } else {
      user = await this.userRepository.save(
        this.userRepository.create({
          phone: dto.phone,
          password: hashed,
          firstName: dto.firstName?.trim() || 'User',
          lastName: dto.lastName?.trim() || '',
          email: null,
          isActive: false,
          isVerified: false,
          twoFactorEnabled: false,
        }),
      );
      await this.assignCustomerRole(user);
    }

    const otp = await this.otpService.requestOtp(
      dto.phone,
      OtpPurpose.REGISTER,
      OtpChannel.SMS,
    );

    return {
      success: true,
      message: 'کد تایید ارسال شد. تا تایید شماره، حساب غیرفعال است.',
      data: {
        needsOtpVerification: true as const,
        expiresIn: otp.expiresIn,
        debugNote: otp.debugNote,
        phone: dto.phone,
        userUuid: user.uuid,
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
      throw new UnauthorizedException('شماره یا رمز عبور اشتباه است.');
    }

    if (!user.isVerified) {
      throw new ForbiddenException(
        'شماره موبایل هنوز تایید نشده. ثبت‌نام را با کد پیامک کامل کنید.',
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException('این حساب غیرفعال است.');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('شماره یا رمز عبور اشتباه است.');
    }

    this.assertCustomerAudience(user);

    user.lastLogin = new Date();
    await this.userRepository.save(user);

    const tokens = await this.tokenService.issueTokens(user, 'customer', meta);
    return {
      success: true,
      message: 'ورود انجام شد',
      data: {
        user: this.tokenService.toAuthUser(user),
        ...tokens,
      },
    };
  }

  /**
   * Unified OTP entry: existing users log in; new phones get a pending account
   * (inactive until OTP verify) so the code is visible on the admin user page.
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
          isActive: false,
          isVerified: false,
          twoFactorEnabled: false,
        }),
      );
      await this.assignCustomerRole(existing);
      existing = await this.loadUser(existing.id);
      isNewUser = true;
    } else if (!existing.isActive && existing.isVerified) {
      // Admin-disabled account
      throw new ForbiddenException('این حساب غیرفعال است.');
    } else {
      this.assertCustomerAudience(existing);
      isNewUser = !existing.isVerified;
    }

    const result = await this.otpService.requestOtp(
      dto.phone,
      isNewUser || !existing.isVerified
        ? OtpPurpose.REGISTER
        : OtpPurpose.LOGIN,
      OtpChannel.SMS,
    );

    return {
      success: true,
      message: 'کد تایید پیامک شد',
      data: {
        ...result,
        isNewUser: isNewUser || !existing.isVerified,
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
      throw new BadRequestException(
        'کد تأیید اشتباه است یا مهلت آن تمام شده.',
      );
    }

    let user = await this.userRepository.findOne({
      where: { phone: dto.phone },
      relations: ['userRoles', 'userRoles.role'],
    });

    if (!user) {
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
      // Banned by admin (verified once, then deactivated)
      if (!user.isActive && user.isVerified) {
        throw new ForbiddenException('این حساب غیرفعال است.');
      }
      if (dto.firstName?.trim()) user.firstName = dto.firstName.trim();
      if (dto.lastName?.trim()) user.lastName = dto.lastName.trim();
      user.isActive = true;
      user.isVerified = true;
      user.lastLogin = new Date();
      await this.userRepository.save(user);
      user = await this.loadUser(user.id);
    }

    const tokens = await this.tokenService.issueTokens(user, 'customer', meta);
    return {
      success: true,
      message: 'شماره تأیید شد',
      data: {
        user: this.tokenService.toAuthUser(user),
        ...tokens,
      },
    };
  }

  /**
   * Forgot-password step 1: send OTP for any existing account
   * (active/inactive, verified or pending registration).
   * Unknown phones still get a generic success (no enumeration).
   */
  async forgotPasswordRequest(dto: CustomerForgotPasswordRequestDto) {
    const ttl = Number(process.env.OTP_EXPIRES_SECONDS || 300);
    const generic = {
      success: true,
      message:
        'اگر حسابی با این شماره وجود داشته باشد، کد بازیابی ارسال شده است.',
      data: {
        expiresIn: ttl,
        sent: false as boolean,
      },
    };

    const user = await this.userRepository.findOne({
      where: { phone: dto.phone },
    });

    if (!user) {
      return generic;
    }

    const otp = await this.otpService.requestOtp(
      dto.phone,
      OtpPurpose.RESET_PASSWORD,
      OtpChannel.SMS,
    );

    return {
      success: true,
      message: generic.message,
      data: {
        expiresIn: otp.expiresIn,
        debugNote: otp.debugNote,
        sent: otp.sent,
        userUuid: user.uuid,
      },
    };
  }

  /**
   * Forgot-password step 2: verify OTP + set new password.
   * Completes pending registration (activates + verifies) when needed.
   */
  async forgotPasswordReset(
    dto: CustomerForgotPasswordResetDto,
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    const ok = await this.otpService.verifyOtp(
      dto.phone,
      dto.code,
      OtpChannel.SMS,
    );
    if (!ok) {
      throw new BadRequestException(
        'کد تأیید اشتباه است یا مهلت آن تمام شده.',
      );
    }

    const user = await this.userRepository.findOne({
      where: { phone: dto.phone },
      relations: ['userRoles', 'userRoles.role'],
    });
    if (!user) {
      throw new NotFoundException('حسابی با این شماره پیدا نشد.');
    }

    user.password = await bcrypt.hash(dto.password, 10);
    user.isActive = true;
    user.isVerified = true;
    user.lastLogin = new Date();
    await this.userRepository.save(user);

    if (!user.userRoles?.length) {
      await this.assignCustomerRole(user);
    }

    const full = await this.loadUser(user.id);
    const tokens = await this.tokenService.issueTokens(full, 'customer', meta);
    return {
      success: true,
      message: 'رمز عبور با موفقیت تغییر کرد',
      data: {
        user: this.tokenService.toAuthUser(full),
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
