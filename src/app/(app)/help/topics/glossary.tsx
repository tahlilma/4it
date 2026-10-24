import type { HelpTopic } from "../kit";

/** [term, Bangla, meaning] — alphabetical. */
const TERMS: [string, string, string][] = [
  ["Absent", "অনুপস্থিত", "Did not come on a working day and had no approved leave. Code A. One day's pay is deducted for each absent day."],
  ["Advance", "অগ্রিম", "Money given to an employee before payday, taken back in monthly instalments from wages."],
  ["Appointment letter", "নিয়োগপত্র", "The letter given on joining that states the job, wage and terms of employment (Rule 19)."],
  ["Arrear", "বকেয়া", "Money owed from an earlier month, paid in a later payroll."],
  ["Attendance bonus", "হাজিরা বোনাস", "A fixed reward for a perfect month — no absence and few late days."],
  ["Audit log", "অডিট লগ", "The permanent record of who did what in the app, and when."],
  ["Basic wage", "মূল মজুরী", "The main part of the salary. Overtime, absence deductions, bonuses and benefits are calculated from it."],
  ["BGMEA / BKMEA", "বিজিএমইএ / বিকেএমইএ", "The garment manufacturers' and knitwear manufacturers' associations of Bangladesh."],
  ["Buyer code of conduct", "ক্রেতার আচরণবিধি", "The rules a brand requires its suppliers to follow, often stricter than the law (for example on working hours)."],
  ["Casual leave (CL)", "নৈমিত্তিক ছুটি", "Up to 10 days of paid leave a year for personal needs."],
  ["Compensatory leave (CO)", "বিকল্প ছুটি", "A day off given in place of a holiday on which the person worked."],
  ["Compliance", "কমপ্লায়েন্স", "Following the law and buyers' codes — and being able to prove it with records."],
  ["Confirmation", "স্থায়ীকরণ", "When a probationer becomes permanent at the end of probation."],
  ["Deemed resignation", "স্বেচ্ছায় চাকুরী ত্যাগ গণ্য", "Treating a long-absent worker as having resigned, after the letter process of s.27(3A)."],
  ["Discharge", "ডিসচার্জ", "Ending employment because the worker is medically unfit (s.22)."],
  ["Dismissal", "বরখাস্ত", "Ending employment for proven misconduct (s.23)."],
  ["Earned leave (EL)", "অর্জিত ছুটি", "Also called annual leave. One day for every 18 days worked; usable after a year."],
  ["EL encashment", "অর্জিত ছুটি নগদায়ন", "Being paid for unused earned leave instead of taking it."],
  ["Festival bonus", "উৎসব ভাতা", "A bonus before major religious festivals — two a year after one year's service."],
  ["Grade", "গ্রেড", "A wage level set by the government's minimum-wage gazette. Each designation belongs to a grade."],
  ["Gross salary", "মোট মজুরী", "The full monthly salary: basic plus all allowances."],
  ["Holiday-duty allowance", "ছুটির দিনের ভাতা", "Extra pay for staff without overtime who work on a holiday."],
  ["House rent", "বাড়ি ভাড়া", "The allowance for housing, a fixed percentage of basic."],
  ["ID card", "পরিচয়পত্র", "The identity card every worker must get (Form 6)."],
  ["Increment", "বেতন বৃদ্ধি", "A yearly increase in salary — at least 5% of basic in the garment sector."],
  ["Job card", "জব কার্ড", "A monthly record of one person's daily in and out times, hours and overtime."],
  ["Late", "বিলম্ব", "Arriving after the shift start plus the grace minutes. Code L."],
  ["Leave without pay (LWP)", "বিনা বেতনে ছুটি", "Approved time off that is not paid."],
  ["Lefty", "লেফটি", "A worker who has stopped coming without leave. The lefty process sends three letters before treating them as resigned."],
  ["Line", "লাইন", "A sewing (production) line. Used for line-wise attendance and reports."],
  ["Lock (payroll)", "লক", "Freezing a month after wages are paid so its records can't change."],
  ["Manual entry", "ম্যানুয়াল এন্ট্রি", "A correction to attendance, always with a written reason."],
  ["Maternity benefit", "প্রসূতি কল্যাণ সুবিধা", "16 weeks of leave around childbirth, with pay if eligible (ss.45–50)."],
  ["MFS", "মোবাইল ব্যাংকিং", "Mobile financial services such as bKash, Nagad, Rocket and Upay."],
  ["Minimum wage", "নিম্নতম মজুরী", "The lowest legal wage for each grade, set by government gazette."],
  ["Net pay", "নিট প্রদেয়", "What the person actually receives after all deductions."],
  ["Night bill", "নাইট বিল", "A small allowance for leaving very late (after the shift's night-bill time)."],
  ["Nominee", "মনোনীত ব্যক্তি", "The person who receives a worker's dues if the worker dies (Form 41)."],
  ["Notice period", "নোটিশ কাল", "How long before leaving the worker or employer must inform the other side. Missing notice is paid or deducted."],
  ["Overtime (OT)", "অতিরিক্ত কাজ", "Work beyond normal hours, paid at twice the basic rate per hour."],
  ["Pay slip", "মজুরী স্লিপ", "The paper given with wages showing how they were calculated (Form 38)."],
  ["Probation", "শিক্ষানবিশকাল", "The trial period after joining — 3 months for workers, 6 for clerical staff."],
  ["Process (attendance / payroll)", "প্রসেস", "Making the app recalculate from the latest records."],
  ["Pro-rata", "আনুপাতিক", "In proportion — for example leave or pay for part of a year or month."],
  ["Punch", "পাঞ্চ", "One record from the attendance machine: a person's ID and the time."],
  ["Punch ID", "পাঞ্চ আইডি", "The number a person is enrolled under on the punch machine."],
  ["Retrenchment", "ছাঁটাই", "Ending jobs because there is less work (s.20)."],
  ["Revenue stamp", "রেভিনিউ স্ট্যাম্প", "A small fixed deduction for signing a cash wage receipt."],
  ["Section (department)", "সেকশন", "A part of a department, such as Iron or Packing inside Finishing."],
  ["Service benefit", "সার্ভিস বেনিফিট", "Money paid on leaving based on years of service (days of wages per year)."],
  ["Settlement", "চূড়ান্ত নিষ্পত্তি", "Paying everything owed to a person who leaves."],
  ["Shift", "শিফট", "The working hours and rules (late grace, break, overtime rounding) a person follows."],
  ["Sick leave (SL)", "অসুস্থতাজনিত ছুটি", "Up to 14 days of paid leave a year for illness."],
  ["Single punch", "একক পাঞ্চ", "A day with only one punch — usually a forgotten in or out."],
  ["Termination", "চাকুরী অবসান", "The employer ending a job with notice, without a misconduct reason (s.26)."],
  ["Tiffin bill", "টিফিন বিল", "A small allowance for staying late in the evening."],
  ["Weekly holiday", "সাপ্তাহিক ছুটি", "The one day off every week, usually Friday. Code W."],
];

export const glossary: HelpTopic = {
  slug: "glossary",
  title: "Glossary",
  summary: "Every term used in the app, explained in one or two plain sentences — with the Bangla word.",
  icon: "book",
  color: "teal",
  keywords: "words terms meaning definitions dictionary bangla",
  sections: () => {
    const letters = [...new Set(TERMS.map(([t]) => t[0].toUpperCase()))];
    return letters.map((l) => ({
      id: `letter-${l.toLowerCase()}`,
      title: l,
      body: (
        <dl className="my-3 divide-y divide-sep overflow-hidden rounded-[12px] bg-surface ring-1 ring-sep ring-inset">
          {TERMS.filter(([t]) => t[0].toUpperCase() === l).map(([t, bn, d]) => (
            <div key={t} className="grid gap-x-6 gap-y-0.5 px-4 py-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
              <dt>
                <span className="text-[14.5px] font-semibold text-label">{t}</span>
                <span className="block font-bn text-[13px] text-label-2">{bn}</span>
              </dt>
              <dd className="text-[14px] leading-relaxed text-label-2">{d}</dd>
            </div>
          ))}
        </dl>
      ),
    }));
  },
};
