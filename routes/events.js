import express from "express";
import { db } from "../config/db.js";
const router = express.Router();

router.post("/", async (req, res) => {
  await db.query("UPDATE events SET status='INACTIVE'");
  const [r] = await db.query(
    "INSERT INTO events (name,status) VALUES (?, 'ACTIVE')",
    [req.body.name]
  );
  res.json({ id: r.insertId });
});

router.get("/active", async (_, res) => {
  const [rows] = await db.query("SELECT * FROM events WHERE status='ACTIVE' LIMIT 1");
  res.json(rows[0]);
});

export default router;
