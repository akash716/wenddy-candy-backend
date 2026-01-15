import express from "express";
import { db } from "../../config/db.js";

const router = express.Router();

/**
 * ===============================
 * CREATE COMBO OFFER RULE
 * POST /api/admin/combo-offer-rules
 * ===============================
 *
 * body:
 * {
 *   unique_count: 3,
 *   offer_price: 180,
 *   candy_ids: [1,2],   // candies involved in offer
 *   valid_from: null,
 *   valid_to: null
 * }
 */
router.post("/", async (req, res) => {
  const { unique_count, offer_price, candy_ids, valid_from, valid_to } = req.body;

  if (
    !unique_count ||
    !offer_price ||
    !Array.isArray(candy_ids) ||
    candy_ids.length < 2
  ) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  if (candy_ids.length < unique_count) {
    return res
      .status(400)
      .json({ error: "Candy count less than unique_count" });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    /* 🔒 Prevent duplicate ACTIVE rule */
    const [existing] = await conn.query(
      `
      SELECT r.id
      FROM combo_offer_rules r
      JOIN combo_offer_rule_candies rc ON rc.rule_id = r.id
      WHERE r.is_active = 1
        AND r.unique_count = ?
      GROUP BY r.id
      HAVING COUNT(rc.candy_id) = ?
    `,
      [unique_count, candy_ids.length]
    );

    if (existing.length) {
      throw new Error("Active rule already exists with same configuration");
    }

    /* 1️⃣ Insert rule */
    const [ruleRes] = await conn.query(
      `
      INSERT INTO combo_offer_rules
      (unique_count, offer_price, is_active, valid_from, valid_to)
      VALUES (?,?,1,?,?)
    `,
      [unique_count, offer_price, valid_from || null, valid_to || null]
    );

    const ruleId = ruleRes.insertId;

    /* 2️⃣ Insert rule candies */
    for (const candyId of candy_ids) {
      await conn.query(
        `
        INSERT INTO combo_offer_rule_candies (rule_id, candy_id)
        VALUES (?,?)
      `,
        [ruleId, candyId]
      );
    }

    await conn.commit();
    conn.release();

    res.json({ success: true, rule_id: ruleId });

  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error("CREATE RULE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});



/**
 * ===============================
 * GET ALL OFFER RULES
 * GET /api/admin/combo-offer-rules
 * ===============================
 */
router.get("/", async (req, res) => {
  try {
    const [rules] = await db.query(`
      SELECT *
      FROM combo_offer_rules
      ORDER BY created_at DESC
    `);

    for (const rule of rules) {
      const [candies] = await db.query(
        `
        SELECT c.id, c.name
        FROM combo_offer_rule_candies rc
        JOIN candies c ON c.id = rc.candy_id
        WHERE rc.rule_id = ?
      `,
        [rule.id]
      );

      rule.candies = candies;
    }

    res.json({ success: true, rules });

  } catch (err) {
    console.error("FETCH RULES ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});


/**
 * ===============================
 * UPDATE OFFER RULE (FULL FIX)
 * PUT /api/admin/combo-offer-rules/:id
 * ===============================
 */
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    offer_price,
    valid_from,
    valid_to,
    candy_ids
  } = req.body;

  if (
    !offer_price ||
    !Array.isArray(candy_ids) ||
    candy_ids.length < 2
  ) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    /* 1️⃣ Update rule main data */
    await conn.query(
      `
      UPDATE combo_offer_rules
      SET offer_price = ?, valid_from = ?, valid_to = ?
      WHERE id = ?
      `,
      [offer_price, valid_from || null, valid_to || null, id]
    );

    /* 2️⃣ Remove old candy mappings */
    await conn.query(
      `DELETE FROM combo_offer_rule_candies WHERE rule_id = ?`,
      [id]
    );

    /* 3️⃣ Insert updated candy mappings */
    for (const candyId of candy_ids) {
      await conn.query(
        `
        INSERT INTO combo_offer_rule_candies (rule_id, candy_id)
        VALUES (?, ?)
        `,
        [id, candyId]
      );
    }

    await conn.commit();
    conn.release();

    res.json({ success: true });

  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error("UPDATE RULE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});


/**
 * ===============================
 * ACTIVATE / DEACTIVATE RULE
 * PATCH /api/admin/combo-offer-rules/:id/status
 * ===============================
 *
 * body: { is_active: true | false }
 */
router.patch("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (typeof is_active !== "boolean") {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    await db.query(
      `
      UPDATE combo_offer_rules
      SET is_active = ?
      WHERE id = ?
    `,
      [is_active ? 1 : 0, id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("STATUS UPDATE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});



/**
 * ===============================
 * DELETE RULE (RARE)
 * DELETE /api/admin/combo-offer-rules/:id
 * ===============================
 */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      `DELETE FROM combo_offer_rule_candies WHERE rule_id = ?`,
      [id]
    );

    await conn.query(
      `DELETE FROM combo_offer_rules WHERE id = ?`,
      [id]
    );

    await conn.commit();
    conn.release();

    res.json({ success: true });

  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error("DELETE RULE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
