// LubeLogger (auth off, GET-only behind nginx /lubelogger/) → per car: odometer + reminders, most urgent first
type Vehicle = { id: number; year: number; make: string; model: string; soldDate: string };
type Reminder = { description: string; urgency: string; metric: string; dueDays: string; dueDistance: string };

export type Car = { id: number; name: string; km: number; reminders: { text: string; due: string; lvl: string }[] };

const ORDER = ['PastDue', 'VeryUrgent', 'Urgent', 'NotUrgent'];
const LVL: Record<string, string> = { PastDue: 'bad', VeryUrgent: 'bad', Urgent: 'warn', NotUrgent: 'ok' };

// metric says what the reminder counts: Date → days, Odometer → km, Both → whichever LubeLogger flagged
export function dueText(r: Reminder): string {
  const d = Number(r.dueDays), km = Number(r.dueDistance);
  const days = d < 0 ? `${-d} napja lejárt` : d === 0 ? 'ma' : `${d} nap múlva`;
  const dist = km < 0 ? `${(-km).toLocaleString('hu-HU')} km-rel túl` : `${km.toLocaleString('hu-HU')} km múlva`;
  return r.metric === 'Date' ? days : r.metric === 'Odometer' ? dist : `${days} · ${dist}`;
}

export function toCar(v: Vehicle, km: number, reminders: Reminder[]): Car {
  return {
    id: v.id, name: `${v.make} ${v.model}`, km,
    reminders: [...reminders].sort((a, b) => ORDER.indexOf(a.urgency) - ORDER.indexOf(b.urgency) || Number(a.dueDays) - Number(b.dueDays))
      .map(r => ({ text: r.description, due: dueText(r), lvl: LVL[r.urgency] ?? 'ok' })),
  };
}

export async function loadCars(): Promise<Car[]> {
  const get = async (p: string) => {
    const r = await fetch('/lubelogger/api/' + p);
    if (!r.ok) throw new Error(`lubelogger ${p} ${r.status}`);
    return r.json();
  };
  const vehicles: Vehicle[] = (await get('vehicles')).filter((v: Vehicle) => !v.soldDate);
  return Promise.all(vehicles.map(async v => {
    const [km, rem] = await Promise.all([get(`vehicle/odometerrecords/latest?vehicleId=${v.id}`), get(`vehicle/reminders?vehicleId=${v.id}`)]);
    return toCar(v, Number(km) || 0, rem);
  }));
}
