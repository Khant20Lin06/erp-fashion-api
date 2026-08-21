import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'admin@example.com',
    description: 'User email address.',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'correct-horse-battery-staple',
    description: 'Plain-text password for the login attempt.',
  })
  @IsString()
  @MinLength(1)
  password!: string;
}
