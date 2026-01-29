import express from "express";
import { db } from "../../config/db.js";

const router = express.Router();

/* =============================== 
   CREATE COMBO OFFER RULE
================================ */
router.post("/", async (req, res) => {
  const {
    unique_count,
    offer_price,
    price,
    price_pattern,
    valid_from,
    valid_to
  } = req.body;

  if (!unique_count || !offer_price) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const isMixed = Array.isArray(price_pattern) && price_pattern.length > 0;

  // SAME PRICE
  if (!isMixed && (price === null || price === undefined)) {
    return res
      .status(400)
      .json({ error: "price required for same-price combo" });
  }

  // MIXED PRICE
  if (isMixed) {
    const totalQty = price_pattern.reduce(
      (s, p) => s + Number(p.qty || 0),
      0
    );

    if (totalQty !== Number(unique_count)) {
      return res.status(400).json({
        error: "price_pattern qty must match unique_count"
      });
    }
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const patternJson = isMixed
      ? JSON.stringify(price_pattern)
      : null;

    /* 🔒 CORRECT DUPLICATE CHECK */
    const [existing] = await conn.query(
      `
      SELECT id
      FROM combo_offer_rules
      WHERE is_active = 1
        AND unique_count = ?
        AND (
          (price IS NOT NULL AND price = ?)
          OR
          (price IS NULL AND price_pattern = ?)
        )
      `,
      [unique_count, price ?? null, patternJson]
    );

    if (existing.length) {
      await conn.rollback();
      return res.status(400).json({
        error: "Similar active rule already exists"
      });
    }

    /* ✅ INSERT */
    await conn.query(
      `
      INSERT INTO combo_offer_rules
      (unique_count, offer_price, price, price_pattern, is_active, valid_from, valid_to)
      VALUES (?, ?, ?, ?, 1, ?, ?)
      `,
      [
        unique_count,
        offer_price,
        isMixed ? null : price,
        isMixed ? patternJson : null,
        valid_from || null,
        valid_to || null
      ]
    );

    await conn.commit();
    res.json({ success: true });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

/* =============================== 
   UPDATE COMBO OFFER RULE
================================ */
router.put("/:id", async (req, res) => {
  const id = req.params.id;
  const {
    unique_count,
    offer_price,
    price,
    price_pattern,
    valid_from,
    valid_to
  } = req.body;

  if (!unique_count || !offer_price) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const isMixed = Array.isArray(price_pattern) && price_pattern.length > 0;

  if (!isMixed && (price === null || price === undefined)) {
    return res
      .status(400)
      .json({ error: "price required for same-price combo" });
  }

  if (isMixed) {
    const totalQty = price_pattern.reduce(
      (s, p) => s + Number(p.qty || 0),
      0
    );

    if (totalQty !== Number(unique_count)) {
      return res.status(400).json({
        error: "price_pattern qty must match unique_count"
      });
    }
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const patternJson = isMixed
      ? JSON.stringify(price_pattern)
      : null;

    /* 🔒 DUPLICATE CHECK (exclude self) */
    const [existing] = await conn.query(
      `
      SELECT id
      FROM combo_offer_rules
      WHERE is_active = 1
        AND unique_count = ?
        AND id != ?
        AND (
          (price IS NOT NULL AND price = ?)
          OR
          (price IS NULL AND price_pattern = ?)
        )
      `,
      [unique_count, id, price ?? null, patternJson]
    );

    if (existing.length) {
      await conn.rollback();
      return res.status(400).json({
        error: "Similar active rule already exists"
      });
    }

    await conn.query(
      `
      UPDATE combo_offer_rules
      SET unique_count = ?, offer_price = ?, price = ?, price_pattern = ?, valid_from = ?, valid_to = ?
      WHERE id = ?
      `,
      [
        unique_count,
        offer_price,
        isMixed ? null : price,
        isMixed ? patternJson : null,
        valid_from || null,
        valid_to || null,
        id
      ]
    );

    await conn.commit();
    res.json({ success: true });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

/* =============================== 
   GET ALL RULES
================================ */
router.get("/", async (_req, res) => {
  const [rules] = await db.query(
    `SELECT * FROM combo_offer_rules ORDER BY created_at DESC`
  );

  for (const r of rules) {
    if (r.price_pattern) {
      try {
        r.price_pattern = JSON.parse(r.price_pattern);
      } catch {
        r.price_pattern = [];
      }
    }
  }

  res.json({ success: true, rules });
});

/* =============================== 
   ACTIVATE / DEACTIVATE
================================ */
router.patch("/:id/status", async (req, res) => {
  const { is_active } = req.body;

  await db.query(
    `UPDATE combo_offer_rules SET is_active = ? WHERE id = ?`,
    [is_active ? 1 : 0, req.params.id]
  );

  res.json({ success: true });
});

/* =============================== 
   DELETE RULE (SAFE)
================================ */
router.delete("/:id", async (req, res) => {
  await db.query(
    `UPDATE combo_offer_rules SET is_active = 0 WHERE id = ?`,
    [req.params.id]
  );

  res.json({ success: true });
});

export default router;
