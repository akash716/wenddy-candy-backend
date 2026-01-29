import express from "express";
import { db } from "../../config/db.js";

const router = express.Router();

/**
 * GET /api/salesman/config/:stallId
 *
 * Provides:
 *  - Stall info
 *  - Active event
 *  - All candies (Single tab) ✅ WITH IMAGE
 *  - Combo offers (Same price + Mixed price) ✅ WITH IMAGE
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
       2️⃣ ACTIVE EVENT
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
       ✅ IMAGE ADDED
    ========================= */
    const [candies] = await db.query(
      `
      SELECT
        c.id,
        c.code,
        c.name,
        c.price,
        c.image,
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
       4️⃣ COMBO OFFER RULES
    ========================= */
    const [offers] = await db.query(
      `
      SELECT
        id,
        unique_count,
        offer_price,
        price,
        price_pattern
      FROM combo_offer_rules
      WHERE is_active = 1
      ORDER BY id
      `
    );

    /* 🔥 parse price_pattern JSON */
    for (const offer of offers) {
      if (offer.price_pattern) {
        offer.price_pattern = JSON.parse(offer.price_pattern);
      }
    }

    /* =========================
       5️⃣ ATTACH CANDIES TO OFFERS
       ✅ IMAGE ADDED
    ========================= */
    for (const offer of offers) {

      /* ===== SAME PRICE COMBO ===== */
      if (offer.price !== null) {
        const [offerCandies] = await db.query(
          `
          SELECT
            c.id,
            c.name,
            c.price,
            c.image,
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

      /* ===== MIXED PRICE COMBO ===== */
      else {
        const [mixedCandies] = await db.query(
          `
          SELECT
            c.id,
            c.name,
            c.price,
            c.image,
            IFNULL(i.stock, 0) AS stock
          FROM stall_candies sc
          JOIN candies c ON c.id = sc.candy_id
          LEFT JOIN stall_candy_inventory i
            ON i.candy_id = c.id
           AND i.stall_id = ?
          WHERE sc.stall_id = ?
            AND c.price IN (65, 80)
          ORDER BY c.price, c.name
          `,
          [stallId, stallId]
        );

        offer.candies = mixedCandies;
      }
    }

    /* =========================
       6️⃣ FINAL RESPONSE
    ========================= */
    res.json({
      stall,
      event: event || null,
      candies,
      offers
    });

  } catch (err) {
    console.error("SALESMAN CONFIG ERROR:", err);
    res.status(500).json({
      error: "Failed to load salesman config"
    });
  }
});

export default router;
