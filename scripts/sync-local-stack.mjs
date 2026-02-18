import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, "package.json");
const SERVICES_LOCAL_PATH = path.join(ROOT_DIR, "services.local.json");
const DOCKER_COMPOSE_PATH = path.join(ROOT_DIR, "docker-compose.yml");

const INFRA_SERVICES = new Set(["api-gateway", "event-bus"]);
const IGNORED_ROOT_DIRS = new Set(["node_modules", "scripts", "_templates", ".git", ".vscode"]);

const FIXED_SERVICE_ENV = {
  "api-gateway": { portKey: "API_GATEWAY_PORT" },
  "event-bus": { portKey: "EVENT_BUS_PORT", databaseKey: "EVENT_BUS_DATABASE_URL" },
  catalog: { portKey: "CATALOG_PORT", databaseKey: "CATALOG_DATABASE_URL" },
  "purchase-orders": {
    portKey: "PURCHASE_ORDERS_PORT",
    databaseKey: "PURCHASE_ORDERS_DATABASE_URL",
  },
};

const ROUTING_TARGETS = [
  { serviceName: "catalog", envKey: "SERVICE_CATALOG_URL", defaultUrl: "http://catalog:8002" },
  {
    serviceName: "purchase-orders",
    envKey: "SERVICE_PURCHASE_ORDERS_URL",
    defaultUrl: "http://purchase-orders:8003",
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const parsed = {};
  const contents = fs.readFileSync(filePath, "utf8");
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

  return parsed;
}

function defaultPort(serviceName) {
  if (serviceName === "api-gateway") return 8000;
  if (serviceName === "event-bus") return 8001;
  if (serviceName === "catalog") return 8002;
  if (serviceName === "purchase-orders") return 8003;
  return 3000;
}

function readServicePort(serviceName, rootLocalEnv) {
  const knownConfig = FIXED_SERVICE_ENV[serviceName];
  if (knownConfig?.portKey) {
    const knownPort = Number(rootLocalEnv[knownConfig.portKey] ?? "");
    if (!Number.isNaN(knownPort) && knownPort > 0) {
      return knownPort;
    }
  }

  const envPath = path.join(ROOT_DIR, serviceName, ".env");
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, "utf8");
    const match = envFile.match(/^PORT\s*=\s*(\d+)\s*$/m);
    if (match) {
      return Number(match[1]);
    }
  }

  return defaultPort(serviceName);
}

function readServiceCommand(serviceName) {
  const packagePath = path.join(ROOT_DIR, serviceName, "package.json");
  const packageJson = readJson(packagePath);
  const scripts = packageJson?.scripts ?? {};

  if (typeof scripts.dev === "string") return "npm run dev";
  if (typeof scripts["start:dev"] === "string") return "npm run start:dev";
  if (typeof scripts.start === "string") return "npm run start";

  throw new Error(
    `Service '${serviceName}' has no runnable script. Add one of: dev, start:dev, start in ${serviceName}/package.json`,
  );
}

function listServiceDirectories() {
  const entries = fs.readdirSync(ROOT_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith("."))
    .filter((name) => !IGNORED_ROOT_DIRS.has(name))
    .filter((name) => fs.existsSync(path.join(ROOT_DIR, name, "package.json")))
    .sort();
}

function resolveServiceNames(workspaces) {
  const names = new Set();

  for (const workspace of workspaces) {
    if (fs.existsSync(path.join(ROOT_DIR, workspace, "package.json"))) {
      names.add(workspace);
    }
  }

  for (const discovered of listServiceDirectories()) {
    names.add(discovered);
  }

  return [...names];
}

function buildServiceList(serviceNames, rootLocalEnv) {
  return serviceNames.map((name) => {
    const port = readServicePort(name, rootLocalEnv);
    const type = INFRA_SERVICES.has(name) ? "infra" : "registered";

    return {
      name,
      type,
      port,
      command: readServiceCommand(name),
      localUrl: `http://${name}:${port}`,
    };
  });
}

function writeServicesLocalFile(services) {
  const payload = {
    services: services.map(({ name, type, port, localUrl }) => ({
      name,
      type,
      port,
      localUrl,
    })),
    registeredServices: services
      .filter((service) => service.type === "registered")
      .map(({ name, port, localUrl }) => ({ name, port, localUrl })),
  };

  fs.writeFileSync(SERVICES_LOCAL_PATH, `${JSON.stringify(payload, null, 2)}\n`);
}

function getDatabaseEnvValue(serviceName) {
  const config = FIXED_SERVICE_ENV[serviceName];
  if (config?.databaseKey) {
    return `\${${config.databaseKey}}`;
  }

  return "${DATABASE_URL}";
}

function getPortEnvValue(serviceName, detectedPort) {
  const config = FIXED_SERVICE_ENV[serviceName];
  if (config?.portKey) {
    return `\${${config.portKey}:-${detectedPort}}`;
  }

  return String(detectedPort);
}

function makeEnvironmentLines(service) {
  const lines = [
    "      NODE_ENV: development",
    `      PORT: ${getPortEnvValue(service.name, service.port)}`,
    "      INTERNAL_SERVICE_KEY: ${INTERNAL_SERVICE_KEY:-refinery-local-key}",
  ];

  if (service.name !== "api-gateway") {
    lines.push(`      DATABASE_URL: ${getDatabaseEnvValue(service.name)}`);
  }

  if (service.type === "registered") {
    lines.push("      EVENT_BUS_URL: ${SERVICE_EVENT_BUS_URL:-http://event-bus:8001}");
  }

  if (service.name === "api-gateway" || service.name === "event-bus") {
    for (const target of ROUTING_TARGETS) {
      lines.push(`      ${target.envKey}: \${${target.envKey}:-${target.defaultUrl}}`);
    }
  }

  return lines;
}

function makeServiceComposeBlock(service, allServices) {
  const lines = [
    `  ${service.name}:`,
    "    build:",
    `      context: ./${service.name}`,
    "      dockerfile: Dockerfile",
    "      target: dev",
    "    env_file:",
    "      - ./.env.local",
    "    environment:",
    ...makeEnvironmentLines(service),
    `    command: ${service.command}`,
  ];

  if (service.name === "api-gateway") {
    lines.push("    ports:", `      - "${getPortEnvValue(service.name, service.port)}:${getPortEnvValue(service.name, service.port)}"`);
  }

  lines.push("    volumes:");
  lines.push(`      - ./${service.name}:/app`);
  lines.push("      - /app/node_modules");

  const dependsOn = [];
  if (service.type === "registered") {
    dependsOn.push("event-bus");
  }
  if (service.name === "api-gateway") {
    for (const dependency of allServices) {
      if (dependency.name !== "api-gateway") {
        dependsOn.push(dependency.name);
      }
    }
  }

  if (dependsOn.length > 0) {
    lines.push("    depends_on:");
    for (const dependency of [...new Set(dependsOn)]) {
      lines.push(`      - ${dependency}`);
    }
  }

  return lines.join("\n");
}

function writeDockerCompose(services) {
  const sections = services.map((service) => makeServiceComposeBlock(service, services));
  fs.writeFileSync(DOCKER_COMPOSE_PATH, `services:\n\n${sections.join("\n\n")}\n`);
}

function main() {
  const rootLocalEnv = parseEnvFile(path.join(ROOT_DIR, ".env.local"));
  const packageJson = readJson(PACKAGE_JSON_PATH);
  const workspaces = Array.isArray(packageJson.workspaces) ? packageJson.workspaces : [];

  const serviceNames = resolveServiceNames(workspaces);
  if (serviceNames.length === 0) {
    throw new Error("No service directories found.");
  }

  const services = buildServiceList(serviceNames, rootLocalEnv);
  writeServicesLocalFile(services);
  writeDockerCompose(services);

  console.log("Updated services.local.json and docker-compose.yml from .env.local");
}

main();
