import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const out = process.env.SHOT_DIR || "/opt/cursor/artifacts";
await mkdir(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();

async function shot(name) {
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("saved", file);
}

await page.goto("http://127.0.0.1:4721", { waitUntil: "networkidle0" });
await shot("landing");

await page.goto("http://127.0.0.1:4721/login", { waitUntil: "networkidle0" });
await page.evaluate(async () => {
  const body = new URLSearchParams({ email: "demo@spotted.app", password: "demo1234" });
  await fetch("/api/auth/login", {
    method: "POST",
    body,
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
});
await page.goto("http://127.0.0.1:4721/app", { waitUntil: "networkidle0" });
await shot("dashboard");

const projectHref = await page.evaluate(() => {
  const a = [...document.querySelectorAll("a")].find((el) => el.textContent.includes("Open source AI"));
  return a?.getAttribute("href") || "/app/projects";
});
await page.goto(new URL(projectHref, "http://127.0.0.1:4721").toString(), { waitUntil: "networkidle0" });
await shot("project_overview");

const mentionsHref = await page.evaluate(() => {
  const a = [...document.querySelectorAll("a")].find((el) => (el.getAttribute("href") || "").includes("/mentions"));
  return a?.getAttribute("href");
});
if (mentionsHref) await page.goto(new URL(mentionsHref, "http://127.0.0.1:4721").toString(), { waitUntil: "networkidle0" });
await shot("mentions");

const analyticsHref = await page.evaluate(() => {
  const a = [...document.querySelectorAll("a")].find((el) => (el.getAttribute("href") || "").includes("/analytics"));
  return a?.getAttribute("href");
});
if (analyticsHref) await page.goto(new URL(analyticsHref, "http://127.0.0.1:4721").toString(), { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 800));
await shot("analytics");

const alertsHref = await page.evaluate(() => {
  const a = [...document.querySelectorAll("a")].find((el) => (el.getAttribute("href") || "").includes("/alerts"));
  return a?.getAttribute("href");
});
if (alertsHref) await page.goto(new URL(alertsHref, "http://127.0.0.1:4721").toString(), { waitUntil: "networkidle0" });
await shot("alerts");

await page.goto("http://127.0.0.1:4721/app/publish", { waitUntil: "networkidle0" });
await page.click("textarea[name=content]", { clickCount: 3 });
await page.type("textarea[name=content]", "Spotted screenshot check — scheduled from the calendar.");
await page.click("button[type=submit]");
await new Promise((r) => setTimeout(r, 1200));
await shot("publisher");

await page.goto("http://127.0.0.1:4721/app/settings/sources", { waitUntil: "networkidle0" });
await shot("sources");

await page.goto("http://127.0.0.1:4721/app/inbox", { waitUntil: "networkidle0" });
await shot("inbox");

await browser.close();
console.log("done");
