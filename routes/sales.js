import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

router.post("/checkout", async (req, res) => {
  const { bill, lines } = req.body;
  if (!bill || !lines || lines.length === 0) {
    return res.status(400).json({ error: "Cart is empty" });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [saleRes] = await conn.query(
      "INSERT INTO sales (total) VALUES (?)",
      [bill.total]
    );
    const saleId = saleRes.insertId;

    for (const line of lines) {
      const [itemRes] = await conn.query(
        "INSERT INTO sale_items (sale_id, type, price) VALUES (?, ?, ?)",
        [saleId, line.type, line.price]
      );
      const saleItemId = itemRes.insertId;

      for (const f of line.items) {
        const [[candy]] = await conn.query(
          "SELECT id FROM candies WHERE code = ?",
          [f.id]
        );

        const [[inv]] = await conn.query(
          "SELECT stock FROM inventory WHERE candy_id = ? FOR UPDATE",
          [candy.id]
        );

        if (!inv || inv.stock < f.qty) {
          throw new Error("Out of stock");
        }

        await conn.query(
          "UPDATE inventory SET stock = stock - ? WHERE candy_id = ?",
          [f.qty, candy.id]
        );

        await conn.query(
          "INSERT INTO sale_item_flavours (sale_item_id, candy_id, qty) VALUES (?, ?, ?)",
          [saleItemId, candy.id, f.qty]
        );
      }
    }

    await conn.commit();
    res.json({ success: true });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

export default router;
