import express from "express";
import { db } from "../../config/db.js";

const router = express.Router();

/* ================= GET ALL OFFERS ================= */
router.get("/", async (req, res) => {
  const [offers] = await db.query(
    "SELECT * FROM combo_offers ORDER BY id DESC"
  );

  for (const offer of offers) {
    const [candies] = await db.query(
      `
      SELECT c.id, c.name, c.price
      FROM combo_offer_candies coc
      JOIN candies c ON c.id = coc.candy_id
      WHERE coc.offer_id = ?
      `,
      [offer.id]
    );

    offer.candies = candies;
  }

  res.json({ rules: offers });
});

/* ================= CREATE OFFER ================= */
router.post("/", async (req, res) => {
  const { title, combo_size, price, candyIds } = req.body;

  if (!title || !combo_size || !price || !Array.isArray(candyIds)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  if (candyIds.length < combo_size) {
    return res
      .status(400)
      .json({ error: "Candies must be >= combo size" });
  }

  const [result] = await db.query(
    `
    INSERT INTO combo_offers (title, combo_size, price, is_active)
    VALUES (?, ?, ?, 1)
    `,
    [title, combo_size, price]
  );

  for (const candyId of candyIds) {
    await db.query(
      `
      INSERT INTO combo_offer_candies (offer_id, candy_id)
      VALUES (?, ?)
      `,
      [result.insertId, candyId]
    );
  }

  res.json({ success: true });
});

/* ================= UPDATE OFFER ================= */
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { title, combo_size, price, candyIds } = req.body;

  if (!title || !combo_size || !price || !Array.isArray(candyIds)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  await db.query(
    `
    UPDATE combo_offers
    SET title = ?, combo_size = ?, price = ?
    WHERE id = ?
    `,
    [title, combo_size, price, id]
  );

  await db.query(
    "DELETE FROM combo_offer_candies WHERE offer_id = ?",
    [id]
  );

  for (const candyId of candyIds) {
    await db.query(
      `
      INSERT INTO combo_offer_candies (offer_id, candy_id)
      VALUES (?, ?)
      `,
      [id, candyId]
    );
  }

  res.json({ success: true });
});

/* ================= TOGGLE ACTIVE ================= */
router.patch("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  await db.query(
    "UPDATE combo_offers SET is_active = ? WHERE id = ?",
    [is_active ? 1 : 0, id]
  );

  res.json({ success: true });
});

export default router;
