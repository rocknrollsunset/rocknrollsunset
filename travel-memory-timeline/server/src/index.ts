import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieSession from "cookie-session";
import { authRouter } from "./routes/auth.js";
import { tripsRouter } from "./routes/trips.js";
import { journalRouter } from "./routes/journal.js";
import { backfillRouter } from "./routes/backfill.js";
import { photosRouter } from "./routes/photos.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(
  cookieSession({
    name: "session",
    secret: process.env.SESSION_SECRET || "dev-secret",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
);

app.use("/auth", authRouter);
app.use("/api/trips", tripsRouter);
app.use("/api/journal", journalRouter);
app.use("/api/backfill", backfillRouter);
app.use("/api/photos", photosRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
