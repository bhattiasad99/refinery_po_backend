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

@Entity({ name: "purchase_order_payment_milestones" })
export class PurchaseOrderPaymentMilestone {
  @PrimaryColumn({ type: "varchar", length: 140 })
  id!: string;

  @Column({ name: "purchase_order_id", type: "varchar", length: 140 })
  purchaseOrderId!: string;

  @ManyToOne(() => PurchaseOrder, (purchaseOrder) => purchaseOrder.milestones, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "purchase_order_id", referencedColumnName: "id" })
  purchaseOrder!: PurchaseOrder;

  @Column({ type: "varchar", length: 255, nullable: true })
  label!: string | null;

  @Column({
    type: "numeric",
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  percentage!: number | null;

  @Column({ name: "due_in_days", type: "integer", nullable: true })
  dueInDays!: number | null;

  @Column({ name: "sort_order", type: "integer", default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
