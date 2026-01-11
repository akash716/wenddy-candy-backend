import express from "express";
import { db } from "../../config/db.js";

const router = express.Router();

/**
 * GET all offers
 */
router.get("/", async (req, res) => {
  const [offers] = await db.query(
    "SELECT * FROM combo_offers ORDER BY id DESC"
  );

  for (const offer of offers) {
    const [candies] = await db.query(
      `
      SELECT c.id, c.name
      FROM combo_offer_candies coc
      JOIN candies c ON c.id = coc.candy_id
      WHERE coc.offer_id = ?
      `,
      [offer.id]
    );

    offer.candies = candies;
  }

  res.json(offers);
});

/**
 * CREATE offer
 */
router.post("/", async (req, res) => {
  const { title, combo_size, price, candyIds } = req.body;

  const [result] = await db.query(
    "INSERT INTO combo_offers (title, combo_size, price) VALUES (?,?,?)",
    [title, combo_size, price]
  );

  const offerId = result.insertId;

  for (const candyId of candyIds) {
    await db.query(
      "INSERT INTO combo_offer_candies (offer_id, candy_id) VALUES (?,?)",
      [offerId, candyId]
    );
  }

  res.json({ success: true });
});

/**
 * UPDATE combo offer
 */
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { title, combo_size, price, candyIds } = req.body;

  if (!title || !price || !combo_size || !Array.isArray(candyIds)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  if (candyIds.length < combo_size) {
    return res
      .status(400)
      .json({ error: "Allowed candies must be >= combo size" });
  }

  try {
    // 1️⃣ Update combo master
    await db.query(
      `
      UPDATE combo_offers
      SET title = ?, combo_size = ?, price = ?
      WHERE id = ?
      `,
      [title, combo_size, price, id]
    );

    // 2️⃣ Replace allowed candies (SAFE)
    await db.query(
      "DELETE FROM combo_offer_candies WHERE offer_id = ?",
      [id]
    );

    for (const candyId of candyIds) {
      await db.query(
        "INSERT INTO combo_offer_candies (offer_id, candy_id) VALUES (?,?)",
        [id, candyId]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("UPDATE COMBO ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});


export default router;
