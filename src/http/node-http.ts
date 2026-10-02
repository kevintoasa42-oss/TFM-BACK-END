import type { IncomingMessage, ServerResponse } from "node:http";
import { ApplicationError } from "../errors.ts";

export function webRequest(request: IncomingMessage, port: number, body?: Buffer): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) value.forEach((part) => headers.append(name, part));
    else if (value !== undefined) headers.set(name, value);
  }
  // The configured frontend proxy owns this header; direct connections use HTTP.
  const protocol = process.env.TRUST_PROXY === "true" && headers.get("x-forwarded-proto") === "https" ? "https" : "http";
  return new Request(new URL(request.url ?? "/", `${protocol}://${request.headers.host ?? `localhost:${port}`}`), {
    method: request.method ?? "GET", headers, body: body ? new Uint8Array(body) : undefined,
  });
}

export async function readBody(request: IncomingMessage): Promise<Buffer | undefined> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > 2_500_000) throw new ApplicationError(413, "La solicitud supera el tamaño permitido.");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

export async function respond(response: ServerResponse, result: Response, head = false): Promise<void> {
  response.statusCode = result.status;
  result.headers.forEach((value, name) => response.setHeader(name, value));
  response.end(head ? undefined : Buffer.from(await result.arrayBuffer()));
}
