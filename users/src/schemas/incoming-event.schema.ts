export type IncomingEvent = {
  name: string;
  body: Record<string, unknown>;
  source: string;
  url: string;
};

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export function parseIncomingEvent(payload: unknown): ParseResult<IncomingEvent> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, message: "event payload must be a JSON object" };
  }

  const input = payload as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const source = typeof input.source === "string" ? input.source.trim() : "";
  const url = typeof input.url === "string" ? input.url.trim() : "";
  const body = input.body;

  if (!name) {
    return { ok: false, message: "name is required" };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "body must be a JSON object" };
  }

  if (!source) {
    return { ok: false, message: "source is required" };
  }

  if (!url) {
    return { ok: false, message: "url is required" };
  }

  return {
    ok: true,
    value: {
      name,
      body: body as Record<string, unknown>,
      source,
      url,
    },
  };
}
