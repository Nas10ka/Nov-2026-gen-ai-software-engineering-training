import { IsIn, IsString, Matches, ValidateBy, ValidateIf } from 'class-validator';
import { ACCOUNT_PATTERN, TransactionType, TYPES } from '../common/validation';
import { isMonetaryAmount } from './money';

export class CreateTransactionDto {
  @ValidateIf((body, value) => body.type !== 'deposit' || value !== undefined)
  @IsString()
  @Matches(ACCOUNT_PATTERN)
  fromAccount?: string;

  @ValidateIf((body, value) => body.type !== 'withdrawal' || value !== undefined)
  @IsString()
  @Matches(ACCOUNT_PATTERN)
  toAccount?: string;

  @ValidateBy({
    name: 'isMonetaryAmount',
    validator: {
      validate: isMonetaryAmount,
      defaultMessage: () => 'Amount must be a positive number with at most two decimal places within safe monetary precision',
    },
  })
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
