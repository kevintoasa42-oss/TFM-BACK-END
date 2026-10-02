import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { validateLibrary } from "../src/services/content.service.ts";

const admin = { id: randomUUID(), name: "Ana", email: "ana@example.test", role: "admin" };
function library() {
  const areaId = randomUUID(), topicId = randomUUID(), questionId = randomUUID();
  return {
    areas: [{ id: areaId, ownerId: admin.id, name: "Ciencias", icon: "✦", color: "mint" }],
    topics: [{ id: topicId, areaId, name: "Biología", description: "Células" }],
    questions: [{ id: questionId, topicId, prompt: "¿Cuál es la unidad de la vida?", options: ["Célula", "Átomo", "Tejido", "Órgano"], correctIndex: 0 }],
    exams: [{ id: randomUUID(), topicId, name: "Examen", questionIds: [questionId] }],
  };
}

test("API de contenido: el servidor valida propiedad, opciones y referencias sin depender del frontend", () => {
  const valid = library();
  assert.equal(validateLibrary(valid, admin).questions[0].correctIndex, 0);
  assert.throws(() => validateLibrary(valid, { ...admin, id: randomUUID() }), /otra cuenta/);
  assert.throws(() => validateLibrary({ ...valid, questions: [] }, admin), /preguntas distintas/);
  assert.throws(() => validateLibrary({ ...valid, topics: [] }, admin), /tema válido/);
  assert.throws(() => validateLibrary({ ...valid, questions: [{ ...valid.questions[0], options: ["Igual", "igual", "C", "D"] }] }, admin), /distintas/);
  assert.throws(() => validateLibrary({ ...valid, questions: [{ ...valid.questions[0], correctIndex: 4 }] }, admin));
  assert.throws(() => validateLibrary({ ...valid, exams: [{ ...valid.exams[0], questionIds: [] }] }, admin));
});
