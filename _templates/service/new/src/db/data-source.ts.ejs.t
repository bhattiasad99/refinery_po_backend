---
to: <%= name %>/src/db/data-source.ts
---
import "reflect-metadata"
import { DataSource } from "typeorm"
import dotenv from "dotenv"
import path from "node:path"

dotenv.config()

const databaseUrl = process.env.<%= name.toUpperCase().replace(/-/g, "_") %>_DATABASE_URL?.trim()

if (!databaseUrl) {
    throw new Error("<%= name.toUpperCase().replace(/-/g, "_") %>_DATABASE_URL is missing in .env")
}

let parsedDatabaseUrl: URL
try {
    parsedDatabaseUrl = new URL(databaseUrl)
} catch {
    throw new Error("<%= name.toUpperCase().replace(/-/g, "_") %>_DATABASE_URL is not a valid URL")
}

if (
    parsedDatabaseUrl.protocol !== "postgresql:" &&
    parsedDatabaseUrl.protocol !== "postgres:"
) {
    throw new Error("<%= name.toUpperCase().replace(/-/g, "_") %>_DATABASE_URL must start with postgres:// or postgresql://")
}

if (
    parsedDatabaseUrl.hostname === "HOST" ||
    parsedDatabaseUrl.username === "USER" ||
    parsedDatabaseUrl.password === "PASSWORD" ||
    parsedDatabaseUrl.pathname === "/DBNAME"
) {
    throw new Error(
        "<%= name.toUpperCase().replace(/-/g, "_") %>_DATABASE_URL contains template placeholders. Replace USER, PASSWORD, HOST, and DBNAME with real PostgreSQL values."
    )
}

const entitiesPath = path.join(__dirname, "..", "entities", "*.{ts,js}")

export const AppDataSource = new DataSource({
    type: "postgres",
    url: databaseUrl,
    ssl: { rejectUnauthorized: false }, // Neon needs SSL
    entities: [entitiesPath],
    migrations: [],
    synchronize: true, // dev only; use migrations for real prod
    logging: false,
})
