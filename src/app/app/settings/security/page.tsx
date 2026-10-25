import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  changePasswordAction,
  confirmTotpAction,
  disableTotpAction,
  logoutEverywhereAction,
  startTotpAction,
} from "@/lib/actions";
import { Button, Card, Field, PageHeader } from "@/components/ui";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { appConfig } from "@/lib/config";
import { openSecret } from "@/lib/crypto";
import { totpUri } from "@/lib/totp";

export default async function SecurityPage() {
  const session = await requireSession();
  const locale = session.locale === "ar" ? "ar" : "en";
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { totpEnabled: true, totpSecret: true, lastLoginAt: true },
  });
  const sessions = await prisma.session.count({
    where: { userId: session.id, expiresAt: { gt: new Date() } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "ar" ? "الأمان" : "Security"}
        description={locale === "ar"
          ? `الجلسات تنتهي بعد ${appConfig.sessionDays} أيام. يمكنك إنهاء كل الجلسات من هنا.`
          : `Sessions last ${appConfig.sessionDays} days. You can sign out everywhere from here.`}
      />
      <Card>
        <h2 className="font-semibold">{locale === "ar" ? "تغيير كلمة المرور" : "Change password"}</h2>
        <form action={changePasswordAction} className="mt-3 space-y-3">
          <Field label={locale === "ar" ? "الحالية" : "Current"}><input name="currentPassword" type="password" required /></Field>
          <Field label={locale === "ar" ? "الجديدة" : "New"}>
            <input name="newPassword" type="password" required minLength={PASSWORD_MIN_LENGTH} />
          </Field>
          <p className="text-xs text-muted">
            {locale === "ar"
              ? `١٢ حرفاً على الأقل مع حرف كبير وصغير ورقم ورمز.`
              : `At least ${PASSWORD_MIN_LENGTH} characters with upper and lower case, a number, and a symbol.`}
          </p>
          <Button type="submit">{locale === "ar" ? "حفظ" : "Save password"}</Button>
        </form>
      </Card>
      <Card>
        <h2 className="font-semibold">{locale === "ar" ? "الجلسات" : "Sessions"}</h2>
        <p className="mt-1 text-sm text-muted">
          {locale === "ar"
            ? `${sessions} جلسات نشطة. آخر دخول: ${user?.lastLoginAt ? user.lastLoginAt.toLocaleString("ar") : "—"}`
            : `${sessions} active session${sessions === 1 ? "" : "s"}. Last sign-in: ${user?.lastLoginAt ? user.lastLoginAt.toLocaleString() : "—"}`}
        </p>
        <form action={logoutEverywhereAction} className="mt-3">
          <Button type="submit">{locale === "ar" ? "خروج من كل الأجهزة" : "Sign out everywhere"}</Button>
        </form>
      </Card>
      {session.role === "OWNER" ? (
        <Card>
          <h2 className="font-semibold">{locale === "ar" ? "التحقق بخطوتين" : "Two-factor authentication"}</h2>
          <p className="mt-1 text-sm text-muted">
            {user?.totpEnabled
              ? locale === "ar"
                ? "مفعّل. ستُطلب رموز تطبيق المصادقة عند الدخول."
                : "On. We will ask for an authenticator code at sign-in."
              : locale === "ar"
                ? "اختياري للمالك. أضف تطبيقاً مثل Google Authenticator."
                : "Optional for the owner. Use an app such as Google Authenticator."}
          </p>
          {user?.totpEnabled ? (
            <form action={disableTotpAction} className="mt-3 space-y-3">
              <Field label={locale === "ar" ? "كلمة المرور" : "Password"}><input name="password" type="password" required /></Field>
              <Button type="submit">{locale === "ar" ? "إيقاف" : "Turn off"}</Button>
            </form>
          ) : (
            <TotpSetup locale={locale} email={session.email} pendingSecret={openSecret(user?.totpSecret)} />
          )}
        </Card>
      ) : null}
    </div>
  );
}

function TotpSetup({
  locale,
  email,
  pendingSecret,
}: {
  locale: string;
  email: string;
  pendingSecret: string | null;
}) {
  if (!pendingSecret) {
    return (
      <form action={startTotpAction} className="mt-3">
        <Button type="submit">{locale === "ar" ? "بدء الإعداد" : "Start setup"}</Button>
      </form>
    );
  }
  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm">
        {locale === "ar" ? "أضف هذا السر في تطبيق المصادقة ثم أدخل الرمز." : "Add this secret in your authenticator app, then enter the code."}
      </p>
      <p className="break-all rounded-xl bg-bg-soft px-3 py-2 font-mono text-sm">{pendingSecret}</p>
      <p className="break-all text-xs text-muted">{totpUri(email, pendingSecret)}</p>
      <form action={confirmTotpAction} className="space-y-3">
        <Field label={locale === "ar" ? "الرمز" : "Code"}><input name="totp" required pattern="\d{6}" /></Field>
        <Button type="submit">{locale === "ar" ? "تفعيل" : "Turn on"}</Button>
      </form>
    </div>
  );
}
