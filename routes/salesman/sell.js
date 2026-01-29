import express from "express";
import { db } from "../../config/db.js";

const router = express.Router();

/**
 * POST /api/salesman/:stallId/sell
 * ✅ FINAL CHECKOUT
 * ✅ FRONTEND IS SOURCE OF TRUTH
 * ✅ COMBO + SINGLE BOTH SUPPORTED
 */
router.post("/:stallId/sell", async (req, res) => {
  const { stallId } = req.params;
  const { lines } = req.body;

  if (!Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: "Cart empty" });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    /* =========================
       1️⃣ FINAL TOTAL (CORRECT)
    ========================= */
    let finalTotal = 0;

    for (const line of lines) {

      // ✅ COMBO
      if (line.type === "COMBO") {
        finalTotal += Number(line.price || 0);
      }

      // ✅ SINGLE ITEM
      if (line.type === "ITEM" && Array.isArray(line.items)) {
        for (const it of line.items) {
          finalTotal +=
            Number(it.price || 0) * Number(it.qty || 1);
        }
      }
    }

    if (isNaN(finalTotal)) {
      throw new Error("Invalid total from frontend");
    }

    /* =========================
       2️⃣ CREATE SALE
    ========================= */
    const [saleRes] = await conn.query(
      `
      INSERT INTO sales (stall_id, total)
      VALUES (?, ?)
      `,
      [stallId, finalTotal]
    );

    const saleId = saleRes.insertId;

    /* =========================
       3️⃣ SALE ITEMS + INVENTORY
    ========================= */
    for (const line of lines) {
      const safePrice = Number(line.price || 0);

      const [itemRes] = await conn.query(
        `
        INSERT INTO sale_items (sale_id, type, price)
        VALUES (?, ?, ?)
        `,
        [saleId, line.type, safePrice]
      );

      const saleItemId = itemRes.insertId;

      for (const it of line.items || []) {
        const qty = Number(it.qty || 1);

        const [[row]] = await conn.query(
          `
          SELECT stock
          FROM stall_candy_inventory
          WHERE stall_id = ? AND candy_id = ?
          FOR UPDATE
          `,
          [stallId, it.candy_id]
        );

        if (!row || row.stock < qty) {
          throw new Error(
            `Out of stock for candy_id ${it.candy_id}`
          );
        }

        await conn.query(
          `
          UPDATE stall_candy_inventory
          SET stock = stock - ?
          WHERE stall_id = ? AND candy_id = ?
          `,
          [qty, stallId, it.candy_id]
        );

        await conn.query(
          `
          INSERT INTO sale_item_flavours
          (sale_item_id, candy_id, qty)
          VALUES (?, ?, ?)
          `,
          [saleItemId, it.candy_id, qty]
        );
      }
    }

    await conn.commit();

    res.json({
      success: true,
      total: finalTotal
    });

  } catch (err) {
    await conn.rollback();
    console.error("SELL ERROR:", err.message);

    res.status(500).json({
      error: err.message || "Checkout failed"
    });

  } finally {
    conn.release();
  }
});

export default router;
