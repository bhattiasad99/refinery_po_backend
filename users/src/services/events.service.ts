import type { IncomingEvent } from "../schemas/incoming-event.schema";
import { parseDepartmentProjectionInput, upsertDepartmentProjection } from "./department-projection.service";

export async function processIncomingEvent(event: IncomingEvent): Promise<void> {
  switch (event.name) {
    case "create_department": {
      const projection = parseDepartmentProjectionInput(event.body);
      if (!projection) {
        return;
      }

      await upsertDepartmentProjection(projection);
      return;
    }

    default: {
      return;
    }
  }
}
