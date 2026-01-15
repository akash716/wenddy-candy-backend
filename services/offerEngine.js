import { db } from "../config/db.js";

/**
 * FINAL OFFER ENGINE
 * ✔ manual combos respected
 * ✔ singles auto-offer supported
 * ✔ no double discount
 * ✔ NaN safe
 */
export async function applyOfferEngine({ lines }) {

  /* =========================
     1️⃣ SPLIT LINES
  ========================= */
  const comboLines = lines.filter(l => l.type === "COMBO");
  const itemLines  = lines.filter(l => l.type === "ITEM");

  /* =========================
     2️⃣ TOTAL OF MANUAL COMBOS
     (FIXED PRICE)
  ========================= */
  const comboTotal = comboLines.reduce(
    (s, l) => s + Number(l.price || 0),
    0
  );

  /* =========================
     3️⃣ FLATTEN ITEM LINES ONLY
  ========================= */
  const items = [];

  for (const line of itemLines) {
    for (const it of line.items) {
      items.push({
        candy_id: it.candy_id,
        price: Number(it.price),
        qty: Number(it.qty)
      });
    }
  }

  /* =========================
     4️⃣ NORMAL TOTAL (ITEMS)
  ========================= */
  const normalItemTotal = items.reduce(
    (s, i) => s + i.price * i.qty,
    0
  );

  if (!items.length) {
    // 🔥 only combos in cart
    return {
      lines,
      total: comboTotal
    };
  }

  /* =========================
     5️⃣ GROUP ITEMS BY PRICE
  ========================= */
  const priceGroups = {};
  for (const it of items) {
    if (!priceGroups[it.price]) {
      priceGroups[it.price] = [];
    }
    priceGroups[it.price].push({ ...it });
  }

  let best = null;

  /* =========================
     6️⃣ FIND BEST OFFER
  ========================= */
  for (const price in priceGroups) {
    const group = priceGroups[price];

    const qtyMap = {};
    for (const it of group) {
      qtyMap[it.candy_id] =
        (qtyMap[it.candy_id] || 0) + it.qty;
    }

    const uniqueIds = Object.keys(qtyMap);
    if (uniqueIds.length < 2) continue;

    const [rules] = await db.query(
      `
      SELECT *
      FROM combo_offer_rules
      WHERE is_active = 1
        AND price = ?
        AND unique_count <= ?
      ORDER BY unique_count DESC
      LIMIT 1
      `,
      [Number(price), uniqueIds.length]
    );

    if (!rules.length) continue;

    const rule = rules[0];

    const minQty = Math.min(
      ...uniqueIds.map(id => qtyMap[id])
    );

    const comboCount = Math.floor(minQty);
    if (!comboCount) continue;

    const offerTotal = comboCount * Number(rule.offer_price);

    if (!best || offerTotal < best.offerTotal) {
      best = {
        rule,
        comboCount,
        qtyMap,
        price: Number(price)
      };
    }
  }

  /* =========================
     7️⃣ NO OFFER ON ITEMS
  ========================= */
  if (!best) {
    return {
      lines,
      total: comboTotal + normalItemTotal
    };
  }

  /* =========================
     8️⃣ CALCULATE ITEM OFFER
  ========================= */
  const remainingMap = {};
  for (const it of items) {
    remainingMap[it.candy_id] =
      (remainingMap[it.candy_id] || 0) + it.qty;
  }

  // consume offer items
  for (let i = 0; i < best.comboCount; i++) {
    let used = 0;
    for (const id in best.qtyMap) {
      if (used >= best.rule.unique_count) break;
      if (remainingMap[id] > 0) {
        remainingMap[id]--;
        used++;
      }
    }
  }

  const remainingItemTotal = items.reduce((s, it) => {
    return s + (remainingMap[it.candy_id] || 0) * it.price;
  }, 0);

  const itemTotalWithOffer =
    best.comboCount * Number(best.rule.offer_price) +
    remainingItemTotal;

  /* =========================
     9️⃣ FINAL TOTAL
  ========================= */
  return {
    lines,
    total: comboTotal + itemTotalWithOffer
  };
}
