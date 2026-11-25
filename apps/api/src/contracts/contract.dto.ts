import { IsIn, IsString, Matches, ValidateIf } from 'class-validator';
import {
  DEVICE_AMOUNT_FORMAT,
  REPAYMENT_TERMS,
  type RepaymentTerm,
} from '../repayment/repayment-calculator';

export class CreateContractDto {
  @IsString()
  @Matches(DEVICE_AMOUNT_FORMAT)
  deviceAmount!: string;

  @IsIn(REPAYMENT_TERMS)
  termMonths!: RepaymentTerm;
}

export class UpdateContractDto {
  @ValidateIf((_input: unknown, value: unknown) => value !== undefined)
  @IsString()
  @Matches(DEVICE_AMOUNT_FORMAT)
  deviceAmount?: string;

  @ValidateIf((_input: unknown, value: unknown) => value !== undefined)
  @IsIn(REPAYMENT_TERMS)
  termMonths?: RepaymentTerm;
}

export class ListContractsDto {
  @Matches(/^(?:[1-9]\d{0,5}|1000000)$/)
  page = '1';

  @Matches(/^(?:[1-9]\d?|100)$/)
  pageSize = '20';
}
