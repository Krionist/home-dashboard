import { daytimeOf, sceneOf, sceneOverride, seasonOf } from './scene';

describe('scene', () => {
  it('maps months to seasons', () => {
    expect([0, 3, 6, 9, 11].map(m => seasonOf(new Date(2026, m, 15)))).toEqual(['winter', 'spring', 'summer', 'autumn', 'winter']);
  });
  it('treats the sun near the horizon as dusk', () => {
    expect(daytimeOf('above_horizon', 30)).toBe('day');
    expect(daytimeOf('above_horizon', 3)).toBe('dusk');
    expect(daytimeOf('below_horizon', -3)).toBe('dusk');
    expect(daytimeOf('below_horizon', -20)).toBe('night');
  });
  it('turns weather into clouds / precipitation / storm / wind', () => {
    const d = new Date(2026, 9, 24);
    expect(sceneOf('sunny', 'above_horizon', 30, 6, d)).toMatchObject({ season: 'autumn', time: 'day', clouds: 0, rain: 0, snow: 0, storm: false });
    expect(sceneOf('lightning-rainy', 'above_horizon', 30, 0, d)).toMatchObject({ rain: 60, storm: true, clouds: 1 });
    expect(sceneOf('snowy', 'below_horizon', -30, 0, d)).toMatchObject({ snow: 50, rain: 0, time: 'night' });
    expect(sceneOf('fog', 'above_horizon', 30, 0, d).fog).toBe(true);
    expect(sceneOf('sunny', 'above_horizon', 30, 80, d).wind).toBe(1);
  });
  it('lets ?scene= override season, time and weather', () => {
    const base = sceneOf('sunny', 'above_horizon', 30, 0, new Date(2026, 9, 24));
    expect(sceneOverride('?scene=winter,night,snowy', base)).toMatchObject({ season: 'winter', time: 'night', snow: 50 });
    expect(sceneOverride('', base)).toBe(base);
  });
});
