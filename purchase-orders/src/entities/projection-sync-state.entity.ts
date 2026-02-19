import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "projection_sync_state" })
export class ProjectionSyncState {
  @PrimaryColumn({ type: "varchar", length: 120 })
  key!: string;

  @Column({ name: "last_cursor_at", type: "timestamptz", nullable: true })
  lastCursorAt!: Date | null;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
