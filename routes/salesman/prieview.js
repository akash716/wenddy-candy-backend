import express from "express";
import { applyOfferEngine } from "../../services/offerEngine.js";

const router = express.Router();

/**
 * POST /api/salesman/preview
 * 🔥 NO DB WRITE
 * 🔥 COMBO + ITEM SAFE TOTAL
 * 🔥 NO DOUBLE COUNT (BIG COMBO FIX)
 */
router.post("/", async (req, res) => {
  const { lines } = req.body;

  if (!Array.isArray(lines) || lines.length === 0) {
    return res.json({ total: 0 });
  }

  try {
    let comboTotal = 0;
    const itemLines = [];
    const comboCandyIds = new Set(); // 🔥 prevent double count

    /* =========================
       SPLIT COMBO & ITEM
    ========================= */
    for (const line of lines) {

      /* ===== COMBO ===== */
      if (line.type === "COMBO") {
        comboTotal += Number(line.price || 0);

        // collect candies used in combo
        if (Array.isArray(line.items)) {
          for (const it of line.items) {
            if (it?.candy_id) {
              comboCandyIds.add(it.candy_id);
            }
          }
        }
        continue;
      }

      /* ===== ITEM ===== */
      if (line.type === "ITEM") {
        const it = line.items?.[0];
        if (!it?.candy_id) continue;

        // 🔥 skip items already part of combo
        if (!comboCandyIds.has(it.candy_id)) {
          itemLines.push(line);
        }
      }
    }

    /* =========================
       ITEM TOTAL VIA ENGINE
    ========================= */
    let itemTotal = 0;

    if (itemLines.length) {
      const result = await applyOfferEngine({
        lines: itemLines
      });

      itemTotal = Number(result.total || 0);
    }

    /* =========================
       FINAL TOTAL
    ========================= */
    const total = comboTotal + itemTotal;

    res.json({ total });

  } catch (err) {
    console.error("PREVIEW ERROR:", err);
    res.status(500).json({
      error: "Preview failed"
    });
  }
});

export default router;
