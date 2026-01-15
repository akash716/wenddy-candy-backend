import express from "express";
import { db } from "../../config/db.js";
import { applyOfferEngine } from "../../services/offerEngine.js";

const router = express.Router();

/**
 * POST /api/salesman/:stallId/sell
 * Single + Combo checkout (offer aware)
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

    // 🔥 APPLY OFFER ENGINE (QTY + COMBO SAFE)
    const {
      lines: finalLines,
      total: finalTotal
    } = await applyOfferEngine({ lines });

    if (isNaN(finalTotal)) {
      throw new Error("Final total calculation failed");
    }

    // 1️⃣ CREATE SALE
    const [saleRes] = await conn.query(
      `
      INSERT INTO sales (stall_id, total)
      VALUES (?, ?)
      `,
      [stallId, Number(finalTotal)]
    );

    const saleId = saleRes.insertId;

    // 2️⃣ PROCESS SALE ITEMS
    for (const line of finalLines) {

      // ✅ DO NOT FORCE COMBO PRICE = 0
      const safePrice = Number(line.price || 0);

      if (isNaN(safePrice)) {
        throw new Error("Invalid item price");
      }

      const [itemRes] = await conn.query(
        `
        INSERT INTO sale_items (sale_id, type, price)
        VALUES (?, ?, ?)
        `,
        [saleId, line.type, safePrice]
      );

      const saleItemId = itemRes.insertId;

      // 3️⃣ INVENTORY + FLAVOURS
      for (const it of line.items) {
        const qty = Number(it.qty || 1);

        // 🔒 LOCK + CHECK STOCK
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

        // UPDATE STOCK
        await conn.query(
          `
          UPDATE stall_candy_inventory
          SET stock = stock - ?
          WHERE stall_id = ? AND candy_id = ?
          `,
          [qty, stallId, it.candy_id]
        );

        // INSERT FLAVOUR
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
      total: Number(finalTotal)
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
