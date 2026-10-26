import type { Keyword } from "@prisma/client";
import type { GoogleMapsPlace } from "@/lib/connectors/types";
import {
  addGoogleMapsPlaceAction,
  removeGoogleMapsPlaceAction,
  saveIgnoreWordsAction,
  saveKeywordContextAction,
  saveMapsIntervalAction,
} from "@/lib/actions";
import { Button, Card, Field } from "@/components/ui";
import { DEFAULT_MAPS_INTERVAL_HOURS, mapsIntervalHours } from "@/lib/listen/maps";

export function BrandListenSettings({
  projectId,
  locale,
  excludeWords,
  places,
  intervalHours,
  keywords,
}: {
  projectId: string;
  locale: string;
  excludeWords: string[];
  places: GoogleMapsPlace[];
  intervalHours?: number;
  keywords: Keyword[];
}) {
  const ar = locale === "ar";
  const hours = mapsIntervalHours(intervalHours);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="font-semibold">{ar ? "أماكن خرائط جوجل للمراقبة" : "Google Maps places to watch"}</h2>
        <p className="mt-1 text-sm text-muted">
          {ar
            ? "الصق رابط خرائط أو اسم المكتب. نبحث مرة ثم نراجع التقييمات العامة تقريباً مرة في اليوم."
            : "Paste a Google Maps link or the office name. We look it up once, then check public reviews about once a day."}
        </p>
        <form action={addGoogleMapsPlaceAction} className="mt-3 space-y-2">
          <input type="hidden" name="projectId" value={projectId} />
          <Field label={ar ? "رابط أو اسم" : "Maps link or name"}>
            <input name="place" required placeholder={ar ? "New Jersey Developments القاهرة" : "New Jersey Developments, Cairo"} />
          </Field>
          <Field label={ar ? "اسم يظهر عندك (اختياري)" : "Name to show (optional)"}>
            <input name="label" placeholder={ar ? "مكتب نيو جيرسي" : "New Jersey Developments office"} />
          </Field>
          <Button type="submit">{ar ? "أضف المكان" : "Add this place"}</Button>
        </form>
        <form action={saveMapsIntervalAction} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="projectId" value={projectId} />
          <Field label={ar ? "كم ساعة بين كل فحص؟" : "Hours between checks"}>
            <input name="hours" type="number" min={1} max={168} defaultValue={hours || DEFAULT_MAPS_INTERVAL_HOURS} />
          </Field>
          <Button type="submit" variant="soft">{ar ? "حفظ" : "Save"}</Button>
        </form>
        <ul className="mt-3 space-y-2 text-sm">
          {places.length === 0 ? (
            <li className="text-muted">{ar ? "لا أماكن بعد." : "No places yet."}</li>
          ) : (
            places.map((place) => {
              const key = place.dataId || place.placeId || place.label;
              return (
                <li key={key} className="flex items-start justify-between gap-2 rounded-xl bg-bg-soft px-3 py-2">
                  <span>
                    <span className="font-medium">{place.label}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {place.dataId || place.placeId || (ar ? "لم يُحفظ المعرّف بعد" : "No Maps id saved yet")}
                    </span>
                  </span>
                  <form action={removeGoogleMapsPlaceAction}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="placeKey" value={key} />
                    <Button type="submit" variant="ghost" className="px-2 py-1 text-xs">{ar ? "إزالة" : "Remove"}</Button>
                  </form>
                </li>
              );
            })
          )}
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">{ar ? "تجاهل الإشارات التي تحتوي" : "Ignore mentions that contain"}</h2>
        <p className="mt-1 text-sm text-muted">
          {ar
            ? "كلمات من ولاية أمريكية أو أخبار لا تخص مشروعك. افصل بفاصلة."
            : "Words from the wrong New Jersey — US cities or news. Separate with commas."}
        </p>
        <form action={saveIgnoreWordsAction} className="mt-3 space-y-2">
          <input type="hidden" name="projectId" value={projectId} />
          <textarea
            name="excludeWords"
            rows={4}
            defaultValue={excludeWords.join(", ")}
            placeholder="Trenton, Newark, Jersey City, Hoboken"
          />
          <Button type="submit">{ar ? "حفظ الكلمات المتجاهلة" : "Save ignored words"}</Button>
        </form>
      </Card>
      {keywords.length ? (
        <Card className="lg:col-span-2">
          <h2 className="font-semibold">{ar ? "يجب أن يظهر أيضاً واحد من" : "Must also mention one of"}</h2>
          <p className="mt-1 text-sm text-muted">
            {ar
              ? "إن طابقت الإشارة الاسم الإنجليزي فقط، نطلب كلمة مصرية مثل القاهرة أو Genesis. اكتب {arabic} لقبول أي نص عربي."
              : "If a mention matches only the English name, it must also say an Egypt word such as Cairo or Genesis. Type {arabic} to also accept any Arabic text."}
          </p>
          <div className="mt-3 space-y-4">
            {keywords.map((keyword) => (
              <form key={keyword.id} action={saveKeywordContextAction} className="grid gap-2 md:grid-cols-2">
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="keywordId" value={keyword.id} />
                <p className="md:col-span-2 text-sm font-medium">{keyword.phrase}</p>
                <Field label={ar ? "يجب أن يظهر واحد من" : "Must also mention one of"}>
                  <input name="requiredAny" defaultValue={keyword.requiredAny.join(", ")} placeholder="Egypt, Cairo, Sokhna, مصر, {arabic}" />
                </Field>
                <Field label={ar ? "فقط عندما تكون المطابقة هي" : "Only when the match is just"}>
                  <input
                    name="requiredAnyWhen"
                    defaultValue={keyword.requiredAnyWhen.join(", ")}
                    placeholder="New Jersey Development, NJ Developments"
                  />
                </Field>
                <div className="md:col-span-2">
                  <Button type="submit" variant="soft">{ar ? "حفظ هذه الكلمة" : "Save this word"}</Button>
                </div>
              </form>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
