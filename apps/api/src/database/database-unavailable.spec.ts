import { Prisma } from '../generated/prisma/client';
import { isDatabaseUnavailable } from './database-unavailable';

describe('database availability classification', () => {
  it('recognizes unreachable database initialization but keeps misconfiguration distinct', () => {
    expect(
      isDatabaseUnavailable(
        new Prisma.PrismaClientInitializationError(
          'private connection detail',
          'fixture',
          'P1001',
        ),
      ),
    ).toBe(true);
    expect(
      isDatabaseUnavailable(
        new Prisma.PrismaClientInitializationError(
          'private credentials detail',
          'fixture',
          'P1000',
        ),
      ),
    ).toBe(false);
  });

  it.each([
    ['57P01', true],
    ['08006', true],
    ['23514', false],
    [undefined, false],
  ])('classifies raw-query database status %p', (sqlState, unavailable) => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'private SQL detail',
      {
        code: 'P2010',
        clientVersion: 'fixture',
        meta: { code: sqlState },
      },
    );
    expect(isDatabaseUnavailable(error)).toBe(unavailable);
  });

  it('does not treat constraint violations as availability incidents', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'private constraint detail',
      {
        code: 'P2002',
        clientVersion: 'fixture',
      },
    );
    expect(isDatabaseUnavailable(error)).toBe(false);
  });
});
