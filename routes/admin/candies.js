import express from "express";
import { db } from "../../config/db.js";

const router = express.Router();

/**
 * GET all candies
 */
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        id,
        code,
        name,
        price,
        CASE
          WHEN code LIKE 'MC%' THEN 'Milk'
          WHEN code LIKE 'DC%' THEN 'Dark'
          WHEN code LIKE 'DG%' THEN 'Dragee'
          ELSE 'Other'
        END AS category
      FROM candies
      ORDER BY id
    `);

    res.json(rows);
  } catch (err) {
    console.error("GET CANDIES ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * CREATE candy
 */
router.post("/", async (req, res) => {
  try {
    console.log("CREATE CANDY BODY:", req.body); // 🔍 DEBUG LOG

    const { name, category, price } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: "Name & price required" });
    }

    const prefix =
      category === "Milk" ? "MC" :
      category === "Dark" ? "DC" :
      category === "Dragee" ? "DG" :
      "OT";

    const [[countRow]] = await db.query(
      "SELECT COUNT(*) AS count FROM candies WHERE code LIKE ?",
      [`${prefix}%`]
    );

    const code = `${prefix}${countRow.count + 1}`;

    const [result] = await db.query(
      "INSERT INTO candies (code, name, price) VALUES (?, ?, ?)",
      [code, name, price]
    );

    res.json({
      success: true,
      insertedId: result.insertId
    });

  } catch (err) {
    console.error("CREATE CANDY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
