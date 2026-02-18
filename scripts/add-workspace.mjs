import fs from "node:fs";
import path from "node:path";

const serviceName = process.argv[2];

if (!serviceName) {
  console.error("Usage: node scripts/add-workspace.mjs <service-name>");
  process.exit(1);
}

const packageJsonPath = path.resolve("package.json");
const packageJsonRaw = fs.readFileSync(packageJsonPath, "utf8");
const packageJson = JSON.parse(packageJsonRaw);

packageJson.private = true;

if (!Array.isArray(packageJson.workspaces)) {
  packageJson.workspaces = [];
}

if (!packageJson.workspaces.includes(serviceName)) {
  packageJson.workspaces.push(serviceName);
}

fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
