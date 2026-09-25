import { fmt } from "./domain";
import { ENERGY_SOURCES } from "./energy-domain";
import { energyPath, TOPIC_LABELS } from "./assistant-domain";
import type {
  AssistantAnswer,
  AssistantRequest,
  AssistantTopic,
  ConversationService,
} from "./assistant-domain";
const signed = (n: number, digits = 0) =>
  `${n > 0 ? "+" : ""}${fmt(n, digits)}`;
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function resolveTopic(
  request: AssistantRequest,
): AssistantTopic | "unsupported" {
  const q = normalize(request.question);
  if (
    /diagnostic|remedio|medicamento|doenca|prescrev|dor no|sintoma|comer apenas|jejum|altere|mude minha|apague|exclua|ignore .*instruc/.test(
      q,
    )
  )
    return "unsupported";
  if (
    /^(e )?(por que\??|explique melhor\.?|como assim\??|quais registros\??)$/.test(
      q,
    )
  )
    return request.previousTopic ?? request.selection.topic;
  if (/fora.*padrao|discrepan|distoant|estranh|atipic/.test(q))
    return "anomaly";
  if (/peso|balanca|equivalente|emagreci|engordei/.test(q)) return "weight";
  if (/basal|repouso/.test(q)) return "basal";
  if (/saldo|gasto|deficit|superavit/.test(q)) return "energy";
  if (/macro|proteina|carboidrato|gordura/.test(q)) return "macros";
  if (/incompleto|confirmad|fora da compara|sem dados|qualidade/.test(q))
    return "coverage";
  if (/treino|carga|repetic|serie|volume/.test(q)) return "training";
  if (/caloria|acima|abaixo|meta/.test(q)) return "calories";
  if (/resumo|como foi|periodo|semana/.test(q)) return "summary";
  return "unsupported";
}
export function explain(request: AssistantRequest): AssistantAnswer {
  const topic = resolveTopic(request),
    f = request.facts,
    d = f.diet,
    e = f.energy;
  const answer: AssistantAnswer = {
    topic,
    title:
      topic === "unsupported"
        ? "O que posso explicar nesta demonstração"
        : TOPIC_LABELS[topic],
    paragraphs: [],
    evidence: [],
    actions: [],
    suggestions: ["coverage", "energy", "training"],
    simulated: true,
  };
  const range = f.dates.length
    ? `${f.dates[0]} a ${f.dates.at(-1)}`
    : "Nenhuma data passada ou atual selecionada";
  answer.evidence = [
    `Período: ${range}.`,
    `${d.recorded} dias com alimentação; ${d.confirmed} confirmados; ${d.denominator} encerrados, confirmados e com meta.`,
  ];
  const energyAction = {
    label: "Revisar gasto de energia",
    to: energyPath(f.dates.at(-1) ?? f.currentDate),
  };
  if (topic === "unsupported") {
    answer.paragraphs = [
      "Sou uma demonstração com respostas guiadas sobre os registros deste app. Ainda não interpreto qualquer pergunta, não faço diagnósticos e não altero dados ou metas.",
      "Escolha uma das perguntas sugeridas. Para outra data, feche a conversa e selecione o período na tela de Evolução.",
    ];
    answer.suggestions = ["summary", "anomaly", "weight"];
    return answer;
  }
  if (!f.dates.length) {
    answer.paragraphs = [
      "Não há datas válidas até hoje neste contexto. Selecione outro período para consultar os registros.",
    ];
    return answer;
  }
  if (topic === "summary" || topic === "coverage") {
    const missing = f.dates.length - d.recorded;
    answer.paragraphs = [
      `Há alimentação registrada em ${d.recorded} de ${f.dates.length} dias: ${d.incomplete} ainda sem confirmação e ${missing} sem registros. Hoje permanece parcial, mesmo se confirmado.`,
      d.denominator
        ? `A aderência calórica foi de ${fmt(d.adherence!)}%: ${d.adherent} de ${d.denominator} dias elegíveis dentro de ±10% da meta vigente em cada data.`
        : "Ainda não há dias encerrados, confirmados e com meta para calcular aderência. Ausência de registro não significa consumo zero.",
    ];
    if (topic === "summary")
      answer.paragraphs.push(
        `${f.training.count} sessões de treino concluídas no período. O saldo energético usa ${e.comparableDays} dias com alimentação confirmada e gasto total${e.net === null ? "; ainda sem saldo calculável" : `: ${signed(e.net)} kcal`}.`,
      );
    const excluded = f.days.filter(
      (v) => !v.recorded || !v.confirmed || !v.closed || !v.goal,
    );
    answer.evidence.push(
      ...excluded.map(
        (v) =>
          `${v.date}: ${!v.recorded ? "sem alimentação" : !v.closed ? "hoje, parcial" : !v.confirmed ? "alimentação não confirmada" : "sem meta vigente"}.`,
      ),
    );
    answer.actions = excluded.slice(0, 3).map((v) => ({
      label: `Abrir diário de ${v.date}`,
      to: `/?date=${v.date}`,
    }));
  }
  if (topic === "calories" || topic === "macros") {
    answer.paragraphs = d.recorded
      ? [
          `Consumo registrado: ${fmt(d.total.calories)} kcal em ${d.recorded} dias; média de ${fmt(d.total.calories / d.recorded)} kcal por dia registrado. Essa média inclui registros parciais.`,
        ]
      : [
          "Não há alimentação registrada neste período. Não posso interpretar a ausência de registros como consumo abaixo da meta.",
        ];
    if (topic === "calories")
      answer.paragraphs.push(
        `Nos ${d.denominator} dias encerrados, confirmados e com meta, os somatórios são ${fmt(d.excessCalories)} kcal acima e ${fmt(d.belowCalories)} kcal abaixo da meta. São diferenças separadas, sem compensar um dia com outro. A meta alimentar não é o gasto total medido.`,
      );
    const selectedDay = f.days.length === 1 ? f.days[0] : undefined;
    if (topic === "calories" && selectedDay?.recorded && selectedDay.goal) {
      const difference =
        selectedDay.macros.calories - selectedDay.goal.calories;
      answer.paragraphs.splice(
        1,
        0,
        `Em ${selectedDay.date}, o consumo está ${difference === 0 ? "exatamente na meta" : `${fmt(Math.abs(difference))} kcal ${difference > 0 ? "acima" : "abaixo"} da meta de ${fmt(selectedDay.goal.calories)} kcal`}.${!selectedDay.closed || !selectedDay.confirmed ? " Esta comparação é parcial e ainda não entra nos somatórios finais." : " Esse dia está confirmado e encerrado."}`,
      );
    }
    for (const day of f.days.filter((v) => v.recorded)) {
      answer.evidence.push(
        `${day.date}${!day.closed || !day.confirmed ? " (parcial)" : " (confirmado)"}: ${fmt(day.macros.calories)} kcal; meta ${day.goal ? fmt(day.goal.calories) + " kcal" : "não definida"}.`,
      );
      if (topic === "macros") {
        for (const [key, label] of [
          ["protein", "Proteínas"],
          ["carbs", "Carboidratos"],
          ["fat", "Gorduras"],
        ] as const) {
          const value = day.macros[key],
            goal = day.goal?.[key];
          answer.evidence.push(
            `${label}: ${fmt(value, 1)} g${goal === undefined ? "; sem meta" : ` / ${fmt(goal, 1)} g${goal > 0 ? ` (${fmt((value / goal) * 100)}%)` : " (percentual indisponível para meta zero)"}${value > goal ? `; ${fmt(value - goal, 1)} g acima` : ""}`}.`,
          );
        }
      }
    }
    if (topic === "macros")
      answer.paragraphs.push(
        "A parte escura de cada barra representa o consumo acima da meta daquele nutriente. Os percentuais usam a meta vigente em cada dia; registros parciais ainda podem mudar.",
      );
    answer.actions = f.days
      .filter((v) => v.recorded)
      .slice(-3)
      .map((v) => ({
        label: `Revisar alimentação de ${v.date}`,
        to: `/?date=${v.date}`,
      }));
  }
  if (topic === "energy" || topic === "basal") {
    answer.paragraphs = [
      "Calorias abaixo da meta comparam consumo e meta alimentar. Saldo energético compara consumo e gasto total. São referências diferentes; não há soma automática de treino ou atividade ao gasto total.",
    ];
    if (topic === "energy")
      answer.paragraphs.push(
        e.net === null
          ? "Ainda não há dias encerrados com alimentação confirmada e gasto total para calcular déficit ou superávit."
          : `Nos ${e.comparableDays} dias comparáveis, o déficit soma ${fmt(e.deficit)} kcal e o superávit ${fmt(e.surplus)} kcal. Saldo líquido: ${signed(e.net)} kcal (consumo − gasto total).`,
      );
    answer.paragraphs.push(
      `O basal representa apenas repouso. Aparece como referência quando não há gasto total, mas não permite concluir o déficit total nem estimar perda de peso. ${e.basalComparedDays ? `Em ${e.basalComparedDays} dias elegíveis, consumo menos basal soma ${signed(e.basalNet)} kcal.` : "Não há dias elegíveis para a comparação com basal neste período."}`,
    );
    answer.evidence.push(
      ...f.days.map(
        (v) =>
          `${v.date}: ${v.total !== null ? `gasto total ${fmt(v.total)} kcal, ${ENERGY_SOURCES[v.source!]}${v.simulated ? " (simulado)" : ""}` : v.basal !== null ? `somente basal: ${fmt(v.basal)} kcal` : "sem gasto total ou referência basal"}; ${v.recorded && v.confirmed && v.closed && v.total !== null ? "entra no saldo" : "fora do saldo total"}.`,
      ),
    );
    answer.actions = [energyAction];
  }
  if (topic === "anomaly") {
    const totals = f.days.filter((v) => v.total !== null && v.closed);
    const candidates = totals.flatMap((v) => {
      const others = totals.filter((o) => o.date !== v.date);
      const average = others.reduce((n, o) => n + o.total!, 0) / others.length;
      return others.length >= 3 &&
        average > 0 &&
        (v.total! > average * 1.5 || v.total! < average * 0.5)
        ? [{ ...v, average, count: others.length }]
        : [];
    });
    answer.paragraphs =
      totals.length < 4
        ? [
            "Há menos de quatro dias encerrados com gasto total. A base é insuficiente para esta comparação de valores discrepantes.",
          ]
        : candidates.length
          ? [
              `Encontrei ${candidates.length} registros para conferir. Nesta demonstração, destaco gastos maiores que 150% ou menores que 50% da média dos outros dias encerrados com gasto total. É uma regra de revisão, não uma conclusão sobre erro ou saúde.`,
            ]
          : [
              "Nenhum gasto cruzou a regra demonstrativa de 150% ou 50% da média dos outros dias. Isso não garante que todos os registros estejam corretos.",
            ];
    candidates.forEach((v) =>
      answer.evidence.push(
        `${v.date}: ${fmt(v.total!)} kcal; média dos outros ${v.count} dias: ${fmt(v.average)} kcal. Origem: ${ENERGY_SOURCES[v.source!]}${v.simulated ? " (simulada)" : ""}.`,
      ),
    );
    answer.paragraphs.push(
      "Se houver uma diferença inesperada, confira data, unidade e se o valor representa gasto total ou apenas atividade. Os dados disponíveis não comprovam a causa.",
    );
    answer.actions = candidates.length
      ? candidates.slice(0, 3).map((v) => ({
          label: `Revisar gasto de ${v.date}`,
          to: energyPath(v.date),
        }))
      : [energyAction];
    answer.suggestions = ["energy", "basal", "coverage"];
  }
  if (topic === "weight") {
    const first = f.measurements[0],
      last = f.measurements.at(-1);
    answer.paragraphs = [
      e.theoreticalWeight === null
        ? "Sem dias comparáveis, não há equivalente teórico de peso calculável."
        : `O saldo de ${signed(e.net!)} kcal equivale teoricamente a ${signed(e.theoreticalWeight, 2)} ${f.unit}, usando a aproximação de 7.700 kcal/kg. Esse número não é perda ou ganho de peso medido.`,
      first && last && first.date !== last.date
        ? `A balança variou ${signed(last.weight - first.weight, 2)} ${f.unit}, entre ${first.date} e ${last.date}. Esse intervalo pode ser diferente dos dias usados no saldo energético.`
        : "São necessárias pelo menos duas medições em datas distintas deste período para calcular a variação observada.",
      "O app não consegue identificar a causa de uma divergência apenas com esses registros. Revise a cobertura da alimentação, do gasto e das pesagens antes de comparar os números.",
    ];
    answer.evidence.push(
      ...f.measurements.map((m) => `${m.date}: ${fmt(m.weight, 2)} ${f.unit}.`),
    );
    answer.actions = [
      {
        label: "Ver medições do período",
        to: `/evolucao?tab=body&period=${f.period}&date=${f.dates[0]}`,
      },
    ];
  }
  if (topic === "training") {
    const sessions = f.training.exerciseSessions;
    answer.paragraphs = [
      `${f.training.count} sessões concluídas no período. Volume registrado: ${fmt(f.training.volume)} ${f.unit} × repetições, somando apenas séries concluídas.`,
      sessions.length >= 2
        ? `Para ${sessions[0].name}, compare as séries abaixo. Uma mudança de carga precisa ser lida junto com as repetições; estes números, isoladamente, não comprovam melhora ou piora.`
        : "Ainda não há duas sessões concluídas do mesmo exercício neste período para comparar carga e repetições.",
    ];
    answer.evidence.push(
      ...sessions.map(
        (s) =>
          `${s.date} · ${s.name}: ${s.sets.map((v) => `${fmt(v.weight, 1)} ${f.unit} × ${v.reps}`).join("; ")}.`,
      ),
    );
    answer.paragraphs.push(
      "Séries sem carga externa ficam com carga zero, sem presumir o peso corporal. Planos prescritos e sessões não concluídas não entram neste volume.",
    );
    answer.actions = sessions.slice(-2).map((s) => ({
      label: `Consultar treino de ${s.date}`,
      to: `/treinos?session=${encodeURIComponent(s.id)}`,
    }));
  }
  if (topic === "summary")
    answer.suggestions = ["coverage", "anomaly", "weight", "training"];
  if (topic === "energy") answer.suggestions = ["basal", "weight", "coverage"];
  return answer;
}
export function createMockConversationService(): ConversationService {
  let failed = false;
  return {
    mode: "mock",
    async reply(request, signal) {
      if (!request.question.trim() || request.question.length > 600)
        throw new Error("Escreva uma pergunta de até 600 caracteres.");
      await new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
          reject(new DOMException("Cancelado", "AbortError"));
          return;
        }
        const abort = () => {
          clearTimeout(timer);
          reject(new DOMException("Cancelado", "AbortError"));
        };
        const timer = setTimeout(() => {
          signal.removeEventListener("abort", abort);
          resolve();
        }, 550);
        signal.addEventListener("abort", abort, { once: true });
      });
      if (
        !failed &&
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("fail") === "assistant"
      ) {
        failed = true;
        throw new Error(
          "Não foi possível preparar a explicação. Sua pergunta foi preservada; tente novamente.",
        );
      }
      return explain(request);
    },
  };
}
export { remoteConversationService as conversationService } from "./assistant-remote";
