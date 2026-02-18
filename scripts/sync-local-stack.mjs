import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, "package.json");
const SERVICES_LOCAL_PATH = path.join(ROOT_DIR, "services.local.json");
const DOCKER_COMPOSE_PATH = path.join(ROOT_DIR, "docker-compose.yml");
const INFRA_SERVICES = new Set(["api-gateway", "event-bus"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readServicePort(serviceName) {
  const envPath = path.join(ROOT_DIR, serviceName, ".env");
  if (!fs.existsSync(envPath)) {
    return 3000;
  }

  const envFile = fs.readFileSync(envPath, "utf8");
  const match = envFile.match(/^PORT\s*=\s*(\d+)\s*$/m);
  return match ? Number(match[1]) : 3000;
}

function buildServiceList(workspaces) {
  return workspaces.map((name) => {
    const port = readServicePort(name);
    const type = INFRA_SERVICES.has(name) ? "infra" : "registered";
    return {
      name,
      type,
      port,
      localUrl: `http://${name}:${port}`,
    };
  });
}

function writeServicesLocalFile(services) {
  const payload = {
    services,
    registeredServices: services
      .filter((service) => service.type === "registered")
      .map(({ name, port, localUrl }) => ({ name, port, localUrl })),
  };

  fs.writeFileSync(SERVICES_LOCAL_PATH, `${JSON.stringify(payload, null, 2)}\n`);
}

function makeServiceComposeBlock(service, allServices, eventBusPort) {
  const volumes = [`      - ./${service.name}:/app`, "      - /app/node_modules"];
  const environment = ["      NODE_ENV: development", `      PORT: ${service.port}`];
  const dependsOn = [];

  if (service.type === "registered") {
    environment.push(`      EVENT_BUS_URL: http://event-bus:${eventBusPort}`);
    dependsOn.push("event-bus");
  }

  if (service.name === "api-gateway" || service.name === "event-bus") {
    environment.push("      LOCAL_SERVICES_FILE: /app/services.local.json");
    volumes.push("      - ./services.local.json:/app/services.local.json:ro");
  }

  if (service.name === "api-gateway") {
    const dependencies = allServices
      .filter((item) => item.name !== "api-gateway")
      .map((item) => item.name);
    dependsOn.push(...dependencies);
  }

  const lines = [
    `  ${service.name}:`,
    "    build:",
    `      context: ./${service.name}`,
    "      dockerfile: Dockerfile",
    "      target: dev",
    `    env_file:`,
    `      - ./${service.name}/.env`,
    "    environment:",
    ...environment,
    "    command: npm run dev",
    "    ports:",
    `      - \"${service.port}:${service.port}\"`,
    "    volumes:",
    ...volumes,
  ];

  if (dependsOn.length > 0) {
    lines.push("    depends_on:");
    for (const dependency of [...new Set(dependsOn)]) {
      lines.push(`      - ${dependency}`);
    }
  }

  return lines.join("\n");
}

function writeDockerCompose(services) {
  const eventBus = services.find((service) => service.name === "event-bus");
  const eventBusPort = eventBus ? eventBus.port : 8001;
  const sections = services.map((service) =>
    makeServiceComposeBlock(service, services, eventBusPort),
  );
  const contents = ["services:", ...sections].join("\n\n");
  fs.writeFileSync(DOCKER_COMPOSE_PATH, `${contents}\n`);
}

function main() {
  const packageJson = readJson(PACKAGE_JSON_PATH);
  const workspaces = Array.isArray(packageJson.workspaces)
    ? packageJson.workspaces
    : [];

  if (workspaces.length === 0) {
    throw new Error("No workspaces found in package.json.");
  }

  const services = buildServiceList(workspaces);
  writeServicesLocalFile(services);
  writeDockerCompose(services);
  console.log("Updated services.local.json and docker-compose.yml");
}

main();
