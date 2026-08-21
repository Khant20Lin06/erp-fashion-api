import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'current-password-123',
    description: 'The current password for the authenticated user.',
  })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({
    example: 'new-password-456',
    minLength: 8,
    description: 'Replacement password that satisfies the password policy.',
  })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
