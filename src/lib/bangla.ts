// Bangla helpers: digits, dates, and amount-in-words (Bangla and English, lakh/crore system).

import { dmy } from "./dates";
import { money } from "./num";

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** Replace ASCII digits with Bangla digits. */
export function bn(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/[0-9]/g, (d) => BN_DIGITS[+d]);
}

export const MONTHS_BN = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];
export const WEEKDAYS_BN = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];

/** ০১/০৯/২০২৪ */
export function bnDate(d: Date | null | undefined): string {
  return d ? bn(dmy(d)) : "";
}

/** ১২,৫০০.০০ */
export function bnMoney(n: number | null | undefined, decimals = true): string {
  return bn(money(n, decimals));
}

export function bnMonthLabel(year: number, month: number): string {
  return `${MONTHS_BN[month - 1]} ${bn(year)}`;
}

// 0–99 in Bangla are irregular words.
const BN_0_99 = [
  "শূন্য", "এক", "দুই", "তিন", "চার", "পাঁচ", "ছয়", "সাত", "আট", "নয়",
  "দশ", "এগারো", "বারো", "তেরো", "চৌদ্দ", "পনেরো", "ষোলো", "সতেরো", "আঠারো", "উনিশ",
  "বিশ", "একুশ", "বাইশ", "তেইশ", "চব্বিশ", "পঁচিশ", "ছাব্বিশ", "সাতাশ", "আটাশ", "ঊনত্রিশ",
  "ত্রিশ", "একত্রিশ", "বত্রিশ", "তেত্রিশ", "চৌত্রিশ", "পঁয়ত্রিশ", "ছত্রিশ", "সাঁইত্রিশ", "আটত্রিশ", "ঊনচল্লিশ",
  "চল্লিশ", "একচল্লিশ", "বিয়াল্লিশ", "তেতাল্লিশ", "চুয়াল্লিশ", "পঁয়তাল্লিশ", "ছেচল্লিশ", "সাতচল্লিশ", "আটচল্লিশ", "ঊনপঞ্চাশ",
  "পঞ্চাশ", "একান্ন", "বাহান্ন", "তিপ্পান্ন", "চুয়ান্ন", "পঞ্চান্ন", "ছাপ্পান্ন", "সাতান্ন", "আটান্ন", "ঊনষাট",
  "ষাট", "একষট্টি", "বাষট্টি", "তেষট্টি", "চৌষট্টি", "পঁয়ষট্টি", "ছেষট্টি", "সাতষট্টি", "আটষট্টি", "ঊনসত্তর",
  "সত্তর", "একাত্তর", "বাহাত্তর", "তিয়াত্তর", "চুয়াত্তর", "পঁচাত্তর", "ছিয়াত্তর", "সাতাত্তর", "আটাত্তর", "ঊনআশি",
  "আশি", "একাশি", "বিরাশি", "তিরাশি", "চুরাশি", "পঁচাশি", "ছিয়াশি", "সাতাশি", "আটাশি", "ঊননব্বই",
  "নব্বই", "একানব্বই", "বিরানব্বই", "তিরানব্বই", "চুরানব্বই", "পঁচানব্বই", "ছিয়ানব্বই", "সাতানব্বই", "আটানব্বই", "নিরানব্বই",
];

function bnBelowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${BN_0_99[h]}শত`);
  if (r) parts.push(BN_0_99[r]);
  return parts.join(" ");
}

/** Integer to Bangla words using কোটি / লক্ষ / হাজার / শত. */
export function bnWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return BN_0_99[0];
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${bnWords(crore)} কোটি`);
  if (lakh) parts.push(`${BN_0_99[lakh]} লক্ষ`);
  if (thousand) parts.push(`${BN_0_99[thousand]} হাজার`);
  if (n) parts.push(bnBelowThousand(n));
  return parts.join(" ");
}

/** "দুই হাজার নয়শত নয় টাকা মাত্র" (with পয়সা when present) */
export function bnTakaWords(amount: number): string {
  const taka = Math.floor(Math.abs(amount));
  const paisa = Math.round((Math.abs(amount) - taka) * 100);
  let s = `${bnWords(taka)} টাকা`;
  if (paisa) s += ` ${bnWords(paisa)} পয়সা`;
  return `${s} মাত্র`;
}

const EN_ONES = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const EN_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function enBelowHundred(n: number): string {
  if (n < 20) return EN_ONES[n];
  const t = Math.floor(n / 10), o = n % 10;
  return o ? `${EN_TENS[t]} ${EN_ONES[o]}` : EN_TENS[t];
}

function enBelowThousand(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${EN_ONES[h]} Hundred`);
  if (r) parts.push(enBelowHundred(r));
  return parts.join(" ");
}

/** Integer to English words using the lakh/crore system used in Bangladesh. */
export function enWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return EN_ONES[0];
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${enWords(crore)} Crore`);
  if (lakh) parts.push(`${enBelowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${enBelowHundred(thousand)} Thousand`);
  if (n) parts.push(enBelowThousand(n));
  return parts.join(" ");
}

/** "Taka Two Thousand Nine Hundred Nine Only" */
export function enTakaWords(amount: number): string {
  const taka = Math.floor(Math.abs(amount));
  const paisa = Math.round((Math.abs(amount) - taka) * 100);
  let s = `Taka ${enWords(taka)}`;
  if (paisa) s += ` and ${enWords(paisa)} Paisa`;
  return `${s} Only`;
}
