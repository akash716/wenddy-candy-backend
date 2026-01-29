import express from "express";
import multer from "multer";
import path from "path";
import { db } from "../../config/db.js";

const router = express.Router();

/* ================= MULTER ================= */
const storage = multer.diskStorage({
  destination: "uploads/candies",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});
const upload = multer({ storage });

/* ================= GET ALL ================= */
router.get("/", async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        id, code, name, price, image,
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
    res.status(500).json({ error: err.message });
  }
});

/* ================= CREATE (TEXT ONLY) ================= */
router.post("/", async (req, res) => {
  try {
    const { name, category, price } = req.body;

    // ✅ FIX: category bhi compulsory
    if (!name || !price || !category) {
      return res.status(400).json({
        error: "Name, category & price required"
      });
    }

    // ✅ FIX: sirf valid categories allow
    const allowed = ["Milk", "Dark", "Dragee"];
    if (!allowed.includes(category)) {
      return res.status(400).json({
        error: "Invalid category"
      });
    }

    const prefix =
      category === "Milk" ? "MC" :
      category === "Dark" ? "DC" :
      category === "Dragee" ? "DG" : "OT";

    const [[row]] = await db.query(
      "SELECT COUNT(*) AS c FROM candies WHERE code LIKE ?",
      [`${prefix}%`]
    );

    const code = `${prefix}${row.c + 1}`;

    const [result] = await db.query(
      "INSERT INTO candies (code, name, price) VALUES (?, ?, ?)",
      [code, name, price]
    );

    res.json({
      success: true,
      id: result.insertId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= UPDATE (TEXT ONLY) ================= */
router.put("/:id", async (req, res) => {
  const { name, category, price } = req.body;

  if (!name || !price || !category) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    await db.query(
      "UPDATE candies SET name=?, price=? WHERE id=?",
      [name, price, req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= IMAGE UPLOAD ================= */
router.post("/:id/image", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Image required" });
  }

  const imagePath = `/uploads/candies/${req.file.filename}`;

  await db.query(
    "UPDATE candies SET image=? WHERE id=?",
    [imagePath, req.params.id]
  );

  res.json({ success: true, image: imagePath });
});

export default router;
