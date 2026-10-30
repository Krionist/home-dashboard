import { chargeState, levelClass } from './devices';

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
});
