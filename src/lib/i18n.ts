export type Locale = "en" | "ar";

const dict = {
  en: {
    product: "Spotted",
    tagline: "See every mention of your brand",
    signIn: "Sign in",
    signUp: "Create account",
    signOut: "Sign out",
    home: "Home",
    mentions: "Mentions",
    analytics: "Analytics",
    alerts: "Alerts",
    inbox: "Inbox",
    publish: "Publish",
    reports: "Reports",
    scraper: "Scraper",
    platforms: "Connected platforms",
    settings: "Settings",
    help: "How Spotted works",
    brands: "Your brands",
    newBrand: "Add a brand",
    listenNow: "Find new mentions",
    emptyMentions: "No mentions yet. Add words to watch and we will look for them.",
    continue: "Continue",
    back: "Back",
    skip: "Skip for now",
    save: "Save",
    search: "Search",
    positive: "Positive",
    neutral: "Neutral",
    negative: "Negative",
    complaintsRisk: "Complaints & risk",
    today: "today",
    thisWeek: "this week",
    openOriginal: "Open original",
    darkMode: "Dark",
    lightMode: "Light",
    language: "Language",
    demoHint: "Try the demo: demo@spotted.app / demo1234",
    howItWorks: "How Spotted works",
  },
  ar: {
    product: "سبوتد",
    tagline: "شاهد كل إشارة لعلامتك",
    signIn: "تسجيل الدخول",
    signUp: "إنشاء حساب",
    signOut: "تسجيل الخروج",
    home: "الرئيسية",
    mentions: "الإشارات",
    analytics: "التحليلات",
    alerts: "التنبيهات",
    inbox: "الوارد",
    publish: "النشر",
    reports: "التقارير",
    scraper: "المكشط",
    platforms: "المنصات المتصلة",
    settings: "الإعدادات",
    help: "كيف يعمل سبوتد",
    brands: "علاماتك",
    newBrand: "إضافة علامة",
    listenNow: "ابحث عن إشارات جديدة",
    emptyMentions: "لا توجد إشارات بعد. أضف كلمات للمراقبة وسنبحث عنها.",
    continue: "متابعة",
    back: "رجوع",
    skip: "تخطَّ الآن",
    save: "حفظ",
    search: "بحث",
    positive: "إيجابي",
    neutral: "محايد",
    negative: "سلبي",
    complaintsRisk: "شكاوى ومخاطر",
    today: "اليوم",
    thisWeek: "هذا الأسبوع",
    openOriginal: "افتح الأصل",
    darkMode: "داكن",
    lightMode: "فاتح",
    language: "اللغة",
    demoHint: "جرّب العرض: demo@spotted.app / demo1234",
    howItWorks: "كيف يعمل سبوتد",
  },
} as const;

export type MessageKey = keyof (typeof dict)["en"];

export function t(locale: string, key: MessageKey) {
  const pack = locale === "ar" ? dict.ar : dict.en;
  return pack[key];
}

export function isRtl(locale: string) {
  return locale === "ar";
}

export function sentimentLabel(locale: string, value: string) {
  if (value === "POSITIVE") return t(locale, "positive");
  if (value === "NEGATIVE") return t(locale, "negative");
  return t(locale, "neutral");
}
