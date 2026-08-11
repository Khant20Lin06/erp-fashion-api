import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

const MIN_PASSWORD_LENGTH = 8;

@Injectable()
export class PasswordService {
  async hash(plainPassword: string): Promise<string> {
    return hash(plainPassword);
  }

  async verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    return verify(passwordHash, plainPassword);
  }

  validatePolicy(plainPassword: string): boolean {
    return plainPassword.length >= MIN_PASSWORD_LENGTH;
  }
}
