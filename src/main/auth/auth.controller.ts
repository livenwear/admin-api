import { Controller, Post, Body, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto, SignUpDto, TwoFactorDto, EnableTwoFactorDto } from './dto/auth.dto';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@ApiTags('auth') // Group routes under the 'auth' tag in Swagger
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // @Post('signup')
  // @ApiOperation({ summary: 'Sign up a new user' }) // Operation summary
  // @ApiBody({ type: SignUpDto }) // Body schema for the request
  // @ApiResponse({ status: 201, description: 'User successfully created.' })
  // @ApiResponse({ status: 400, description: 'Bad request.' })
  // signUp(@Body() dto: SignUpDto) {
  //   return this.authService.signUp(dto);
  // }

  @Post('signin')
  @ApiOperation({ summary: 'Sign in an existing user' }) // Operation summary
  @ApiBody({ type: SignInDto }) // Body schema for the request
  @ApiResponse({ status: 200, description: 'User signed in successfully.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async signIn(@Body() dto: SignInDto, @Res() res: Response<any, Record<string, any>>) {
    return this.authService.signIn(dto, res); // Call the service method
  }
}
