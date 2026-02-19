import { AppDataSource } from "../db/data-source";

type RowData = Record<string, unknown>;

type BackfillSummary = {
  processed: number;
  published: number;
  skipped: number;
  failed: number;
};

type EnsureTrackingTableInput = {
  tableName: string;
  idColumn: string;
  idType: "uuid" | "text";
};

type BackfillConfig<Row extends RowData> = {
  sourceTable: string;
  sourceIdColumn: keyof Row & string;
  sourceColumns: Array<keyof Row & string>;
  trackingTable: string;
  trackingIdColumn: string;
  eventType: string;
  eventSource: string;
  eventUrl: string;
  mapRowToPayload: (row: Row) => Record<string, unknown>;
  batchSize?: number;
};

function quoteIdentifier(identifier: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

export async function publishEvent(
  type: string,
  payload: Record<string, unknown>,
  source: string,
  url: string,
): Promise<void> {
  const eventBusUrl = process.env.SERVICE_EVENT_BUS_URL?.trim();
  if (!eventBusUrl) {
    throw new Error("SERVICE_EVENT_BUS_URL is not set");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const internalServiceKey = process.env.INTERNAL_SERVICE_KEY?.trim();
  if (internalServiceKey) {
    headers["x-internal-key"] = internalServiceKey;
  }

  const response = await fetch(`${eventBusUrl}/events`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: type,
      body: payload,
      source,
      url,
    }),
  });

  if (!response.ok) {
    throw new Error(`Event bus responded with status ${response.status}`);
  }
}

class BackfillProvider {
  async ensureTrackingTable(input: EnsureTrackingTableInput): Promise<void> {
    const tableName = quoteIdentifier(input.tableName);
    const idColumn = quoteIdentifier(input.idColumn);
    const idType = input.idType === "uuid" ? "uuid" : "text";

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${idColumn} ${idType} PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async backfill<Row extends RowData>(config: BackfillConfig<Row>): Promise<BackfillSummary> {
    const sourceTable = quoteIdentifier(config.sourceTable);
    const sourceIdColumn = quoteIdentifier(config.sourceIdColumn);
    const sourceColumns = config.sourceColumns.map(quoteIdentifier).join(", ");
    const trackingTable = quoteIdentifier(config.trackingTable);
    const trackingIdColumn = quoteIdentifier(config.trackingIdColumn);
    const batchSize = config.batchSize ?? 500;

    let cursor: string | null = null;
    const summary: BackfillSummary = {
      processed: 0,
      published: 0,
      skipped: 0,
      failed: 0,
    };

    while (true) {
      let rows: Row[];
      if (cursor === null) {
        rows = await AppDataSource.query(
          `SELECT ${sourceColumns} FROM ${sourceTable} ORDER BY ${sourceIdColumn} ASC LIMIT $1`,
          [batchSize],
        ) as Row[];
      } else {
        rows = await AppDataSource.query(
          `SELECT ${sourceColumns} FROM ${sourceTable}
           WHERE ${sourceIdColumn} > $1
           ORDER BY ${sourceIdColumn} ASC
           LIMIT $2`,
          [cursor, batchSize],
        ) as Row[];
      }

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        summary.processed += 1;

        const rowIdRaw = row[config.sourceIdColumn];
        const rowId = typeof rowIdRaw === "string" ? rowIdRaw : String(rowIdRaw ?? "");
        if (!rowId) {
          summary.failed += 1;
          console.error("Backfill skipped row with empty id", row);
          continue;
        }

        try {
          const insertResult = await AppDataSource.query(
            `INSERT INTO ${trackingTable} (${trackingIdColumn})
             VALUES ($1)
             ON CONFLICT (${trackingIdColumn}) DO NOTHING
             RETURNING ${trackingIdColumn}`,
            [rowId],
          ) as Array<Record<string, unknown>>;

          if (insertResult.length === 0) {
            summary.skipped += 1;
            continue;
          }

          await publishEvent(
            config.eventType,
            config.mapRowToPayload(row),
            config.eventSource,
            config.eventUrl,
          );
          summary.published += 1;
        } catch (error) {
          summary.failed += 1;
          console.error(`Backfill failed for ${config.sourceTable}.${config.sourceIdColumn}=${rowId}`, error);

          try {
            await AppDataSource.query(
              `DELETE FROM ${trackingTable} WHERE ${trackingIdColumn} = $1`,
              [rowId],
            );
          } catch (rollbackError) {
            console.error(`Backfill cleanup failed for ${config.trackingTable}.${config.trackingIdColumn}=${rowId}`, rollbackError);
          }
        }
      }

      const lastRow: Row | undefined = rows[rows.length - 1];
      const lastIdRaw = lastRow?.[config.sourceIdColumn];
      cursor = typeof lastIdRaw === "string" ? lastIdRaw : String(lastIdRaw ?? "");

      if (!cursor) {
        break;
      }
    }

    return summary;
  }
}

export const backfillProvider = new BackfillProvider();
