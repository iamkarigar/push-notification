import "dotenv/config";
import express from "express";
import { connectDb } from "./config/db.js";
import { connectMongoose } from "./config/mongoose.js";
import teamRoutes from "./routes/teamRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { startTeamCollectionWatchers } from "./watchers/teamCollectionWatchers.js";

const app = express();
app.use(express.json());

app.use("/team/v1", teamRoutes);
app.use("/api/v1/notifications", notificationRoutes);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;

async function main() {
  await connectMongoose();
  await connectDb();
  console.log("MongoDB native client: ANALYTICS_MONGO_URL (TEAM db for team auth)");
  app.listen(PORT, () => {
    console.log(`Karigar Notifications listening on port ${PORT}`);
    // Change streams → internal HTTP calls; start after listen so fetch() succeeds.
    startTeamCollectionWatchers();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
