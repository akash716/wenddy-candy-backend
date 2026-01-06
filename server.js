import express from "express";
import cors from "cors";

import salesRoutes from "./routes/sales.js";
import candiesRoutes from "./routes/candies.js";
import offersRoutes from "./routes/offers.js";
import eventsRoutes from "./routes/events.js";
import adminInventory from "./routes/adminInventory.js";
import adminReports from "./routes/adminReports.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/sales", salesRoutes);
app.use("/api/candies", candiesRoutes);
app.use("/api/offers", offersRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/admin/inventory", adminInventory);
app.use("/api/admin/reports", adminReports);

app.get("/", (req, res) => {
  res.json({ status: "Wenddy Candy Backend Running" });
});

app.listen(5000, () => {
  console.log("✅ Server running on http://localhost:5000");
});
