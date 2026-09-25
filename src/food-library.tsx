import { useState } from "react";
import { Star, Plus } from "lucide-react";
import { useApp, useData } from "./store";
import type { FoodItem } from "./domain";
import { dateLabel, fmt, sumMacros, uid } from "./domain";
import { cloneFoods, foodKey, recentFoods } from "./food-data";
import {
  Button,
  ErrorBox,
  Field,
  IconButton,
  Segmented,
  useFormTask,
} from "./ui";

export function FoodLibrary({
  onAdd,
}: {
  onAdd: (items: FoodItem[], type?: string) => void;
}) {
  const data = useData();
  const { update } = useApp();
  const [tab, setTab] = useState<"recent" | "favorites" | "saved" | "repeat">(
    "recent",
  );
  const [search, setSearch] = useState("");
  const [added, setAdded] = useState("");
  const task = useFormTask();
  const matches = (name: string) =>
    name
      .toLocaleLowerCase("pt-BR")
      .includes(search.trim().toLocaleLowerCase("pt-BR"));
  const foods = (
    tab === "favorites" ? (data.favoriteFoods ?? []) : recentFoods(data)
  ).filter((f) => matches(f.name));
  const sets =
    tab === "saved"
      ? (data.savedMeals ?? [])
          .filter((m) => matches(m.name))
          .map((m) => ({
            ...m,
            subtitle: `${m.items.length} alimentos`,
            type: undefined,
          }))
      : [...data.meals]
          .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
          .filter((m) =>
            matches(m.type + " " + m.items.map((f) => f.name).join(" ")),
          )
          .slice(0, 20)
          .map((m) => ({
            ...m,
            name: m.type,
            subtitle: dateLabel(m.date) + " · " + m.time,
          }));
  const add = (items: FoodItem[], name: string, type?: string) => {
    onAdd(cloneFoods(items), type);
    setAdded(`${name}: adicionado para revisão.`);
  };
  return (
    <section className="food-library" aria-label="Biblioteca de alimentos">
      <Segmented
        label="Sua biblioteca"
        value={tab}
        onChange={(v) => {
          setTab(v);
          setAdded("");
        }}
        options={[
          { value: "recent", label: "Recentes" },
          { value: "favorites", label: "Favoritos" },
          { value: "saved", label: "Minhas refeições" },
          { value: "repeat", label: "Repetir refeição" },
        ]}
      />
      <Field label="Buscar na biblioteca">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nome do alimento ou da refeição"
        />
      </Field>
      <div className="food-library-list">
        {tab === "recent" || tab === "favorites"
          ? foods.map((f) => {
              const favorite = data.favoriteFoods?.some(
                (item) => foodKey(item) === foodKey(f),
              );
              return (
                <div className="food-library-row" key={foodKey(f)}>
                  <div>
                    <strong>{f.name}</strong>
                    <small>
                      {fmt(f.portion, 1)} {f.unit} · {fmt(f.calories)} kcal
                    </small>
                  </div>
                  <IconButton
                    type="button"
                    label={(favorite ? "Desfavoritar " : "Favoritar ") + f.name}
                    aria-pressed={Boolean(favorite)}
                    onClick={() =>
                      void task.run(() =>
                        update((d) => ({
                          ...d,
                          favoriteFoods: favorite
                            ? (d.favoriteFoods ?? []).filter(
                                (item) => foodKey(item) !== foodKey(f),
                              )
                            : [...(d.favoriteFoods ?? []), { ...f, id: uid() }],
                        })),
                      )
                    }
                  >
                    <Star size={18} fill={favorite ? "currentColor" : "none"} />
                  </IconButton>
                  <IconButton
                    type="button"
                    label={"Adicionar " + f.name}
                    onClick={() => add([f], f.name)}
                  >
                    <Plus size={19} />
                  </IconButton>
                </div>
              );
            })
          : sets.map((m) => (
              <div className="food-library-row" key={m.id}>
                <div>
                  <strong>{m.name}</strong>
                  <small>
                    {m.subtitle} · {fmt(sumMacros(m.items).calories)} kcal
                  </small>
                  <small>{m.items.map((i) => i.name).join(" · ")}</small>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => add(m.items, m.name, m.type)}
                >
                  Usar refeição
                </Button>
                {tab === "saved" && (
                  <IconButton
                    type="button"
                    label={"Remover dos salvos: " + m.name}
                    onClick={() =>
                      void task.run(() =>
                        update((d) => ({
                          ...d,
                          savedMeals: (d.savedMeals ?? []).filter(
                            (s) => s.id !== m.id,
                          ),
                        })),
                      )
                    }
                  >
                    <span aria-hidden="true">×</span>
                  </IconButton>
                )}
              </div>
            ))}
        {(tab === "recent" || tab === "favorites"
          ? !foods.length
          : !sets.length) && (
          <p className="muted">
            {search
              ? "Nenhum resultado para esta busca."
              : tab === "favorites"
                ? "Marque a estrela de um alimento recente para encontrá-lo aqui."
                : tab === "saved"
                  ? "Ao registrar uma refeição, escolha salvar em Minhas refeições."
                  : "Seus registros aparecerão aqui. Você também pode adicionar por foto ou manualmente."}
          </p>
        )}
      </div>
      {added && (
        <p className="success-box" role="status">
          {added} Ajuste as porções abaixo e salve a refeição para incluir no
          diário.
        </p>
      )}
      <ErrorBox message={task.error} />
    </section>
  );
}
