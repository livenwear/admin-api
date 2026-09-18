import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role, RoleSlug, User, UserRoleEntity } from 'src/entities';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepository: Repository<UserRoleEntity>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureRoles();
    await this.ensureSuperAdmin();
    await this.ensureDemoCustomers();
  }

  private async ensureRoles() {
    const defs: Array<{
      slug: RoleSlug;
      name: string;
      description: string;
    }> = [
      {
        slug: RoleSlug.USER,
        name: 'User',
        description: 'Customer / storefront user',
      },
      {
        slug: RoleSlug.ADMIN,
        name: 'Admin',
        description: 'Store administrator',
      },
      {
        slug: RoleSlug.SUPER_ADMIN,
        name: 'Super Admin',
        description: 'Full system access',
      },
    ];

    for (const def of defs) {
      const existing = await this.roleRepository.findOne({
        where: { slug: def.slug },
      });
      if (existing) continue;

      await this.roleRepository.save(
        this.roleRepository.create({
          slug: def.slug,
          name: def.name,
          description: def.description,
          isSystem: true,
        }),
      );
      this.logger.log(`Seeded role: ${def.slug}`);
    }
  }

  private async ensureSuperAdmin() {
    const email = this.configService.get<string>(
      'SUPER_ADMIN_EMAIL',
      'superadmin@liven.local',
    );
    const password = this.configService.get<string>(
      'SUPER_ADMIN_PASSWORD',
      'SuperAdmin@1234',
    );
    const firstName = this.configService.get<string>(
      'SUPER_ADMIN_FIRST_NAME',
      'Super',
    );
    const lastName = this.configService.get<string>(
      'SUPER_ADMIN_LAST_NAME',
      'Admin',
    );

    const superRole = await this.roleRepository.findOne({
      where: { slug: RoleSlug.SUPER_ADMIN },
    });
    if (!superRole) {
      this.logger.error('SUPER_ADMIN role missing — cannot seed user');
      return;
    }

    let user = await this.userRepository.findOne({
      where: { email },
      relations: ['userRoles', 'userRoles.role'],
    });

    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = await this.userRepository.save(
        this.userRepository.create({
          email,
          password: hashedPassword,
          firstName,
          lastName,
          isActive: true,
          isVerified: true,
          twoFactorEnabled: false,
        }),
      );
      this.logger.log(`Seeded SUPER_ADMIN user: ${email}`);
    }

    const hasRole = await this.userRoleRepository.findOne({
      where: { userId: user.id, roleId: superRole.id },
    });
    if (!hasRole) {
      await this.userRoleRepository.save(
        this.userRoleRepository.create({
          user,
          role: superRole,
        }),
      );
      this.logger.log(`Assigned SUPER_ADMIN role to: ${email}`);
    } else {
      this.logger.log(`Super admin already exists: ${email}`);
    }
  }

  /** Demo storefront customers for local login tests */
  private async ensureDemoCustomers() {
    const customerRole = await this.roleRepository.findOne({
      where: { slug: RoleSlug.USER },
    });
    if (!customerRole) {
      this.logger.error('USER role missing — cannot seed demo customers');
      return;
    }

    const password = 'Customer@1234';
    const hashedPassword = await bcrypt.hash(password, 10);
    const demos: Array<{
      phone: string;
      firstName: string;
      lastName: string;
    }> = [
      { phone: '09121111111', firstName: 'سارا', lastName: 'محمدی' },
      { phone: '09122222222', firstName: 'رضا', lastName: 'کریمی' },
      { phone: '09123333333', firstName: 'نرگس', lastName: 'احمدی' },
      { phone: '09124444444', firstName: 'امیر', lastName: 'حسینی' },
    ];

    for (const demo of demos) {
      let user = await this.userRepository.findOne({
        where: { phone: demo.phone },
      });

      if (!user) {
        user = await this.userRepository.save(
          this.userRepository.create({
            phone: demo.phone,
            password: hashedPassword,
            firstName: demo.firstName,
            lastName: demo.lastName,
            email: null,
            isActive: true,
            isVerified: true,
            twoFactorEnabled: false,
          }),
        );
        this.logger.log(`Seeded demo customer: ${demo.phone}`);
      }

      const hasRole = await this.userRoleRepository.findOne({
        where: { userId: user.id, roleId: customerRole.id },
      });
      if (!hasRole) {
        await this.userRoleRepository.save(
          this.userRoleRepository.create({
            user,
            role: customerRole,
          }),
        );
      }
    }
  }
}
