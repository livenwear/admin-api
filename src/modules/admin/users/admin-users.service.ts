import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import {
  AuditLog,
  ImpersonationGrant,
  Role,
  RoleSlug,
  User,
  UserRoleEntity,
  Address,
} from 'src/entities';
import { TokenService } from 'src/modules/auth/shared/token.service';
import { CustomerWishlistService } from 'src/modules/customer/customer-wishlist.service';
import { Brackets, Repository } from 'typeorm';
import {
  AdminCreateUserDto,
  AdminListUsersQueryDto,
  AdminUpdateUserDto,
} from './dto/admin-users.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepository: Repository<UserRoleEntity>,
    @InjectRepository(ImpersonationGrant)
    private readonly grantRepository: Repository<ImpersonationGrant>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly wishlistService: CustomerWishlistService,
  ) {}

  async list(query: AdminListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';

    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role');

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('user.firstName ILIKE :term', { term })
            .orWhere('user.lastName ILIKE :term', { term })
            .orWhere('user.phone ILIKE :term', { term })
            .orWhere('user.email ILIKE :term', { term });
        }),
      );
    }

    if (query.isActive === 'true' || query.isActive === 'false') {
      qb.andWhere('user.isActive = :isActive', {
        isActive: query.isActive === 'true',
      });
    }

    if (query.isVerified === 'true' || query.isVerified === 'false') {
      qb.andWhere('user.isVerified = :isVerified', {
        isVerified: query.isVerified === 'true',
      });
    }

    if (query.role?.trim()) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM user_roles ur2
          INNER JOIN roles r2 ON r2.id = ur2.role_id
          WHERE ur2.user_id = user.id AND r2.slug = :roleSlug
        )`,
        { roleSlug: query.role.trim() },
      );
    }

    const sortable = new Set([
      'createdAt',
      'updatedAt',
      'lastLogin',
      'firstName',
      'lastName',
      'phone',
      'email',
    ]);
    const column = sortable.has(sortBy) ? sortBy : 'createdAt';
    qb.orderBy(`user.${column}`, sortOrder);

    const total = await qb.clone().getCount();
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const data = await qb
      .skip((safePage - 1) * limit)
      .take(limit)
      .getMany();

    const from = total === 0 ? 0 : (safePage - 1) * limit + 1;
    const to = total === 0 ? 0 : Math.min(safePage * limit, total);

    return {
      success: true,
      data: data.map((u) => this.toAdminUser(u)),
      meta: {
        page: safePage,
        limit,
        total,
        totalPages,
        hasNext: safePage < totalPages,
        hasPrev: safePage > 1,
        from,
        to,
        sortBy: column,
        sortOrder,
      },
    };
  }

  async getOne(uuid: string) {
    const user = await this.findByUuidOrFail(uuid);
    return { success: true, data: this.toAdminUser(user, true) };
  }

  async getWishlist(uuid: string) {
    const user = await this.findByUuidOrFail(uuid);
    const data = await this.wishlistService.listForUserId(user.id);
    return { success: true, data };
  }

  async getAddresses(uuid: string) {
    const user = await this.findByUuidOrFail(uuid);
    const rows = await this.addressRepository.find({
      where: { userId: user.id },
      order: { isDefault: 'DESC', updatedAt: 'DESC' },
    });
    return {
      success: true,
      data: {
        count: rows.length,
        items: rows.map((row) => ({
          uuid: row.uuid,
          title: row.title,
          province: row.province,
          city: row.city,
          addressLine1: row.addressLine1,
          plaque: row.plaque,
          unit: row.unit,
          postalCode: row.postalCode,
          phone: row.phone,
          isDefault: row.isDefault,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
      },
    };
  }

  async create(dto: AdminCreateUserDto, actor: User) {
    await this.assertUniqueContacts(dto.phone, dto.email);

    if (!dto.phone && !dto.email) {
      throw new BadRequestException('At least phone or email is required.');
    }

    const hashed = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : null;

    const user = await this.userRepository.save(
      this.userRepository.create({
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone || null,
        email: dto.email || null,
        password: hashed,
        isActive: dto.isActive ?? true,
        isVerified: dto.isVerified ?? true,
        twoFactorEnabled: false,
      }),
    );

    const roleSlugs = dto.roles?.length ? dto.roles : [RoleSlug.USER];
    await this.replaceRoles(user, roleSlugs);

    const full = await this.findByUuidOrFail(user.uuid);
    await this.writeAudit(actor, 'user.create', full.uuid, {
      phone: full.phone,
      email: full.email,
    });

    return {
      success: true,
      message: 'User created',
      data: this.toAdminUser(full, true),
    };
  }

  async update(uuid: string, dto: AdminUpdateUserDto, actor: User) {
    const user = await this.findByUuidOrFail(uuid);
    this.guardStaffMutation(user, actor, dto.roles);

    if (dto.phone !== undefined || dto.email !== undefined) {
      await this.assertUniqueContacts(
        dto.phone === undefined ? undefined : dto.phone,
        dto.email === undefined ? undefined : dto.email,
        user.id,
      );
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phone !== undefined) user.phone = dto.phone || null;
    if (dto.email !== undefined) user.email = dto.email || null;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.isVerified !== undefined) user.isVerified = dto.isVerified;
    if (dto.password) {
      user.password = await bcrypt.hash(dto.password, 10);
    }

    await this.userRepository.save(user);

    if (dto.roles) {
      await this.replaceRoles(user, dto.roles);
    }

    const full = await this.findByUuidOrFail(uuid);
    await this.writeAudit(actor, 'user.update', full.uuid, {
      fields: Object.keys(dto),
    });

    return {
      success: true,
      message: 'User updated',
      data: this.toAdminUser(full, true),
    };
  }

  async softDelete(uuid: string, actor: User) {
    const user = await this.findByUuidOrFail(uuid);
    this.guardStaffMutation(user, actor);

    if (user.uuid === actor.uuid) {
      throw new BadRequestException('You cannot delete your own account.');
    }

    await this.userRepository.softRemove(user);
    await this.writeAudit(actor, 'user.delete', uuid, null);

    return { success: true, message: 'User deleted' };
  }

  async impersonate(
    uuid: string,
    actor: User,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const target = await this.findByUuidOrFail(uuid);
    const targetRoles = this.tokenService.getRoleSlugs(target);

    if (
      targetRoles.includes(RoleSlug.ADMIN) ||
      targetRoles.includes(RoleSlug.SUPER_ADMIN)
    ) {
      throw new ForbiddenException('Cannot impersonate staff accounts.');
    }

    if (!target.isActive) {
      throw new ForbiddenException('Target user is inactive.');
    }

    const ttlSeconds = Number(
      this.configService.get('IMPERSONATION_TTL_SECONDS', '60'),
    );
    const code = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.grantRepository.save(
      this.grantRepository.create({
        code,
        adminUser: actor,
        targetUser: target,
        expiresAt,
        usedAt: null,
        adminIp: meta?.ipAddress ?? null,
        adminUserAgent: meta?.userAgent ?? null,
      }),
    );

    await this.writeAudit(actor, 'user.impersonate', target.uuid, {
      targetPhone: target.phone,
      expiresAt,
    }, meta);

    const customerWebUrl = this.configService.get<string>(
      'CUSTOMER_WEB_URL',
      'http://localhost:3000',
    );

    return {
      success: true,
      message: 'Impersonation grant created',
      data: {
        code,
        expiresIn: ttlSeconds,
        expiresAt,
        exchangePath: `/auth/impersonate?code=${code}`,
        redirectUrl: `${customerWebUrl.replace(/\/$/, '')}/auth/impersonate?code=${code}`,
        target: {
          uuid: target.uuid,
          firstName: target.firstName,
          lastName: target.lastName,
          phone: target.phone,
        },
      },
    };
  }

  private async findByUuidOrFail(uuid: string) {
    const user = await this.userRepository.findOne({
      where: { uuid },
      relations: ['userRoles', 'userRoles.role'],
    });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  private async assertUniqueContacts(
    phone?: string | null,
    email?: string | null,
    excludeId?: number,
  ) {
    if (phone) {
      const existing = await this.userRepository.findOne({ where: { phone } });
      if (existing && existing.id !== excludeId) {
        throw new ConflictException('Phone number already in use.');
      }
    }
    if (email) {
      const existing = await this.userRepository.findOne({ where: { email } });
      if (existing && existing.id !== excludeId) {
        throw new ConflictException('Email already in use.');
      }
    }
  }

  private async replaceRoles(user: User, roleSlugs: string[]) {
    const unique = [...new Set(roleSlugs.map((s) => s.trim()).filter(Boolean))];
    if (!unique.length) {
      throw new BadRequestException('At least one role is required.');
    }

    const roles = await this.roleRepository.find();
    const bySlug = new Map(roles.map((r) => [r.slug, r]));

    for (const slug of unique) {
      if (!bySlug.has(slug as RoleSlug)) {
        throw new BadRequestException(`Unknown role: ${slug}`);
      }
    }

    await this.userRoleRepository.delete({ userId: user.id });
    for (const slug of unique) {
      const role = bySlug.get(slug as RoleSlug)!;
      await this.userRoleRepository.save(
        this.userRoleRepository.create({ user, role }),
      );
    }
  }

  private guardStaffMutation(
    target: User,
    actor: User,
    nextRoles?: string[],
  ) {
    const actorRoles = this.tokenService.getRoleSlugs(actor);
    const targetRoles = this.tokenService.getRoleSlugs(target);
    const actorIsSuper = actorRoles.includes(RoleSlug.SUPER_ADMIN);

    if (
      targetRoles.includes(RoleSlug.SUPER_ADMIN) &&
      !actorIsSuper
    ) {
      throw new ForbiddenException('Only super admin can modify super admins.');
    }

    if (
      nextRoles?.includes(RoleSlug.SUPER_ADMIN) &&
      !actorIsSuper
    ) {
      throw new ForbiddenException('Only super admin can assign super_admin.');
    }
  }

  private toAdminUser(user: User, detailed = false) {
    const base = {
      uuid: user.uuid,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      bio: user.bio,
      isActive: user.isActive,
      isVerified: user.isVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: this.tokenService.getRoleSlugs(user),
      hasPassword: Boolean(user.password),
    };

    if (!detailed) return base;

    return {
      ...base,
      id: user.id,
    };
  }

  private async writeAudit(
    actor: User,
    action: string,
    entityId: string,
    metadata: Record<string, unknown> | null,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        user: actor,
        action,
        entityType: 'user',
        entityId,
        metadata,
        ipAddress: meta?.ipAddress ?? null,
        userAgent: meta?.userAgent ?? null,
      }),
    );
  }
}
