import express from "express";
import { db } from "../../config/db.js";

const router = express.Router();

/* ---------------------------------------------------
   STALL → CANDIES (SPECIFIC ROUTES FIRST)
--------------------------------------------------- */

/**
 * GET all candies + assigned candies for a stall
 */
router.get("/:stallId/candies", async (req, res) => {
  try {
    const { stallId } = req.params;

    const [allCandies] = await db.query(
      "SELECT id, name, price FROM candies ORDER BY name"
    );

    const [assigned] = await db.query(
      "SELECT candy_id FROM stall_candies WHERE stall_id = ?",
      [stallId]
    );

    res.json({
      allCandies,
      assignedCandyIds: assigned.map(a => a.candy_id),
    });
  } catch (err) {
    console.error("STALL CANDIES GET ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * ASSIGN candies to stall
 * 🔥 ALSO AUTO-CREATE INVENTORY ROWS
 */
router.post("/:stallId/candies", async (req, res) => {
  try {
    const { stallId } = req.params;
    const { candyIds } = req.body;

    if (!Array.isArray(candyIds)) {
      return res.status(400).json({ error: "candyIds must be an array" });
    }

    // 1️⃣ Remove old mappings
    await db.query(
      "DELETE FROM stall_candies WHERE stall_id = ?",
      [stallId]
    );

    // 2️⃣ Insert new mappings + inventory rows
    for (const candyId of candyIds) {
      // mapping
      await db.query(
        "INSERT INTO stall_candies (stall_id, candy_id) VALUES (?, ?)",
        [stallId, candyId]
      );

      // 🔥 inventory row (auto-create if missing)
      await db.query(`
        INSERT INTO stall_candy_inventory (stall_id, candy_id, stock)
        VALUES (?, ?, 0)
        ON DUPLICATE KEY UPDATE stock = stock
      `, [stallId, candyId]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("STALL CANDIES SAVE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ---------------------------------------------------
   GENERIC STALL ROUTES (LAST)
--------------------------------------------------- */

/**
 * GET all stalls
 */
router.get("/", async (req, res) => {
  const [rows] = await db.query(
    `
    SELECT *
    FROM stalls
    WHERE is_deleted = 0
    ORDER BY created_at DESC
    `
  );

  res.json(rows);
});



/**
 * CREATE stall
 */
router.post("/", async (req, res) => {
  try {
    const { name, company, location } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Stall name required" });
    }

    await db.query(
      "INSERT INTO stalls (name, company, location) VALUES (?,?,?)",
      [name, company, location]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("STALL CREATE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * ACTIVATE / DEACTIVATE stall
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    await db.query(
      "UPDATE stalls SET is_active = ? WHERE id = ?",
      [is_active, id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("STALL UPDATE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * ARCHIVE (soft delete) stall
 */
router.put("/:id/archive", async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(
      `
      UPDATE stalls
      SET is_deleted = 1, is_active = 0
      WHERE id = ?
      `,
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("ARCHIVE STALL ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});


export default router;
