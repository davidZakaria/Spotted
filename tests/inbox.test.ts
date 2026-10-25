import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { commentsFromFacebookFeed } from "@/lib/connectors/meta";
import { FACEBOOK_MESSENGER_NOTE, formatInboxSync, inboxWarningCopy } from "@/lib/inbox";
import { HttpError } from "@/lib/connectors/http";

describe("Facebook inbox comments", () => {
  it("emits each comment from post.comments.data, not the Page posts", () => {
    const items = commentsFromFacebookFeed([
      {
        id: "pageid_post1",
        message: "Hello from the Page",
        from: { name: "Acme" },
        permalink_url: "https://www.facebook.com/post1",
        comments: {
          data: [
            {
              id: "comment_1",
              message: "Nice work",
              from: { name: "Ada" },
              created_time: "2026-10-24T12:00:00+0000",
              permalink_url: "https://www.facebook.com/comment_1",
            },
          ],
        },
      },
      {
        id: "pageid_post2",
        message: "Second post with no comments",
        from: { name: "Acme" },
        comments: { data: [] },
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.externalId).toBe("comment_1");
    expect(items[0]?.authorName).toBe("Ada");
    expect(items[0]?.content).toBe("Nice work");
    expect(items[0]?.url).toBe("https://www.facebook.com/comment_1");
    expect(items[0]?.type).toBe("COMMENT");
    expect(items.some((item) => item.externalId === "pageid_post1")).toBe(false);
  });
});

describe("inbox warnings and schedule", () => {
  it("uses the Messenger reconnect note", () => {
    expect(FACEBOOK_MESSENGER_NOTE).toBe("Facebook didn't allow reading Messenger; reconnect and allow messages");
    const copy = inboxWarningCopy(
      "FACEBOOK",
      new HttpError("403 https://graph.facebook.com/v22.0/123/conversations", 403, "pages_messaging"),
    );
    expect(copy.message).toBe(FACEBOOK_MESSENGER_NOTE);
    expect(copy.code).toBe("inbox_messenger");
  });

  it("schedules sync-inbox for every workspace and records ConnectorWarning on failure", () => {
    const queue = readFileSync("src/lib/queue.ts", "utf8");
    expect(queue).toMatch(/repeat-inbox/);
    expect(queue).toMatch(/sync-inbox/);
    expect(queue).toMatch(/5 \* 60 \* 1000/);
    const publish = readFileSync("src/lib/jobs/publish.ts", "utf8");
    expect(publish).toMatch(/syncAllInboxes/);
    expect(publish).toMatch(/warnInbox/);
    expect(publish).toMatch(/recordInboxSync/);
    expect(publish).not.toMatch(/permission gaps are expected/);
    const worker = readFileSync("src/worker.ts", "utf8");
    expect(worker).toMatch(/enqueue\("sync-inbox"\)/);
  });

  it("explains what feeds the inbox, when it last synced, and offers Refresh inbox", () => {
    const page = readFileSync("src/app/app/inbox/page.tsx", "utf8");
    expect(page).toMatch(/Refresh inbox/);
    expect(page).toMatch(/refreshInboxAction/);
    expect(page).toMatch(/Last synced/);
    expect(page).toMatch(/every 5 minutes/);
    expect(page).toMatch(/inboxWarningsForWorkspace/);
    expect(formatInboxSync(null, "en")).toBe("Not synced yet");
  });

  it("keeps tests out of the Next production typecheck", () => {
    const tsconfig = readFileSync("tsconfig.json", "utf8");
    expect(tsconfig).toMatch(/"tests"/);
  });
});
