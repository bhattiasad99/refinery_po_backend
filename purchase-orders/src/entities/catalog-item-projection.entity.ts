import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { decimalTransformer } from "./decimal.transformer";

@Entity({ name: "catalog_items_projection" })
export class CatalogItemProjection {
  @PrimaryColumn({ type: "varchar", length: 140 })
  id!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  name!: string | null;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ name: "category_id", type: "varchar", length: 140, nullable: true })
  categoryId!: string | null;

  @Column({ name: "category_name", type: "varchar", length: 200, nullable: true })
  categoryName!: string | null;

  @Column({ name: "supplier_id", type: "varchar", length: 140, nullable: true })
  supplierId!: string | null;

  @Column({ name: "supplier_name", type: "varchar", length: 200, nullable: true })
  supplierName!: string | null;

  @Column({
    type: "numeric",
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  price!: number | null;

  @Column({ type: "varchar", length: 12, nullable: true })
  currency!: string | null;

  @Column({ name: "in_stock", type: "boolean", nullable: true })
  inStock!: boolean | null;

  @Column({ name: "is_active", type: "boolean", nullable: true })
  isActive!: boolean | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
