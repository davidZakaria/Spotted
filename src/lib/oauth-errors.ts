const COPY: Record<string, { en: string; ar: string }> = {
  missing_meta_keys: {
    en: "The Facebook app keys are missing. Add META_APP_ID and META_APP_SECRET, then try Connect again.",
    ar: "مفاتيح تطبيق فيسبوك غير موجودة. أضف META_APP_ID و META_APP_SECRET ثم أعد المحاولة.",
  },
  missing_google_oauth: {
    en: "YouTube search already works with your API key. To manage a channel, add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
    ar: "بحث يوتيوب يعمل بمفتاح الواجهة. لإدارة قناة أضف مفاتيح جوجل للدخول.",
  },
  missing_threads_keys: {
    en: "Threads needs THREADS_APP_ID and THREADS_APP_SECRET, plus a redirect URI of /api/oauth/threads/callback.",
    ar: "ثريدز يحتاج THREADS_APP_ID و THREADS_APP_SECRET وعنوان إعادة توجيه /api/oauth/threads/callback.",
  },
  missing_oauth_env: {
    en: "This platform is not set up yet. A teammate still needs to add the app keys.",
    ar: "هذه المنصة غير جاهزة بعد. يحتاج زميل إلى إضافة المفاتيح.",
  },
  oauth: {
    en: "The sign-in was cancelled or did not finish. Tap Connect and try again.",
    ar: "أُلغي تسجيل الدخول أو لم يكتمل. اضغط ربط وحاول مرة أخرى.",
  },
  oauth_exchange: {
    en: "We reached the platform but could not finish connecting. If this is Facebook, confirm you are an admin of the app (Development mode) and try again.",
    ar: "وصلنا إلى المنصة لكن الربط لم يكتمل. إن كان فيسبوك، تأكد أنك مدير التطبيق.",
  },
  no_pages: {
    en: "Facebook signed you in, but we found no Pages you manage. Create a Page or ask an admin to add you, then Connect again.",
    ar: "سجّل فيسبوك دخولك لكن لا توجد صفحات تديرها. أنشئ صفحة أو اطلب إضافتك ثم أعد الربط.",
  },
  not_signed_in: {
    en: "Sign in to Spotted first, then tap Connect.",
    ar: "سجّل الدخول إلى سبوتد أولاً ثم اضغط ربط.",
  },
};

export function oauthErrorCopy(code: string | undefined, locale = "en") {
  if (!code) return null;
  const row = COPY[code];
  if (!row) {
    return locale === "ar"
      ? "حدث خطأ أثناء الربط. حاول مرة أخرى."
      : "Something went wrong while connecting. Please try again.";
  }
  return locale === "ar" ? row.ar : row.en;
}

export function logOauth(event: string, detail: Record<string, unknown> = {}) {
  const safe = { ...detail };
  for (const key of Object.keys(safe)) {
    if (/token|secret|password|code/i.test(key)) delete safe[key];
  }
  console.error(`[oauth] ${event}`, safe);
}
