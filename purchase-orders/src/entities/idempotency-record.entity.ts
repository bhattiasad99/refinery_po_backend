import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export const IDEMPOTENCY_STATE = {
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
} as const;

export type IdempotencyState = (typeof IDEMPOTENCY_STATE)[keyof typeof IDEMPOTENCY_STATE];

@Entity({ name: "idempotency_records" })
@Index(["key", "actorId", "method", "path"], { unique: true })
export class IdempotencyRecord {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 120 })
  key!: string;

  @Column({ type: "varchar", length: 255, name: "actor_id" })
  actorId!: string;

  @Column({ type: "varchar", length: 10 })
  method!: string;

  @Column({ type: "text" })
  path!: string;

  @Column({ type: "varchar", length: 64, name: "request_hash" })
  requestHash!: string;

  @Column({ type: "varchar", length: 20 })
  state!: IdempotencyState;

  @Column({ type: "int", name: "status_code", nullable: true })
  statusCode!: number | null;

  @Column({ type: "jsonb", name: "response_body", nullable: true })
  responseBody!: unknown;

  @Column({ type: "timestamptz", name: "expires_at" })
  expiresAt!: Date;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
