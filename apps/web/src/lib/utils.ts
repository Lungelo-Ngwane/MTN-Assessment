import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { z } from 'zod';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const amountSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/,
    'Enter a rand amount with up to two decimal places, for example 15000.00.',
  )
  .refine(
    (amount) => !/^0(?:\.0{1,2})?$/.test(amount),
    'Enter an amount greater than zero.',
  );

const rand = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const date = new Intl.DateTimeFormat('en-ZA', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
export const zar = (amount: string | null) =>
  amount === null ? 'Unavailable' : `R ${rand.format(Number(amount))}`;
export function rate(percentage: string) {
  const [whole, fraction = ''] = percentage.split('.');
  const decimals = fraction.replace(/0+$/, '');
  return `${decimals ? `${whole}.${decimals}` : whole}%`;
}
export const formatDate = (value: string) => date.format(new Date(value));
