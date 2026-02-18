import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const mode = process.argv[2];
const command = process.argv.slice(3).join(" ");

if (!mode || !command) {
  console.error("Usage: node ../scripts/run-with-root-env.mjs <local|production> <command>");
  process.exit(1);
}

const envFileName = mode === "production" ? ".env.production" : ".env.local";
const envFilePath = path.resolve(process.cwd(), "..", envFileName);

if (!fs.existsSync(envFilePath)) {
  console.error(`Missing ${envFileName} at ${envFilePath}`);
  process.exit(1);
}

const parsed = {};
const contents = fs.readFileSync(envFilePath, "utf8");
for (const rawLine of contents.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) {
    continue;
  }

  const equalIndex = line.indexOf("=");
  if (equalIndex === -1) {
    continue;
  }

  const key = line.slice(0, equalIndex).trim();
  const value = line.slice(equalIndex + 1).trim().replace(/^['"]|['"]$/g, "");
  parsed[key] = value;
}

const serviceName = path.basename(process.cwd());
const SERVICE_ENV_KEYS = {
  "api-gateway": {
    port: "API_GATEWAY_PORT",
    database: "API_GATEWAY_DATABASE_URL",
  },
  "event-bus": {
    port: "EVENT_BUS_PORT",
    database: "EVENT_BUS_DATABASE_URL",
  },
  catalog: {
    port: "CATALOG_PORT",
    database: "CATALOG_DATABASE_URL",
  },
  "purchase-orders": {
    port: "PURCHASE_ORDERS_PORT",
    database: "PURCHASE_ORDERS_DATABASE_URL",
  },
};

const keys = SERVICE_ENV_KEYS[serviceName];
const servicePort = keys?.port ? parsed[keys.port] : undefined;
if (servicePort) {
  parsed.PORT = servicePort;
}

const serviceDatabaseUrl = keys?.database ? parsed[keys.database] : undefined;
if (serviceDatabaseUrl) {
  parsed.DATABASE_URL = serviceDatabaseUrl;
}

if (serviceName !== "event-bus" && parsed.SERVICE_EVENT_BUS_URL) {
  parsed.EVENT_BUS_URL = parsed.SERVICE_EVENT_BUS_URL;
}

const child = spawn(command, {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    ...parsed,
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
