import { describe, it, expect } from 'vitest';
import { weatherAlerts } from './weather-alert';

const h = (hour: number, x: object = {}) => ({ datetime: `2026-11-13T${String(hour).padStart(2, '0')}:00:00`, condition: 'cloudy', ...x });

describe('weatherAlerts', () => {
  it('is quiet in calm weather', () => {
    expect(weatherAlerts([h(10), h(11, { precipitation: 1, wind_speed: 20 })])).toEqual([]);
  });
  it('flags the first stormy hour, "most" when it is now', () => {
    const a = weatherAlerts([h(10, { condition: 'lightning-rainy' }), h(11, { condition: 'lightning' })]);
    expect(a.map(x => x.text)).toEqual(['Zivatar, villámlás – most']);
  });
  it('reports each kind once with its start hour', () => {
    const a = weatherAlerts([h(10), h(11, { precipitation: 7 }), h(12, { wind_gust_speed: 60 }), h(13, { condition: 'hail' })]);
    expect(a.map(x => x.text)).toEqual(['Jégeső várható 13:00-tól', 'Felhőszakadás várható 11:00-tól', 'Erős szél várható 12:00-tól']);
  });
});
