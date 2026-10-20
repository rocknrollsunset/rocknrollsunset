import { google } from "googleapis";
import { prisma } from "../db.js";

export const PHOTOS_PICKER_SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
  PHOTOS_PICKER_SCOPE,
];

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl() {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function storeTokensFromCode(code: string) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);

  await prisma.oAuthToken.upsert({
    where: { provider: "google" },
    create: {
      provider: "google",
      accessToken: tokens.access_token ?? "",
      refreshToken: tokens.refresh_token ?? undefined,
      scope: tokens.scope ?? SCOPES.join(" "),
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    },
    update: {
      accessToken: tokens.access_token ?? "",
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      scope: tokens.scope ?? SCOPES.join(" "),
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    },
  });
}

export async function getAuthorizedClient(requiredScope?: string) {
  const saved = await prisma.oAuthToken.findUnique({ where: { provider: "google" } });
  if (!saved) {
    throw new Error("Not connected to Google yet. Visit /auth/google to connect.");
  }
  // Google lets people untick individual permissions, and older connections predate a scope.
  if (requiredScope && !saved.scope.split(" ").includes(requiredScope)) {
    throw new Error('That Google permission wasn\'t granted. Click "Connect Google Account" again and allow it.');
  }

  const client = createOAuthClient();
  client.setCredentials({
    access_token: saved.accessToken,
    refresh_token: saved.refreshToken ?? undefined,
    expiry_date: saved.expiryDate?.getTime(),
  });

  client.on("tokens", (tokens) => {
    void prisma.oAuthToken.update({
      where: { provider: "google" },
      data: {
        accessToken: tokens.access_token ?? saved.accessToken,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      },
    });
  });

  return client;
}
