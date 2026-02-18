import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, "package.json");
const SERVICES_LOCAL_PATH = path.join(ROOT_DIR, "services.local.json");
const DOCKER_COMPOSE_LOCAL_PATH = path.join(ROOT_DIR, "docker-compose.yml");
const DOCKER_COMPOSE_PROD_PATH = path.join(ROOT_DIR, "docker-compose.prod.yml");
const ROOT_LOCAL_ENV_PATH = path.join(ROOT_DIR, ".env.local");
const ROOT_PROD_ENV_PATH = path.join(ROOT_DIR, ".env.production");
const INFRA_SERVICES = new Set(["api-gateway", "event-bus"]);
const IGNORED_ROOT_DIRS = new Set(["node_modules", "scripts", "_templates", ".git", ".vscode"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
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
    env[key] = value;
  }

  return env;
}

function toEnvPrefix(serviceName) {
  return serviceName.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

function defaultPort(serviceName) {
  if (serviceName === "api-gateway") return 8000;
  if (serviceName === "event-bus") return 8001;
  if (serviceName === "catalog") return 8002;
  if (serviceName === "purchase-orders") return 8003;
  return 3000;
}

function readServicePort(serviceName, rootLocalEnv) {
  const prefixedKey = `${toEnvPrefix(serviceName)}_PORT`;
  const fromRoot = Number(rootLocalEnv[prefixedKey] || "");
  if (!Number.isNaN(fromRoot) && fromRoot > 0) {
    return fromRoot;
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

function readServiceCommand(serviceName, mode) {
  const packagePath = path.join(ROOT_DIR, serviceName, "package.json");
  const packageJson = readJson(packagePath);
  const scripts = packageJson?.scripts ?? {};

  if (mode === "local") {
    if (typeof scripts.dev === "string") return "npm run dev";
    if (typeof scripts["start:dev"] === "string") return "npm run start:dev";
    if (typeof scripts.start === "string") return "npm run start";
  } else {
    if (typeof scripts["start:prod"] === "string") return "npm run start:prod";
    if (typeof scripts.start === "string") return "npm run start";
  }

  throw new Error(
    `Service '${serviceName}' has no runnable script for mode '${mode}'.`,
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
      localUrl: `http://${name}:${port}`,
      localCommand: readServiceCommand(name, "local"),
      prodCommand: readServiceCommand(name, "prod"),
    };
  });
}

function writeServicesLocalFile(services) {
  const normalizedServices = services.map(({ name, type, port, localUrl }) => ({
    name,
    type,
    port,
    localUrl,
  }));

  const payload = {
    services: normalizedServices,
    registeredServices: normalizedServices
      .filter((service) => service.type === "registered")
      .map(({ name, port, localUrl }) => ({ name, port, localUrl })),
  };

  fs.writeFileSync(SERVICES_LOCAL_PATH, `${JSON.stringify(payload, null, 2)}\n`);
}

function serviceUrlEnvName(serviceName) {
  return `SERVICE_${toEnvPrefix(serviceName)}_URL`;
}

function makeEnvironmentLines(service, allServices, mode, eventBusPort) {
  const servicePrefix = toEnvPrefix(service.name);
  const servicePortKey = `${servicePrefix}_PORT`;
  const serviceDbKey = `${servicePrefix}_DATABASE_URL`;
  const defaultEventBusUrl = `http://event-bus:${eventBusPort}`;

  const envLines = [
    `      NODE_ENV: ${mode === "local" ? "development" : "production"}`,
    `      PORT: \${${servicePortKey}:-${service.port}}`,
    "      INTERNAL_SERVICE_KEY: ${GLOBAL_INTERNAL_SERVICE_KEY:-refinery-local-key}",
  ];

  if (service.name !== "api-gateway") {
    envLines.push(`      DATABASE_URL: \${${serviceDbKey}}`);
  }

  if (service.type === "registered") {
    envLines.push(
      `      EVENT_BUS_URL: \${SERVICE_EVENT_BUS_URL:-${defaultEventBusUrl}}`,
    );
  }

  if (service.name === "api-gateway" || service.name === "event-bus") {
    for (const registered of allServices.filter((item) => item.type === "registered")) {
      const envName = serviceUrlEnvName(registered.name);
      const localDefault = `http://${registered.name}:${registered.port}`;
      const envValue =
        mode === "local" ? `\${${envName}:-${localDefault}}` : `\${${envName}}`;
      envLines.push(`      ${envName}: ${envValue}`);
    }
  }

  if (mode === "local" && (service.name === "api-gateway" || service.name === "event-bus")) {
    envLines.push("      LOCAL_SERVICES_FILE: /app/services.local.json");
  }

  return envLines;
}

function makeServiceComposeBlock(service, allServices, mode, eventBusPort) {
  const servicePrefix = toEnvPrefix(service.name);
  const servicePortKey = `${servicePrefix}_PORT`;
  const envFilePath = mode === "local" ? "./.env.local" : "./.env.production";
  const command = mode === "local" ? service.localCommand : service.prodCommand;
  const target = mode === "local" ? "dev" : "prod";

  const lines = [
    `  ${service.name}:`,
    "    build:",
    `      context: ./${service.name}`,
    "      dockerfile: Dockerfile",
    `      target: ${target}`,
    "    env_file:",
    `      - ${envFilePath}`,
    "    environment:",
    ...makeEnvironmentLines(service, allServices, mode, eventBusPort),
    `    command: ${command}`,
  ];

  if (service.name === "api-gateway") {
    lines.push("    ports:");
    lines.push(
      `      - "\${${servicePortKey}:-${service.port}}:\${${servicePortKey}:-${service.port}}"`,
    );
  }

  if (mode === "local") {
    lines.push("    volumes:");
    lines.push(`      - ./${service.name}:/app`);
    lines.push("      - /app/node_modules");
    if (service.name === "api-gateway" || service.name === "event-bus") {
      lines.push("      - ./services.local.json:/app/services.local.json:ro");
    }
  }

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

function writeDockerCompose(services, mode) {
  const eventBus = services.find((service) => service.name === "event-bus");
  const eventBusPort = eventBus ? eventBus.port : 8001;
  const sections = services.map((service) =>
    makeServiceComposeBlock(service, services, mode, eventBusPort),
  );
  const contents = ["services:", ...sections].join("\n\n");
  const outputPath = mode === "local" ? DOCKER_COMPOSE_LOCAL_PATH : DOCKER_COMPOSE_PROD_PATH;
  fs.writeFileSync(outputPath, `${contents}\n`);
}

function main() {
  const rootLocalEnv = parseEnvFile(ROOT_LOCAL_ENV_PATH);
  parseEnvFile(ROOT_PROD_ENV_PATH);

  const packageJson = readJson(PACKAGE_JSON_PATH);
  const workspaces = Array.isArray(packageJson.workspaces)
    ? packageJson.workspaces
    : [];
  const serviceNames = resolveServiceNames(workspaces);
  if (serviceNames.length === 0) {
    throw new Error("No service directories found.");
  }

  const services = buildServiceList(serviceNames, rootLocalEnv);
  writeServicesLocalFile(services);
  writeDockerCompose(services, "local");
  writeDockerCompose(services, "prod");

  console.log(
    "Updated services.local.json, docker-compose.yml (.env.local), and docker-compose.prod.yml (.env.production)",
  );
}

main();
