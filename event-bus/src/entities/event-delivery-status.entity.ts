import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { EventStore } from "./event-store.entity";

@Entity({ name: "event_delivery_status" })
export class EventDeliveryStatus {
  @PrimaryColumn({ type: "varchar", length: 180 })
  id!: string;

  @Column({ type: "varchar", length: 20 })
  status!: "failed" | "success";

  @Column({ type: "varchar", length: 120, name: "target_service" })
  targetService!: string;

  @Column({ type: "text", name: "target_url" })
  targetUrl!: string;

  @CreateDateColumn({ type: "timestamptz", name: "delivered_at" })
  deliveredAt!: Date;

  @Column({ type: "text", name: "error_message", nullable: true })
  errorMessage!: string | null;

  @Column({ type: "varchar", length: 140, name: "event_id" })
  eventId!: string;

  @ManyToOne(() => EventStore, (event) => event.deliveryStatuses, { onDelete: "CASCADE" })
  @JoinColumn({ name: "event_id" })
  event!: EventStore;
}
