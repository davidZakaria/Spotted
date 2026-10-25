import { SignJWT, jwtVerify } from "jose";
import { appConfig } from "./config";
import { prisma } from "./db";

const secret = () => new TextEncoder().encode(`${appConfig.authSecret}:oauth-state`);

export async function createOauthState(input: {
  userId: string;
  workspaceId: string;
  provider: string;
}) {
  const nonce = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.oauthNonce.create({
    data: {
      nonce,
      userId: input.userId,
      workspaceId: input.workspaceId,
      provider: input.provider,
      expiresAt,
    },
  });
  return new SignJWT({
    userId: input.userId,
    workspaceId: input.workspaceId,
    provider: input.provider,
    nonce,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(nonce)
    .setExpirationTime("10m")
    .sign(secret());
}

export async function consumeOauthState(input: {
  state: string;
  provider: string;
  userId: string;
  workspaceId: string;
}) {
  const { payload } = await jwtVerify(input.state, secret());
  const nonce = String(payload.nonce ?? payload.jti ?? "");
  const userId = String(payload.userId ?? "");
  const workspaceId = String(payload.workspaceId ?? "");
  const provider = String(payload.provider ?? "");
  if (!nonce || !userId || !workspaceId || !provider) {
    throw new Error("Invalid OAuth state");
  }
  if (userId !== input.userId || workspaceId !== input.workspaceId || provider !== input.provider) {
    throw new Error("OAuth state does not match this session");
  }
  const row = await prisma.oauthNonce.findUnique({ where: { nonce } });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw new Error("OAuth state already used or expired");
  }
  if (row.userId !== input.userId || row.workspaceId !== input.workspaceId || row.provider !== input.provider) {
    throw new Error("OAuth state does not match this session");
  }
  await prisma.oauthNonce.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return { userId, workspaceId, provider, nonce };
}
