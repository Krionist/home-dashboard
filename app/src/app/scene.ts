// background scene derived from HA: weather condition, sun, wind, date
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Daytime = 'day' | 'dusk' | 'night';
export interface Scene {
  season: Season; time: Daytime;
  clouds: number; // 0..1 sky cover
  rain: number;   // drops shown, 0..60
  snow: number;   // flakes shown, 0..60
  fog: boolean; storm: boolean;
  wind: number;   // 0..1, speeds up sway and drift
}

export const seasonOf = (d: Date): Season => (['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'] as const)[d.getMonth()];

// civil twilight band (sun within 6° of the horizon) counts as dusk/dawn
export const daytimeOf = (sunState: string | undefined, elevation: number | undefined): Daytime =>
  elevation !== undefined && Math.abs(elevation) < 6 ? 'dusk' : sunState === 'below_horizon' ? 'night' : 'day';

const CLOUDS: Record<string, number> = { sunny: 0, 'clear-night': 0, partlycloudy: .4, cloudy: .85, fog: .7, rainy: .8, pouring: 1, lightning: .9, 'lightning-rainy': 1, snowy: .8, 'snowy-rainy': .9, hail: .9, windy: .3, 'windy-variant': .6 };

export function sceneOf(condition: string | undefined, sunState: string | undefined, elevation: number | undefined, windKmh: number | undefined, date: Date): Scene {
  const c = condition ?? 'sunny';
  return {
    season: seasonOf(date),
    time: daytimeOf(sunState, elevation),
    clouds: CLOUDS[c] ?? .3,
    rain: c === 'pouring' || c === 'lightning-rainy' ? 60 : c === 'rainy' || c === 'hail' ? 32 : c === 'snowy-rainy' ? 20 : 0,
    snow: c === 'snowy' ? 50 : c === 'snowy-rainy' ? 25 : 0,
    fog: c === 'fog',
    storm: c === 'lightning' || c === 'lightning-rainy',
    wind: Math.min(1, Math.max(c.startsWith('windy') ? .7 : 0, (windKmh ?? 0) / 40)),
  };
}

// ?scene=winter,night,snowy (any order) previews a combination without waiting for the weather
export function sceneOverride(search: string, s: Scene): Scene {
  const parts = new URLSearchParams(search).get('scene')?.split(',') ?? [];
  if (!parts.length) return s;
  let out = { ...s };
  for (const p of parts) {
    if (['spring', 'summer', 'autumn', 'winter'].includes(p)) out.season = p as Season;
    else if (['day', 'dusk', 'night'].includes(p)) out.time = p as Daytime;
    else out = { ...sceneOf(p, undefined, undefined, undefined, new Date()), season: out.season, time: out.time };
  }
  return out;
}
