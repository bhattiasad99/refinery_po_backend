import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "users_projection" })
export class UserProjection {
  @PrimaryColumn({ type: "varchar", length: 140 })
  id!: string;

  @Column({ name: "full_name", type: "varchar", length: 200, nullable: true })
  fullName!: string | null;

  @Column({ type: "varchar", length: 240, nullable: true })
  email!: string | null;

  @Column({ name: "department_id", type: "varchar", length: 140, nullable: true })
  departmentId!: string | null;

  @Column({ name: "department_name", type: "varchar", length: 200, nullable: true })
  departmentName!: string | null;

  @Column({ name: "is_active", type: "boolean", nullable: true })
  isActive!: boolean | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
