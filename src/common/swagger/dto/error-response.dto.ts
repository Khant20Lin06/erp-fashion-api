import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 401 })
  statusCode!: number;

  @ApiProperty({ example: 'AUTHENTICATION_FAILED' })
  code!: string;

  @ApiProperty({ example: 'Invalid email or password' })
  message!: string;

  @ApiProperty({ example: '/api/v1/auth/login' })
  path!: string;

  @ApiProperty({ example: '2026-08-15T09:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: 'b471e8f0-4da9-45d5-97ca-2c2c44d9b4a4' })
  requestId!: string;
}
