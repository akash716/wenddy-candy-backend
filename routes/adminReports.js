import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

/**
 * GET /api/admin/reports/today
 */
router.get("/today", async (req, res) => {
  try {
    const [bills] = await db.query(`
      SELECT id AS bill_id, total, created_at
      FROM sales
      WHERE DATE(created_at) = CURDATE()
      ORDER BY id DESC
    `);

    for (const bill of bills) {
      const [lines] = await db.query(`
        SELECT 
          si.type,
          si.price,
          GROUP_CONCAT(CONCAT(c.name,' x',sif.qty) SEPARATOR ', ') AS items
        FROM sale_items si
        JOIN sale_item_flavours sif ON sif.sale_item_id = si.id
        JOIN candies c ON c.id = sif.candy_id
        WHERE si.sale_id = ?
        GROUP BY si.id
      `, [bill.bill_id]);

      bill.lines = lines;
    }

    const [[summary]] = await db.query(`
      SELECT COUNT(*) total_bills, IFNULL(SUM(total),0) total_amount
      FROM sales
      WHERE DATE(created_at)=CURDATE()
    `);

    res.json({ summary, bills });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load report" });
  }
});

export default router; // ✅ THIS LINE IS REQUIRED
