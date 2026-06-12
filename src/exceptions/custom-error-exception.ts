import { HttpException, HttpStatus } from '@nestjs/common';

export class CustomErrorException extends HttpException {
  constructor(message: string, error: string, statusCode: number = HttpStatus.BAD_REQUEST) {
    super(
      {
        message,
        error,
        statusCode,
      },
      statusCode,
    );
  }
}
