import { Column, Entity, OneToMany, PrimaryColumn } from "typeorm";
import { User } from "./user.entity";

@Entity({ name: "departments" })
export class Department {
  @PrimaryColumn({ type: "varchar", length: 140 })
  id!: string;

  @Column({ type: "varchar", length: 120, unique: true })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @OneToMany(() => User, (user) => user.department)
  users!: User[];
}
