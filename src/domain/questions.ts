import { z } from "zod";

const answerIndex = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export const questionDraftSchema = z.object({
  topicId: z.string().min(1, "Selecciona un tema."),
  prompt: z.string().trim().min(5, "La pregunta debe tener al menos 5 caracteres."),
  options: z.tuple([
    z.string().trim().min(1, "Completa las cuatro opciones."),
    z.string().trim().min(1, "Completa las cuatro opciones."),
    z.string().trim().min(1, "Completa las cuatro opciones."),
    z.string().trim().min(1, "Completa las cuatro opciones."),
  ]),
  correctIndex: answerIndex,
}).superRefine((draft, ctx) => {
  if (new Set(draft.options.map((option) => option.toLocaleLowerCase())).size !== 4) {
    ctx.addIssue({ code: "custom", message: "Las cuatro opciones deben ser distintas.", path: ["options"] });
  }
});

