type GetUserQuery = {
  id?: string;
  email?: string;
};

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export function parseGetUserQuery(payload: unknown): ParseResult<GetUserQuery> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, message: "query must be an object" };
  }

  const query = payload as Record<string, unknown>;
  const id = typeof query.id === "string" ? query.id.trim() : "";
  const email = typeof query.email === "string" ? query.email.trim().toLowerCase() : "";

  if (!id && !email) {
    return { ok: false, message: "id or email is required" };
  }

  if (id && email) {
    return { ok: false, message: "provide either id or email, not both" };
  }

  if (email && !email.includes("@")) {
    return { ok: false, message: "email must be valid" };
  }

  return {
    ok: true,
    value: {
      ...(id ? { id } : {}),
      ...(email ? { email } : {}),
    },
  };
}
