import express from "express";
import { db } from "../../config/db.js";

const router = express.Router();

/* ===============================
   STALL SUMMARY
================================ */
router.get("/stall/summary", async (req, res) => {
  const { stall_id, start_date, end_date } = req.query;

  const [rows] = await db.query(`
    SELECT
      COUNT(id) AS total_bills,
      SUM(total) AS total_revenue,
      ROUND(SUM(total) / COUNT(id), 2) AS avg_bill
    FROM sales
    WHERE stall_id = ?
      AND created_at BETWEEN ? AND ?
  `, [stall_id, start_date, end_date]);

  res.json(rows[0]);
});

/* ===============================
   STALL CANDY SALES
================================ */
router.get("/stall/candies", async (req, res) => {
  const { stall_id, start_date, end_date } = req.query;

  const [rows] = await db.query(`
    SELECT
      c.name,
      SUM(sif.qty) AS qty_sold
    FROM sales s
    JOIN sale_items si ON si.sale_id = s.id
    JOIN sale_item_flavours sif ON sif.sale_item_id = si.id
    JOIN candies c ON c.id = sif.candy_id
    WHERE s.stall_id = ?
      AND s.created_at BETWEEN ? AND ?
    GROUP BY c.id
    ORDER BY qty_sold DESC
  `, [stall_id, start_date, end_date]);

  res.json(rows);
});

/* ===============================
   STALL COMBO SALES
================================ */
router.get("/stall/combos", async (req, res) => {
  const { stall_id, start_date, end_date } = req.query;

  const [rows] = await db.query(`
    SELECT
      co.title,
      COUNT(si.id) AS sold
    FROM sales s
    JOIN sale_items si ON si.sale_id = s.id
    JOIN combo_offers co ON co.id = si.offer_id
    WHERE s.stall_id = ?
      AND si.type = 'COMBO'
      AND s.created_at BETWEEN ? AND ?
    GROUP BY co.id
  `, [stall_id, start_date, end_date]);

  res.json(rows);
});

/* ===============================
   STALL INVENTORY SNAPSHOT
================================ */
router.get("/stall/inventory", async (req, res) => {
  const { stall_id } = req.query;

  try {
    const [rows] = await db.query(`
      SELECT
        c.name,
        sci.stock
      FROM stall_candy_inventory sci
      JOIN candies c ON c.id = sci.candy_id
      WHERE sci.stall_id = ?
      ORDER BY c.name
    `, [stall_id]);

    res.json(rows);

  } catch (err) {
    console.error("INVENTORY REPORT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});
/* ===============================
   OVERALL COMPANY SUMMARY
================================ */
router.get("/overall/summary", async (req, res) => {
  const { start_date, end_date } = req.query;

  try {
    const [rows] = await db.query(`
      SELECT
        st.company AS company,
        COUNT(DISTINCT s.id) AS total_bills,
        SUM(s.total) AS total_revenue
      FROM sales s
      JOIN stalls st ON st.id = s.stall_id
      WHERE s.created_at BETWEEN ? AND ?
        AND st.company IS NOT NULL
      GROUP BY st.company
      ORDER BY total_revenue DESC
    `, [start_date, end_date]);

    res.json(rows);
  } catch (err) {
    console.error("OVERALL SUMMARY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});
/* ===============================
   OVERALL ITEMS SOLD
================================ */
router.get("/overall/items", async (req, res) => {
  const { start_date, end_date } = req.query;

  try {
    const [rows] = await db.query(`
      SELECT
        st.company AS company,
        SUM(sif.qty) AS items_sold
      FROM sales s
      JOIN stalls st ON st.id = s.stall_id
      JOIN sale_items si ON si.sale_id = s.id
      JOIN sale_item_flavours sif ON sif.sale_item_id = si.id
      WHERE s.created_at BETWEEN ? AND ?
        AND st.company IS NOT NULL
      GROUP BY st.company
    `, [start_date, end_date]);

    res.json(rows);
  } catch (err) {
    console.error("OVERALL ITEMS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================
// 🧾 BILLS LIST
// ==============================
router.get("/bills", async (req, res) => {
  const { start_date, end_date } = req.query;

  try {
    const [rows] = await db.query(`
      SELECT
        s.id,
        st.name AS stall,
        s.total,
        s.created_at
      FROM sales s
      JOIN stalls st ON st.id = s.stall_id
      WHERE s.created_at BETWEEN ? AND ?
      ORDER BY s.created_at DESC
    `, [start_date, end_date]);

    res.json(rows);

  } catch (err) {
    console.error("BILLS LIST ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================
// 🧾 BILL DETAILS
// ==============================
router.get("/bills/:billId", async (req, res) => {
  const { billId } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT
        si.id AS sale_item_id,
        si.type,
        CASE
          WHEN si.type = 'COMBO' THEN co.price
          ELSE si.price
        END AS display_price,
        co.title AS combo_title,
        c.name AS candy_name,
        sif.qty
      FROM sale_items si
      LEFT JOIN combo_offers co ON co.id = si.offer_id
      LEFT JOIN sale_item_flavours sif ON sif.sale_item_id = si.id
      LEFT JOIN candies c ON c.id = sif.candy_id
      WHERE si.sale_id = ?
      ORDER BY si.id, sif.id
    `, [billId]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});






export default router;
