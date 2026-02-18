import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn } from "typeorm";
import { EventDeliveryStatus } from "./event-delivery-status.entity";

@Entity({ name: "event_store" })
export class EventStore {
  @PrimaryColumn({ type: "varchar", length: 140 })
  id!: string;

  @CreateDateColumn({ type: "timestamptz", name: "timestamp" })
  timestamp!: Date;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({ type: "jsonb", name: "data" })
  data!: Record<string, unknown>;

  @Column({ type: "varchar", length: 120 })
  source!: string;

  @Column({ type: "text", name: "url" })
  url!: string;

  @OneToMany(() => EventDeliveryStatus, (deliveryStatus) => deliveryStatus.event)
  deliveryStatuses!: EventDeliveryStatus[];
}
