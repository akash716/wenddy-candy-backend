import express from "express";
import { db } from "../../config/db.js";

const router = express.Router();

/**
 * GET /api/salesman/config/:stallId
 * Loads:
 *  - Stall info
 *  - Active event (optional)
 *  - Candies assigned to stall (inventory-aware)
 *  - Combo offers assigned to stall (inventory-aware)
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


    /* =========================
       2️⃣ ACTIVE EVENT (OPTIONAL)
    ========================= */
    const [[event]] = await db.query(`
      SELECT *
      FROM events
      WHERE CURDATE() BETWEEN start_date AND end_date
      LIMIT 1
    `);

    /* =========================
       3️⃣ INVENTORY-AWARE CANDIES
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
       4️⃣ STALL-SPECIFIC COMBO OFFERS
    ========================= */
    const [offers] = await db.query(
      `
      SELECT
        o.id,
        o.title,
        o.combo_size,
        o.price
      FROM stall_combo_offers sco
      JOIN combo_offers o ON o.id = sco.offer_id
      WHERE sco.stall_id = ? AND o.is_active = 1
      `,
      [stallId]
    );

    /* =========================
       5️⃣ ALLOWED CANDIES + STOCK
       🔥 THIS IS THE FIX
    ========================= */
    for (const offer of offers) {
      const [allowed] = await db.query(
        `
        SELECT
          c.id,
          c.name,
          IFNULL(i.stock, 0) AS stock
        FROM combo_offer_candies coc
        JOIN candies c ON c.id = coc.candy_id
        LEFT JOIN stall_candy_inventory i
          ON i.candy_id = c.id
          AND i.stall_id = ?
        WHERE coc.offer_id = ?
        `,
        [stallId, offer.id]
      );

      offer.allowed_candies = allowed;
    }

    /* =========================
       FINAL RESPONSE
    ========================= */
    res.json({
      stall,
      event: event || null,
      candies,
      offers
    });

  } catch (err) {
    console.error("SALESMAN CONFIG ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
