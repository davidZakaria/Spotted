export type Locale = "en" | "ar";

const dict = {
  en: {
    product: "Aether",
    tagline: "Listen. Understand. Publish.",
    signIn: "Sign in",
    signUp: "Create workspace",
    overview: "Overview",
    mentions: "Mentions",
    analytics: "Analytics",
    alerts: "Alerts",
    inbox: "Inbox",
    publish: "Publisher",
    reports: "Reports",
    sources: "Sources",
    settings: "Settings",
    projects: "Projects",
    newProject: "New project",
    listenNow: "Listen now",
    emptyMentions: "No mentions yet. Add keywords and run listening.",
    unavailable: "Not permitted by this platform’s API",
    budget: "API budget",
    hashtagQuota: "Hashtag quota",
  },
  ar: {
    product: "أثير",
    tagline: "استمع. افهم. انشر.",
    signIn: "تسجيل الدخول",
    signUp: "إنشاء مساحة عمل",
    overview: "نظرة عامة",
    mentions: "الإشارات",
    analytics: "التحليلات",
    alerts: "التنبيهات",
    inbox: "الوارد",
    publish: "النشر",
    reports: "التقارير",
    sources: "المصادر",
    settings: "الإعدادات",
    projects: "المشاريع",
    newProject: "مشروع جديد",
    listenNow: "استمع الآن",
    emptyMentions: "لا توجد إشارات بعد. أضف كلمات مفتاحية وشغّل الاستماع.",
    unavailable: "غير مسموح به عبر واجهة هذه المنصة",
    budget: "ميزانية الواجهة",
    hashtagQuota: "حصة الهاشتاج",
  },
} as const;

export function t(locale: string, key: keyof (typeof dict)["en"]) {
  const pack = locale === "ar" ? dict.ar : dict.en;
  return pack[key];
}
