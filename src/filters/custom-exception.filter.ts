import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class CustomExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    const status = exception.getStatus ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception.getResponse();

    // Torob Product API expects plain `{ error: "..." }` on 4xx
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'error' in exceptionResponse &&
      typeof (exceptionResponse as { error?: unknown }).error === 'string' &&
      !('message' in exceptionResponse) &&
      !('statusCode' in exceptionResponse)
    ) {
      response.status(status).json({
        error: (exceptionResponse as { error: string }).error,
      });
      return;
    }

    // Ensure response is always formatted correctly
    const errorResponse = {
      message: (exceptionResponse as any).message || 'Something went wrong',
      error: (exceptionResponse as any).error || 'Internal Server Error',
      statusCode: status,
    };

    response.status(status).json(errorResponse);
  }
}
