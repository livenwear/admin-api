import { Injectable, UnauthorizedException, ConflictException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { authenticator } from 'otplib';
import { SignInDto, SignUpDto, TwoFactorDto, EnableTwoFactorDto } from './dto/auth.dto';
import { User } from 'src/database/entities/user/user.entity';
import { Response } from 'express';
import { CustomErrorException } from 'src/exceptions/custom-error-exception';
import { ErrorHandler } from 'src/utils/error-handler';
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) { }

  // ✅ Hash password function
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  // ✅ Compare password function
  private async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // async signUp(dto: SignUpDto): Promise<{ message: string }> {
  //   const userExists = await this.userRepository.findOne({ where: { email: dto.email } });
  //   if (userExists) {
  //     throw new ConflictException('User already exists');
  //   }

  //   // Ensure hashing before saving
  //   const hashedPassword = await this.hashPassword(dto.password);
  //   const newUser = this.userRepository.create({
  //     ...dto,
  //     password: hashedPassword, // Ensure hashed password is saved
  //   });

  //   await this.userRepository.save(newUser);
  //   return { message: 'User registered successfully' };
  // }



  async signIn(dto: SignInDto, res: Response): Promise<void> {
    try {
      console.log("Start signIn process");

      // Fetch user from database
      console.log("Fetching user from database...");
      const user = await this.userRepository.findOne({ where: { email: dto.email } });
      console.log("User fetched", user);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Validate password
      console.log("Validating password...");
      const isPasswordValid = await this.comparePassword(dto.password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // If user has enabled 2FA, require verification
      if (user.twoFactorEnabled) {
        console.log("2FA required");
        res.json({ message: '2FA required', twoFactorRequired: true, success: true });
        return; // End execution if 2FA is required
      }

      // Generate JWT token (user-specific payload)
      console.log("Generating JWT token...");
      const token = this.jwtService.sign({ userUuid: user.uuid, email: user.email });

      // Set JWT in HttpOnly cookie
      console.log("Setting JWT in cookie...");
      res.cookie('authToken', token, {
        httpOnly: true,
        secure: false, // Set to true when in production with HTTPS
        maxAge: 3600000, // 1 hour
        sameSite: 'strict',
      });

      console.log("Login successful");

      // Send success response to the client
      res.status(200).json({ message: 'Login successful', twoFactorRequired: false, success: true, data: { uuid: user.uuid,firstName: user.firstName , lastName: user.lastName , avatar: user.avatar, } });

    } catch (error) {
      // Handle errors and return appropriate response
      console.error('Error during signIn:', error);
      if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
        res.status(404).json({ message: error.message }); // Return specific error message
        return;
      }
      throw ErrorHandler.process(error);
    }
  }




  // Method to compare passwords (bcrypt)






  async getUserById(userUuid: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { uuid: userUuid } });
  }


}
