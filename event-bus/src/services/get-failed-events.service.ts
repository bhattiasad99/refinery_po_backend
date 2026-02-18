import { AppDataSource } from "../db/data-source";
import { EventDeliveryStatus } from "../entities/event-delivery-status.entity";
import { FailedEventFilters } from "../types";

export const getFailedEvents = async (filters: FailedEventFilters) => {
    const statusRepository = AppDataSource.getRepository(EventDeliveryStatus);

    const qb = statusRepository
        .createQueryBuilder("delivery")
        .innerJoinAndSelect("delivery.event", "event")
        .where("delivery.status = :status", { status: "failed" })
        .andWhere("delivery.targetService = :targetService", {
            targetService: filters.targetService,
        })
        .andWhere("event.timestamp >= :from", { from: filters.from })
        .andWhere("event.timestamp <= :to", { to: filters.to })
        .orderBy("event.timestamp", "DESC")
        .take(filters.limit);

    if (filters.name) {
        qb.andWhere("event.name = :name", { name: filters.name });
    }

    if (filters.source) {
        qb.andWhere("event.source = :source", { source: filters.source });
    }

    const failedDeliveries = await qb.getMany();
    return failedDeliveries;
}