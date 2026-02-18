import { EventDeliveryStatus } from "../entities/event-delivery-status.entity";
import { EventStore } from "../entities/event-store.entity";

export const ENTITIES = [
  { name: "event_store", entity: EventStore },
  { name: "event_delivery_status", entity: EventDeliveryStatus },
] as const;

export type EntityName = (typeof ENTITIES)[number]["name"];
