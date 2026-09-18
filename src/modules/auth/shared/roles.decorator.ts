import { SetMetadata } from '@nestjs/common';
import { RoleSlug } from 'src/entities';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RoleSlug[]) => SetMetadata(ROLES_KEY, roles);

export const AUDIENCE_KEY = 'audience';
export const AuthAudienceRequired = (audience: 'admin' | 'customer') =>
  SetMetadata(AUDIENCE_KEY, audience);
