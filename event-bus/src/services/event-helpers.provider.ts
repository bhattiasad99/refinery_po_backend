import { Request } from 'express';
import { EventFilters, FailedEventFilters, ParsedResult } from '../types';
import { eventFiltersSchema } from '../schema/get-events.schema';
import { failedEventFiltersSchema } from '../schema/get-failed-events.schema';


export const eventHelpersProvider = {
    normalizeFilterQuery: (query: Request["query"]) => {
        return {
            name: eventHelpersProvider.readQueryValue(query.name),
            source: eventHelpersProvider.readQueryValue(query.source),
            targetService: eventHelpersProvider.readQueryValue(query.targetService),
            from: eventHelpersProvider.readQueryValue(query.from),
            to: eventHelpersProvider.readQueryValue(query.to),
            order: eventHelpersProvider.readQueryValue(query.order),
            limit: eventHelpersProvider.readQueryValue(query.limit),
        }
    },
    readQueryValue: (value: unknown): string | undefined => {
        if (Array.isArray(value)) {
            const first = value[0];
            return typeof first === "string" ? first : undefined;
        }

        if (typeof value !== "string") {
            return undefined;
        }

        return value;
    },
    parseEventFilters: (query: Request["query"]): ParsedResult<EventFilters> => {
        const { value, error } = eventFiltersSchema.validate(eventHelpersProvider.normalizeFilterQuery(query), {
            abortEarly: true,
        });
        if (error) {
            const invalidDate = error.details.some((detail) => {
                const key = String(detail.path[0] ?? "");
                return key === "from" || key === "to";
            });
            return {
                ok: false,
                message: invalidDate ? "from and to must be valid ISO dates" : (error.details[0]?.message ?? "Invalid query"),
            };
        }

        return {
            ok: true,
            value: {
                name: value.name,
                source: value.source,
                from: value.from,
                to: value.to,
                order: value.order,
                limit: value.limit,
            },
        };
    },
    parseFailedEventFilters: (query: Request["query"]): ParsedResult<FailedEventFilters> => {
        const { value, error } = failedEventFiltersSchema.validate(eventHelpersProvider.normalizeFilterQuery(query), {
            abortEarly: true,
        });
        if (error) {
            const invalidDate = error.details.some((detail) => {
                const key = String(detail.path[0] ?? "");
                return key === "from" || key === "to";
            });
            return {
                ok: false,
                message: invalidDate ? "from and to must be valid ISO dates" : (error.details[0]?.message ?? "Invalid query"),
            };
        }

        return {
            ok: true,
            value: {
                targetService: value.targetService,
                name: value.name,
                source: value.source,
                from: value.from,
                to: value.to,
                limit: value.limit,
            },
        };
    }
}
