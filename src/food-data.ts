import { uid } from "./domain";
import type { AppData, FoodItem, Meal } from "./domain";
export const cloneFoods = (items: FoodItem[]) =>
  items.map((item) => ({ ...item, id: uid() }));
export const foodKey = (item: FoodItem) =>
  `${item.name.trim().toLocaleLowerCase("pt-BR")}|${item.unit}`;
export function recentFoods(data: AppData) {
  const items = [...data.meals]
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
    .flatMap((meal) => meal.items);
  return [
    ...new Map(
      [...items].reverse().map((item) => [foodKey(item), item]),
    ).values(),
  ]
    .reverse()
    .slice(0, 30);
}
export function saveMeal(data: AppData, meal: Meal, draftKey: string): AppData {
  const previous = data.meals.find((m) => m.id === meal.id);
  const drafts = { ...data.mealDrafts };
  delete drafts[draftKey];
  return {
    ...data,
    meals: [...data.meals.filter((m) => m.id !== meal.id), meal],
    mealDrafts: drafts,
    confirmedFoodDays: (data.confirmedFoodDays ?? []).filter(
      (date) => date !== meal.date && date !== previous?.date,
    ),
  };
}
export function removeMeal(data: AppData, meal: Meal): AppData {
  const drafts = { ...data.mealDrafts };
  delete drafts[meal.id];
  return {
    ...data,
    meals: data.meals.filter((m) => m.id !== meal.id),
    mealDrafts: drafts,
    confirmedFoodDays: (data.confirmedFoodDays ?? []).filter(
      (date) => date !== meal.date,
    ),
  };
}
