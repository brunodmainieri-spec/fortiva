import { getSupabase } from "./supabase";
import type { ConversationService } from "./assistant-domain";
import {
  chatInput,
  chatOutput,
} from "../supabase/functions/_shared/chat-contract.ts";
export const remoteConversationService: ConversationService = {
  mode: "remote",
  async reply(request, signal) {
    const body = chatInput(request),
      client = getSupabase();
    const { data: session, error: sessionError } =
      await client.auth.getSession();
    if (sessionError || !session.session)
      throw Error("Entre novamente para conversar com o assistente.");
    const { data, error } = await client.functions.invoke("assistant-chat", {
      body,
      signal,
      timeout: 85000,
      headers: { Authorization: "Bearer " + session.session.access_token },
    });
    if (error) {
      if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
      let message =
        "Não foi possível responder. Verifique a conexão e tente novamente.";
      if (error.context instanceof Response) {
        if (error.context.status === 401)
          message = "Sua sessão expirou. Entre novamente.";
        else if (error.context.status === 404)
          message = "O assistente ainda precisa ser ativado no servidor.";
        else {
          const result = await error.context.json().catch(() => null);
          if (
            typeof result?.message === "string" &&
            result.message.length < 500
          )
            message = result.message;
        }
      }
      throw Error(message);
    }
    return {
      ...chatOutput(data),
      topic: request.selection.topic,
      title: "",
      evidence: [],
      actions: [],
      suggestions: [],
      simulated: false,
    };
  },
};
