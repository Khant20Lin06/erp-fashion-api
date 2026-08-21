import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'admin@example.com',
    description: 'Email address for the password reset request.',
  })
  @IsEmail()
  email!: string;
}
