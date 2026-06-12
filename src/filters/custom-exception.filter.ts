import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class CustomExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    const status = exception.getStatus ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception.getResponse();

    // Ensure response is always formatted correctly
    const errorResponse = {
      message: (exceptionResponse as any).message || 'Something went wrong',
      error: (exceptionResponse as any).error || 'Internal Server Error',
      statusCode: status,
    };

    response.status(status).json(errorResponse);
  }
}
