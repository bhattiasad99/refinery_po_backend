import { AppDataSource } from "../db/data-source";
import { EventStore } from "../entities/event-store.entity";
import { EventFilters } from "../types";

export const getEvents = async (filters: EventFilters) => {
    const eventRepository = AppDataSource.getRepository(EventStore);
    const qb = eventRepository.createQueryBuilder("event");

    if (filters.name) {
        qb.andWhere("event.name = :name", { name: filters.name });
    }

    if (filters.source) {
        qb.andWhere("event.source = :source", { source: filters.source });
    }

    qb.andWhere("event.timestamp >= :from", { from: filters.from });
    qb.andWhere("event.timestamp <= :to", { to: filters.to });
    qb.orderBy("event.timestamp", filters.order);
    qb.take(filters.limit);

    const events = await qb.getMany();
    return events;
}