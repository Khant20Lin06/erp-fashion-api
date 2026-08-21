import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'password-reset-token',
    description: 'Raw password reset token issued by the backend.',
  })
  @IsString()
  @MinLength(1)
  token!: string;

  @ApiProperty({
    example: 'reset-password-999',
    minLength: 8,
    description: 'New password to store if the reset token is valid.',
  })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
