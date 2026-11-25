import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsString, Matches, ValidateIf } from 'class-validator';
import { deviceAmountField, termField } from '../openapi/financial-fields';
import {
  DEVICE_AMOUNT_FORMAT,
  REPAYMENT_TERMS,
  type RepaymentTerm,
} from '../repayment/repayment-calculator';

const PAGE_FORMAT = /^(?:[1-9]\d{0,5}|1000000)$/;
const PAGE_SIZE_FORMAT = /^(?:[1-9]\d?|100)$/;

export class CreateContractDto {
  @ApiProperty(deviceAmountField)
  @IsString()
  @Matches(DEVICE_AMOUNT_FORMAT)
  deviceAmount!: string;

  @ApiProperty(termField)
  @IsIn(REPAYMENT_TERMS)
  termMonths!: RepaymentTerm;
}

export class UpdateContractDto {
  @ApiPropertyOptional(deviceAmountField)
  @ValidateIf((_input: unknown, value: unknown) => value !== undefined)
  @IsString()
  @Matches(DEVICE_AMOUNT_FORMAT)
  deviceAmount?: string;

  @ApiPropertyOptional(termField)
  @ValidateIf((_input: unknown, value: unknown) => value !== undefined)
  @IsIn(REPAYMENT_TERMS)
  termMonths?: RepaymentTerm;
}

export class ListContractsDto {
  @ApiPropertyOptional({
    type: 'string',
    pattern: PAGE_FORMAT.source,
    default: '1',
    description: 'Page number from 1 through 1,000,000.',
  })
  @Matches(PAGE_FORMAT)
  page = '1';

  @ApiPropertyOptional({
    type: 'string',
    pattern: PAGE_SIZE_FORMAT.source,
    default: '20',
    description: 'Items per page, from 1 through 100.',
  })
  @Matches(PAGE_SIZE_FORMAT)
  pageSize = '20';
}
