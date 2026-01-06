import express from "express";
import { db } from "../config/db.js";
const router = express.Router();

router.post("/", async (req, res) => {
  const { eventId, name, comboSize, price } = req.body;
  await db.query(
    "INSERT INTO offers (event_id,name,combo_size,price) VALUES (?,?,?,?)",
    [eventId, name, comboSize, price]
  );
  res.sendStatus(201);
});

router.get("/:eventId", async (req, res) => {
  const [rows] = await db.query("SELECT * FROM offers WHERE event_id=?", [req.params.eventId]);
  res.json(rows);
});

export default router;
