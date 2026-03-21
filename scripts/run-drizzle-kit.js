#!/usr/bin/env node
/**
 * Thin wrapper that runs drizzle-kit with the .env-loaded environment.
 *
 * pnpm run db:generate / db:migrate use Node's --env-file-if-exists
 * to load .env before invoking this script. This script then spawns
 * drizzle-kit with the already-populated process.env.
 */

import { execSync } from "node:child_process";

const args = process.argv.slice(2).join(" ");
execSync(`drizzle-kit ${args}`, { stdio: "inherit", env: process.env });
