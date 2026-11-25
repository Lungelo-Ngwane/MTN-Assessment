import { Prisma } from '../generated/prisma/client';

const unavailableCodes = new Set([
  'P1001',
  'P1002',
  'P1008',
  'P1017',
  'P2024',
  'P2037',
]);
const unavailableSqlStates = new Set([
  '08000',
  '08001',
  '08003',
  '08006',
  '57P01',
  '57P02',
  '57P03',
  '53300',
]);

export function isDatabaseUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return unavailableCodes.has(error.errorCode ?? '');
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return (
      unavailableCodes.has(error.code) ||
      (error.code === 'P2010' &&
        typeof error.meta?.code === 'string' &&
        unavailableSqlStates.has(error.meta.code))
    );
  }
  return false;
}
