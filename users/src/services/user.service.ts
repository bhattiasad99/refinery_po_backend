import argon2 from "argon2";
import { AppDataSource } from "../db/data-source";
import { Department } from "../entities/department.entity";
import { User } from "../entities/user.entity";
import type { CreateUserInput } from "../schemas/create-user.schema";
import type { VerifyCredentialsInput } from "../schemas/verify-credentials.schema";

export type PublicUser = {
  id: string;
  email: string;
  departmentId: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateUserResult =
  | { ok: true; value: User }
  | { ok: false; status: number; message: string };

type GetUserResult =
  | { ok: true; value: PublicUser }
  | { ok: false; status: number; message: string };

type VerifyCredentialsResult =
  | { ok: true; value: PublicUser }
  | { ok: false; status: number; message: string };

type ListUsersResult =
  | { ok: true; value: PublicUser[] }
  | { ok: false; status: number; message: string };

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    departmentId: user.departmentId,
    createdBy: user.createdBy,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

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

export async function getUserByIdOrEmail(input: { id?: string; email?: string }): Promise<GetUserResult> {
  const userRepository = AppDataSource.getRepository(User);

  const queryBuilder = userRepository.createQueryBuilder("user");

  if (input.id) {
    queryBuilder.where("user.id = :id", { id: input.id });
  } else if (input.email) {
    queryBuilder.where("LOWER(user.email) = LOWER(:email)", { email: input.email });
  } else {
    return { ok: false, status: 400, message: "id or email is required" };
  }

  const user = await queryBuilder.getOne();

  if (!user) {
    return { ok: false, status: 404, message: "User not found" };
  }

  return { ok: true, value: toPublicUser(user) };
}

export async function verifyCredentials(
  input: VerifyCredentialsInput,
): Promise<VerifyCredentialsResult> {
  const userRepository = AppDataSource.getRepository(User);

  const user = await userRepository
    .createQueryBuilder("user")
    .where("LOWER(user.email) = LOWER(:email)", { email: input.email })
    .getOne();

  if (!user) {
    return { ok: false, status: 401, message: "Invalid credentials" };
  }

  const isPasswordValid = await argon2.verify(user.passwordHash, input.password);
  if (!isPasswordValid) {
    return { ok: false, status: 401, message: "Invalid credentials" };
  }

  return { ok: true, value: toPublicUser(user) };
}

export async function listUsers(input: { limit?: number } = {}): Promise<ListUsersResult> {
  const userRepository = AppDataSource.getRepository(User);
  const limit = input.limit && input.limit > 0 ? Math.min(input.limit, 200) : 50;

  const users = await userRepository.find({
    order: { createdAt: "DESC" },
    take: limit,
  });

  return { ok: true, value: users.map(toPublicUser) };
}
