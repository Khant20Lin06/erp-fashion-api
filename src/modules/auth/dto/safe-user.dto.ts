import { User } from '../../users/entities/user.entity';

export interface SafeUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  status: string;
}

export function toSafeUserDto(user: User): SafeUserDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    status: user.status,
  };
}
