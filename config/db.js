import mysql from "mysql2/promise";
import { URL } from "url";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const url = new URL(process.env.DATABASE_URL);

export const pool = mysql.createPool({
  host: url.hostname,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1), // 🔥 "railway"
  port: Number(url.port),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 30000,
});

// 🔥 TEMPORARY BACKWARD COMPATIBILITY
export const db = pool;
