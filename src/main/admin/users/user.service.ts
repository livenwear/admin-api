import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto, GetUsersDto, UpdateUserDto } from './dto/user.dto';
import { Role, User, UserRole, UserRoleEntity } from 'src/entities';
import { hashPassword } from 'src/common/hashPassword';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepository: Repository<UserRoleEntity>,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    try {
      const { password, firstName, lastName, email, role } = createUserDto;
      const hashedPassword = await hashPassword(password);

      const user = await this.userRepository.save(
        this.userRepository.create({
          firstName,
          lastName,
          email,
          password: hashedPassword,
        }),
      );

      const roleSlug = role || UserRole.USER;
      const roleEntity = await this.roleRepository.findOne({
        where: { slug: roleSlug },
      });
      if (roleEntity) {
        await this.userRoleRepository.save(
          this.userRoleRepository.create({ user, role: roleEntity }),
        );
      }

      return this.getUserById(user.id);
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async getAllUsers(query: GetUsersDto): Promise<{
    data: User[];
    meta: {
      totalItems: number;
      totalPages: number;
      currentPage: number;
      itemsPerPage: number;
      allItems: number;
    };
  }> {
    try {
      const {
        firstName,
        lastName,
        email,
        role,
        isVerified,
        isActive,
        twoFactorEnabled,
        phone,
        page = '1',
        limit = '10',
        sortBy = 'createdAt',
        sortOrder = 'DESC',
      } = query;

      const qb = this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.userRoles', 'userRole')
        .leftJoinAndSelect('userRole.role', 'role');

      if (firstName) qb.andWhere('user.firstName = :firstName', { firstName });
      if (lastName) qb.andWhere('user.lastName = :lastName', { lastName });
      if (email) qb.andWhere('user.email = :email', { email });
      if (role) qb.andWhere('role.slug = :role', { role });
      if (isVerified !== undefined) {
        qb.andWhere('user.isVerified = :isVerified', {
          isVerified: isVerified === 'true',
        });
      }
      if (isActive !== undefined) {
        qb.andWhere('user.isActive = :isActive', {
          isActive: isActive === 'true',
        });
      }
      if (twoFactorEnabled !== undefined) {
        qb.andWhere('user.twoFactorEnabled = :twoFactorEnabled', {
          twoFactorEnabled: twoFactorEnabled === 'true',
        });
      }
      if (phone) qb.andWhere('user.phone = :phone', { phone });

      const take = parseInt(limit, 10);
      const skip = (parseInt(page, 10) - 1) * take;

      qb.orderBy(`user.${sortBy}`, sortOrder as 'ASC' | 'DESC')
        .skip(skip)
        .take(take);

      const [users, filteredTotal] = await qb.getManyAndCount();
      const totalAllUsers = await this.userRepository.count();

      return {
        data: users,
        meta: {
          totalItems: filteredTotal,
          totalPages: Math.ceil(filteredTotal / take),
          currentPage: parseInt(page, 10),
          itemsPerPage: take,
          allItems: totalAllUsers,
        },
      };
    } catch (error) {
      console.error('UserService.getAllUsers Error:', error);
      throw new InternalServerErrorException('Error retrieving users');
    }
  }

  async getUserById(id: number): Promise<User> {
    try {
      const user = await this.userRepository.findOne({
        where: { id },
        relations: ['userRoles', 'userRoles.role'],
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Error retrieving user with ID ${id}: ${error.message}`,
      );
    }
  }

  async updateUser(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      const { role, password, ...rest } = updateUserDto;
      Object.assign(user, rest);

      if (password) {
        user.password = await hashPassword(password);
      }

      await this.userRepository.save(user);

      if (role) {
        const roleEntity = await this.roleRepository.findOne({
          where: { slug: role },
        });
        if (roleEntity) {
          await this.userRoleRepository.delete({ userId: user.id });
          await this.userRoleRepository.save(
            this.userRoleRepository.create({ user, role: roleEntity }),
          );
        }
      }

      return this.getUserById(user.id);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Error updating user with ID ${id}: ${error.message}`,
      );
    }
  }

  async deleteUser(id: number): Promise<void> {
    const user = await this.getUserById(id);
    await this.userRepository.softRemove(user);
  }

  async deleteUserHardDelete(id: number): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.userRepository.delete({ id: user.id });
  }
}
