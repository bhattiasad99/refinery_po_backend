import { QueryFailedError } from "typeorm";
import { AppDataSource } from "../db/data-source";
import {
  IDEMPOTENCY_STATE,
  IdempotencyRecord,
} from "../entities/idempotency-record.entity";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

type IdempotencyLookup = {
  key: string;
  actorId: string;
  method: string;
  path: string;
};

type BeginIdempotencyInput = IdempotencyLookup & {
  requestHash: string;
  ttlMs?: number;
};

type ReplayResult = {
  kind: "replay";
  statusCode: number;
  responseBody: unknown;
};

type StartedResult = {
  kind: "started";
  record: IdempotencyRecord;
};

export type BeginIdempotencyResult = ReplayResult | StartedResult;

export class IdempotencyPayloadMismatchError extends Error {
  constructor() {
    super("Idempotency key was already used with a different payload");
    this.name = "IdempotencyPayloadMismatchError";
  }
}

export class IdempotencyRequestInProgressError extends Error {
  constructor() {
    super("An identical request is already being processed");
    this.name = "IdempotencyRequestInProgressError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as { code?: string } | undefined;
  return driverError?.code === "23505";
}

async function getExistingRecord(where: IdempotencyLookup): Promise<IdempotencyRecord | null> {
  const repository = AppDataSource.getRepository(IdempotencyRecord);
  return repository.findOne({
    where: {
      key: where.key,
      actorId: where.actorId,
      method: where.method,
      path: where.path,
    },
  });
}

export async function beginIdempotentRequest(
  input: BeginIdempotencyInput,
): Promise<BeginIdempotencyResult> {
  const repository = AppDataSource.getRepository(IdempotencyRecord);
  const now = new Date();
  const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;

  const next = repository.create({
    key: input.key,
    actorId: input.actorId,
    method: input.method,
    path: input.path,
    requestHash: input.requestHash,
    state: IDEMPOTENCY_STATE.PROCESSING,
    statusCode: null,
    responseBody: null,
    expiresAt: new Date(now.getTime() + ttlMs),
  });

  try {
    const created = await repository.save(next);
    return { kind: "started", record: created };
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
  }

  const existing = await getExistingRecord(input);
  if (!existing) {
    throw new Error("Idempotency conflict occurred but existing record was not found");
  }

  if (existing.expiresAt.getTime() <= now.getTime()) {
    await repository.delete({ id: existing.id });
    return beginIdempotentRequest(input);
  }

  if (existing.requestHash !== input.requestHash) {
    throw new IdempotencyPayloadMismatchError();
  }

  if (existing.state === IDEMPOTENCY_STATE.COMPLETED && existing.statusCode !== null) {
    return {
      kind: "replay",
      statusCode: existing.statusCode,
      responseBody: existing.responseBody,
    };
  }

  throw new IdempotencyRequestInProgressError();
}

export async function completeIdempotentRequest(
  recordId: string,
  statusCode: number,
  responseBody: unknown,
): Promise<void> {
  const repository = AppDataSource.getRepository(IdempotencyRecord);
  await repository.update(
    { id: recordId },
    {
      state: IDEMPOTENCY_STATE.COMPLETED,
      statusCode,
      responseBody: responseBody as never,
    },
  );
}

export async function releaseIdempotentRequest(recordId: string): Promise<void> {
  const repository = AppDataSource.getRepository(IdempotencyRecord);
  await repository.delete({ id: recordId });
}

export async function cleanupExpiredIdempotencyRecords(now = new Date()): Promise<void> {
  const repository = AppDataSource.getRepository(IdempotencyRecord);
  await repository
    .createQueryBuilder()
    .delete()
    .from(IdempotencyRecord)
    .where("expires_at <= :now", { now: now.toISOString() })
    .execute();
}
