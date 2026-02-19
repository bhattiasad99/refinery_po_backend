import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "purchase_order_number_counters" })
export class PurchaseOrderNumberCounter {
  @PrimaryColumn({ name: "counter_date", type: "date" })
  counterDate!: string;

  @Column({ name: "last_value", type: "integer" })
  lastValue!: number;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
