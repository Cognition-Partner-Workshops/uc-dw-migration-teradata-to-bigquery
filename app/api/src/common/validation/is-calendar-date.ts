import { registerDecorator, ValidationOptions } from 'class-validator';

export const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Salesforce `Date` fields travel as `YYYY-MM-DD` (no time, no zone), like Postgres `date`. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !CALENDAR_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function IsCalendarDate(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isCalendarDate',
      target: target.constructor,
      propertyName: propertyKey as string,
      options: { message: '$property must be a calendar date (YYYY-MM-DD)', ...options },
      validator: { validate: (value: unknown) => isCalendarDate(value) },
    });
  };
}

export function toCalendarDate(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10);
}

export function fromCalendarDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

/** `$Flow.CurrentDate` / `TODAY()` as a calendar date (UTC, like the Postgres `date` column). */
export function currentDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
