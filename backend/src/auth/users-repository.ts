import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { DEFAULT_RATING } from "../rating/elo.js";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  rating: number;
}

export async function createUser(username: string, passwordHash: string): Promise<User> {
  const id = randomUUID();
  await pool.query("INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)", [id, username, passwordHash]);
  return { id, username, passwordHash, rating: DEFAULT_RATING };
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const result = await pool.query("SELECT id, username, password_hash, rating FROM users WHERE username = $1", [username]);
  const row = result.rows[0];
  if (!row) return null;
  return { id: row.id, username: row.username, passwordHash: row.password_hash, rating: row.rating };
}

export async function getRating(userId: string): Promise<number | null> {
  const result = await pool.query("SELECT rating FROM users WHERE id = $1", [userId]);
  return result.rows[0]?.rating ?? null;
}
