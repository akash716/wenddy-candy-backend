import express from "express";
import { db } from "../../config/db.js";

const router = express.Router();

/**
 * ASSIGN candies to stall
 */
router.post("/:stallId/candies", async (req, res) => {
  try {
    const { stallId } = req.params;
    const { candyIds } = req.body;

    await db.query(
      "DELETE FROM stall_candies WHERE stall_id = ?",
      [stallId]
    );

    for (const candyId of candyIds) {
      await db.query(
        "INSERT INTO stall_candies (stall_id, candy_id) VALUES (?, ?)",
        [stallId, candyId]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("STALL CANDIES SAVE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
