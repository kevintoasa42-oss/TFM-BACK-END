import test from "node:test";
import assert from "node:assert/strict";
import { newRoom, joinRoom, startRoom, answerRoom, expireRoom, revealRoom, advanceRoom, roomView } from "../src/domain/room.ts";

const question = { id: "q1", topicId: "t1", prompt: "¿Cuál es la unidad de la vida?", options: ["Célula", "Átomo", "Tejido", "Órgano"], correctIndex: 0 };

test("sala: dos jugadores, solución oculta, puntuación y final", () => {
  const lobby = newRoom("123456", "Examen", "host", "Ana", [question]);
  assert.throws(() => newRoom("111111", "Vacío", "host", "Ana", []), /no tiene preguntas/);
  const joined = joinRoom(lobby, "guest", "Luis");
  assert.throws(() => joinRoom(joined, "third", "Eva"), /completa/);
  assert.throws(() => startRoom(joined, "guest", 1000), /anfitrión/);
  const started = startRoom(joined, "host", 1000);
  assert.equal("correctIndex" in roomView(started, "guest", 1000).question, false);
  const hostAnswered = answerRoom(started, "host", 0, 2000);
  assert.throws(() => answerRoom(hostAnswered, "host", 1, 3000), /Ya respondiste/);
  const revealed = answerRoom(hostAnswered, "guest", 1, 4000);
  assert.equal(revealed.phase, "reveal");
  assert.equal(revealed.players[0].score, 100);
  assert.equal(revealed.players[1].score, 0);
  assert.equal(roomView(revealed, "guest", 4000).question.correctIndex, 0);
  assert.equal(revealRoom(revealed), revealed, "no se duplica la puntuación");
  assert.throws(() => advanceRoom(revealed, "guest", 5000), /anfitrión/);
  assert.equal(advanceRoom(revealed, "host", 5000).phase, "finished");
});

test("sala: rechaza respuesta tardía y cierra al terminar los 20 segundos", () => {
  const started = startRoom(joinRoom(newRoom("123456", "Examen", "host", "Ana", [question]), "guest", "Luis"), "host", 1000);
  assert.throws(() => answerRoom(started, "guest", 0, 21_000), /tiempo/);
  const expired = expireRoom(started, 21_000);
  assert.equal(expired.phase, "reveal");
  assert.equal(expired.players[0].score, 0);
  assert.equal(expireRoom(expired, 50_000), expired);
});

test("sala: comunica el reloj del servidor para que el navegador calcule el tiempo restante", () => {
  const started = startRoom(joinRoom(newRoom("123456", "Examen", "host", "Ana", [question]), "guest", "Luis"), "host", 1000);
  const host = roomView(started, "host", 5000);
  const guest = roomView(started, "guest", 5000);
  assert.equal(host.endsAt - host.serverNow, 16_000);
  assert.equal(guest.endsAt - guest.serverNow, 16_000);
  assert.equal("correctIndex" in guest.question, false);
});
