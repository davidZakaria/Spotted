import { prisma } from "./db";
import { isSealedSecret, sealSecret } from "./crypto";

export async function encryptStoredTokens() {
  const accounts = await prisma.socialAccount.findMany({
    where: {
      OR: [{ accessToken: { not: null } }, { refreshToken: { not: null } }],
    },
    select: { id: true, accessToken: true, refreshToken: true },
  });
  let updated = 0;
  for (const account of accounts) {
    const accessToken = isSealedSecret(account.accessToken) ? account.accessToken : sealSecret(account.accessToken);
    const refreshToken = isSealedSecret(account.refreshToken) ? account.refreshToken : sealSecret(account.refreshToken);
    if (accessToken === account.accessToken && refreshToken === account.refreshToken) continue;
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: { accessToken, refreshToken },
    });
    updated += 1;
  }

  const users = await prisma.user.findMany({
    where: { totpSecret: { not: null } },
    select: { id: true, totpSecret: true },
  });
  for (const user of users) {
    if (isSealedSecret(user.totpSecret)) continue;
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: sealSecret(user.totpSecret) },
    });
    updated += 1;
  }
  return { scanned: accounts.length + users.length, updated };
}
