import { PasswordService } from './password.service';

describe('PasswordService', () => {
  it('creates independently salted Argon2id hashes and verifies the exact password', async () => {
    const passwords = new PasswordService();
    await passwords.onModuleInit();
    const password = '  a passphrase! 🔑  ';
    const first = await passwords.hash(password);
    const second = await passwords.hash(password);

    expect(first).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(first).not.toEqual(second);
    await expect(passwords.verify(password, first)).resolves.toBe(true);
    await expect(passwords.verify(password.trim(), first)).resolves.toBe(false);
    await expect(passwords.verify(password)).resolves.toBe(false);
    await expect(
      passwords.verify(password, 'legacy-placeholder'),
    ).resolves.toBe(false);
  });
});
