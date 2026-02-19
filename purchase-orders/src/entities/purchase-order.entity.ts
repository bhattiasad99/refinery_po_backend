import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { PurchaseOrderLineItem } from "./purchase-order-line-item.entity";
import { PurchaseOrderPaymentMilestone } from "./purchase-order-payment-milestone.entity";
import { PurchaseOrderStatusHistory } from "./purchase-order-status-history.entity";
import { decimalTransformer } from "./decimal.transformer";

@Entity({ name: "purchase_orders" })
export class PurchaseOrder {
  @PrimaryColumn({ type: "varchar", length: 140 })
  id!: string;

  @Column({ type: "varchar", length: 40, default: "DRAFT" })
  status!: string;

  @Column({ name: "po_number", type: "varchar", length: 40, unique: true, nullable: true })
  poNumber!: string | null;

  @Column({ name: "submitted_at", type: "timestamptz", nullable: true })
  submittedAt!: Date | null;

  @Column({ name: "submitted_by", type: "varchar", length: 200, nullable: true })
  submittedBy!: string | null;

  @Column({ name: "approved_at", type: "timestamptz", nullable: true })
  approvedAt!: Date | null;

  @Column({ name: "approved_by", type: "varchar", length: 200, nullable: true })
  approvedBy!: string | null;

  @Column({ name: "rejected_at", type: "timestamptz", nullable: true })
  rejectedAt!: Date | null;

  @Column({ name: "rejected_by", type: "varchar", length: 200, nullable: true })
  rejectedBy!: string | null;

  @Column({ name: "fulfilled_at", type: "timestamptz", nullable: true })
  fulfilledAt!: Date | null;

  @Column({ name: "fulfilled_by", type: "varchar", length: 200, nullable: true })
  fulfilledBy!: string | null;

  @Column({ name: "requested_by_department", type: "varchar", length: 160, nullable: true })
  requestedByDepartment!: string | null;

  @Column({ name: "requested_by_user", type: "varchar", length: 160, nullable: true })
  requestedByUser!: string | null;

  @Column({ name: "budget_code", type: "varchar", length: 80, nullable: true })
  budgetCode!: string | null;

  @Column({ name: "need_by_date", type: "date", nullable: true })
  needByDate!: string | null;

  @Column({ name: "supplier_name", type: "varchar", length: 200, nullable: true })
  supplierName!: string | null;

  @Column({ name: "payment_term_id", type: "varchar", length: 40, nullable: true })
  paymentTermId!: string | null;

  @Column({ name: "payment_term_label", type: "varchar", length: 120, nullable: true })
  paymentTermLabel!: string | null;

  @Column({ name: "payment_term_description", type: "text", nullable: true })
  paymentTermDescription!: string | null;

  @Column({ name: "tax_included", type: "boolean", nullable: true })
  taxIncluded!: boolean | null;

  @Column({
    name: "advance_percentage",
    type: "numeric",
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  advancePercentage!: number | null;

  @Column({ name: "balance_due_in_days", type: "integer", nullable: true })
  balanceDueInDays!: number | null;

  @Column({ name: "custom_terms", type: "text", nullable: true })
  customTerms!: string | null;

  @Column({ name: "step4_primary", type: "text", nullable: true })
  step4Primary!: string | null;

  @Column({ name: "step4_secondary", type: "text", nullable: true })
  step4Secondary!: string | null;

  @Column({ name: "step4_tertiary", type: "text", nullable: true })
  step4Tertiary!: string | null;

  @Column({ name: "step5_primary", type: "text", nullable: true })
  step5Primary!: string | null;

  @Column({ name: "step5_secondary", type: "text", nullable: true })
  step5Secondary!: string | null;

  @Column({ name: "step5_tertiary", type: "text", nullable: true })
  step5Tertiary!: string | null;

  @OneToMany(() => PurchaseOrderLineItem, (lineItem) => lineItem.purchaseOrder, {
    cascade: false,
  })
  lineItems!: PurchaseOrderLineItem[];

  @OneToMany(() => PurchaseOrderPaymentMilestone, (milestone) => milestone.purchaseOrder, {
    cascade: false,
  })
  milestones!: PurchaseOrderPaymentMilestone[];

  @OneToMany(() => PurchaseOrderStatusHistory, (history) => history.purchaseOrder, {
    cascade: false,
  })
  statusHistory!: PurchaseOrderStatusHistory[];

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
