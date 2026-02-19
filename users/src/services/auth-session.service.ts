import { AppDataSource } from "../db/data-source";
import { RefreshSession } from "../entities/refresh-session.entity";
import { User } from "../entities/user.entity";
import type { PublicUser } from "./user.service";

type Result<T> = { ok: true; value: T } | { ok: false; status: number; message: string };

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

export async function createRefreshSession(input: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<Result<{ sessionId: string }>> {
  const userRepository = AppDataSource.getRepository(User);
  const sessionRepository = AppDataSource.getRepository(RefreshSession);

  const user = await userRepository.findOne({ where: { id: input.userId } });
  if (!user) {
    return { ok: false, status: 404, message: "User not found" };
  }

  const session = sessionRepository.create({
    userId: input.userId,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    revokedAt: null,
    replacedByTokenHash: null,
    lastUsedAt: null,
  });

  const saved = await sessionRepository.save(session);
  return { ok: true, value: { sessionId: saved.id } };
}

export async function rotateRefreshSession(input: {
  tokenHash: string;
  newTokenHash: string;
  expiresAt: Date;
}): Promise<Result<{ user: PublicUser; sessionId: string }>> {
  const sessionRepository = AppDataSource.getRepository(RefreshSession);
  const userRepository = AppDataSource.getRepository(User);

  const current = await sessionRepository.findOne({
    where: { tokenHash: input.tokenHash },
  });

  if (!current) {
    return { ok: false, status: 401, message: "Invalid refresh token" };
  }

  const now = new Date();
  if (current.revokedAt || current.expiresAt <= now) {
    return { ok: false, status: 401, message: "Refresh token is expired or revoked" };
  }

  const user = await userRepository.findOne({ where: { id: current.userId } });
  if (!user) {
    return { ok: false, status: 404, message: "User not found" };
  }

  current.revokedAt = now;
  current.replacedByTokenHash = input.newTokenHash;
  current.lastUsedAt = now;
  await sessionRepository.save(current);

  const nextSession = sessionRepository.create({
    userId: current.userId,
    tokenHash: input.newTokenHash,
    expiresAt: input.expiresAt,
    revokedAt: null,
    replacedByTokenHash: null,
    lastUsedAt: now,
  });
  const saved = await sessionRepository.save(nextSession);

  return {
    ok: true,
    value: {
      user: toPublicUser(user),
      sessionId: saved.id,
    },
  };
}

export async function revokeRefreshSession(input: {
  tokenHash: string;
}): Promise<Result<{ revoked: boolean }>> {
  const sessionRepository = AppDataSource.getRepository(RefreshSession);

  const session = await sessionRepository.findOne({
    where: { tokenHash: input.tokenHash },
  });

  if (!session) {
    return { ok: true, value: { revoked: false } };
  }

  if (!session.revokedAt) {
    const now = new Date();
    session.revokedAt = now;
    session.lastUsedAt = now;
    await sessionRepository.save(session);
  }

  return { ok: true, value: { revoked: true } };
}
