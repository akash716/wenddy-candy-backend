import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

/* ───────────── ESM DIRNAME FIX ───────────── */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ───────────── ROUTES ───────────── */
import stallRoutes from "./routes/admin/stalls.js";
import eventRoutes from "./routes/admin/events.js";
import eventCandyRoutes from "./routes/admin/eventCandies.js";
import offerRoutes from "./routes/admin/offers.js";
import inventoryRoutes from "./routes/admin/inventory.js";
import salesmanConfigRoutes from "./routes/salesman/config.js";
import checkoutRoutes from "./routes/sales/checkout.js";
import candies from "./routes/admin/candies.js";
import stallCandies from "./routes/admin/stallCandies.js";
import salesmanRoutes from "./routes/salesman/dashboard.js";
import salesmanSellRoutes from "./routes/salesman/sell.js";
import stallOffersRoutes from "./routes/admin/stallOffers.js";
import reportRoutes from "./routes/admin/reports.js";
import comboOfferRules from "./routes/admin/comboOfferRules.js";
import previewRoutes from "./routes/salesman/preview.js";

const app = express();

/* ───────────── Middleware ───────────── */
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true
}));

app.use(express.json());

/* ───────────── STATIC UPLOADS (🔥 FIX) ───────────── */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ───────────── Health Check ───────────── */
app.get("/", (req, res) => {
  res.send("✅ Wenddy Candy API running");
});

/* ───────────── Routes ───────────── */
app.use("/api/admin/stalls", stallRoutes);
app.use("/api/admin/events", eventRoutes);
app.use("/api/admin/event-candies", eventCandyRoutes);
app.use("/api/admin/offers", offerRoutes);
app.use("/api/admin/inventory", inventoryRoutes);
app.use("/api/admin/candies", candies);
app.use("/api/admin/stall-candies", stallCandies);
app.use("/api/admin/stall-offers", stallOffersRoutes);
app.use("/api/admin/combo-offer-rules", comboOfferRules);
app.use("/api/admin/reports", reportRoutes);

app.use("/api/salesman/config", salesmanConfigRoutes);
app.use("/api/salesman/dashboard", salesmanRoutes);
app.use("/api/salesman", salesmanSellRoutes);
app.use("/api/salesman/preview", previewRoutes);

app.use("/api/sales/checkout", checkoutRoutes);

/* ───────────── PORT ───────────── */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Wenddy Candy backend running on port ${PORT}`);
});
