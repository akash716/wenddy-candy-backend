import express from "express";
import { db } from "../../config/db.js";

const router = express.Router();

/**
 * ✅ SELL = FULL CHECKOUT
 * POST /api/salesman/:stallId/sell
 *
 * This is the ONLY billing endpoint
 */
router.post("/:stallId/sell", async (req, res) => {
  const { stallId } = req.params;
  const { event_id, bill, lines } = req.body;

  // 🔒 Validate payload
  if (!bill || !Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: "Cart is empty" });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    /* 1️⃣ CREATE SALE (BILL HEADER) */
    const [saleRes] = await conn.query(
      `INSERT INTO sales (stall_id, event_id, total)
       VALUES (?,?,?)`,
      [stallId, event_id || null, bill.total]
    );

    const saleId = saleRes.insertId;

    /* 2️⃣ PROCESS CART LINES */
    for (const line of lines) {

      // 🔴 CRITICAL RULE
      // Combo price MUST be 0 at item level
      const saleItemPrice =
        line.type === "COMBO" ? 0 : line.price;

      const [itemRes] = await conn.query(
        `INSERT INTO sale_items (sale_id, type, offer_id, price)
         VALUES (?,?,?,?)`,
        [saleId, line.type, line.offer_id || null, saleItemPrice]
      );

      const saleItemId = itemRes.insertId;

      /* 3️⃣ INVENTORY + FLAVOURS */
      for (const it of line.items) {
        const [[row]] = await conn.query(
          `SELECT stock
           FROM stall_candy_inventory
           WHERE stall_id=? AND candy_id=?
           FOR UPDATE`,
          [stallId, it.candy_id]
        );

        if (!row || row.stock < it.qty) {
          throw new Error("Out of stock");
        }

        await conn.query(
          `UPDATE stall_candy_inventory
           SET stock = stock - ?
           WHERE stall_id=? AND candy_id=?`,
          [it.qty, stallId, it.candy_id]
        );

        await conn.query(
          `INSERT INTO sale_item_flavours
           (sale_item_id, candy_id, qty)
           VALUES (?,?,?)`,
          [saleItemId, it.candy_id, it.qty]
        );
      }
    }

    await conn.commit();
    conn.release();

    res.json({ success: true, sale_id: saleId });

  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error("SELL CHECKOUT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
