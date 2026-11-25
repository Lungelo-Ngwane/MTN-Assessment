import {
  DEVICE_AMOUNT_FORMAT,
  REPAYMENT_TERMS,
} from '../repayment/repayment-calculator';

export const deviceAmountField = {
  type: 'string' as const,
  pattern: DEVICE_AMOUNT_FORMAT.source,
  example: '15000.00',
  description:
    'Positive ZAR decimal string with up to two decimal places. The technical supported range is R0.01 to R906,319,135,069.39.',
};

export const termField = {
  type: 'integer' as const,
  enum: [...REPAYMENT_TERMS],
  example: 12,
  description: 'Repayment term in months.',
};
