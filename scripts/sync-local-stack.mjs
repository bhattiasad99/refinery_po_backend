import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, "package.json");
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

function toEnvPrefix(serviceName) {
  return serviceName.toUpperCase().replace(/-/g, "_");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function defaultPort(serviceName) {
  if (serviceName === "api-gateway") return 8000;
  if (serviceName === "event-bus") return 8001;
  if (serviceName === "catalog") return 8002;
  if (serviceName === "purchase-orders") return 8003;
  return 3000;
}

function readServicePort(serviceName) {
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

function buildServiceList(serviceNames) {
  return serviceNames.map((name) => {
    const port = readServicePort(name);
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

function getDatabaseEnvValue(serviceName) {
  const config = FIXED_SERVICE_ENV[serviceName];
  if (config?.databaseKey) {
    return `\${${config.databaseKey}}`;
  }

  return `\${${toEnvPrefix(serviceName)}_DATABASE_URL}`;
}

function getPortEnvValue(serviceName, detectedPort) {
  const config = FIXED_SERVICE_ENV[serviceName];
  if (config?.portKey) {
    return `\${${config.portKey}}`;
  }

  return `\${${toEnvPrefix(serviceName)}_PORT}`;
}

function getPortEnvName(serviceName) {
  return FIXED_SERVICE_ENV[serviceName]?.portKey ?? `${toEnvPrefix(serviceName)}_PORT`;
}

function getDatabaseEnvName(serviceName) {
  return FIXED_SERVICE_ENV[serviceName]?.databaseKey ?? `${toEnvPrefix(serviceName)}_DATABASE_URL`;
}

function getServiceLocalUrl(allServices, serviceName, fallbackUrl) {
  const target = allServices.find((entry) => entry.name === serviceName);
  return target?.localUrl ?? fallbackUrl;
}

function makeEnvironmentLines(service, allServices) {
  const lines = [
    "      NODE_ENV: development",
    `      ${getPortEnvName(service.name)}: ${getPortEnvValue(service.name, service.port)}`,
    "      INTERNAL_SERVICE_KEY: ${INTERNAL_SERVICE_KEY}",
  ];

  if (service.name !== "api-gateway") {
    lines.push(`      ${getDatabaseEnvName(service.name)}: ${getDatabaseEnvValue(service.name)}`);
  }

  if (service.type === "registered") {
    lines.push(`      SERVICE_EVENT_BUS_URL: ${getServiceLocalUrl(allServices, "event-bus", "http://event-bus:8001")}`);
  }

  if (service.name === "api-gateway") {
    lines.push(`      SERVICE_CATALOG_URL: ${getServiceLocalUrl(allServices, "catalog", "http://catalog:8002")}`);
    lines.push(
      `      SERVICE_PURCHASE_ORDERS_URL: ${getServiceLocalUrl(allServices, "purchase-orders", "http://purchase-orders:8003")}`,
    );
    lines.push(`      SERVICE_EVENT_BUS_URL: ${getServiceLocalUrl(allServices, "event-bus", "http://event-bus:8001")}`);
  }

  if (service.name === "event-bus") {
    lines.push(`      SERVICE_CATALOG_URL: ${getServiceLocalUrl(allServices, "catalog", "http://catalog:8002")}`);
    lines.push(
      `      SERVICE_PURCHASE_ORDERS_URL: ${getServiceLocalUrl(allServices, "purchase-orders", "http://purchase-orders:8003")}`,
    );
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
    ...makeEnvironmentLines(service, allServices),
    `    command: ${service.command}`,
    "    healthcheck:",
    "      test:",
    "        - CMD",
    "        - node",
    "        - -e",
    `        - "fetch('http://127.0.0.1:' + (process.env.${getPortEnvName(service.name)} || 3000) + '/health').then((r) => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1));"`,
    "      interval: 5s",
    "      timeout: 3s",
    "      retries: 20",
    "      start_period: 10s",
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
      lines.push(`      ${dependency}:`);
      lines.push("        condition: service_healthy");
    }
  }

  return lines.join("\n");
}

function writeDockerCompose(services) {
  const sections = services.map((service) => makeServiceComposeBlock(service, services));
  fs.writeFileSync(DOCKER_COMPOSE_PATH, `services:\n\n${sections.join("\n\n")}\n`);
}

function main() {
  const packageJson = readJson(PACKAGE_JSON_PATH);
  const workspaces = Array.isArray(packageJson.workspaces) ? packageJson.workspaces : [];

  const serviceNames = resolveServiceNames(workspaces);
  if (serviceNames.length === 0) {
    throw new Error("No service directories found.");
  }

  const services = buildServiceList(serviceNames);
  writeDockerCompose(services);

  console.log("Updated docker-compose.yml");
}

main();
