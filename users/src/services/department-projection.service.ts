import { AppDataSource } from "../db/data-source";
import { Department } from "../entities/department.entity";

type DepartmentProjectionInput = {
  id: string;
  name: string;
  description: string | null;
};

export function parseDepartmentProjectionInput(body: Record<string, unknown>): DepartmentProjectionInput | null {
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description : null;

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    description,
  };
}

export async function upsertDepartmentProjection(input: DepartmentProjectionInput): Promise<void> {
  const departmentRepository = AppDataSource.getRepository(Department);
  await departmentRepository.upsert(
    {
      id: input.id,
      name: input.name,
      description: input.description,
    },
    ["id"],
  );
}
