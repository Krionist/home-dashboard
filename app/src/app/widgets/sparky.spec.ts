import { calorieView, toMeals } from './sparky';

describe('calorieView', () => {
  it('blue under, green within 100 kcal, red over; fill capped at 1', () => {
    expect(calorieView({ eaten: 1000, goal: 2000 })).toEqual({ fill: 0.5, left: 1000, tone: 'cold' });
    expect(calorieView({ eaten: 1900, goal: 2000 }).tone).toBe('ok');
    expect(calorieView({ eaten: 2000, goal: 2000 }).tone).toBe('ok');
    expect(calorieView({ eaten: 2300, goal: 2000 })).toEqual({ fill: 1, left: -300, tone: 'bad' });
  });
});

describe('toMeals', () => {
  it('scales kcal by quantity/serving and groups by meal', () => {
    const e = (food_name: string, meal_type: string, quantity: number, calories: number) => ({ food_name, meal_type, quantity, serving_size: 100, unit: 'g', calories });
    expect(toMeals([e('Rice', 'Lunch', 200, 130), e('Egg', 'Breakfast', 50, 150), e('Soup', 'Lunch', 100, 40)]).map(m => [m.name, m.kcal]))
      .toEqual([['Lunch', 300], ['Breakfast', 75]]);
  });
});
