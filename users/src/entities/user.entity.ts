import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Department } from "./department.entity";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 180, unique: true })
  email!: string;

  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash!: string;

  @Column({ name: "department_id", type: "varchar", length: 140 })
  departmentId!: string;

  @ManyToOne(() => Department, (department) => department.users, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "department_id" })
  department!: Department;

  @Column({ name: "created_by", type: "varchar", length: 140, nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
