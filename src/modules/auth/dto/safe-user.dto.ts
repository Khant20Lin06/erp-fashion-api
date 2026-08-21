import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';

export class SafeUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'admin@example.com' })
  email!: string;

  @ApiProperty({ example: 'Ada' })
  firstName!: string;

  @ApiProperty({ example: 'Lovelace' })
  lastName!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  displayName!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;
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
