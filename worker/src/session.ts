import { DurableObject } from "cloudflare:workers";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface UserProfile {
  [key: string]: string | undefined;
}

interface Env {
  AI: Ai;
}

export class UserSession extends DurableObject<Env> {
  private initialized = false;

  private async ensureSchema(): Promise<void> {
    if (this.initialized) return;
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS profile (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    this.initialized = true;
  }

  async getHistory(limit = 20): Promise<ChatMessage[]> {
    await this.ensureSchema();
    const rows = this.ctx.storage.sql
      .exec<{ role: string; content: string }>(
        `SELECT role, content FROM messages ORDER BY id DESC LIMIT ?`,
        limit,
      )
      .toArray();
    return rows.reverse().map((r) => ({
      role: r.role as ChatMessage["role"],
      content: r.content,
    }));
  }

  async addMessage(message: ChatMessage): Promise<void> {
    await this.ensureSchema();
    this.ctx.storage.sql.exec(
      `INSERT INTO messages (role, content) VALUES (?, ?)`,
      message.role,
      message.content,
    );
  }

  async getProfile(): Promise<UserProfile> {
    await this.ensureSchema();
    const rows = this.ctx.storage.sql
      .exec<{ key: string; value: string }>(`SELECT key, value FROM profile`)
      .toArray();
    const profile: UserProfile = {};
    for (const row of rows) {
      profile[row.key] = row.value;
    }
    return profile;
  }

  async setProfileKey(key: string, value: string): Promise<void> {
    await this.ensureSchema();
    this.ctx.storage.sql.exec(
      `INSERT INTO profile (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      value,
    );
  }

  async clearHistory(): Promise<void> {
    await this.ensureSchema();
    this.ctx.storage.sql.exec(`DELETE FROM messages`);
  }

  async clearAll(): Promise<void> {
    await this.ensureSchema();
    this.ctx.storage.sql.exec(`DELETE FROM messages`);
    this.ctx.storage.sql.exec(`DELETE FROM profile`);
  }
}
