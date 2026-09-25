import { getSupabase } from "./supabase";
import { uid } from "./domain";
import type { Plan, Profile } from "./domain";
import {
  trainingInput,
  parseTrainingProposal,
} from "../supabase/functions/_shared/training-contract.ts";
export async function generateTrainingPlan(
  profile: Profile,
  signal?: AbortSignal,
): Promise<Plan> {
  // Only these six fields reach the model. No name, email, photos or history.
  const input = trainingInput(profile);
  const client = getSupabase();
  const { data: session, error: sessionError } = await client.auth.getSession();
  if (sessionError || !session.session)
    throw new Error("Entre novamente para gerar seu plano.");
  const { data, error } = await client.functions.invoke(
    "generate-training-plan",
    {
      body: { profile: input },
      headers: { Authorization: `Bearer ${session.session.access_token}` },
      signal,
      timeout: 85000,
    },
  );
  if (error) {
    if (signal?.aborted) throw new Error("Geração cancelada.");
    let message =
      "Não foi possível gerar seu plano. Verifique a conexão e tente novamente.";
    if (error.context instanceof Response) {
      if (error.context.status === 404)
        message = "A geração de treinos ainda precisa ser ativada no servidor.";
      else if (error.context.status === 401)
        message = "Sua sessão expirou. Entre novamente para gerar o plano.";
      else {
        const result = await error.context.json().catch(() => null);
        if (typeof result?.message === "string" && result.message.length < 500)
          message = result.message;
      }
    }
    throw new Error(message);
  }
  const proposal = parseTrainingProposal(data, input);
  return {
    id: uid(),
    name: proposal.name,
    description: proposal.description,
    active: false,
    updatedAt: new Date().toISOString(),
    revisions: [],
    days: proposal.days.map((day) => ({
      id: uid(),
      name: day.name,
      exercises: day.exercises.map((ex) => ({
        ...ex,
        id: uid(),
        exerciseId: "custom-" + ex.name.trim().toLocaleLowerCase("pt-BR"),
        weight: 0,
      })),
    })),
  };
}
