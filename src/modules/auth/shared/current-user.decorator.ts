import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from 'src/entities';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as User;
  },
);

/** Nullable user for optional-auth routes (guest cart). */
export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User | null => {
    const request = ctx.switchToHttp().getRequest();
    return (request.user as User) || null;
  },
);
