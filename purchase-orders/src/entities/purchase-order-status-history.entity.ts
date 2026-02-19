import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { PurchaseOrder } from "./purchase-order.entity";

@Entity({ name: "purchase_order_status_history" })
export class PurchaseOrderStatusHistory {
  @PrimaryColumn({ type: "varchar", length: 140 })
  id!: string;

  @Column({ name: "purchase_order_id", type: "varchar", length: 140 })
  purchaseOrderId!: string;

  @Column({ name: "from_status", type: "varchar", length: 40, nullable: true })
  fromStatus!: string | null;

  @Column({ name: "to_status", type: "varchar", length: 40 })
  toStatus!: string;

  @Column({ name: "changed_by", type: "varchar", length: 200, nullable: true })
  changedBy!: string | null;

  @Column({ name: "changed_at", type: "timestamptz" })
  changedAt!: Date;

  @ManyToOne(() => PurchaseOrder, (purchaseOrder) => purchaseOrder.statusHistory, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "purchase_order_id" })
  purchaseOrder!: PurchaseOrder;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
