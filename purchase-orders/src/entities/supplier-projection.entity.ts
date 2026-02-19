import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "suppliers_projection" })
export class SupplierProjection {
  @PrimaryColumn({ type: "varchar", length: 140 })
  id!: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  name!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  code!: string | null;

  @Column({ name: "is_active", type: "boolean", nullable: true })
  isActive!: boolean | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
