import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';

export const ACCOUNT_PATTERN = /^ACC-[A-Za-z0-9]{5}$/;
export const TYPES = ['deposit', 'withdrawal', 'transfer'] as const;
export type TransactionType = typeof TYPES[number];

export function invalid(field: string, message: string): never {
  throw new BadRequestException({ error: 'Validation failed', details: [{ field, message }] });
}

export class AccountParams {
  @IsString()
  @Matches(ACCOUNT_PATTERN, { message: 'Account must match ACC-XXXXX (alphanumeric)' })
  accountId!: string;
}

export function validationPipe() {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: (errors: ValidationError[]) => new BadRequestException({
      error: 'Validation failed',
      details: errors.flatMap(error => Object.values(error.constraints ?? {}).map(message => ({
        field: error.property, message,
      }))),
    }),
  });
}
