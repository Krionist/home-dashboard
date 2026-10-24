import { chargeState, levelClass } from './devices';

describe('device battery helpers', () => {
  it('normalises Android and iOS charge states', () => {
    expect(['charging', 'Charging', 'full', 'Full', 'discharging', 'Not Charging', 'not_charging', ''].map(chargeState))
      .toEqual(['charging', 'charging', 'full', 'full', 'idle', 'idle', 'idle', 'idle']);
  });
  it('bands the level', () => {
    expect([10, 30, 80].map(levelClass)).toEqual(['bad', 'warn', 'ok']);
  });
});
