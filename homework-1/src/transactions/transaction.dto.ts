import { IsIn, IsNumber, IsString, Matches, ValidateIf, Min } from 'class-validator';
import { ACCOUNT_PATTERN, TransactionType, TYPES } from '../common/validation';

export class CreateTransactionDto {
  @ValidateIf((body, value) => body.type !== 'deposit' || value !== undefined)
  @IsString()
  @Matches(ACCOUNT_PATTERN)
  fromAccount?: string;

  @ValidateIf((body, value) => body.type !== 'withdrawal' || value !== undefined)
  @IsString()
  @Matches(ACCOUNT_PATTERN)
  toAccount?: string;

  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @IsIn(TYPES)
  type!: TransactionType;
}

export class TransactionQueryDto {
  @ValidateIf((_body, value) => value !== undefined)
  @IsString()
  @Matches(ACCOUNT_PATTERN)
  accountId?: string;

  @ValidateIf((_body, value) => value !== undefined)
  @IsIn(TYPES)
  type?: TransactionType;

  @ValidateIf((_body, value) => value !== undefined)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ValidateIf((_body, value) => value !== undefined)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}
