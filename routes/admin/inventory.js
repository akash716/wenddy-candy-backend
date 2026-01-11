import express from "express";
import { db } from "../../config/db.js";

const router = express.Router();

/**
 * GET inventory for a stall
 * URL: /api/admin/inventory/:stallId
 */
router.get("/:stallId", async (req, res) => {
  try {
    const { stallId } = req.params;

    const [rows] = await db.query(
      `
      SELECT 
        c.id AS candy_id,
        c.name,
        c.price,
        IFNULL(i.stock, 0) AS stock
      FROM stall_candies sc
      JOIN candies c ON c.id = sc.candy_id
      LEFT JOIN stall_candy_inventory i
        ON i.candy_id = sc.candy_id
        AND i.stall_id = sc.stall_id
      WHERE sc.stall_id = ?
      ORDER BY c.name
      `,
      [stallId]
    );

    res.json(rows);
  } catch (err) {
    console.error("GET INVENTORY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * UPDATE inventory stock (PERSISTENT)
 * URL: /api/admin/inventory/:stallId
 */
router.post("/:stallId", async (req, res) => {
  try {
    const { stallId } = req.params;
    const { candyId, stock } = req.body;

    if (stock < 0) {
      return res.status(400).json({ error: "Stock cannot be negative" });
    }

    // 🔥 UPDATE THE CORRECT TABLE
    await db.query(
      `
      UPDATE stall_candy_inventory
      SET stock = ?
      WHERE stall_id = ? AND candy_id = ?
      `,
      [stock, stallId, candyId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("INVENTORY UPDATE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
