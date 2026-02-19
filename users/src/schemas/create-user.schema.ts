export type CreateUserInput = {
  email: string;
  password: string;
  department: string;
  createdBy: null;
};

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export function parseCreateUserInput(payload: unknown): ParseResult<CreateUserInput> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, message: "request body must be a JSON object" };
  }

  const input = payload as Record<string, unknown>;
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const department = typeof input.department === "string" ? input.department.trim() : "";

  if (!email) {
    return { ok: false, message: "email is required" };
  }

  if (!email.includes("@")) {
    return { ok: false, message: "email must be valid" };
  }

  if (password.length < 8) {
    return { ok: false, message: "password must be at least 8 characters" };
  }

  if (!department) {
    return { ok: false, message: "department is required" };
  }

  if ("createdBy" in input && input.createdBy !== null) {
    return { ok: false, message: "createdBy must be null" };
  }

  return {
    ok: true,
    value: {
      email,
      password,
      department,
      createdBy: null,
    },
  };
}
