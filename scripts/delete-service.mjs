import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const INFRA_SERVICES = new Set(["api-gateway", "event-bus"]);
const ROOT = process.cwd();
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");

const args = process.argv.slice(2);
const allowInfra = args.includes("--allow-infra");
const serviceName = (() => {
  const positional = args.find((arg) => !arg.startsWith("--"));
  if (positional) return positional;

  const compact = args.find(
    (arg) => arg.startsWith("--") && arg !== "--allow-infra",
  );
  if (!compact) return undefined;

  const normalized = compact.replace(/^--/, "");
  return normalized.length > 0 ? normalized : undefined;
})();

if (!serviceName) {
  console.error("Usage: node scripts/delete-service.mjs <service-name> [--allow-infra]");
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
const workspaces = Array.isArray(packageJson.workspaces) ? packageJson.workspaces : [];

if (INFRA_SERVICES.has(serviceName) && !allowInfra) {
  console.error(
    `Refusing to delete infra service '${serviceName}'. Use del:service-unsafe for infra deletion.`,
  );
  process.exit(1);
}

const serviceDir = path.join(ROOT, serviceName);
if (!fs.existsSync(serviceDir)) {
  console.error(`Service folder not found: ${serviceName}`);
  process.exit(1);
}

if (!workspaces.includes(serviceName)) {
  console.warn(
    `Service '${serviceName}' is not listed in package.json workspaces. Continuing with folder deletion.`,
  );
}

function findReferences(name, ownDirName) {
  const ignoredDirs = new Set([
    "node_modules",
    ".git",
    ".vscode",
    "dist",
    ownDirName,
    "scripts",
    "_templates",
  ]);
  const ignoredFiles = new Set([
    "package.json",
    "package-lock.json",
    "docker-compose.yml",
    "README.md",
    "readme.md",
  ]);
  const results = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) {
          walk(full);
        }
        continue;
      }

      const rel = path.relative(ROOT, full).replace(/\\/g, "/");
      if (ignoredFiles.has(path.basename(rel))) {
        continue;
      }
      try {
        const content = fs.readFileSync(full, "utf8");
        if (content.includes(name)) {
          results.push(rel);
        }
      } catch {
        // skip non-text files
      }
    }
  }

  walk(ROOT);
  return results;
}

const references = findReferences(serviceName, serviceName);
if (references.length > 0) {
  console.error(`Found references to '${serviceName}' in:`);
  for (const ref of references) {
    console.error(`- ${ref}`);
  }
  console.error("Delete aborted. Remove/update these references first.");
  process.exit(1);
}

fs.rmSync(serviceDir, { recursive: true, force: true });
packageJson.workspaces = workspaces.filter((workspace) => workspace !== serviceName);
fs.writeFileSync(PACKAGE_JSON_PATH, `${JSON.stringify(packageJson, null, 2)}\n`);

execSync("node scripts/sync-local-stack.mjs", { stdio: "inherit" });

console.log(`Deleted service '${serviceName}' and synced local stack files.`);
