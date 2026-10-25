import { env } from "./config";

export async function sendMail(input: { to: string; subject: string; text: string }) {
  if (!env("SMTP_HOST")) {
    console.log(`[mail] ${input.subject} -> ${input.to}\n${input.text}`);
    return { delivered: false as const };
  }
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port: Number(env("SMTP_PORT", "587")),
    auth: env("SMTP_USER") ? { user: env("SMTP_USER"), pass: env("SMTP_PASS") } : undefined,
  });
  await transport.sendMail({
    from: env("SMTP_FROM", "Spotted <alerts@localhost>"),
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
  return { delivered: true as const };
}
