import argon2 from "argon2";
import { AppDataSource } from "../db/data-source";
import { Department } from "../entities/department.entity";
import { User } from "../entities/user.entity";
import type { CreateUserInput } from "../schemas/create-user.schema";

type CreateUserResult =
  | { ok: true; value: User }
  | { ok: false; status: number; message: string };

export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const userRepository = AppDataSource.getRepository(User);
  const departmentRepository = AppDataSource.getRepository(Department);

  const existingUser = await userRepository
    .createQueryBuilder("user")
    .where("LOWER(user.email) = LOWER(:email)", { email: input.email })
    .getOne();

  if (existingUser) {
    return { ok: false, status: 409, message: "User email already exists" };
  }

  const department = await departmentRepository
    .createQueryBuilder("department")
    .where("LOWER(department.name) = LOWER(:name)", { name: input.department })
    .getOne();

  if (!department) {
    return { ok: false, status: 400, message: "Department is invalid" };
  }

  try {
    const passwordHash = await argon2.hash(input.password);

    const user = userRepository.create({
      email: input.email,
      passwordHash,
      departmentId: department.id,
      createdBy: null,
    });

    const savedUser = await userRepository.save(user);
    return { ok: true, value: savedUser };
  } catch (error) {
    const dbError = error as { code?: string };
    if (dbError.code === "23505") {
      return { ok: false, status: 409, message: "User email already exists" };
    }

    throw error;
  }
}
