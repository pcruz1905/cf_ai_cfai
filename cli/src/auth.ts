import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

interface Config {
  token: string;
  apiUrl: string;
}

const CONFIG_DIR = join(homedir(), ".cfai");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): Config {
  ensureConfigDir();
  if (existsSync(CONFIG_FILE)) {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as Config;
  }
  const config: Config = {
    token: randomUUID(),
    apiUrl: "http://localhost:8787",
  };
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  return config;
}

export function updateConfig(updates: Partial<Config>): Config {
  const config = { ...loadConfig(), ...updates };
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  return config;
}
