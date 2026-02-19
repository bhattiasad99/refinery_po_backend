import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { PurchaseOrder } from "./purchase-order.entity";
import { decimalTransformer } from "./decimal.transformer";

@Entity({ name: "purchase_order_line_items" })
export class PurchaseOrderLineItem {
  @PrimaryColumn({ type: "varchar", length: 140 })
  id!: string;

  @Column({ name: "purchase_order_id", type: "varchar", length: 140 })
  purchaseOrderId!: string;

  @ManyToOne(() => PurchaseOrder, (purchaseOrder) => purchaseOrder.lineItems, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "purchase_order_id", referencedColumnName: "id" })
  purchaseOrder!: PurchaseOrder;

  @Column({ name: "catalog_item_id", type: "varchar", length: 140, nullable: true })
  catalogItemId!: string | null;

  @Column({ name: "item_name", type: "varchar", length: 255, nullable: true })
  item!: string | null;

  @Column({ name: "supplier_name", type: "varchar", length: 200, nullable: false })
  supplier!: string;

  @Column({ name: "category_name", type: "varchar", length: 140, nullable: true })
  category!: string | null;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({
    type: "numeric",
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  quantity!: number | null;

  @Column({
    name: "unit_price",
    type: "numeric",
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  unitPrice!: number | null;

  @Column({ name: "sort_order", type: "integer", default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
