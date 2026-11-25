import type { OpenAPIObject } from '@nestjs/swagger';
import type { ContractRecord } from '../contracts/contract.repository';
import { ERROR_DEFINITIONS, type ErrorResponse } from '../http/http-errors';
import type { RepaymentOption } from '../repayment/repayment-calculator';
import { termField } from './financial-fields';

type Schemas = NonNullable<NonNullable<OpenAPIObject['components']>['schemas']>;
type Schema = Schemas[string];

export const EXAMPLE_REQUEST_ID = '5eaaa702-477a-4f3a-93ad-864ff5bbb83d';
export const EXAMPLE_TIMESTAMP = '2026-11-25T10:00:00.000Z';

export function ref(name: string): { $ref: string } {
  return { $ref: `#/components/schemas/${name}` };
}

function record(properties: Record<string, Schema>, example?: unknown): Schema {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
    example,
  };
}

const dateTime = {
  type: 'string',
  format: 'date-time',
  example: EXAMPLE_TIMESTAMP,
} as const;
const uuid = { type: 'string', format: 'uuid' } as const;
const owner = 'e57cb305-a042-4ee5-b58f-24c2bbe5bf6e';
const amount = '15000.00';
const rate = '6.500000';
const method = 'reducing-balance-amortisation';
const money = {
  type: 'string',
  pattern: '^(?:0|[1-9][0-9]{0,11})\\.[0-9]{2}$',
} as const;
const interestRate = {
  type: 'string',
  pattern: '^(?:0|[1-9][0-9]{0,2})\\.[0-9]{6}$',
  example: rate,
  description:
    'Annual nominal rate in percentage points, expressed with six decimal places.',
} as const;
const methodField = { type: 'string', example: method } as const;

const options = [
  {
    termMonths: 12,
    monthlyRepayment: '1294.45',
    finalRepayment: '1294.41',
    totalRepayment: '15533.36',
    totalInterest: '533.36',
  },
  {
    termMonths: 24,
    monthlyRepayment: '668.19',
    finalRepayment: '668.28',
    totalRepayment: '16036.65',
    totalInterest: '1036.65',
  },
  {
    termMonths: 36,
    monthlyRepayment: '459.74',
    finalRepayment: '459.56',
    totalRepayment: '16550.46',
    totalInterest: '1550.46',
  },
] satisfies RepaymentOption[];

const payments = {
  monthlyRepayment: {
    ...money,
    example: '1294.45',
    description:
      'Regular instalment for the first termMonths minus one months.',
  },
  finalRepayment: {
    ...money,
    example: '1294.41',
    description: 'Final instalment, adjusted to reconcile the rounded total.',
  },
  totalRepayment: { ...money, example: '15533.36' },
  totalInterest: { ...money, example: '533.36' },
} satisfies Record<Exclude<keyof RepaymentOption, 'termMonths'>, Schema>;

const contractExample = {
  id: 'b3f6ce37-57f2-493b-bfd1-9dc4b3c4a05c',
  userId: owner,
  deviceAmount: amount,
  ...options[0],
  interestRate: rate,
  calculationMethod: method,
  calculationVersion: 1,
  createdAt: EXAMPLE_TIMESTAMP,
  updatedAt: EXAMPLE_TIMESTAMP,
};

export const responseSchemas = {
  UserProfile: record({
    id: { ...uuid, example: owner },
    email: {
      type: 'string',
      format: 'email',
      example: 'assessment@example.test',
    },
    createdAt: dateTime,
    updatedAt: dateTime,
  }),
  AccessToken: record({
    accessToken: {
      type: 'string',
      example: '<JWT>',
      description: 'Signed JWT to supply as a Bearer token.',
    },
    tokenType: { type: 'string', enum: ['Bearer'] },
    expiresIn: {
      type: 'integer',
      minimum: 1,
      maximum: 3600,
      example: 900,
      description: 'Access token lifetime in seconds.',
    },
  }),
  RepaymentOption: record({ termMonths: termField, ...payments }),
  RepaymentQuote: record(
    {
      currency: { type: 'string', enum: ['ZAR'] },
      deviceAmount: { ...money, example: amount },
      annualInterestRate: { ...interestRate, enum: [rate] },
      calculationMethod: methodField,
      options: {
        type: 'array',
        items: ref('RepaymentOption'),
        minItems: 3,
        maxItems: 3,
      },
    },
    {
      currency: 'ZAR',
      deviceAmount: amount,
      annualInterestRate: rate,
      calculationMethod: method,
      options,
    },
  ),
  Contract: record(
    {
      id: uuid,
      userId: { ...uuid, description: 'Owner taken from the JWT subject.' },
      deviceAmount: { ...money, example: amount },
      termMonths: {
        type: 'integer',
        minimum: 1,
        example: 12,
        description:
          'New snapshots use 12, 24 or 36 months. Legacy contracts can contain other positive terms.',
      },
      interestRate,
      ...payments,
      finalRepayment: {
        ...payments.finalRepayment,
        nullable: true,
        description:
          'Adjusted final instalment. Null if unavailable on a legacy snapshot.',
      },
      calculationMethod: {
        ...methodField,
        nullable: true,
        description:
          'Stored calculation strategy. Null if unavailable on a legacy snapshot.',
      },
      calculationVersion: {
        type: 'integer',
        minimum: 1,
        nullable: true,
        example: 1,
        description:
          'Stored calculation version. Null if unavailable on a legacy snapshot.',
      },
      createdAt: dateTime,
      updatedAt: dateTime,
    } satisfies Record<keyof ContractRecord, Schema>,
    contractExample,
  ),
  Pagination: record({
    page: { type: 'integer', minimum: 1, maximum: 1_000_000, example: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 100, example: 20 },
    total: { type: 'integer', minimum: 0, example: 1 },
    totalPages: { type: 'integer', minimum: 0, example: 1 },
  }),
  ContractPage: record(
    {
      items: { type: 'array', items: ref('Contract') },
      pagination: ref('Pagination'),
    },
    {
      items: [contractExample],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    },
  ),
  HealthOk: record({ status: { type: 'string', enum: ['ok'] } }),
  HealthUnavailable: record({
    status: { type: 'string', enum: ['unavailable'] },
  }),
  ErrorResponse: record({
    statusCode: { type: 'integer', minimum: 400, maximum: 599 },
    code: { type: 'string', enum: Object.keys(ERROR_DEFINITIONS) },
    message: { type: 'string' },
    requestId: { ...uuid, example: EXAMPLE_REQUEST_ID },
    timestamp: dateTime,
  } satisfies Record<keyof ErrorResponse, Schema>),
} satisfies Schemas;
