export type VerifyCredentialsInput = {
  email: string;
  password: string;
};

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export function parseVerifyCredentialsInput(payload: unknown): ParseResult<VerifyCredentialsInput> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, message: "request body must be a JSON object" };
  }

  const input = payload as Record<string, unknown>;
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (!email) {
    return { ok: false, message: "email is required" };
  }

  if (!email.includes("@")) {
    return { ok: false, message: "email must be valid" };
  }

  if (password.length < 8) {
    return { ok: false, message: "password must be at least 8 characters" };
  }

  return {
    ok: true,
    value: {
      email,
      password,
    },
  };
}
