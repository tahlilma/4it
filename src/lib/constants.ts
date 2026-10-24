// Coded values used across the app, with English and Bangla labels.

export interface Opt {
  value: string;
  en: string;
  bn: string;
}

export function label(opts: readonly Opt[], value: string | null | undefined, lang: "en" | "bn" = "en"): string {
  if (!value) return "";
  const o = opts.find((x) => x.value === value);
  return o ? o[lang] : value;
}

export const GENDERS: Opt[] = [
  { value: "MALE", en: "Male", bn: "পুরুষ" },
  { value: "FEMALE", en: "Female", bn: "মহিলা" },
  { value: "OTHER", en: "Third gender", bn: "তৃতীয় লিঙ্গ" },
];

export const RELIGIONS: Opt[] = [
  { value: "ISLAM", en: "Islam", bn: "ইসলাম" },
  { value: "HINDU", en: "Hinduism", bn: "হিন্দু" },
  { value: "BUDDHIST", en: "Buddhism", bn: "বৌদ্ধ" },
  { value: "CHRISTIAN", en: "Christianity", bn: "খ্রিস্টান" },
  { value: "OTHER", en: "Other", bn: "অন্যান্য" },
];

export const MARITAL: Opt[] = [
  { value: "SINGLE", en: "Unmarried", bn: "অবিবাহিত" },
  { value: "MARRIED", en: "Married", bn: "বিবাহিত" },
  { value: "WIDOWED", en: "Widowed", bn: "বিধবা/বিপত্নীক" },
  { value: "DIVORCED", en: "Divorced", bn: "তালাকপ্রাপ্ত" },
  { value: "SEPARATED", en: "Separated", bn: "পৃথক" },
];

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export const EMP_TYPES: Opt[] = [
  { value: "WORKER", en: "Worker", bn: "শ্রমিক" },
  { value: "STAFF", en: "Staff", bn: "কর্মচারী" },
  { value: "MANAGEMENT", en: "Management", bn: "ব্যবস্থাপনা" },
];

// Bangladesh Labour Act 2006, s.4 classification of workers.
export const EMPLOYMENT_NATURE: Opt[] = [
  { value: "PERMANENT", en: "Permanent", bn: "স্থায়ী" },
  { value: "PROBATION", en: "Probationer", bn: "শিক্ষানবিশ" },
  { value: "TEMPORARY", en: "Temporary", bn: "অস্থায়ী" },
  { value: "CASUAL", en: "Casual", bn: "সাময়িক" },
  { value: "APPRENTICE", en: "Apprentice", bn: "শিক্ষাধীন" },
  { value: "SEASONAL", en: "Seasonal", bn: "মৌসুমী" },
  { value: "SUBSTITUTE", en: "Substitute (Badli)", bn: "বদলী" },
];

export const PAYMENT_MODES: Opt[] = [
  { value: "CASH", en: "Cash", bn: "নগদ" },
  { value: "BANK", en: "Bank", bn: "ব্যাংক" },
  { value: "MFS", en: "Mobile banking", bn: "মোবাইল ব্যাংকিং" },
];

export const MFS_PROVIDERS = ["bKash", "Nagad", "Rocket", "Upay"];

export const AGE_PROOF: Opt[] = [
  { value: "NID", en: "National ID", bn: "জাতীয় পরিচয়পত্র" },
  { value: "BIRTH_CERT", en: "Birth certificate", bn: "জন্ম নিবন্ধন সনদ" },
  { value: "SSC", en: "Academic certificate", bn: "শিক্ষা সনদ" },
  { value: "MEDICAL", en: "Medical age assessment", bn: "চিকিৎসকের বয়স নির্ধারণ" },
];

export const SEPARATION_TYPES: Opt[] = [
  { value: "RESIGNATION", en: "Resignation (s.27)", bn: "চাকুরী হতে ইস্তফা" },
  { value: "LEFTY", en: "Unauthorised absence — deemed resignation (s.27(3A))", bn: "অননুমোদিত অনুপস্থিতি (লেফটি)" },
  { value: "TERMINATION", en: "Termination by employer (s.26)", bn: "চাকুরী অবসান" },
  { value: "DISMISSAL", en: "Dismissal for misconduct (s.23)", bn: "বরখাস্ত" },
  { value: "DISCHARGE", en: "Discharge (s.22)", bn: "ডিসচার্জ" },
  { value: "RETRENCHMENT", en: "Retrenchment (s.20)", bn: "ছাঁটাই" },
  { value: "DEATH", en: "Death in service (s.19)", bn: "মৃত্যু" },
  { value: "RETIREMENT", en: "Retirement (s.28)", bn: "অবসর" },
];

export const FESTIVALS: Opt[] = [
  { value: "EID_UL_FITR", en: "Eid-ul-Fitr", bn: "ঈদুল ফিতর" },
  { value: "EID_UL_ADHA", en: "Eid-ul-Adha", bn: "ঈদুল আযহা" },
  { value: "DURGA_PUJA", en: "Durga Puja", bn: "দুর্গাপূজা" },
  { value: "CHRISTMAS", en: "Christmas", bn: "বড়দিন" },
  { value: "BUDDHA_PURNIMA", en: "Buddha Purnima", bn: "বুদ্ধ পূর্ণিমা" },
  { value: "OTHER", en: "Other festival", bn: "অন্যান্য উৎসব" },
];

export const HOLIDAY_TYPES: Opt[] = [
  { value: "FESTIVAL", en: "Festival holiday (s.118)", bn: "উৎসব ছুটি" },
  { value: "GOVERNMENT", en: "Government / general holiday", bn: "সরকারি ছুটি" },
  { value: "SPECIAL", en: "Special / compensatory holiday", bn: "বিশেষ ছুটি" },
];

export const ATT_STATUS: Opt[] = [
  { value: "PRESENT", en: "Present", bn: "উপস্থিত" },
  { value: "LATE", en: "Late", bn: "বিলম্ব" },
  { value: "ABSENT", en: "Absent", bn: "অনুপস্থিত" },
  { value: "LEAVE", en: "Leave", bn: "ছুটি" },
  { value: "OFF", en: "Off day", bn: "ছুটির দিন" },
];

export const DAY_TYPES: Opt[] = [
  { value: "WORKDAY", en: "Working day", bn: "কর্মদিবস" },
  { value: "WEEKEND", en: "Weekly holiday", bn: "সাপ্তাহিক ছুটি" },
  { value: "HOLIDAY", en: "Holiday", bn: "ছুটি" },
];

export const WEEKDAY_OPTS: Opt[] = [
  { value: "0", en: "Sunday", bn: "রবিবার" },
  { value: "1", en: "Monday", bn: "সোমবার" },
  { value: "2", en: "Tuesday", bn: "মঙ্গলবার" },
  { value: "3", en: "Wednesday", bn: "বুধবার" },
  { value: "4", en: "Thursday", bn: "বৃহস্পতিবার" },
  { value: "5", en: "Friday", bn: "শুক্রবার" },
  { value: "6", en: "Saturday", bn: "শনিবার" },
];

export const ROLES: Opt[] = [
  { value: "ADMIN", en: "Administrator", bn: "প্রশাসক" },
  { value: "HR_MANAGER", en: "HR & Compliance Manager", bn: "এইচআর ম্যানেজার" },
  { value: "HR_OFFICER", en: "HR Officer", bn: "এইচআর অফিসার" },
  { value: "PAYROLL", en: "Payroll / Accounts", bn: "বেতন/হিসাব" },
  { value: "TIMEKEEPER", en: "Timekeeper", bn: "টাইমকিপার" },
  { value: "VIEWER", en: "Viewer (read-only)", bn: "দর্শক" },
];

export const INCREMENT_KINDS: Opt[] = [
  { value: "ANNUAL", en: "Annual increment", bn: "বাৎসরিক বেতন বৃদ্ধি" },
  { value: "PROMOTION", en: "Promotion", bn: "পদোন্নতি" },
  { value: "SPECIAL", en: "Special increment", bn: "বিশেষ বেতন বৃদ্ধি" },
];

export const ADJUST_KINDS: Opt[] = [
  { value: "ARREAR", en: "Arrear", bn: "বকেয়া" },
  { value: "ADDITION", en: "Other addition", bn: "অন্যান্য প্রদান" },
  { value: "DEDUCTION", en: "Other deduction", bn: "অন্যান্য কর্তন" },
];

export const PAYSLIP_CATEGORIES: Opt[] = [
  { value: "REGULAR", en: "Regular", bn: "নিয়মিত" },
  { value: "NEW_JOIN", en: "New joiner", bn: "নতুন যোগদান" },
  { value: "SEPARATED", en: "Separated", bn: "চাকুরী ত্যাগ" },
  { value: "NEW_AND_SEPARATED", en: "Joined & separated", bn: "যোগদান ও ত্যাগ" },
];
