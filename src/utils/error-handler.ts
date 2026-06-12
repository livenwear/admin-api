import { HttpException, HttpStatus } from '@nestjs/common';

export class ErrorHandler {
    static process(error: any): HttpException {
        if (error instanceof HttpException) {
            return error;
        } return new HttpException(
            {
                message: error?.message || 'An unexpected error occurred',
                error: error?.name || 'InternalServerError',
            },
            HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
}
