import express from "express";
import { db } from "../config/db.js";
const router = express.Router();

router.post("/", async (req, res) => {
  await db.query("INSERT INTO candies (name,mrp) VALUES (?,?)", [req.body.name, req.body.mrp]);
  res.sendStatus(201);
});

router.get("/", async (_, res) => {
  const [rows] = await db.query("SELECT * FROM candies");
  res.json(rows);
});

export default router;
