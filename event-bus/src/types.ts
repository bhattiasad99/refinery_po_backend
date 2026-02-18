
export type IncomingEvent = {
    name: string;
    body: Record<string, unknown>;
    source: string;
    url: string;
};

export type ParsedResult<T> =
    | { ok: true; value: T }
    | { ok: false; message: string };

export type EventFilters = {
    name?: string;
    source?: string;
    from: Date;
    to: Date;
    order: "ASC" | "DESC";
    limit: number;
};

export type FailedEventFilters = {
    targetService: string;
    name?: string;
    source?: string;
    from: Date;
    to: Date;
    limit: number;
};

