import { AppDataSource } from "../db/data-source";
import { EventDeliveryStatus } from "../entities/event-delivery-status.entity";
import { EventStore } from "../entities/event-store.entity";
import { getErrorMessage } from "../lib/error-message";
import { sendEventToService } from "../lib/event-delivery";
import { generateDeliveryStatusId, generateEventId } from "../lib/id-generator";
import { getRegisteredServices } from "../lib/service-registry";
import type { IncomingEvent } from "../types";

export const receiveEventService = async (payload: IncomingEvent): Promise<{
    savedEvent: EventStore;
    deliveryRows: EventDeliveryStatus[];
    successCount: number;
    failedCount: number;
}> => {
    // Persist the event once, then fan out immutable payload to all registered services.
    const eventRepository = AppDataSource.getRepository(EventStore);
    const deliveryStatusRepository = AppDataSource.getRepository(EventDeliveryStatus);

    const eventId = generateEventId(payload.source);
    const eventRecord = eventRepository.create({
        id: eventId,
        name: payload.name,
        data: payload.body,
        source: payload.source,
        url: payload.url,
    });

    const savedEvent = await eventRepository.save(eventRecord);

    const targetServices = getRegisteredServices();
    const outgoingPayload = {
        id: savedEvent.id,
        name: savedEvent.name,
        body: savedEvent.data,
        source: savedEvent.source,
        url: savedEvent.url,
        timestamp: savedEvent.timestamp,
    };

    const settledResults = await Promise.allSettled(
        targetServices.map((service) => sendEventToService(service, outgoingPayload)),
    );

    // Persist one delivery row per target service so failures are queryable/retriable later.
    const deliveryRows = settledResults.map((result, index) => {
        const targetService = targetServices[index];
        const isSuccess = result.status === "fulfilled";

        return deliveryStatusRepository.create({
            id: generateDeliveryStatusId(savedEvent.id, targetService.name),
            status: isSuccess ? "success" : "failed",
            targetService: targetService.name,
            targetUrl: targetService.url,
            eventId: savedEvent.id,
            errorMessage: isSuccess ? null : getErrorMessage(result.reason),
        });
    });

    if (deliveryRows.length > 0) {
        await deliveryStatusRepository.save(deliveryRows);
    }

    const successCount = deliveryRows.filter((row) => row.status === "success").length;
    const failedCount = deliveryRows.length - successCount;
    return { savedEvent, deliveryRows, successCount, failedCount };
};
