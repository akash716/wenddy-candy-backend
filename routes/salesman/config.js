import express from "express";
import { db } from "../../config/db.js";

const router = express.Router();

/**
 * GET /api/salesman/config/:stallId
 *
 * Provides:
 *  - Stall info
 *  - Active event (optional)
 *  - ALL candies (SingleGrid)
 *  - COMBO OFFER RULES with allowed candies (ComboGrid)
 */
router.get("/:stallId", async (req, res) => {
  const { stallId } = req.params;

  try {
    /* =========================
       1️⃣ STALL
    ========================= */
    const [[stall]] = await db.query(
      `
      SELECT *
      FROM stalls
      WHERE id = ?
        AND is_active = 1
        AND is_deleted = 0
      `,
      [stallId]
    );

    if (!stall) {
      return res.status(404).json({ error: "Stall not found" });
    }

    /* =========================
       2️⃣ ACTIVE EVENT (OPTIONAL)
    ========================= */
    const [[event]] = await db.query(
      `
      SELECT *
      FROM events
      WHERE CURDATE() BETWEEN start_date AND end_date
      LIMIT 1
      `
    );

    /* =========================
       3️⃣ ALL CANDIES (SINGLE TAB)
    ========================= */
    const [candies] = await db.query(
      `
      SELECT
        c.id,
        c.code,
        c.name,
        c.price,
        IFNULL(i.stock, 0) AS stock
      FROM stall_candies sc
      JOIN candies c ON c.id = sc.candy_id
      LEFT JOIN stall_candy_inventory i
        ON i.stall_id = sc.stall_id
        AND i.candy_id = sc.candy_id
      WHERE sc.stall_id = ?
      ORDER BY c.name
      `,
      [stallId]
    );

    /* =========================
       4️⃣ COMBO OFFER RULES (NEW SYSTEM ONLY)
    ========================= */
    const [offers] = await db.query(
      `
      SELECT
        r.id,
        r.unique_count,
        r.offer_price,
        r.price
      FROM combo_offer_rules r
      WHERE r.is_active = 1
      ORDER BY r.id
      `
    );

    /* =========================
       5️⃣ RULE → ALLOWED CANDIES
       ✔ stock = 0 allowed (dim in UI)
    ========================= */
    for (const offer of offers) {
      const [offerCandies] = await db.query(
        `
        SELECT
          c.id,
          c.name,
          c.price,
          IFNULL(i.stock, 0) AS stock
        FROM combo_offer_rule_candies rc
        JOIN candies c ON c.id = rc.candy_id
        LEFT JOIN stall_candy_inventory i
          ON i.candy_id = c.id
         AND i.stall_id = ?
        WHERE rc.rule_id = ?
        ORDER BY c.name
        `,
        [stallId, offer.id]
      );

      offer.candies = offerCandies;
    }

    /* =========================
       6️⃣ FINAL RESPONSE
    ========================= */
    res.json({
      stall,
      event: event || null,
      candies, // SingleGrid
      offers   // ComboGrid (RULE BASED)
    });

  } catch (err) {
    console.error("SALESMAN CONFIG ERROR:", err);
    res.status(500).json({
      error: "Failed to load salesman config"
    });
  }
});

export default router;
