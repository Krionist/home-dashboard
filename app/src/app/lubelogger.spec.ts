import { describe, expect, it } from 'vitest';
import { dueText, toCar } from './lubelogger';

const rem = (description: string, urgency: string, metric: string, dueDays: string, dueDistance = '0') => ({ description, urgency, metric, dueDays, dueDistance });

describe('lubelogger', () => {
  it('words the due by metric', () => {
    expect(dueText(rem('x', 'PastDue', 'Date', '-3'))).toBe('3 napja lejárt');
    expect(dueText(rem('x', 'Urgent', 'Date', '0'))).toBe('ma');
    expect(dueText(rem('x', 'NotUrgent', 'Odometer', '0', '15000'))).toBe('15 000 km múlva');
    expect(dueText(rem('x', 'PastDue', 'Both', '5', '-200'))).toBe('5 nap múlva · 200 km-rel túl');
  });

  it('sorts reminders most urgent first', () => {
    const car = toCar({ id: 2, year: 2012, make: 'Toyota', model: 'Prius', soldDate: '' }, 345272,
      [rem('olaj', 'NotUrgent', 'Date', '90'), rem('akku', 'PastDue', 'Date', '-10'), rem('fék', 'PastDue', 'Date', '-40'), rem('gumi', 'Urgent', 'Date', '5')]);
    expect(car.name).toBe('Toyota Prius');
    expect(car.reminders.map(r => [r.text, r.lvl])).toEqual([['fék', 'bad'], ['akku', 'bad'], ['gumi', 'warn'], ['olaj', 'ok']]);
  });
});
