import { Router } from "express";
import { getAuthUrl, storeTokensFromCode } from "../auth/googleClient.js";

export const authRouter = Router();

authRouter.get("/google", (_req, res) => {
  res.redirect(getAuthUrl());
});

authRouter.get("/google/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.status(400).send("Missing code");
    return;
  }
  await storeTokensFromCode(code);
  res.redirect(`${process.env.CLIENT_URL}?connected=1`);
});

authRouter.get("/status", async (_req, res) => {
  const { prisma } = await import("../db.js");
  const saved = await prisma.oAuthToken.findUnique({ where: { provider: "google" } });
  res.json({ connected: Boolean(saved) });
});
