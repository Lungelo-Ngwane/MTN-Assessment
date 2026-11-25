import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('registers, compares repayments and manages a contract', async ({ page }, {
  project,
}) => {
  const email = `demo.${project.name}@example.test`;
  const password = `Browser test ${randomUUID()}`;
  await page.goto('/contracts');
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(
    page.getByText('Account created. You can now sign in.'),
  ).toBeVisible();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Repayment calculator' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'My Contracts' }).click();
  await expect(page.getByText('No saved contracts yet')).toBeVisible();
  await page.getByRole('link', { name: 'Calculator', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Device purchase amount' })
    .fill('15000.00');
  await page.getByRole('button', { name: 'Calculate repayments' }).click();
  await expect(page.getByRole('radio')).toHaveCount(3);
  await expect(page.getByText('6.5%', { exact: true })).toHaveCount(3);
  await page.getByRole('radio', { name: '24 months' }).check();
  await expect(page.getByText('24-month term selected')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await mkdir('test-results/screenshots', { recursive: true });
  await page.screenshot({
    path: `test-results/screenshots/calculator-${project.name}.png`,
    fullPage: true,
    animations: 'disabled',
    scale: 'css',
  });
  await page.getByRole('button', { name: 'Save contract' }).click();
  await page.getByRole('link', { name: 'View contract' }).click();
  await expect(
    page.getByRole('heading', { name: 'Contract details' }),
  ).toBeVisible();
  await expect(page.getByText('6.5%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit contract' }).click();
  await page.getByLabel('Device purchase amount (ZAR)').fill('12000.00');
  await page.getByLabel('Repayment term').selectOption('36');
  await page.getByRole('button', { name: 'Preview repayment' }).click();
  await expect(page.getByRole('heading', { name: /per month/ })).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Contract updated.')).toBeVisible();
  await expect(page.getByText('R 12,000.00')).toBeVisible();
  await page.getByRole('button', { name: 'Delete contract' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Delete contract' }).click();
  await dialog.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(page.getByText('Contract deleted.')).toBeVisible();
  await expect(page.getByText('No saved contracts yet')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible();
});
