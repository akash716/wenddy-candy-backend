import express from "express";
import { db } from "../../config/db.js";

const router = express.Router();

/**
 * GET events
 */
router.get("/", async (req, res) => {
  const [rows] = await db.query("SELECT * FROM events");
  res.json(rows);
});

/**
 * CREATE event
 */
router.post("/", async (req, res) => {
  const { name, start_date, end_date } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Event name required" });
  }

  await db.query(
    "INSERT INTO events (name, start_date, end_date) VALUES (?,?,?)",
    [name, start_date, end_date]
  );

  res.json({ success: true });
});

/**
 * ASSIGN event to stall
 */
router.post("/assign", async (req, res) => {
  const { stall_id, event_id } = req.body;

  // Remove old mapping
  await db.query("DELETE FROM stall_events WHERE stall_id=?", [stall_id]);

  // Assign new
  await db.query(
    "INSERT INTO stall_events (stall_id, event_id) VALUES (?,?)",
    [stall_id, event_id]
  );

  res.json({ success: true });
});

export default router;
