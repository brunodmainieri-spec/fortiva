import { getSupabase } from "./supabase";
import { uid } from "./domain";
import type { FoodItem } from "./domain";
export type PhotoAnalysis = { items: FoodItem[]; note: string };
export async function analyzeMealPhoto(
  photo: string,
  signal?: AbortSignal,
): Promise<PhotoAnalysis> {
  const client = getSupabase();
  const { data: session, error: sessionError } = await client.auth.getSession();
  if (sessionError || !session.session)
    throw new Error("Entre novamente para analisar a foto.");
  const { data, error } = await client.functions.invoke("analyze-meal-photo", {
    body: { photo },
    headers: { Authorization: `Bearer ${session.session.access_token}` },
    signal,
    timeout: 70000,
  });
  if (error) {
    if (signal?.aborted) throw new Error("Análise cancelada.");
    let message =
      "Não foi possível analisar a foto. Verifique sua conexão e tente novamente.";
    if (error.context instanceof Response) {
      if (error.context.status === 404)
        message = "A análise de fotos ainda precisa ser ativada no servidor.";
      else if (error.context.status === 401)
        message = "Sua sessão expirou. Entre novamente para analisar a foto.";
      else {
        const result = await error.context.json().catch(() => null);
        if (typeof result?.message === "string" && result.message.length < 500)
          message = result.message;
      }
    }
    throw new Error(message);
  }
  if (
    !data ||
    !Array.isArray(data.items) ||
    data.items.length > 20 ||
    typeof data.note !== "string"
  )
    throw new Error("A análise retornou dados incompletos. Tente novamente.");
  const items: FoodItem[] = data.items.map(
    (item: Record<string, unknown>, index: number) => {
      if (
        !item ||
        typeof item.name !== "string" ||
        !item.name.trim() ||
        !["g", "ml"].includes(String(item.unit)) ||
        ["portion", "calories", "protein", "carbs", "fat"].some(
          (field) =>
            typeof item[field] !== "number" ||
            !Number.isFinite(item[field]) ||
            (item[field] as number) < 0,
        ) ||
        (item.portion as number) <= 0
      )
        throw new Error(
          "A análise retornou valores inválidos. Tente novamente.",
        );
      return {
        id: uid(),
        name: item.name,
        portion: item.portion as number,
        unit: item.unit as string,
        calories: item.calories as number,
        protein: item.protein as number,
        carbs: item.carbs as number,
        fat: item.fat as number,
        photo: index === 0 ? photo : undefined,
      };
    },
  );
  if (!items.length)
    throw new Error(
      data.note ||
        "Não identifiquei alimentos nesta foto. Envie uma imagem mais nítida da refeição.",
    );
  return { items, note: data.note.slice(0, 600) };
}
