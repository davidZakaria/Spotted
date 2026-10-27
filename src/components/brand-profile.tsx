"use client";

import { useState } from "react";
import type { Keyword, Source } from "@prisma/client";
import { saveBrandProfileAction, saveKeywordContextAction } from "@/lib/actions";
import { Button, Card, Field } from "@/components/ui";
import type { BrandProfile, HealthItem } from "@/lib/listen/profile";
import { PLATFORMS } from "@/lib/platforms";

function lines(values: string[]) {
  return values.join(", ");
}

function accountLines(accounts: { label: string; handle?: string; url?: string }[]) {
  return accounts.map((account) => account.url || (account.handle ? `@${account.handle}` : account.label)).join(", ");
}

const STEPS = 7;

export function BrandHealthCard({
  locale,
  score,
  items,
}: {
  locale: string;
  score: number;
  items: HealthItem[];
}) {
  const ar = locale === "ar";
  const missing = items.filter((item) => !item.ok);
  return (
    <Card>
      <h2 className="font-semibold">{ar ? "صحة العلامة" : "Brand health"}</h2>
      <p className="mt-1 text-sm text-muted">
        {ar ? `اكتمال الإعداد ${score}٪. أكمل النواقص لنراقب بدقة.` : `${score}% ready. Fill the gaps so we watch you more accurately.`}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-soft">
        <div className="h-full bg-accent" style={{ width: `${score}%` }} />
      </div>
      {missing.length ? (
        <ul className="mt-3 space-y-1 text-sm">
          {missing.map((item) => (
            <li key={item.id} className="text-warn">
              {ar ? item.labelAr : item.label}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-good">{ar ? "كل الأساسيات موجودة." : "The basics are all in place."}</p>
      )}
    </Card>
  );
}

export function BrandProfileWizard({
  projectId,
  locale,
  profile,
  keywords,
}: {
  projectId: string;
  locale: string;
  profile: BrandProfile;
  keywords: Keyword[];
}) {
  const ar = locale === "ar";
  const [step, setStep] = useState(1);
  const titles = ar
    ? ["كلمات المزاج", "حساباتكم", "المنافسون", "الأشخاص", "المنتجات", "اللغات والمواقع", "التجاهل والسياق"]
    : ["Mood words", "Your accounts", "Competitors", "People", "Products", "Languages and sites", "Ignore and context"];
  const helps = ar
    ? [
        "اكتب عبارات يقولها العملاء السعداء أو الغاضبون — بأي لغة. السلبية تجعل الإشارة سلبية وشكوى.",
        "حساباتكم وموقعكم. منشوراتكم تُوسم «منشورنا» ويمكن إخفاؤها من الإشارات.",
        "أسماء المنافسين لنقارن حصتهم. لا نفتح بحثاً إضافياً مدفوعاً لكل اسم.",
        "المتحدثون والمديرون. إن ظهر الاسم نضع وسم «شخص».",
        "أسماء المشاريع والوسوم. نضيف بعضها إلى بحث جوجل الحالي دون بحث إضافي.",
        "اللغات والدول والمواقع التي تهمك. أوقف ما لا تحتاجه.",
        "كلمات الضوضاء، وما يجب أن يظهر مع الاسم الإنجليزي.",
      ]
    : [
        "Type phrases happy or upset customers use — any language. Negative words mark a mention negative and Complaints & risk.",
        "Your pages and website. Their posts are tagged Own post and can be hidden.",
        "Competitor names so we can compare. We do not spend an extra paid search on each name.",
        "Spokespeople and executives. If the name appears we tag the mention Person.",
        "Product and project names plus hashtags. A few are packed into the existing Google search — no extra searches.",
        "Languages, countries, and which sites to watch. Turn off what you do not need.",
        "Noise words to ignore, and words that must appear with the English name.",
      ];

  return (
    <Card>
      <p className="text-xs text-muted">
        {ar ? `الخطوة ${step} من ${STEPS}` : `Step ${step} of ${STEPS}`}
      </p>
      <h2 className="mt-1 font-semibold">{titles[step - 1]}</h2>
      <p className="mt-1 text-sm text-muted">{helps[step - 1]}</p>
      <form action={saveBrandProfileAction} className="mt-4 space-y-4">
        <input type="hidden" name="projectId" value={projectId} />
        <section className={step === 1 ? "space-y-3" : "hidden"}>
          <Field label={ar ? "كلمات إيجابية" : "Positive words"} hint={ar ? "مثال: أنصح، تسليم في الموعد" : "Example: recommend, on time"}>
            <textarea name="positiveWords" rows={3} defaultValue={lines(profile.positiveWords)} />
          </Field>
          <Field label={ar ? "كلمات سلبية" : "Negative words"} hint={ar ? "أضف 3 على الأقل. مثال: نصب، تأخير، متضرر" : "Add at least 3. Example: scam, delay, never delivered"}>
            <textarea name="negativeWords" rows={3} defaultValue={lines(profile.negativeWords)} />
          </Field>
        </section>
        <section className={step === 2 ? "space-y-3" : "hidden"}>
          <Field label={ar ? "الحسابات الرسمية" : "Official accounts"} hint={ar ? "روابط أو @حساب. افصل بفاصلة." : "Links or @handles. Separate with commas."}>
            <textarea name="officialAccounts" rows={3} defaultValue={accountLines(profile.officialAccounts)} placeholder="@yourbrand, https://facebook.com/yourbrand" />
          </Field>
          <Field label={ar ? "المواقع الرسمية" : "Official websites"} hint={ar ? "موقع الشركة. منشوراته تُعد منشورنا." : "Company sites. Posts from these count as Own post."}>
            <textarea name="websites" rows={2} defaultValue={lines(profile.websites)} placeholder="https://yourbrand.com" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="hideOwnPosts" defaultChecked={profile.hideOwnPosts} />
            {ar ? "أخفِ منشوراتنا من قائمة الإشارات" : "Hide our own posts in Mentions"}
          </label>
        </section>
        <section className={step === 3 ? "space-y-3" : "hidden"}>
          <Field label={ar ? "المنافسون" : "Competitors"} hint={ar ? "أسماء للمقارنة في الإشارات." : "Names we tag as Competitor."}>
            <textarea name="competitors" rows={3} defaultValue={lines(profile.competitors)} />
          </Field>
          <Field label={ar ? "حسابات المنافسين" : "Competitor accounts"} hint={ar ? "روابط أو @حساب." : "Links or @handles."}>
            <textarea name="competitorAccounts" rows={2} defaultValue={accountLines(profile.competitorAccounts)} />
          </Field>
        </section>
        <section className={step === 4 ? "space-y-3" : "hidden"}>
          <Field label={ar ? "المتحدثون والمديرون" : "Spokespeople and executives"} hint={ar ? "الاسم كما يظهر في المنشورات." : "The name as it appears in posts."}>
            <textarea name="spokespeople" rows={3} defaultValue={lines(profile.spokespeople)} />
          </Field>
        </section>
        <section className={step === 5 ? "space-y-3" : "hidden"}>
          <Field label={ar ? "المنتجات والمشاريع" : "Products and projects"} hint={ar ? "Genesis أو Jura أو اسم المرحلة." : "Genesis, Jura, or a phase name."}>
            <textarea name="products" rows={3} defaultValue={lines(profile.products)} />
          </Field>
          <Field label={ar ? "الوسوم" : "Hashtags"} hint={ar ? "مع # أو بدونه." : "With or without #."}>
            <textarea name="hashtags" rows={2} defaultValue={lines(profile.hashtags)} />
          </Field>
        </section>
        <section className={step === 6 ? "space-y-3" : "hidden"}>
          <Field label={ar ? "اللغات" : "Languages"} hint={ar ? "en, ar, fr…" : "en, ar, fr…"}>
            <input name="languages" defaultValue={lines(profile.languages)} placeholder="ar, en" />
          </Field>
          <Field label={ar ? "الدول" : "Countries"} hint={ar ? "EG, AE, SA…" : "EG, AE, SA…"}>
            <input name="countries" defaultValue={lines(profile.countries)} placeholder="EG" />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{ar ? "المواقع للمراقبة" : "Sites to watch"}</legend>
            <p className="mb-2 text-xs text-muted">
              {ar ? "أوقف ما لا تحتاجه. خرائط جوجل تُدار من بطاقة الأماكن." : "Turn off what you do not need. Google Maps places stay in the Maps card."}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PLATFORMS.filter((platform) => platform.readyNow).map((platform) => (
                <label key={platform.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="sources"
                    value={platform.id}
                    defaultChecked={profile.sources.includes(platform.id as Source) || (!profile.sources.length && platform.id !== "GOOGLE_MAPS")}
                  />
                  {ar ? platform.nameAr : platform.name}
                </label>
              ))}
            </div>
          </fieldset>
        </section>
        <section className={step === 7 ? "space-y-3" : "hidden"}>
          <Field label={ar ? "تجاهل الإشارات التي تحتوي" : "Ignore mentions that contain"} hint={ar ? "كلمات من الولاية الأمريكية أو أخبار لا تخصك." : "US-state words or news that are not about you."}>
            <textarea name="excludeWords" rows={3} defaultValue={lines(profile.excludeWords)} />
          </Field>
        </section>
        <div className="flex flex-wrap gap-2">
          {step > 1 ? (
            <Button type="button" variant="soft" onClick={() => setStep((n) => n - 1)}>
              {ar ? "رجوع" : "Back"}
            </Button>
          ) : null}
          {step < STEPS ? (
            <Button type="button" variant="soft" onClick={() => setStep((n) => n + 1)}>
              {ar ? "التالي" : "Next"}
            </Button>
          ) : null}
          <Button type="submit">{ar ? "حفظ ملف العلامة" : "Save brand profile"}</Button>
        </div>
      </form>
      {step === 7 && keywords.length ? (
        <div className="mt-6 space-y-3 border-t border-line pt-4">
          <h3 className="font-medium">{ar ? "يجب أن يظهر أيضاً واحد من" : "Must also mention one of"}</h3>
          <p className="text-sm text-muted">
            {ar
              ? "إن طابقت الإشارة الاسم الإنجليزي فقط، نطلب كلمة مصرية مثل القاهرة. اكتب {arabic} لأي نص عربي."
              : "If a mention matches only the English name, it must also say an Egypt word such as Cairo. Type {arabic} to accept any Arabic."}
          </p>
          {keywords.map((keyword) => (
            <form key={keyword.id} action={saveKeywordContextAction} className="grid gap-2 md:grid-cols-2">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="keywordId" value={keyword.id} />
              <p className="md:col-span-2 text-sm font-medium">{keyword.phrase}</p>
              <Field label={ar ? "يجب أن يظهر واحد من" : "Must also mention one of"}>
                <input name="requiredAny" defaultValue={keyword.requiredAny.join(", ")} />
              </Field>
              <Field label={ar ? "فقط عندما تكون المطابقة هي" : "Only when the match is just"}>
                <input name="requiredAnyWhen" defaultValue={keyword.requiredAnyWhen.join(", ")} />
              </Field>
              <div className="md:col-span-2">
                <Button type="submit" variant="soft">{ar ? "حفظ هذه الكلمة" : "Save this word"}</Button>
              </div>
            </form>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
