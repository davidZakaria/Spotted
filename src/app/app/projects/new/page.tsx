import { createProjectAction } from "@/lib/actions";
import { SOURCE_CATALOG } from "@/lib/connectors/catalog";
import { Button, Card, Field } from "@/components/ui";

export default function NewProjectPage() {
  const defaults = SOURCE_CATALOG.filter((s) => s.keyless).map((s) => s.id);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New listening project</h1>
        <p className="text-sm text-muted">Keywords run across every selected source. Keyless sources work immediately.</p>
      </div>
      <Card>
        <form action={createProjectAction} className="space-y-4">
          <Field label="Project name">
            <input name="name" required placeholder="Open source AI" />
          </Field>
          <Field label="Description">
            <textarea name="description" rows={2} placeholder="Brand and competitor coverage for the next launch." />
          </Field>
          <Field label="Keywords" hint="Comma-separated. Arabic and English both work.">
            <input name="keywords" required placeholder="open source, llama, nextjs, ذكاء اصطناعي" />
          </Field>
          <Field label="Sources">
            <div className="grid gap-2 sm:grid-cols-2">
              {SOURCE_CATALOG.map((s) => (
                <label key={s.id} className="flex items-start gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                  <input type="checkbox" name="sources" value={s.id} defaultChecked={defaults.includes(s.id)} className="mt-1 w-auto" />
                  <span>
                    <span className="font-medium">{s.name}</span>
                    <span className="block text-xs text-muted">{s.keyless ? "Keyless" : s.envVars.join(", ") || "Needs credentials"}</span>
                  </span>
                </label>
              ))}
            </div>
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="RSS feeds"><textarea name="rssFeeds" rows={2} placeholder="https://..." /></Field>
            <Field label="Google Alert RSS URLs"><textarea name="googleAlertFeeds" rows={2} /></Field>
            <Field label="Reddit subreddits"><input name="redditSubreddits" placeholder="MachineLearning, programming" /></Field>
            <Field label="Facebook Page IDs"><input name="facebookPageIds" placeholder="Public or owned Page IDs" /></Field>
            <Field label="Instagram hashtags" hint="30 unique / 7 days / connected IG account."><input name="instagramHashtags" placeholder="opensource, ai" /></Field>
            <Field label="YouTube channel IDs"><input name="youtubeChannelIds" /></Field>
            <Field label="Telegram channels"><input name="telegramChannels" placeholder="durov" /></Field>
            <Field label="App Store IDs"><input name="appStoreIds" placeholder="310633997" /></Field>
            <Field label="Competitor handles"><input name="competitors" placeholder="openai, @vercel" /></Field>
          </div>
          <Button type="submit">Create and listen</Button>
        </form>
      </Card>
    </div>
  );
}
