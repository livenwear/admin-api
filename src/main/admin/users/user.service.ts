import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateUserDto, GetUsersDto, UpdateUserDto } from './dto/user.dto';
import * as bcrypt from 'bcrypt';
import { User } from 'src/database/entities/user/user.entity';
import { hashPassword } from 'src/common/hashPassword';
import { UserRole } from 'src/common/type';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    try {
    
      const { password, firstName, lastName, email, role } = createUserDto;
      
      const hashedPassword = await hashPassword(password);
    
      const user = this.userRepository.create({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: role || UserRole.USER, 
      });
    
      const savedUser = await this.userRepository.save(user);
      return savedUser;
    
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

    const where: any = {};

    if (firstName) where.firstName = firstName;
    if (lastName) where.lastName = lastName;
    if (email) where.email = email;
    if (role) where.role = role;
    if (isVerified !== undefined) where.isVerified = isVerified === 'true';
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (twoFactorEnabled !== undefined) where.twoFactorEnabled = twoFactorEnabled === 'true';
    if (phone) where.phone = phone;

    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;

    // Filtered + paginated users
    const [users, filteredTotal] = await this.userRepository.findAndCount({
      where,
      order: {
        [sortBy]: sortOrder,
      },
      skip,
      take,
    });

    // Total users (unfiltered)
    const totalAllUsers = await this.userRepository.count();

    return {
      data: users,
      meta: {
        totalItems: filteredTotal,
        totalPages: Math.ceil(filteredTotal / take),
        currentPage: parseInt(page, 10),
        itemsPerPage: take,
        allItems:totalAllUsers, // 👈 include in response
      },
    };
  } catch (error) {
    console.error('UserService.getAllUsers Error:', error);
    throw new InternalServerErrorException('Error retrieving users');
  }
}



  async getUserById(id: number): Promise<User> {
    try {
      const user = await this.userRepository.findOne({ where: { id } });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return user;
    } catch (error) {
      console.error(`Error retrieving user with ID ${id}: ${error.message}`);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(`Error retrieving user with ID ${id}: ${error.message}`);
    }
  }
 
 
  async updateUser(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    try {
     

      // Retrieve user by ID using 'findOne' method
      const user = await this.userRepository.findOne({ where: { id } });

      // If user doesn't exist, throw a NotFoundException
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      Object.assign(user, updateUserDto);

      if (updateUserDto.password) {
        user.password = await hashPassword(updateUserDto.password); 
      }

      return await this.userRepository.save(user);

    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw new InternalServerErrorException(`Error updating user with ID ${id}: ${error.message}`);
      }

      throw error;
    }
  }
  async deleteUser(id: number): Promise<void> {
    try {
      const user = await this.getUserById(id);
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
  
      await this.userRepository.softRemove(user);
    } catch (error) {
      throw error;
    }
  }

  async deleteUserHardDelete(id: number): Promise<void> {
    try {
      const user = await this.userRepository.findOne({
        where: { id },
        withDeleted: true,
      });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
  
      await this.userRepository.delete({id:user.id});
    } catch (error) {
      throw error;
    }
  }
}
