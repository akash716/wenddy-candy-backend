import { db } from "../config/db.js";

export async function applyOfferEngine({ lines }) {

  /* =========================
     1️⃣ FLATTEN ITEMS (ITEM ONLY)
  ========================= */
  const items = [];
  for (const line of lines.filter(l => l.type === "ITEM")) {
    for (const it of line.items) {
      items.push({
        candy_id: it.candy_id,
        price: Number(it.price),
        qty: Number(it.qty || 1)
      });
    }
  }

  if (!items.length) {
    return { lines, total: 0 };
  }

  /* =========================
     2️⃣ BUILD MAPS
  ========================= */
  const candyQty = {};
  const candyPrice = {};

  for (const it of items) {
    candyQty[it.candy_id] =
      (candyQty[it.candy_id] || 0) + it.qty;
    candyPrice[it.candy_id] = it.price;
  }

  /* =========================
     3️⃣ NORMAL TOTAL
  ========================= */
  const normalTotal = Object.keys(candyQty).reduce(
    (s, id) => s + candyQty[id] * candyPrice[id],
    0
  );

  let best = null;

  /* =========================
     4️⃣ SAME PRICE COMBOS (🔥 FIXED)
  ========================= */
  const priceTotals = {};

  for (const id in candyQty) {
    const price = candyPrice[id];
    priceTotals[price] =
      (priceTotals[price] || 0) + candyQty[id];
  }

  for (const price in priceTotals) {
    const totalQty = priceTotals[price];

    const [rules] = await db.query(
      `
      SELECT *
      FROM combo_offer_rules
      WHERE is_active = 1
        AND price = ?
        AND unique_count <= ?
      `,
      [Number(price), totalQty]
    );

    for (const r of rules) {
      const count = Math.floor(totalQty / r.unique_count);
      if (!count) continue;

      const total = count * Number(r.offer_price);

      if (!best || total < best.total) {
        best = {
          type: "SAME",
          rule: r,
          count,
          consume: () => {
            let need = r.unique_count;
            for (const id of Object.keys(candyQty)) {
              if (
                candyPrice[id] === Number(price) &&
                candyQty[id] > 0 &&
                need > 0
              ) {
                const use = Math.min(candyQty[id], need);
                candyQty[id] -= use;
                need -= use;
              }
            }
          },
          total
        };
      }
    }
  }

  /* =========================
     5️⃣ MIXED PRICE COMBOS (UNCHANGED)
  ========================= */
  const [mixedRules] = await db.query(`
    SELECT *
    FROM combo_offer_rules
    WHERE is_active = 1
      AND price IS NULL
      AND price_pattern IS NOT NULL
  `);

  for (const r of mixedRules) {
    let pattern;
    try {
      pattern = JSON.parse(r.price_pattern);
    } catch {
      continue;
    }

    let count = Infinity;

    for (const p of pattern) {
      const available = Object.keys(candyQty)
        .filter(id => candyPrice[id] === p.price)
        .reduce((s, id) => s + candyQty[id], 0);

      count = Math.min(count, Math.floor(available / p.qty));
    }

    if (!count || count === Infinity) continue;

    const total = count * Number(r.offer_price);

    if (!best || total < best.total) {
      best = {
        type: "MIXED",
        rule: r,
        count,
        consume: () => {
          for (const p of pattern) {
            let need = p.qty;
            for (const id of Object.keys(candyQty)) {
              if (
                candyPrice[id] === p.price &&
                candyQty[id] > 0 &&
                need > 0
              ) {
                candyQty[id]--;
                need--;
              }
            }
          }
        },
        total
      };
    }
  }

  /* =========================
     6️⃣ APPLY BEST
  ========================= */
  if (!best) {
    return { lines, total: normalTotal };
  }

  for (let i = 0; i < best.count; i++) {
    best.consume();
  }

  const remainingTotal = Object.keys(candyQty).reduce(
    (s, id) => s + candyQty[id] * candyPrice[id],
    0
  );

  return {
    lines,
    total: best.count * Number(best.rule.offer_price) + remainingTotal
  };
}
