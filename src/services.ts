import { generateTrainingPlan } from "./training-service";
import { analyzeMealPhoto } from "./meal-photo-service";
import type { PhotoAnalysis } from "./meal-photo-service";
import type { Plan, Profile, EnergyProvider, EnergyEntry } from "./domain";
export { auth, repository } from "./cloud-services";
export interface NutritionAI {
  analyze(photo: string, signal?: AbortSignal): Promise<PhotoAnalysis>;
}
export interface TrainingAI {
  generate(profile: Profile, signal?: AbortSignal): Promise<Plan>;
}
export const nutritionAI: NutritionAI = { analyze: analyzeMealPhoto };
export const trainingAI: TrainingAI = { generate: generateTrainingPlan };
export async function compressPhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Escolha uma imagem JPG, PNG ou WebP.");
  if (file.size > 15 * 1024 * 1024)
    throw new Error("Escolha uma imagem de até 15 MB.");
  const image = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("Não foi possível abrir essa imagem."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 800 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Seu navegador não conseguiu preparar a foto.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.65);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface WearableService {
  connect(
    provider: EnergyProvider,
  ): Promise<{ provider: EnergyProvider; connectedAt: string }>;
  fetchDaily(provider: EnergyProvider): Promise<EnergyEntry[]>;
  disconnect(): Promise<void>;
}
export const wearableService: WearableService = {
  async connect(_provider) {
    throw new Error(
      "A integração com dispositivos ainda não está disponível. Registre o gasto manualmente.",
    );
  },
  async fetchDaily(_provider) {
    throw new Error("A importação de dispositivos ainda não está disponível.");
  },
  async disconnect() {},
};
