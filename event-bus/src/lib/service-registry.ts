import fs from "node:fs";
import path from "node:path";

export type RegisteredService = {
  name: string;
  url: string;
};

function normalizeServiceNameFromEnvKey(key: string): string {
  const value = key.replace(/^SERVICE_/, "").replace(/_URL$/, "");
  return value.toLowerCase().replace(/_/g, "-");
}

function readEnvServices(): RegisteredService[] {
  const services: RegisteredService[] = [];

  for (const [key, rawValue] of Object.entries(process.env)) {
    if (!key.startsWith("SERVICE_") || !key.endsWith("_URL")) {
      continue;
    }

    const url = rawValue?.trim();
    if (!url) {
      continue;
    }

    const name = normalizeServiceNameFromEnvKey(key);
    services.push({ name, url });
  }

  return services;
}

function readLocalServices(): RegisteredService[] {
  const filePath = process.env.LOCAL_SERVICES_FILE ?? path.join(process.cwd(), "services.local.json");
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as { services?: Array<{ name?: string; localUrl?: string }> };
    if (!Array.isArray(parsed.services)) {
      return [];
    }

    return parsed.services
      .filter((service) => typeof service.name === "string" && typeof service.localUrl === "string")
      .map((service) => ({
        name: service.name!.trim(),
        url: service.localUrl!.trim(),
      }))
      .filter((service) => service.name.length > 0 && service.url.length > 0);
  } catch {
    return [];
  }
}

export function getRegisteredServices(): RegisteredService[] {
  const all = [...readEnvServices(), ...readLocalServices()];
  const map = new Map<string, RegisteredService>();

  for (const service of all) {
    if (service.name === "event-bus") {
      continue;
    }

    map.set(service.name, service);
  }

  return [...map.values()];
}
