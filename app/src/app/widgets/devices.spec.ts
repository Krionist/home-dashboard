import { chargeState, levelClass, lowBattery } from './devices';

describe('device battery helpers', () => {
  it('normalises Android and iOS charge states', () => {
    expect(['charging', 'Charging', 'full', 'Full', 'discharging', 'Not Charging', 'not_charging', ''].map(s => chargeState(s)))
      .toEqual(['charging', 'charging', 'full', 'full', 'idle', 'idle', 'idle', 'idle']);
  });
  it('reports a plugged-in device that is neither charging nor full', () => {
    expect([chargeState('not_charging', true), chargeState('discharging', false), chargeState('charging', true), chargeState('full', true)])
      .toEqual(['plugged', 'idle', 'charging', 'full']);
  });
  it('bands the level', () => {
    expect([10, 30, 80].map(levelClass)).toEqual(['bad', 'warn', 'ok']);
  });
  it('flags phones and watches under 25% that are not charging', () => {
    const st = (state: string) => ({ state } as never);
    const e = { 'p.l': st('24'), 'p.s': st('discharging'), 'w.l': st('10'), 'w.s': st('charging'), 't.l': st('5'), 't.s': st('discharging'), 'u.l': st('unavailable'), 'u.s': st('') };
    const d = [{ name: 'P', level: 'p.l', state: 'p.s' }, { name: 'W', kind: 'watch' as const, level: 'w.l', state: 'w.s' }, { name: 'T', kind: 'tablet' as const, level: 't.l', state: 't.s' }, { name: 'U', level: 'u.l', state: 'u.s' }];
    expect(lowBattery(d, e)).toEqual([{ name: 'P', pct: 24 }]);
  });
});
