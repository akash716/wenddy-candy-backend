import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

/**
 * GET all inventory
 */
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        c.id,
        c.name,
        c.mrp,
        i.stock
      FROM candies c
      JOIN inventory i ON c.id = i.candy_id
      ORDER BY c.id
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

/**
 * UPDATE stock for a candy
 */
router.put("/:id", async (req, res) => {
  const { stock } = req.body;

  if (stock < 0) {
    return res.status(400).json({ error: "Stock cannot be negative" });
  }

  try {
    await db.query(
      "UPDATE inventory SET stock = ? WHERE candy_id = ?",
      [stock, req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update stock" });
  }
});

export default router;
