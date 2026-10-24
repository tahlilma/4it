import type { ReactNode } from "react";
import { BnLetterHead, Boxed, EnLetterHead, FieldLines, PhotoBox, SigBlock, bnAddress, enAddress } from "@/components/report/doc";
import { CompanyHeader, Sheet, Signatures } from "@/components/report/sheet";
import { bn, bnDate, bnMoney, bnTakaWords, enTakaWords } from "../../bangla";
import { code128Bars, code128Width } from "../../barcode";
import { BIOMETRIC_LAYOUTS } from "../../biometric";
import type { CompanyRow } from "../../company";
import { EMPLOYMENT_NATURE, GENDERS, label, MARITAL, RELIGIONS, SEPARATION_TYPES, WEEKDAY_OPTS } from "../../constants";
import { addDays, calendarSpan, dMonY, diffDays, dmy } from "../../dates";
import { prisma } from "../../db";
import { inChunks } from "../../chunk";
import { employeeWhere } from "../../employee-filter";
import { otRate } from "../../engine/salary";
import { money, round2 } from "../../num";
import { leaveBalances } from "../../services/leave";
import type { Filters, ReportDef } from "../types";
import { groupBy, loadEmployees, type EmpRow, secTitle, takeBatch } from "../util";

const DOC_FILTERS = ["emp", "org", "status"] as const;
const photo = (e: { id: number; photoPath: string | null }) => (e.photoPath ? `/api/photo/${e.id}` : null);
const nb = (bnV: string | null | undefined, enV: string | null | undefined) => (bnV && bnV.trim() ? bnV : enV ?? "");
const desigBn = (e: EmpRow) => nb(e.designation.nameBn, e.designation.nameEn);
const secBn = (e: EmpRow) => nb(e.section.nameBn, e.section.nameEn);
const nameBn = (e: { nameBn: string; nameEn: string }) => nb(e.nameBn, e.nameEn);
const P = ({ children, className = "" }: { children: ReactNode; className?: string }) => <p className={`mt-2 text-justify font-bn text-[13px] leading-relaxed ${className}`}>{children}</p>;

/** One document per item, limited to the current batch (see ReportDef.batch). */
function pages<T>(f: Filters, list: T[], render: (t: T, last: boolean) => ReactNode, empty = "No employees match the filter."): { node?: ReactNode; empty?: string } {
  if (!list.length) return { empty };
  const items = takeBatch(f, list);
  return { node: items.map((t, i) => render(t, i === items.length - 1)) };
}

function SalaryTable({ cols }: { cols: { head: string; rows: (string | number)[] }[] }) {
  const labels = ["পদবী", "গ্রেড", "মূল বেতন/মজুরী", "বাড়ী ভাড়া", "চিকিৎসা ভাতা", "যাতায়াত ভাতা", "খাদ্য ভাতা", "ওভারটাইম হার (প্রতি ঘন্টা)", "মাসিক সর্বমোট বেতন/মজুরী"];
  return (
    <table className="dt mt-3 font-bn text-[13px]">
      <thead>
        <tr>
          <th className="w-10">নং</th>
          <th>পদবী ও বেতন/মজুরী কাঠামো</th>
          {cols.map((c) => (
            <th key={c.head}>{c.head}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {labels.map((l, i) => (
          <tr key={l} className={i === labels.length - 1 ? "font-bold" : ""}>
            <td className="center">{bn(i + 1)}.</td>
            <td>{l}</td>
            {cols.map((c) => (
              <td key={c.head} className={i <= 1 ? "center" : "num"}>
                {typeof c.rows[i] === "number" ? bnMoney(c.rows[i] as number, i === 7) : c.rows[i]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function salCol(head: string, desig: string, grade: string, s: { basic: number; houseRent: number; medical: number; transport: number; food: number; gross: number }, rate: number) {
  return { head, rows: [desig, grade, s.basic, s.houseRent, s.medical, s.transport, s.food, rate, s.gross] };
}

/** Recipient block used on letters. */
function ToBlock({ e, extra }: { e: EmpRow; extra?: [string, ReactNode][] }) {
  return (
    <div className="mt-3 font-bn text-[13px]">
      <div>প্রতি,</div>
      <FieldLines
        labelWidth="28mm"
        items={[
          ["নাম", <b key="n">{nameBn(e)}</b>],
          ["পিতার নাম", nb(e.fatherBn, e.fatherEn)],
          ["পদবী", desigBn(e)],
          ["সেকশন", secBn(e)],
          ["আইডি নং", bn(e.empCode)],
          ...(extra ?? []),
        ]}
      />
    </div>
  );
}

export const documentReports: ReportDef[] = [
  {
    slug: "job-application",
    group: "Personal File",
    title: "Job Application Letter",
    titleBn: "চাকুরীর জন্য আবেদনপত্র",
    description: "Applicant's job application with personal details, as kept in the personal file.",
    perm: "reports.hr",
    batch: 100,
    filters: [...DOC_FILTERS],
    async run(f, { company }) {
      const emps = await loadEmployees(f);
      return {
        title: "Job Application",
        ...pages(f, emps, (e, last) => (
          <Sheet key={e.id} last={last}>
            <BnLetterHead company={company} photo photoSrc={photo(e)} />
            <div className="mt-6 font-bn text-[13px]">
              <div>বরাবর,</div>
              <div>ব্যবস্থাপনা পরিচালক</div>
              <div>{company.nameBn || company.nameEn}</div>
              <div>{company.addressBn || company.addressEn}</div>
              <P className="mt-4 font-semibold">বিষয়ঃ {desigBn(e)} পদে চাকুরীর জন্য আবেদনপত্র।</P>
              <P>জনাব,</P>
              <P>
                বিনীত নিবেদন এই যে, আপনার স্বনামধন্য পোশাক শিল্প প্রতিষ্ঠানে বিষয় উল্লেখিত পদের জন্য আমি একজন প্রার্থী হিসাবে আমার শিক্ষাগত যোগ্যতা ও প্রয়োজনীয় তথ্যাবলী আপনার সদয় বিবেচনার জন্য নিম্নে প্রেরণ করিলামঃ
              </P>
              <div className="mt-3">
                <FieldLines
                  items={[
                    ["১. আবেদনকারীর নাম", nameBn(e)],
                    ["২. পিতার নাম", nb(e.fatherBn, e.fatherEn)],
                    ["৩. মাতার নাম", nb(e.motherBn, e.motherEn)],
                    ["৪. স্থায়ী ঠিকানা", bnAddress(e, "perm")],
                    ["৫. বর্তমান ঠিকানা", bnAddress(e, "pres")],
                    ["৬. মোবাইল নং", bn(e.mobile)],
                    ["৭. জরুরী যোগাযোগ", bn([e.emergencyName, e.emergencyPhone].filter(Boolean).join(", "))],
                    ["৮. জাতীয়তা", e.nationality === "Bangladeshi" ? "বাংলাদেশী" : e.nationality],
                    ["৯. শিক্ষাগত যোগ্যতা", nb(e.educationBn, e.educationEn)],
                    ["১০. জন্ম তারিখ", bnDate(e.dob)],
                    ["১১. ধর্ম", label(RELIGIONS, e.religion, "bn")],
                    ["১২. রক্তের গ্রুপ", e.bloodGroup],
                    ["১৩. উচ্চতা", e.heightCm ? `${bn(e.heightCm)} (সেঃ মিটার)` : ""],
                    ["১৪. জাতীয় পরিচয়পত্র", bn(e.nidNo || e.birthRegNo)],
                    ["১৫. বৈবাহিক অবস্থা", label(MARITAL, e.maritalStatus, "bn")],
                    ["১৬. স্বামী বা স্ত্রীর নাম", nb(e.spouseBn, e.spouseEn) || "প্রযোজ্য নহে"],
                    ["১৭. সন্তান সংখ্যা", e.childrenCount ? `${bn(e.childrenCount)} জন` : "নাই"],
                    ["১৮. পরিচয় প্রদানকারী", e.referenceName],
                    ["১৯. পূর্ব অভিজ্ঞতা", e.experienceYears ? `${bn(e.experienceYears)} বছর${e.experienceDetails ? ` — ${e.experienceDetails}` : ""}` : "নাই"],
                  ]}
                />
              </div>
              <P className="mt-5">অতএব মহোদয়ের নিকট আকুল আবেদন আমাকে উক্ত পদে নিয়োগ দানে বাধিত করিবেন।</P>
              <div className="mt-14 w-60 text-center">
                <div className="border-t border-dotted border-black pt-1">বিনীত নিবেদক/ নিবেদিকা</div>
                <div>তারিখঃ {bnDate(addDays(e.joinDate, -1))}</div>
              </div>
            </div>
          </Sheet>
        )),
      };
    },
  },
  {
    slug: "appointment-letter",
    group: "Personal File",
    title: "Appointment Letter",
    titleBn: "চাকুরীর নিয়োগপত্র",
    description: "Appointment letter with all items required by Labour Rules 2015 r.19(4): personal details, designation, class of worker, wages, increment rate, benefits and conditions.",
    perm: "reports.hr",
    batch: 100,
    filters: [...DOC_FILTERS],
    async run(f, { company }) {
      const emps = await loadEmployees(f);
      const joining = await prisma.salaryHistory.findMany({ where: { employeeId: { in: emps.map((e) => e.id) }, type: "JOINING" } });
      const jBy = new Map(joining.map((j) => [j.employeeId, j]));
      return {
        title: "Appointment Letter",
        ...pages(f, emps, (e, last) => {
          const s = jBy.get(e.id) ?? e;
          const worker = e.empType === "WORKER";
          const months = worker ? company.probationWorkerMonths : company.probationStaffMonths;
          const rate = e.otEligible ? otRate(s.basic, company) : 0;
          const weekly = label(WEEKDAY_OPTS, String(e.weeklyHoliday ?? company.weeklyHoliday), "bn");
          return (
            <Sheet key={e.id} last={last}>
              <BnLetterHead company={company} subtitle={<Boxed>চাকুরীর নিয়োগপত্র</Boxed>} />
              <div className="font-bn text-[13px]">
                <FieldLines
                  labelWidth="30mm"
                  items={[
                    ["নাম", <b key="n">{nameBn(e)}</b>],
                    ["পিতার নাম", nb(e.fatherBn, e.fatherEn)],
                    ["মাতার নাম", nb(e.motherBn, e.motherEn)],
                    ...(e.spouseEn || e.spouseBn ? ([["স্বামী/স্ত্রীর নাম", nb(e.spouseBn, e.spouseEn)]] as [string, string][]) : []),
                    ["বর্তমান ঠিকানা", bnAddress(e, "pres")],
                    ["স্থায়ী ঠিকানা", bnAddress(e, "perm")],
                  ]}
                />
                <P className="font-semibold">বিষয়ঃ চাকুরীর নিয়োগপত্র।</P>
                <P>জনাব/জনাবা,</P>
                <P>
                  আপনার আবেদন ও কর্তৃপক্ষের সাথে সাক্ষাৎকারের পরিপ্রেক্ষিতে আপনাকে জানানো যাইতেছে যে, আগামী {bnDate(e.joinDate)} ইং তারিখ হইতে নিম্নে বর্ণিত শর্ত সাপেক্ষে আপনাকে অত্র প্রতিষ্ঠানে নিয়োগ দেয়া হইলঃ
                </P>
                <ol className="mt-2 list-none space-y-1.5 text-justify text-[12.5px] leading-relaxed">
                  <li>
                    ১. {e.grade ? `গ্রেড ${bn(e.grade.code)} এর অধীনে ` : ""}আপনার পদবী <b>{desigBn(e)}</b>, সেকশন <b>{secBn(e)}</b>, আইডি নং <b>{bn(e.empCode)}</b>
                    {e.line ? ` (${nb(e.line.nameBn, e.line.nameEn)})` : ""}। শ্রমিকের শ্রেণীঃ {label(EMPLOYMENT_NATURE, "PROBATION", "bn")} (প্রবেশনকাল শেষে {label(EMPLOYMENT_NATURE, "PERMANENT", "bn")})।
                  </li>
                  <li>
                    ২. আপনার বর্তমান মাসিক বেতন/মজুরী হবে নিম্নরূপঃ
                    <table className="dt mt-1">
                      <thead>
                        <tr>
                          <th>মূল মজুরী</th>
                          <th>বাড়ী ভাড়া</th>
                          <th>চিকিৎসা ভাতা</th>
                          <th>যাতায়াত ভাতা</th>
                          <th>খাদ্য ভাতা</th>
                          <th>মোট মজুরী/ বেতন</th>
                          <th>ওভারটাইম হার</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {[s.basic, s.houseRent, s.medical, s.transport, s.food, s.gross].map((v, i) => (
                            <td key={i} className="center">
                              {bnMoney(v)}
                            </td>
                          ))}
                          <td className="center">{e.otEligible ? bnMoney(rate) : "প্রযোজ্য নহে"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </li>
                  <li>
                    ৩. আপনি চাকুরীর প্রথম {bn(months)} মাস প্রবেশনে থাকবেন{worker ? " (দক্ষ শ্রমিকের কাজের মান নির্ধারণ সম্ভব না হইলে কর্তৃপক্ষ প্রবেশনকাল আরও ৩ (তিন) মাস বৃদ্ধি করিতে পারিবেন)" : ""}। প্রবেশনকালীন সময়ে আপনার কাজের মান সন্তোষজনক না হইলে কর্তৃপক্ষ আইন অনুযায়ী আপনার চাকুরীর অবসান করিতে পারিবেন। চাকুরী স্থায়ী হওয়ার পর আপনি চাকুরী হইতে ইস্তফা দিতে চাইলে ৬০ (ষাট) দিন আগে কর্তৃপক্ষকে লিখিতভাবে জানাইতে হইবে, অন্যথায় নোটিশ মেয়াদের মজুরী সমন্বয় করা হইবে (ধারা ২৭)।
                  </li>
                  <li>৪. স্বাভাবিক কর্ম সময় দিনে ৮ (আট) ঘন্টা ও সপ্তাহে ৪৮ ঘন্টা; দৈনিক আহার ও বিশ্রামের বিরতি থাকিবে এবং আপনি শ্রম আইনের বিধান অনুযায়ী সাপ্তাহিক ১ (এক) দিন ({weekly}) ছুটি পাইবেন।</li>
                  <li>
                    ৫.{" "}
                    {e.otEligible
                      ? `কর্তৃপক্ষ প্রয়োজন বোধে আপনাকে দিয়ে অতিরিক্ত সময় (ওভারটাইম) কাজ করাইতে পারিবেন, তবে দৈনিক ২ (দুই) ঘন্টার বেশি নয় এবং সাপ্তাহিক মোট কর্মঘন্টা ৬০ ঘন্টার বেশি নয়। অতিরিক্ত সময়ের জন্য মূল মজুরীর দ্বিগুণ হারে মজুরী প্রদান করা হইবে, যার হিসাব: (মূল মজুরী ÷ ২০৮) × ২ = ${bnMoney(rate)} টাকা প্রতি ঘন্টা (ধারা ১০৮)।`
                      : "আপনার পদটি অতিরিক্ত সময় ভাতার আওতাভুক্ত নয়; সাপ্তাহিক/উৎসব ছুটির দিনে দায়িত্ব পালন করিলে প্রতিষ্ঠানের নীতিমালা অনুযায়ী ছুটির দিনের ভাতা বা বিকল্প ছুটি প্রদান করা হইবে।"}
                  </li>
                  <li>
                    ৬. প্রবেশনকালীন সময়ে আপনি উৎসব ছুটি, অসুস্থতাজনিত ছুটি ও নৈমিত্তিক ছুটি আনুপাতিক হারে ভোগ করিতে পারিবেনঃ ক) উৎসব ছুটি বছরে ১১ দিন, পূর্ণ মজুরীসহ (ধারা ১১৮); খ) নৈমিত্তিক ছুটি বছরে ১০ দিন, পূর্ণ মজুরীসহ (ধারা ১১৫); গ) অসুস্থতাজনিত ছুটি বছরে ১৪ দিন, পূর্ণ মজুরীসহ (ধারা ১১৬); ঘ) বাৎসরিক ছুটি — এক বছর চাকুরী পূর্তির পর প্রতি ১৮ কর্মদিবসের জন্য একদিন (ধারা ১১৭); ঙ) মাতৃত্বকালীন ছুটি (মহিলাদের জন্য) — ধারা ৪৬ অনুযায়ী ন্যূনতম ৬ (ছয়) মাস চাকুরীর পর ১১২ দিন (১৬ সপ্তাহ) ছুটি ও মাতৃত্বকালীন সুবিধা; তবে সন্তান প্রসবের সময় দুই বা ততোধিক সন্তান জীবিত থাকিলে আর্থিক সুবিধা প্রযোজ্য হইবে না।
                  </li>
                  <li>৭. প্রতি বছর চাকুরী পূর্তিতে মূল মজুরীর ন্যূনতম {bn(company.incrementPercent)}% হারে বাৎসরিক মজুরী বৃদ্ধি করা হইবে।</li>
                  <li>৮. এক বছর চাকুরী পূর্তির পর বছরে দুইটি উৎসব ভাতা (প্রতিটি মূল মজুরীর সমপরিমাণ, বিধি ১১১(৫)) এবং হাজিরা বোনাসসহ কোম্পানীর প্রচলিত অন্যান্য সুবিধাদি প্রাপ্য হইবেন।</li>
                  <li>৯. মজুরী মেয়াদ শেষ হওয়ার পরবর্তী ৭ (সাত) কর্মদিবসের মধ্যে মজুরী প্রদান করা হইবে (ধারা ১২৩)।</li>
                  <li>১০. আপনি যদি কখনো কোনরূপ ‘অসদাচরণের’ অপরাধে দোষী প্রমাণিত হন তবে কর্তৃপক্ষ আইন অনুযায়ী আপনার বিরুদ্ধে শাস্তিমূলক ব্যবস্থা গ্রহণ করিতে পারিবেন (ধারা ২৩, ২৪)।</li>
                  <li>১১. সর্বোপরি আপনার চাকুরীর অন্যান্য শর্তাবলী বাংলাদেশ শ্রম আইন ২০০৬, বাংলাদেশ শ্রম বিধিমালা ২০১৫ এবং প্রতিষ্ঠানের চাকুরী বিধি অনুযায়ী পরিচালিত হইবে।</li>
                  <li>১২. আপনার বর্তমান ঠিকানা পরিবর্তন করিলে সাত (০৭) দিনের মধ্যেই কর্তৃপক্ষের নিকট লিখিতভাবে জানাইবেন।</li>
                  <li>১৩. প্রতিষ্ঠানের প্রয়োজনে আপনাকে একই মালিকের অধীনে যে কোন অঙ্গপ্রতিষ্ঠান বা অন্য যে কোন বিভাগে বদলী করা যাইতে পারে।</li>
                </ol>
                <P className="mt-3">আমি সুস্থ, স্বজ্ঞানে ও স্বেচ্ছায় উপরোক্ত শর্তসমূহ মেনে নিয়ে নিয়োগপত্রের মূলকপি গ্রহণ করিয়া ইহার অনুলিপিতে সম্মতিসূচক স্বাক্ষর করিলাম।</P>
                <SigBlock left="মালিকের বা প্রাধিকারপ্রাপ্ত কর্মকর্তার স্বাক্ষর" right="শ্রমিকের পূর্ণনাম ও স্বাক্ষর" />
              </div>
            </Sheet>
          );
        }),
      };
    },
  },
  {
    slug: "fitness-certificate",
    group: "Personal File",
    title: "Age And Fitness Certificate (Medical Form)",
    titleBn: "বয়স ও সক্ষমতার প্রত্যয়নপত্র — ফরম ১৫",
    description: "Certificate of age and fitness by a registered medical practitioner (Form 15, ss.34, 36, 37, Rule 34(1)). The doctor fills in the examined age and signs.",
    perm: "reports.hr",
    batch: 100,
    filters: [...DOC_FILTERS],
    async run(f, { company }) {
      const emps = await loadEmployees(f);
      return {
        title: "Age and Fitness Certificate",
        ...pages(f, emps, (e, last) => {
          const certDate = e.fitnessCertDate ?? e.joinDate;
          const age = calendarSpan(e.dob, certDate);
          const cell = "border border-black p-2 align-top";
          return (
            <Sheet key={e.id} last={last}>
              <div className="relative font-bn">
                <div className="text-center">
                  <div className="text-[19px] font-bold">{company.nameBn || company.nameEn}</div>
                  <div className="text-[12px]">{company.addressBn || company.addressEn}</div>
                  <div className="mt-3 text-[14px] font-semibold">বয়স ও সক্ষমতার প্রত্যয়নপত্র</div>
                  <div className="text-[13px]">ফরম ১৫</div>
                  <div className="text-[12px] font-semibold">[ধারা ৩৪, ৩৬, ৩৭ ও ২৭৭ এবং বিধি ৩৪(১) ও ৩৩৬(৪) দ্রষ্টব্য]</div>
                </div>
                <div className="absolute right-0 top-0">
                  <PhotoBox src={photo(e)} />
                </div>
              </div>
              <table className="mt-6 w-full border-collapse font-bn text-[12.5px]">
                <tbody>
                  <tr>
                    <td className={`${cell} w-1/2`}>১. ক্রমিক নং: {bn(e.empCode)}</td>
                    <td className={cell}>তারিখ: {bnDate(certDate)}</td>
                  </tr>
                  <tr>
                    <td className={cell}>২. নাম: {nameBn(e)}</td>
                    <td className={cell}>
                      পদবীঃ {desigBn(e)} <span className="float-right">আইডিঃ {bn(e.empCode)}</span>
                      <br />
                      সেকশনঃ {secBn(e)}
                    </td>
                  </tr>
                  <tr>
                    <td className={cell}>
                      ৩. পিতার নাম: {nb(e.fatherBn, e.fatherEn)}
                      <br />
                      <br />
                      ৪. মাতার নাম: {nb(e.motherBn, e.motherEn)}
                    </td>
                    <td className={cell}>
                      আমি এই মর্মে প্রত্যয়ন করিতেছি যে,
                      <br />
                      নামঃ {nameBn(e)}
                      <br />
                      পিতাঃ {nb(e.fatherBn, e.fatherEn)}
                      <br />
                      মাতাঃ {nb(e.motherBn, e.motherEn)}
                      <br />
                      ঠিকানাঃ {bnAddress(e, "perm")}
                      <br />
                      কে পরীক্ষা করিয়াছি।
                    </td>
                  </tr>
                  <tr>
                    <td className={cell}>৫. লিঙ্গ: {label(GENDERS, e.gender, "bn")}</td>
                    <td className={cell}>তিনি প্রতিষ্ঠানে নিযুক্ত হইতে ইচ্ছুক এবং আমার পরীক্ষা হইতে এইরূপ পাওয়া গিয়াছে যে, তাহার বয়স .......... (..........) বৎসর এবং তিনি প্রতিষ্ঠানে প্রাপ্ত বয়স্ক/ কিশোর হিসাবে নিযুক্ত হইবার যোগ্য।</td>
                  </tr>
                  <tr>
                    <td className={cell}>৬. স্থায়ী ঠিকানা: {bnAddress(e, "perm")}</td>
                    <td className={cell}>তাহার সনাক্ত করণের চিহ্ন: ............................................</td>
                  </tr>
                  <tr>
                    <td className={cell}>৭. অস্থায়ী/ যোগাযোগের ঠিকানা: {bnAddress(e, "pres")}</td>
                    <td className={cell} />
                  </tr>
                  <tr>
                    <td className={cell}>
                      ৮. জন্ম সনদ/ শিক্ষা সনদ অনুসারে বয়সঃ {bn(age.years)} বছর {bn(age.months)} মাস {bn(age.days)} দিন
                      <br />
                      জন্ম তারিখঃ {bnDate(e.dob)}
                    </td>
                    <td className={cell} />
                  </tr>
                  <tr>
                    <td className={cell}>৯. দৈহিক সক্ষমতা: আছে / নাই</td>
                    <td className={cell} />
                  </tr>
                  <tr>
                    <td className={cell}>১০. সনাক্তকরণ চিহ্ন: {nb(e.identMarkBn, e.identMarkEn) || "----------------------------"}</td>
                    <td className={cell} />
                  </tr>
                  <tr>
                    <td className={`${cell} h-24`}>
                      <div className="mt-14 flex justify-between text-[11px]">
                        <span>সংশ্লিষ্ট ব্যক্তির টিপসহ ও স্বাক্ষর</span>
                        <span className="text-center">
                          রেজিস্টার্ড চিকিৎসকের স্বাক্ষর
                          <br />
                          রেজিঃ নং ও সিল
                        </span>
                      </div>
                    </td>
                    <td className={cell}>
                      <div className="mt-14 flex justify-between text-[11px]">
                        <span>সংশ্লিষ্ট ব্যক্তির টিপসহ ও স্বাক্ষর</span>
                        <span className="text-center">
                          রেজিস্টার্ড চিকিৎসকের স্বাক্ষর
                          <br />
                          রেজিঃ নং ও সিল
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Sheet>
          );
        }),
      };
    },
  },
  {
    slug: "nominee-form",
    group: "Personal File",
    title: "Nominee Form",
    titleBn: "জমা ও বিভিন্ন খাতে প্রাপ্ত অর্থ পরিশোধের ঘোষণা ও মনোনয়ন ফরম — ফরম ৪১",
    description: "Declaration and nomination for wages and other dues in case of death (Form 41; s.19, Rule 118(1)).",
    perm: "reports.hr",
    batch: 100,
    filters: [...DOC_FILTERS],
    async run(f, { company }) {
      const emps = await loadEmployees(f);
      const noms = await inChunks(emps.map((e) => e.id), (slice) => prisma.nominee.findMany({ where: { employeeId: { in: slice } }, orderBy: { id: "asc" } }));
      const heads = ["বকেয়া মজুরী", "প্রভিডেন্ট ফান্ড", "বীমা", "দুর্ঘটনার ক্ষতিপূরণ", "লভ্যাংশ", "অন্যান্য"];
      return {
        title: "Nominee Form",
        ...pages(f, emps, (e, last) => {
          const list = noms.filter((n) => n.employeeId === e.id);
          const dateStr = bnDate(e.nomineeFormDate ?? e.joinDate);
          return (
            <Sheet key={e.id} last={last}>
              <BnLetterHead company={company} />
              <div className="text-center font-bn">
                <Boxed>জমা ও বিভিন্ন খাতে প্রাপ্ত অর্থ পরিশোধের ঘোষণা ও মনোনয়ন ফরম</Boxed>
                <div className="mt-1 text-[11px]">ফরম-৪১ [ধারা ১৯, ১৩১(১)(ক), ১৫৫(২), ২৩৪, ২৬৪, ২৬৫, ২৭৩ এবং বিধি ১১৮(১), ২৩২(২), ২৬২(১), ২৮৯(১) ও ৩২১(১) দ্রষ্টব্য]</div>
              </div>
              <div className="mt-3 font-bn text-[12.5px]">
                <FieldLines
                  labelWidth="40mm"
                  items={[
                    ["১. শ্রমিকের নাম", nameBn(e)],
                    ["২. পিতার নাম", nb(e.fatherBn, e.fatherEn)],
                    ["৩. মাতার নাম", nb(e.motherBn, e.motherEn)],
                    ["৪. স্বামী বা স্ত্রীর নাম", nb(e.spouseBn, e.spouseEn) || "প্রযোজ্য নহে"],
                    ["৫. স্থায়ী ঠিকানা", bnAddress(e, "perm")],
                    ["৬. বর্তমান ঠিকানা", bnAddress(e, "pres")],
                    ["৭. পদের নাম", desigBn(e)],
                    ["৮. শাখার নাম", secBn(e)],
                    ["৯. যোগদানের তারিখ", bnDate(e.joinDate)],
                    ["১০. আই.ডি নং", bn(e.empCode)],
                  ]}
                />
                <P>
                  আমি এতদ্বারা ঘোষণা করিতেছি যে, আমার মৃত্যু হইলে বা আমার অবর্তমানে, আমার অনুকূলে জমা ও বিভিন্ন খাতে প্রাপ্য টাকা গ্রহণের জন্য আমি নিম্নবর্ণিত ব্যক্তিকে/ ব্যক্তিগণকে মনোনয়ন দান করিতেছি এবং নির্দেশ দিচ্ছি যে, উক্ত টাকা নিম্ন বর্ণিত পদ্ধতিতে মনোনীত ব্যক্তিদের মধ্যে বন্টন করিতে হইবে।
                </P>
                <table className="dt mt-2 text-[12px]">
                  <thead>
                    <tr>
                      <th className="w-[38%]">মনোনীত ব্যক্তি বা ব্যক্তিদের নাম, ঠিকানা ও এন আইডি নং (নমিনির ছবি ও স্বাক্ষর শ্রমিক কর্তৃক সত্যায়িত)</th>
                      <th>সদস্যদের সহিত মনোনীত ব্যক্তিদের সম্পর্ক</th>
                      <th>বয়স</th>
                      <th colSpan={2}>প্রত্যেক মনোনীত ব্যক্তিকে প্রদেয় অংশ</th>
                    </tr>
                    <tr>
                      <th>১</th>
                      <th>২</th>
                      <th>৩</th>
                      <th colSpan={2}>৪</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(list.length ? list : [null]).map((n, ni) =>
                      heads.map((h, hi) => (
                        <tr key={`${ni}-${hi}`}>
                          {hi === 0 && (
                            <>
                              <td rowSpan={heads.length} className="align-top">
                                {n && (
                                  <>
                                    <div className="font-semibold">{nameBn(n)}</div>
                                    <div className="mt-1">{nb(n.addressBn, n.addressEn)}</div>
                                    <div className="mt-1">এনআইডিঃ {bn(n.nidNo)}</div>
                                  </>
                                )}
                              </td>
                              <td rowSpan={heads.length} className="center align-top">
                                {n ? nb(n.relationBn, n.relationEn) : ""}
                              </td>
                              <td rowSpan={heads.length} className="center align-top">
                                {n?.age ? bn(n.age) : ""}
                              </td>
                            </>
                          )}
                          <td>{h}</td>
                          <td className="center">{n ? `${bn(n.sharePercent)}%` : ""}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
                <P>
                  প্রত্যয়ন করিতেছি যে, আমার উপস্থিতিতে জনাব/জনাবা {list[0] ? nameBn(list[0]) : "....................."} কে নিম্ন স্বাক্ষরকারী শ্রমিক লিপিবদ্ধ বিবরণসমূহ পাঠ করিবার পর উক্ত ঘোষণা করিয়াছেন।
                </P>
                <div className="mt-4 flex items-end justify-between">
                  <PhotoBox label="মনোনীত ব্যক্তির ছবি (শ্রমিক কর্তৃক সত্যায়িত)" w={30} h={34} />
                  <div className="w-72 text-center text-[12px]">
                    <div className="border-t border-black pt-1">মনোনয়ন প্রদানকারী শ্রমিকের স্বাক্ষর ও টিপসহি</div>
                    <div>তারিখঃ {dateStr} ইং</div>
                  </div>
                </div>
                <div className="mt-12 flex items-end justify-between text-[12px]">
                  <div className="w-64 border-t border-black pt-1 text-center">তারিখসহ মনোনীত ব্যক্তির স্বাক্ষর ও টিপসহি</div>
                  <div className="w-64 text-center">
                    <div className="border-t border-black pt-1">মালিকের বা প্রাধিকারপ্রাপ্ত কর্মকর্তার স্বাক্ষর</div>
                    <div>তারিখঃ {dateStr} ইং</div>
                  </div>
                </div>
              </div>
            </Sheet>
          );
        }),
      };
    },
  },
  {
    slug: "id-card",
    group: "Personal File",
    title: "ID Card (Bangla & English)",
    titleBn: "পরিচয়পত্র — ফরম ৬",
    description: "Photo identity card with all Form 6 particulars (s.5, Rule 19(5)), front and back, four employees per A4 landscape page.",
    perm: "reports.hr",
    batch: 200,
    filters: ["format", ...DOC_FILTERS],
    formats: [
      { value: "bn", label: "Bangla" },
      { value: "en", label: "English" },
    ],
    async run(f, { company }) {
      const emps = takeBatch(f, await loadEmployees(f));
      const bnF = f.format !== "en";
      const perPage = 4;
      const chunks = Array.from({ length: Math.ceil(emps.length / perPage) }, (_, i) => emps.slice(i * perPage, i * perPage + perPage));
      return {
        title: "ID Card",
        ...pages(f, chunks, (chunk, last) => (
          <Sheet key={chunk[0].id} layout="a4l" last={last}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              {chunk.map((e) => (
                <div key={e.id} className="flex gap-2">
                  <IdFront e={e} company={company} bnF={bnF} />
                  <IdBack e={e} company={company} bnF={bnF} />
                </div>
              ))}
            </div>
          </Sheet>
        )),
      };
    },
  },
  {
    slug: "confirmation-letter",
    group: "Personal File",
    title: "Confirmation Letter",
    titleBn: "চাকুরী স্থায়ীকরণ পত্র",
    description: "Letter confirming the employee after the probation period (s.4) with probation vs. confirmed salary.",
    perm: "reports.hr",
    batch: 100,
    filters: [...DOC_FILTERS],
    async run(f, { company }) {
      const emps = await loadEmployees(f);
      const hist = await inChunks(emps.map((e) => e.id), (slice) => prisma.salaryHistory.findMany({ where: { employeeId: { in: slice } }, include: { designation: true, grade: true }, orderBy: { effectiveDate: "asc" } }));
      return {
        title: "Confirmation Letter",
        ...pages(f, emps, (e, last) => {
          const months = e.empType === "WORKER" ? company.probationWorkerMonths : company.probationStaffMonths;
          const confirm = e.confirmDate ?? e.probationEnd ?? addDays(e.joinDate, months * 30);
          const mine = hist.filter((h) => h.employeeId === e.id);
          const before = mine.filter((h) => h.effectiveDate <= addDays(confirm, -1)).pop() ?? mine[0];
          const after = mine.filter((h) => h.effectiveDate <= confirm).pop() ?? before;
          const b = before ?? e, a = after ?? e;
          const dB = before?.designation ? nb(before.designation.nameBn, before.designation.nameEn) : desigBn(e);
          const dA = after?.designation ? nb(after.designation.nameBn, after.designation.nameEn) : desigBn(e);
          const inc = round2(a.gross - b.gross);
          return (
            <Sheet key={e.id} last={last}>
              <BnLetterHead company={company} />
              <div className="border-t border-black pt-3 text-center font-bn">
                <Boxed>ব্যক্তিগত এবং গোপনীয় চিঠি</Boxed>
              </div>
              <div className="mt-3 text-right font-bn text-[13px]">তারিখ : {bnDate(confirm)}</div>
              <ToBlock e={e} />
              <P className="mt-4 text-center font-semibold">বিষয়ঃ চাকুরী স্থায়ী করণ প্রসঙ্গে।</P>
              <P>জনাব/জনাবা,</P>
              <P>
                আপনার কর্মদক্ষতা ও যোগ্যতা নীরিক্ষান্তে {bnDate(e.joinDate)} ইং তারিখ হইতে {bn(months)} মাস প্রবেশনকাল সন্তোষজনকভাবে সমাপ্ত হওয়ায় কর্তৃপক্ষ আপনাকে অভিনন্দন জানাচ্ছে এবং {bnDate(confirm)} ইং তারিখ হইতে আপনার চাকুরী স্থায়ী করার সিদ্ধান্ত নিয়েছেন। স্থায়ীকরণের পর আপনার বেতন/মজুরী কাঠামো নিম্নরূপঃ
              </P>
              <SalaryTable
                cols={[
                  salCol("প্রবেশনকালের বেতন", dB, before?.grade ? bn(before.grade.code) : e.grade ? bn(e.grade.code) : "", b, e.otEligible ? otRate(b.basic, company) : 0),
                  salCol("স্থায়ীকরণের পর", dA, after?.grade ? bn(after.grade.code) : e.grade ? bn(e.grade.code) : "", a, e.otEligible ? otRate(a.basic, company) : 0),
                ]}
              />
              <P>বর্ধিত বেতন/মজুরীঃ {inc > 0 ? `${bnMoney(inc, false)} টাকা` : "প্রযোজ্য নহে"}</P>
              <P>আশা করছি চাকুরীর স্থায়ীকরণ আপনাকে অনুপ্রাণিত করবে এবং কর্মক্ষেত্রে অধিক মনোযোগী হওয়ার উৎসাহ যোগাবে। আমাদের কোম্পানীতে আপনার উত্তরোত্তর সুখী ও সমৃদ্ধি কামনা করছি।</P>
              <P className="mt-4">ধন্যবাদান্তে</P>
              <div className="mt-12 w-60 border-t border-black pt-1 font-bn text-[13px]">কর্তৃপক্ষ</div>
              <P className="mt-6 text-[12px]">
                অনুলিপি :<br />১. হিসাব বিভাগ/ব্যক্তিগত নথি/অফিস কপি
              </P>
            </Sheet>
          );
        }),
      };
    },
  },
  {
    slug: "increment-letter",
    group: "Increment",
    title: "Increment & Promotion Letter",
    titleBn: "বাৎসরিক বেতন বৃদ্ধি / পদোন্নতি পত্র",
    description: "Letter for an approved or applied increment / promotion with old and revised salary structure.",
    perm: "reports.hr",
    batch: 100,
    filters: [...DOC_FILTERS],
    async run(f, { company }) {
      const incId = Number(f.param("inc")) || null;
      const where = incId ? { id: incId } : { status: { in: ["APPROVED", "APPLIED"] }, employee: employeeWhere(f.emp, { defaultStatus: "ALL" }) };
      const incs = await prisma.increment.findMany({
        where,
        include: { employee: { include: { department: true, section: true, designation: true, grade: true, line: true, floor: true, machineType: true, shift: true } }, oldDesignation: true, newDesignation: true, oldGrade: true, newGrade: true },
        orderBy: [{ employee: { empCode: "asc" } }, { effectiveDate: "desc" }],
      });
      const latest = incId ? incs : incs.filter((i, k) => k === 0 || incs[k - 1].employeeId !== i.employeeId);
      return {
        title: "Increment Letter",
        ...pages(f, 
          latest,
          (i, last) => {
            const e = i.employee as EmpRow;
            const promo = i.oldDesignationId !== i.newDesignationId || i.oldGradeId !== i.newGradeId;
            return (
              <Sheet key={i.id} last={last}>
                <BnLetterHead company={company} />
                <div className="border-t border-black pt-3 text-center font-bn">
                  <Boxed>ব্যক্তিগত এবং গোপনীয় চিঠি</Boxed>
                </div>
                <div className="mt-3 text-right font-bn text-[13px]">ইস্যুর তারিখ : {bnDate(addDays(i.effectiveDate, -1))}</div>
                <ToBlock e={e} extra={[["যোগদান", bnDate(e.joinDate)]]} />
                <P className="mt-4 font-semibold">বিষয়: {promo ? "পদোন্নতি ও বেতন/মজুরী বৃদ্ধি প্রসঙ্গে।" : "বাৎসরিক বেতন/মজুরী বৃদ্ধি প্রসঙ্গে।"}</P>
                <P>জনাব/জনাবা,</P>
                <P>
                  কর্তৃপক্ষ আনন্দের সাথে জানাচ্ছে যে, আপনার কাজের মূল্যায়ন এবং পাশাপাশি কোম্পানীর লক্ষ্য অর্জনে আপনার অবদান ও আনুগত্য বিবেচনা করে আপনাকে {promo ? "পদোন্নতি সহ " : ""}বেতন/মজুরী <b>{bnMoney(i.amount, false)}</b> টাকা বৃদ্ধি করেছেন যা আগামী {bnDate(i.effectiveDate)} ইং তারিখ হতে কার্যকর করা হবে :
                </P>
                <SalaryTable
                  cols={[
                    salCol("বেতন কাঠামো", nb(i.oldDesignation.nameBn, i.oldDesignation.nameEn), i.oldGrade ? bn(i.oldGrade.code) : "", { basic: i.oldBasic, houseRent: i.oldHouseRent, medical: i.oldMedical, transport: i.oldTransport, food: i.oldFood, gross: i.oldGross }, e.otEligible ? otRate(i.oldBasic, company) : 0),
                    salCol("পরিবর্তিত বেতন কাঠামো", nb(i.newDesignation.nameBn, i.newDesignation.nameEn), i.newGrade ? bn(i.newGrade.code) : "", { basic: i.newBasic, houseRent: i.newHouseRent, medical: i.newMedical, transport: i.newTransport, food: i.newFood, gross: i.newGross }, e.otEligible ? otRate(i.newBasic, company) : 0),
                  ]}
                />
                <P>আশা করছি এই নতুন বেতন/মজুরী কাঠামো আপনাকে অনুপ্রাণিত করবে এবং কর্মক্ষেত্রে অধিক মনোযোগী হওয়ার উৎসাহ যোগাবে।</P>
                <P className="mt-4">ধন্যবাদান্তে</P>
                <div className="mt-12 w-72 border-t border-black pt-1 font-bn text-[13px]">{company.hrHeadDesignation ? "ব্যবস্থাপক (মানব সম্পদ ও কমপ্লায়েন্স)" : "কর্তৃপক্ষ"}</div>
                <P className="mt-6 text-[12px]">
                  অনুলিপি :<br />১. হিসাব বিভাগ/ব্যক্তিগত নথি/অফিস কপি
                </P>
              </Sheet>
            );
          },
          "No approved or applied increment for the selected employees.",
        ),
      };
    },
  },
  {
    slug: "leave-application",
    group: "Personal File",
    title: "Leave Application Letter",
    titleBn: "ছুটির আবেদনপত্র",
    description: "Leave application form, pre-filled from a recorded application or blank for the employee to complete.",
    perm: "reports.hr",
    batch: 100,
    filters: [...DOC_FILTERS],
    async run(f, { company, today }) {
      const appId = Number(f.param("app")) || null;
      const app = appId ? await prisma.leaveApplication.findUnique({ where: { id: appId }, include: { leaveType: true } }) : null;
      const emps = app ? await loadEmployees({ ...f, emp: { emp: undefined, status: "ALL" } }, { id: app.employeeId }, "ALL") : await loadEmployees(f);
      const bal = await leaveBalances(prisma, emps.map((e) => e.id), (app?.fromDate ?? today).getUTCFullYear(), app?.fromDate ?? today);
      return {
        title: "Leave Application",
        ...pages(f, emps, (e, last) => {
          const b = bal.get(e.id) ?? [];
          const line = "..............................";
          return (
            <Sheet key={e.id} last={last}>
              <BnLetterHead company={company} subtitle={<Boxed>ছুটির আবেদনপত্র</Boxed>} />
              <div className="font-bn text-[13px]">
                <div>বরাবর,</div>
                <div>ব্যবস্থাপক (মানব সম্পদ ও কমপ্লায়েন্স)</div>
                <div>{company.nameBn || company.nameEn}</div>
                <P className="font-semibold">বিষয়ঃ {app ? nb(app.leaveType.nameBn, app.leaveType.nameEn) : "নৈমিত্তিক / অসুস্থতাজনিত / অর্জিত / মাতৃত্বকালীন"} ছুটির জন্য আবেদন।</P>
                <P>জনাব,</P>
                <P>
                  সবিনয় নিবেদন এই যে, আমি নিম্নস্বাক্ষরকারী {app?.reason || line} কারণে আগামী {app ? bnDate(app.fromDate) : line} ইং তারিখ হইতে {app ? bnDate(app.toDate) : line} ইং তারিখ পর্যন্ত মোট {app ? bn(app.days) : "........"} দিন ছুটি প্রয়োজন। অতএব, উক্ত ছুটি মঞ্জুর করিতে আপনার সদয় মর্জি হয়।
                </P>
                <div className="mt-4">
                  <FieldLines
                    labelWidth="40mm"
                    items={[
                      ["নাম", nameBn(e)],
                      ["আইডি নং", bn(e.empCode)],
                      ["পদবী", desigBn(e)],
                      ["সেকশন", secBn(e)],
                      ["যোগদানের তারিখ", bnDate(e.joinDate)],
                      ["ছুটিকালীন ঠিকানা ও মোবাইল", `${bnAddress(e, "perm")}; ${bn(e.mobile)}`],
                    ]}
                  />
                </div>
                <table className="dt mt-4 text-[12px]">
                  <thead>
                    <tr>
                      <th>ছুটির ধরন</th>
                      <th>প্রাপ্য / অর্জিত</th>
                      <th>ভোগকৃত</th>
                      <th>অবশিষ্ট</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.filter((x) => x.accrual !== "NONE").map((x) => (
                      <tr key={x.code}>
                        <td>{nb(x.nameBn, x.nameEn)}</td>
                        <td className="center">{bn(x.entitlement)}</td>
                        <td className="center">{bn(x.availed)}</td>
                        <td className="center">{bn(x.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-14 flex justify-between text-[12px]">
                  <div className="text-center">
                    <div className="border-t border-black px-4 pt-1">আবেদনকারীর স্বাক্ষর</div>
                    <div>তারিখঃ {app ? bnDate(app.appliedOn) : "............"}</div>
                  </div>
                  <div className="border-t border-black px-4 pt-1">সুপারভাইজার / বিভাগীয় প্রধান</div>
                  <div className="border-t border-black px-4 pt-1">মানব সম্পদ বিভাগ</div>
                </div>
                <div className="mt-6 border border-black p-2 text-[12px]">
                  অফিস কর্তৃক পূরণীয়ঃ ছুটি মঞ্জুর / নামঞ্জুর {app?.status === "APPROVED" ? "— মঞ্জুরকৃত" : app?.status === "REJECTED" ? "— নামঞ্জুর" : ""}। মঞ্জুরকৃত দিনঃ {app?.status === "APPROVED" ? bn(app.days) : "........"} ; তারিখঃ {app?.decidedAt ? bnDate(app.decidedAt) : "............"}
                  <div className="mt-8 text-right">অনুমোদনকারীর স্বাক্ষর</div>
                </div>
              </div>
            </Sheet>
          );
        }),
      };
    },
  },
  {
    slug: "service-book",
    group: "Personal File",
    title: "Service Book",
    titleBn: "সার্ভিস বহি — ফরম ৭",
    description: "Statutory service book (s.6, Labour Rules r.20–22, Form 7): identity, employment, service & wage record, leave record and conduct record.",
    perm: "reports.hr",
    batch: 50,
    filters: [...DOC_FILTERS],
    async run(f, { company }) {
      const emps = await loadEmployees(f);
      const ids = emps.map((e) => e.id);
      const [hist, seps, apps, enc] = await Promise.all([
        inChunks(ids, (slice) => prisma.salaryHistory.findMany({ where: { employeeId: { in: slice } }, include: { designation: true }, orderBy: { effectiveDate: "asc" } })),
        prisma.separation.findMany({ where: { employeeId: { in: ids } } }),
        inChunks(ids, (slice) => prisma.leaveApplication.findMany({ where: { employeeId: { in: slice }, status: "APPROVED", leaveType: { code: "EL" } }, orderBy: { fromDate: "asc" } })),
        prisma.elEncashLine.findMany({ where: { employeeId: { in: ids }, run: { status: "POSTED" } }, include: { run: true } }),
      ]);
      const th = "border border-black px-1 py-0.5 text-center font-semibold";
      const td = "border border-black px-1 py-0.5";
      return {
        title: "Service Book",
        ...pages(f, emps, (e, last) => {
          const sep = seps.find((s) => s.employeeId === e.id);
          return (
            <Sheet key={e.id} last={last}>
              <div className="font-bn text-[11.5px]">
                <div className="text-center">
                  <div className="text-[13px] font-semibold">বাংলাদেশ শ্রম বিধিমালা-২০১৫, বিধি-২০ ও ২২</div>
                  <div>ফরম-৭</div>
                  <div className="text-[16px] font-bold">সার্ভিস বহি</div>
                </div>
                <div className="mt-2 flex justify-between">
                  <span>ফরম নং -৭(ক)</span>
                  <span className="font-semibold">প্রথম ভাগ — শ্রমিককে সনাক্তকরণের তথ্য</span>
                  <span>১</span>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <FieldLines
                      labelWidth="62mm"
                      items={[
                        ["০১। শ্রমিকের নাম", nameBn(e)],
                        ["০২। পিতার নাম", nb(e.fatherBn, e.fatherEn)],
                        ["০৩। মাতার নাম", nb(e.motherBn, e.motherEn)],
                        ["০৪। স্বামী/স্ত্রী নাম (প্রযোজ্য ক্ষেত্রে)", nb(e.spouseBn, e.spouseEn)],
                        ["০৫। স্থায়ী ঠিকানা", bnAddress(e, "perm")],
                        ["০৬। বর্তমান ঠিকানা", bnAddress(e, "pres")],
                        ["০৭। জন্ম তারিখ/বয়স", bnDate(e.dob)],
                        ["০৮। জাতীয় পরিচয়পত্র নং (যদি থাকে)", bn(e.nidNo)],
                        ["০৯। শিক্ষাগত যোগ্যতা", nb(e.educationBn, e.educationEn)],
                        ["১০। প্রশিক্ষণ/বিশেষ দক্ষতা (যদি থাকে)", e.machineType?.nameEn ?? ""],
                        ["১১। উচ্চতা", e.heightCm ? `${bn(e.heightCm)} সেঃ মিঃ` : ""],
                        ["১২। রক্তের গ্রুপ (যদি থাকে)", e.bloodGroup],
                        ["১৩। সনাক্ত করার জন্য বিশেষ কোন চিহ্ন (যদি থাকে)", nb(e.identMarkBn, e.identMarkEn)],
                        ["১৪। সার্ভিস বুক খোলার তারিখ", bnDate(e.serviceBookDate)],
                        ["১৫। বাম হাতের বৃদ্ধাঙ্গুলের ছাপ", ""],
                      ]}
                    />
                  </div>
                  <PhotoBox src={photo(e)} w={24} h={28} />
                </div>
                <div className="mt-4 flex justify-between">
                  <span>শ্রমিকের স্বাক্ষর:</span>
                  <span>মালিক/ব্যবস্থাপনা কর্তৃপক্ষের স্বাক্ষর</span>
                </div>
                <div className="mt-3 flex justify-between">
                  <span>ফরম নং -৭(খ)</span>
                  <span className="font-semibold">দ্বিতীয় ভাগ — মালিকের ও চাকুরীর তথ্যসমূহ</span>
                  <span>২</span>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={th}>কারখানা/প্রতিষ্ঠানের নাম ও ঠিকানা</th>
                      <th className={th}>মালিক/ব্যবস্থাপনা কর্তৃপক্ষের নাম</th>
                      <th className={th}>যোগদানের তারিখ</th>
                      <th className={th}>চাকরি ত্যাগ / অবসানের তারিখ</th>
                      <th className={th}>ত্যাগ/অবসানের ধরন/কারণ</th>
                      <th className={th}>মালিক/প্রাধিকারপ্রাপ্ত ব্যক্তির স্বাক্ষর</th>
                      <th className={th}>শ্রমিকের স্বাক্ষর/টিপ সহি</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className={td}>
                        {company.nameBn || company.nameEn}
                        <br />
                        {company.addressBn || company.addressEn}
                      </td>
                      <td className={td}>{company.hrHeadName}</td>
                      <td className={`${td} text-center`}>{bnDate(e.joinDate)}</td>
                      <td className={`${td} text-center`}>{sep ? bnDate(sep.effectiveDate) : ""}</td>
                      <td className={td}>{sep ? label(SEPARATION_TYPES, sep.type, "bn") : ""}</td>
                      <td className={td} />
                      <td className={td} />
                    </tr>
                  </tbody>
                </table>
                <div className="mt-3 flex justify-between">
                  <span>ফরম নং -৭(গ)</span>
                  <span className="font-semibold">তৃতীয় ভাগ — সার্ভিস রেকর্ড ও মজুরি এবং ভাতা সংক্রান্ত তথ্যসমূহ</span>
                  <span>৩</span>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={th}>বর্তমান পদে চাকুরী আরম্ভের তারিখ</th>
                      <th className={th}>চাকুরীর পদ ও কার্ড নম্বর</th>
                      <th className={th}>মূল মজুরি</th>
                      <th className={th}>বাড়ী ভাড়া</th>
                      <th className={th}>চিকিৎসা</th>
                      <th className={th}>অন্যান্য ভাতা</th>
                      <th className={th}>মোট</th>
                      <th className={th}>মালিক/প্রাধিকারপ্রাপ্ত ব্যক্তির স্বাক্ষর</th>
                      <th className={th}>শ্রমিকের স্বাক্ষর/টিপ সহি</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hist.filter((h) => h.employeeId === e.id).map((h) => (
                      <tr key={h.id}>
                        <td className={`${td} text-center`}>{bnDate(h.effectiveDate)}</td>
                        <td className={td}>
                          {h.designation ? nb(h.designation.nameBn, h.designation.nameEn) : ""} / {bn(e.empCode)}
                        </td>
                        <td className={`${td} text-right`}>{bnMoney(h.basic, false)}</td>
                        <td className={`${td} text-right`}>{bnMoney(h.houseRent, false)}</td>
                        <td className={`${td} text-right`}>{bnMoney(h.medical, false)}</td>
                        <td className={`${td} text-right`}>{bnMoney(h.transport + h.food + h.otherAllowance, false)}</td>
                        <td className={`${td} text-right`}>{bnMoney(h.gross, false)}</td>
                        <td className={td} />
                        <td className={td} />
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 flex justify-between">
                  <span>ফরম নং -৭(ঘ)</span>
                  <span className="font-semibold">চতুর্থ ভাগ — ছুটির রেকর্ড</span>
                  <span>৪</span>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={th} colSpan={3}>ভোগকৃত বার্ষিক ছুটির বিবরণ</th>
                      <th className={th} colSpan={2}>নগদায়নকৃত ছুটির বিবরণ</th>
                      <th className={th}>মালিক/প্রাধিকারপ্রাপ্ত ব্যক্তির স্বাক্ষর</th>
                      <th className={th}>শ্রমিকের স্বাক্ষর/টিপ সহি</th>
                    </tr>
                    <tr>
                      <th className={th}>হইতে</th>
                      <th className={th}>পর্যন্ত</th>
                      <th className={th}>মোট</th>
                      <th className={th}>মোট</th>
                      <th className={th}>তারিখ</th>
                      <th className={th} />
                      <th className={th} />
                    </tr>
                  </thead>
                  <tbody>
                    {apps.filter((a) => a.employeeId === e.id).map((a) => (
                      <tr key={`a${a.id}`}>
                        <td className={`${td} text-center`}>{bnDate(a.fromDate)}</td>
                        <td className={`${td} text-center`}>{bnDate(a.toDate)}</td>
                        <td className={`${td} text-center`}>{bn(a.days)}</td>
                        <td className={td} />
                        <td className={td} />
                        <td className={td} />
                        <td className={td} />
                      </tr>
                    ))}
                    {enc.filter((x) => x.employeeId === e.id).map((x) => (
                      <tr key={`e${x.id}`}>
                        <td className={td} />
                        <td className={td} />
                        <td className={td} />
                        <td className={`${td} text-center`}>{bn(x.encashDays)}</td>
                        <td className={`${td} text-center`}>{bnDate(x.run.asOfDate)}</td>
                        <td className={td} />
                        <td className={td} />
                      </tr>
                    ))}
                    <tr>
                      {Array.from({ length: 7 }).map((_, k) => (
                        <td key={k} className={`${td} h-5`} />
                      ))}
                    </tr>
                  </tbody>
                </table>
                <div className="mt-3 flex justify-between">
                  <span>ফরম নং -৭(ঙ)</span>
                  <span className="font-semibold">পঞ্চম ভাগ — আচরণের রেকর্ড</span>
                  <span>৫</span>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={th}>তারিখ</th>
                      <th className={th}>আচরণ বিষয়ক বিবরণ</th>
                      <th className={th}>মালিক/প্রাধিকারপ্রাপ্ত ব্যক্তির স্বাক্ষর</th>
                      <th className={th}>শ্রমিকের স্বাক্ষর/টিপ সহি</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1].map((k) => (
                      <tr key={k}>
                        {Array.from({ length: 4 }).map((_, c) => (
                          <td key={c} className={`${td} h-5`} />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[10px]">বিধি ২১: অসদাচরণের অভিযোগ প্রমাণিত না হওয়া পর্যন্ত সার্ভিস বহিতে লিপিবদ্ধ করা যাইবে না। চূড়ান্ত পাওনা পরিশোধের তথ্য সার্ভিস বহিতে লিপিবদ্ধ করিতে হইবে (বিধি ২২(৭))।</p>
              </div>
            </Sheet>
          );
        }),
      };
    },
  },
  {
    slug: "final-settlement",
    group: "Personal File",
    title: "Final Settlement",
    description: "Final settlement bill for separated employees (service benefit, earned leave, notice, dues and deductions).",
    perm: "reports.hr",
    batch: 100,
    filters: ["emp", "org", "range"],
    defaults: { status: "ALL" },
    async run(f, { company }) {
      const codes = (f.emp.emp ?? "").split(/[\s,;]+/).filter(Boolean);
      const seps = await prisma.separation.findMany({
        where: codes.length ? { employee: { empCode: { in: codes } } } : { effectiveDate: { gte: f.from, lte: f.to }, employee: employeeWhere(f.emp, { defaultStatus: "ALL" }) },
        include: { employee: { include: { department: true, section: true, designation: true, grade: true } } },
        orderBy: { effectiveDate: "asc" },
      });
      return {
        title: "Final Settlement",
        ...pages(f, 
          seps,
          (s, last) => {
            const e = s.employee;
            const lines: [string, number][] = [
              [`Unpaid wages (${s.unpaidDays} days)`, s.unpaidSalary],
              [`Overtime (${s.unpaidOtHours} h)`, s.unpaidOtAmount],
              [`Service benefit / compensation (${s.serviceText}; ${s.benefitDays} days)`, s.serviceBenefit],
              [`Earned leave ${s.elDays} days`, s.elAmount],
              [`Wages in lieu of notice (${s.noticePayDays} days)`, s.noticePay],
              ["Others", s.otherAddition],
              [`Less: deduction for notice period (${s.noticeDeductDays} days)`, -s.noticeDeduction || 0],
              ["Less: advance / loan outstanding", -s.advanceDeduction || 0],
              ["Less: other deductions", -s.otherDeduction || 0],
            ];
            return (
              <Sheet key={s.id} last={last}>
                <EnLetterHead company={company} subtitle={<span className="font-semibold">Final Settlement Bill</span>} />
                <div className="text-right text-[12px]">Payment date: {s.paidOn ? dmy(s.paidOn) : "...................."}</div>
                <div className="mt-2 flex gap-6 text-[12px]">
                  <div className="flex-1">
                    <div className="mb-1 font-semibold">Employee information</div>
                    <table className="w-full">
                      <tbody>
                        {[
                          ["Name", e.nameEn],
                          ["Designation", e.designation.nameEn],
                          ["Card no.", e.empCode],
                          ["Department", e.department.nameEn],
                          ["Section", e.section.nameEn],
                          ["Joining date", dMonY(e.joinDate)],
                          ["Last working day", dMonY(s.effectiveDate)],
                          ["Separation", label(SEPARATION_TYPES, s.type)],
                          ["Grade", e.grade?.nameEn ?? ""],
                          ["Service length", s.serviceText],
                        ].map(([k, v]) => (
                          <tr key={k}>
                            <td className="w-32 py-0.5">{k}</td>
                            <td className="w-3">:</td>
                            <td>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="w-56">
                    <div className="mb-1 text-center font-semibold">Wages breakdown</div>
                    <table className="dt">
                      <tbody>
                        {[
                          ["Basic", e.basic], ["House rent", e.houseRent], ["Medical", e.medical], ["Conveyance", e.transport], ["Food", e.food], ["Total wages", s.gross],
                        ].map(([k, v]) => (
                          <tr key={k as string} className={k === "Total wages" ? "font-bold" : ""}>
                            <td>{k}</td>
                            <td className="num">{money(v as number, false)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <table className="dt mt-4 text-[12px]">
                  <thead>
                    <tr>
                      <th className="w-10">SL</th>
                      <th>Worker benefit — particulars</th>
                      <th className="w-32">Amount (Tk)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(([k, v], i) => (
                      <tr key={k}>
                        <td className="center">{i + 1}</td>
                        <td>{k}</td>
                        <td className="num">{v < 0 ? `(${money(-v)})` : money(v)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td colSpan={2} className="text-right">
                        Total payable amount
                      </td>
                      <td className="num">{money(s.netPayable, false)}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="mt-2 text-[12px] font-semibold">Amount in words: {enTakaWords(s.netPayable)}</div>
                {s.remarks && <div className="mt-1 text-[11px]">Remarks: {s.remarks}</div>}
                <Signatures labels={["Prepared by (Payroll)", "Head of HR / Admin", "Accounts", "Authority"]} />
                <div className="mt-6 font-bn text-[12px] leading-relaxed">
                  আমি উপরে বর্ণিত পাওনাদি ({bnTakaWords(s.netPayable)}) বুঝিয়া পাইয়া সুস্থ ও সজ্ঞানে নিম্নে স্বাক্ষর করিলাম। উপরোক্ত হিসাব আমাকে পড়িয়া শোনানো ও বুঝাইয়া দেওয়া হইয়াছে।
                </div>
                <div className="mt-12 w-56 border-t border-black pt-1 font-bn text-[12px]">শ্রমিকের স্বাক্ষর ও তারিখ</div>
                <p className="mt-3 text-[10px]">Dues are payable within 30 working days of separation (s.30). Record the payment in the service book (Rule 22(7)).</p>
              </Sheet>
            );
          },
          "No separations match — choose an employee or a date range of last working days.",
        ),
      };
    },
  },
  {
    slug: "lefty-letter",
    group: "Personal File",
    title: "Lefty Letter (1st, 2nd & 3rd)",
    titleBn: "অননুমোদিত অনুপস্থিতি — পত্র",
    description: "The three letters required by s.27(3A) for unauthorised absence: rejoin/explain within 10 days, 7 days for self-defence, deemed resignation.",
    perm: "reports.hr",
    batch: 100,
    filters: ["letter", "emp", "org"],
    defaults: { status: "ALL" },
    async run(f, { company, today }) {
      const caseId = Number(f.param("case")) || null;
      const cases = await prisma.leftyCase.findMany({
        where: caseId ? { id: caseId } : { status: { in: ["OPEN", "SEPARATED"] }, employee: employeeWhere(f.emp, { defaultStatus: "ALL" }) },
        include: { employee: { include: { department: true, section: true, designation: true, grade: true, line: true, floor: true, machineType: true, shift: true } } },
        orderBy: { absentFrom: "asc" },
      });
      const n = f.letter;
      return {
        title: `Lefty letter ${n}`,
        ...pages(f, 
          cases,
          (c, last) => {
            const e = c.employee as EmpRow;
            const date = (n === 1 ? c.letter1Date : n === 2 ? c.letter2Date : c.letter3Date) ?? today;
            const subj = n === 1 ? "চাকুরীতে যোগদান ও অনুপস্থিতির কারণ ব্যাখ্যা প্রদান প্রসঙ্গে।" : n === 2 ? "আত্মপক্ষ সমর্থনের সুযোগ প্রদান প্রসঙ্গে।" : "চাকুরী হইতে অব্যাহতি প্রসঙ্গে।";
            return (
              <Sheet key={c.id} last={last}>
                <BnLetterHead company={company} />
                <div className="flex justify-between border-t border-black pt-2 font-bn text-[13px]">
                  <span>সূত্রঃ এইচআর/লেফটি/{bn(e.empCode)}/{bn(n)}</span>
                  <span>তারিখঃ {bnDate(date)}</span>
                </div>
                <div className="mt-1 font-bn text-[12px] font-semibold">রেজিস্টার্ড ডাকযোগে (প্রাপ্তি স্বীকারপত্রসহ)</div>
                <ToBlock e={e} extra={[["বর্তমান ঠিকানা", bnAddress(e, "pres")], ["স্থায়ী ঠিকানা", bnAddress(e, "perm")]]} />
                <P className="mt-4 font-semibold">বিষয়ঃ {subj}</P>
                <P>জনাব/জনাবা,</P>
                {n === 1 && (
                  <P>
                    আপনি গত {bnDate(c.absentFrom)} ইং তারিখ হইতে কর্তৃপক্ষের অনুমতি ব্যতিরেকে কর্মস্থলে অনুপস্থিত রহিয়াছেন। বাংলাদেশ শ্রম আইন ২০০৬ এর ধারা ২৭(৩ক) অনুযায়ী এই পত্র প্রাপ্তির ১০ (দশ) দিনের মধ্যে আপনার অনুপস্থিতির কারণ লিখিতভাবে ব্যাখ্যা করিয়া কাজে যোগদান করিবার জন্য আপনাকে নির্দেশ দেওয়া যাইতেছে।
                  </P>
                )}
                {n === 2 && (
                  <P>
                    আপনি গত {bnDate(c.absentFrom)} ইং তারিখ হইতে কর্তৃপক্ষের অনুমতি ব্যতিরেকে কর্মস্থলে অনুপস্থিত রহিয়াছেন। গত {bnDate(c.letter1Date)} ইং তারিখে আপনার বর্তমান ও স্থায়ী ঠিকানায় রেজিস্টার্ড ডাকযোগে পত্র প্রেরণ করিয়া ১০ (দশ) দিনের মধ্যে অনুপস্থিতির কারণ ব্যাখ্যাসহ কাজে যোগদানের নির্দেশ দেওয়া হইয়াছিল, কিন্তু আপনি নির্ধারিত সময়ের মধ্যে কাজে যোগদান করেন নাই বা কোন ব্যাখ্যা প্রদান করেন নাই। তাই ধারা ২৭(৩ক) অনুযায়ী আত্মপক্ষ সমর্থনের জন্য আপনাকে আরও ৭ (সাত) দিন সময় দেওয়া হইল। এই সময়ের মধ্যে কাজে যোগদান অথবা আত্মপক্ষ সমর্থন না করিলে আপনি অনুপস্থিতির তারিখ হইতে চাকুরী হইতে অব্যাহতি গ্রহণ করিয়াছেন বলিয়া গণ্য হইবেন।
                  </P>
                )}
                {n === 3 && (
                  <P>
                    আপনি গত {bnDate(c.absentFrom)} ইং তারিখ হইতে কর্তৃপক্ষের অনুমতি ব্যতিরেকে কর্মস্থলে অনুপস্থিত রহিয়াছেন। এই বিষয়ে গত {bnDate(c.letter1Date)} ইং ও {bnDate(c.letter2Date)} ইং তারিখে রেজিস্টার্ড ডাকযোগে পত্র প্রেরণ করিয়া যথাক্রমে কাজে যোগদান ও আত্মপক্ষ সমর্থনের সুযোগ দেওয়া হইলেও আপনি কাজে যোগদান কিংবা আত্মপক্ষ সমর্থন করেন নাই। অতএব, বাংলাদেশ শ্রম আইন ২০০৬ এর ধারা ২৭(৩ক) অনুযায়ী {bnDate(c.absentFrom)} ইং তারিখ হইতে আপনি চাকুরী হইতে অব্যাহতি গ্রহণ করিয়াছেন বলিয়া গণ্য করা হইল। আইন অনুযায়ী আপনার প্রাপ্য পাওনাদি (যদি থাকে) যে কোন কর্মদিবসে অফিস চলাকালীন সময়ে মানব সম্পদ বিভাগ হইতে গ্রহণ করিবার জন্য অনুরোধ করা হইল।
                  </P>
                )}
                <div className="mt-14 w-72 border-t border-black pt-1 font-bn text-[13px]">
                  ব্যবস্থাপক (মানব সম্পদ ও কমপ্লায়েন্স)
                  <br />
                  {company.nameBn || company.nameEn}
                </div>
                <P className="mt-6 text-[12px]">
                  অনুলিপিঃ
                  <br />১. বর্তমান ঠিকানা (রেজিস্টার্ড ডাকযোগে)
                  <br />২. স্থায়ী ঠিকানা (রেজিস্টার্ড ডাকযোগে)
                  <br />৩. ব্যক্তিগত নথি / হিসাব বিভাগ
                </P>
              </Sheet>
            );
          },
          "No lefty case found — open one from Separation → Lefty cases.",
        ),
      };
    },
  },
  {
    slug: "lefty-envelope",
    group: "Personal File",
    title: "Lefty Envelop Print (Present & Permanent Address)",
    titleBn: "খাম প্রিন্ট",
    description: "Envelope addresses for registered post to the present and/or permanent address.",
    perm: "reports.hr",
    batch: 200,
    filters: ["address", "emp", "org"],
    defaults: { status: "ALL" },
    async run(f, { company }) {
      const caseId = Number(f.param("case")) || null;
      let emps: EmpRow[];
      if (caseId) {
        const c = await prisma.leftyCase.findUnique({ where: { id: caseId } });
        emps = c ? await loadEmployees({ ...f, emp: { status: "ALL" } }, { id: c.employeeId }, "ALL") : [];
      } else {
        const open = await prisma.leftyCase.findMany({ where: { status: "OPEN" }, select: { employeeId: true } });
        emps = f.emp.emp ? await loadEmployees(f, {}, "ALL") : await loadEmployees(f, { id: { in: open.map((o) => o.employeeId) } }, "ALL");
      }
      const items = emps.flatMap((e) => (f.address === "both" ? (["pres", "perm"] as const) : ([f.address as "pres" | "perm"])).map((w) => ({ e, w })));
      const chunks = Array.from({ length: Math.ceil(items.length / 2) }, (_, i) => items.slice(i * 2, i * 2 + 2));
      return {
        title: "Envelopes",
        ...pages(f, 
          chunks,
          (chunk, last) => (
            <Sheet key={`${chunk[0].e.id}${chunk[0].w}`} last={last}>
              {chunk.map(({ e, w }) => (
                <div key={`${e.id}${w}`} className="relative mb-6 flex h-[125mm] flex-col justify-between border border-dashed border-neutral-400 p-6 font-bn">
                  <div className="text-[13px] font-semibold">রেজিস্টার্ড ডাক — প্রাপ্তি স্বীকারপত্রসহ</div>
                  <div className="ml-auto w-[60%] text-[15px] leading-relaxed">
                    <div className="text-[12px]">প্রাপক,</div>
                    <div className="font-bold">{nameBn(e)}</div>
                    <div>পিতাঃ {nb(e.fatherBn, e.fatherEn)}</div>
                    <div>আইডি নং: {bn(e.empCode)}, {desigBn(e)}</div>
                    <div>{bnAddress(e, w)}</div>
                    <div className="text-[12px]">({w === "pres" ? "বর্তমান ঠিকানা" : "স্থায়ী ঠিকানা"})</div>
                  </div>
                  <div className="w-[55%] text-[12px]">
                    <div>প্রেরক,</div>
                    <div className="font-semibold">মানব সম্পদ বিভাগ, {company.nameBn || company.nameEn}</div>
                    <div>{company.addressBn || company.addressEn}</div>
                    {company.phone && <div>ফোনঃ {bn(company.phone)}</div>}
                  </div>
                </div>
              ))}
            </Sheet>
          ),
          "No employees — open a lefty case or enter employee IDs.",
        ),
      };
    },
  },
  {
    slug: "show-cause",
    group: "Personal File",
    title: "Date Range Absent Report (For Show Cause)",
    titleBn: "কারণ দর্শানোর নোটিশ",
    description: "Employees absent without leave in a period, as a list or as show-cause letters (s.23(4), s.24: at least 7 days to explain).",
    perm: "reports.hr",
    batch: 100,
    filters: ["range", "format", "minDays", "org"],
    formats: [
      { value: "list", label: "Absent list" },
      { value: "letters", label: "Show-cause letters (Bangla)" },
    ],
    async run(f, { company, today }) {
      const days = await prisma.attendanceDay.findMany({
        where: { date: { gte: f.from, lte: f.to }, status: "ABSENT", employee: employeeWhere(f.emp) },
        include: { employee: { include: { department: true, section: true, designation: true, grade: true, line: true, floor: true, machineType: true, shift: true } } },
        orderBy: [{ employee: { department: { sortOrder: "asc" } } }, { employee: { empCode: "asc" } }, { date: "asc" }],
      });
      const by = new Map<number, typeof days>();
      for (const d of days) by.set(d.employeeId, [...(by.get(d.employeeId) ?? []), d]);
      const minDays = Math.max(1, f.minDays || 3);
      const list = [...by.values()].filter((l) => l.length >= minDays);
      if (f.format === "letters") {
        return {
          title: "Show-cause letters",
          ...pages(f, list, (l, last) => {
            const e = l[0].employee as EmpRow;
            return (
              <Sheet key={e.id} last={last}>
                <BnLetterHead company={company} />
                <div className="flex justify-between border-t border-black pt-2 font-bn text-[13px]">
                  <span>সূত্রঃ এইচআর/কারণ দর্শানো/{bn(e.empCode)}</span>
                  <span>তারিখঃ {bnDate(today)}</span>
                </div>
                <ToBlock e={e} />
                <P className="mt-4 font-semibold">বিষয়ঃ কারণ দর্শানোর নোটিশ।</P>
                <P>জনাব/জনাবা,</P>
                <P>
                  আপনি {bnDate(f.from)} ইং হইতে {bnDate(f.to)} ইং তারিখ পর্যন্ত সময়ে নিম্নবর্ণিত {bn(l.length)} দিন কর্তৃপক্ষের অনুমতি ব্যতিরেকে কর্মস্থলে অনুপস্থিত ছিলেনঃ {l.map((d) => bnDate(d.date)).join(", ")}।
                </P>
                <P>
                  বিনা অনুমতিতে অনুপস্থিতি বাংলাদেশ শ্রম আইন ২০০৬ এর ধারা ২৩(৪) অনুযায়ী অসদাচরণ হিসাবে গণ্য হইতে পারে। অতএব, কেন আপনার বিরুদ্ধে আইনানুগ ব্যবস্থা গ্রহণ করা হইবে না তাহার কারণ এই নোটিশ প্রাপ্তির ৭ (সাত) দিনের মধ্যে লিখিতভাবে দর্শাইবার জন্য আপনাকে নির্দেশ দেওয়া হইল (ধারা ২৪)। আপনার বক্তব্য শোনার পরেই কর্তৃপক্ষ পরবর্তী সিদ্ধান্ত গ্রহণ করিবেন।
                </P>
                <div className="mt-14 w-72 border-t border-black pt-1 font-bn text-[13px]">ব্যবস্থাপক (মানব সম্পদ ও কমপ্লায়েন্স)</div>
                <div className="mt-10 w-72 border-t border-black pt-1 font-bn text-[12px]">প্রাপ্তি স্বীকারঃ শ্রমিকের স্বাক্ষর ও তারিখ</div>
              </Sheet>
            );
          }),
        };
      }
      return {
        title: "Date Range Absent Report (for Show Cause)",
        subtitle: `${dmy(f.from)} – ${dmy(f.to)} · absent ${minDays}+ days without leave`,
        table: {
          serial: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "n", label: "Days absent", fmt: "int", total: true },
            { key: "dates", label: "Dates" }, { key: "mobile", label: "Mobile" },
          ],
          groups: groupBy(list, (l) => secTitle(l[0].employee), (l) => ({
            code: l[0].employee.empCode, name: l[0].employee.nameEn, desig: l[0].employee.designation.nameEn, n: l.length,
            dates: compactDates(l.map((d) => d.date)), mobile: l[0].employee.mobile,
          })),
        },
      };
    },
  },
  {
    slug: "maternity-benefit",
    group: "Personal File",
    title: "Maternity Benefit Statement",
    titleBn: "মাতৃত্বকালীন সুবিধা প্রদানের হিসাব",
    description: "Calculation and payment record of the maternity benefit (ss.45–50).",
    perm: "reports.hr",
    batch: 100,
    filters: ["emp"],
    defaults: { status: "ALL" },
    async run(f, { company }) {
      const caseId = Number(f.param("case")) || null;
      const codes = (f.emp.emp ?? "").split(/[\s,;]+/).filter(Boolean);
      const cases = await prisma.maternityCase.findMany({
        where: caseId ? { id: caseId } : codes.length ? { employee: { empCode: { in: codes } } } : {},
        include: { employee: { include: { designation: true, section: true } } },
        orderBy: { expectedDelivery: "desc" },
        take: caseId || codes.length ? undefined : 20,
      });
      return {
        title: "Maternity Benefit",
        ...pages(f, 
          cases,
          (c, last) => (
            <Sheet key={c.id} last={last}>
              <CompanyHeader company={company} bn title="মাতৃত্বকালীন সুবিধা প্রদানের হিসাব" subtitle="বাংলাদেশ শ্রম আইন ২০০৬, ধারা ৪৫–৫০" />
              <div className="font-bn text-[13px]">
                <FieldLines
                  labelWidth="62mm"
                  items={[
                    ["নাম", nameBn(c.employee)],
                    ["আইডি নং", bn(c.employee.empCode)],
                    ["পদবী / সেকশন", `${nb(c.employee.designation.nameBn, c.employee.designation.nameEn)} / ${nb(c.employee.section.nameBn, c.employee.section.nameEn)}`],
                    ["যোগদানের তারিখ", bnDate(c.employee.joinDate)],
                    ["নোটিশ প্রদানের তারিখ (ফরম ১৮)", bnDate(c.noticeDate)],
                    ["সম্ভাব্য প্রসবের তারিখ", bnDate(c.expectedDelivery)],
                    ["প্রকৃত প্রসবের তারিখ", c.actualDelivery ? bnDate(c.actualDelivery) : "—"],
                    ["ছুটির মেয়াদ", `${bnDate(c.leaveFrom)} হইতে ${bnDate(c.leaveTo)} (১১২ দিন)`],
                    ["প্রসবের পূর্বে চাকুরীর মেয়াদ", `${bn(c.serviceMonths)} মাস`],
                    ["জীবিত সন্তান সংখ্যা", bn(c.survivingChildren)],
                    ["পূর্ববর্তী ৩ মাসের মোট মজুরী", `${bnMoney(c.wages3m)} টাকা`],
                    ["উক্ত সময়ে প্রকৃত কর্মদিবস", bn(c.daysWorked3m)],
                    ["দৈনিক গড় মজুরী (ধারা ৪৮)", `${bnMoney(c.avgDailyWage)} টাকা`],
                  ]}
                />
                {c.benefitEligible ? (
                  <table className="dt mt-4">
                    <thead>
                      <tr>
                        <th>কিস্তি</th>
                        <th>দিন</th>
                        <th>টাকা</th>
                        <th>পরিশোধের তারিখ</th>
                        <th>স্বাক্ষর</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>প্রথম কিস্তি (প্রসবের পূর্বে)</td>
                        <td className="center">৫৬</td>
                        <td className="num">{bnMoney(c.firstInstallment)}</td>
                        <td className="center">{c.firstPaidOn ? bnDate(c.firstPaidOn) : ""}</td>
                        <td />
                      </tr>
                      <tr>
                        <td>দ্বিতীয় কিস্তি (প্রসবের পরে)</td>
                        <td className="center">৫৬</td>
                        <td className="num">{bnMoney(c.secondInstallment)}</td>
                        <td className="center">{c.secondPaidOn ? bnDate(c.secondPaidOn) : ""}</td>
                        <td />
                      </tr>
                      <tr className="font-bold">
                        <td>মোট</td>
                        <td className="center">১১২</td>
                        <td className="num">{bnMoney(c.totalBenefit)}</td>
                        <td colSpan={2}>{bnTakaWords(c.totalBenefit)}</td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <P className="mt-4 font-semibold">আর্থিক সুবিধা প্রযোজ্য নহে — {c.remarks}। ছুটি প্রাপ্য।</P>
                )}
                <SigBlock left="শ্রমিকের স্বাক্ষর" center="হিসাব বিভাগ" right="ব্যবস্থাপক (মানব সম্পদ)" />
              </div>
            </Sheet>
          ),
          "No maternity case found.",
        ),
      };
    },
  },
  {
    slug: "biometric-export",
    group: "Employee",
    title: "Excel Export File (Biometric BGMEA & BKMEA)",
    description: "Worker data in the column layout for the BGMEA / BKMEA worker (biometric) database upload. Use the Excel button to download.",
    perm: "reports.hr",
    filters: ["format", "org", "status"],
    formats: [
      { value: "BGMEA", label: "BGMEA worker database" },
      { value: "BKMEA", label: "BKMEA worker database" },
    ],
    async run(f) {
      const layout = BIOMETRIC_LAYOUTS[f.format] ?? BIOMETRIC_LAYOUTS.BGMEA;
      const emps = await prisma.employee.findMany({
        where: employeeWhere(f.emp),
        include: { designation: true, grade: true, section: true, department: true, machineType: true, separation: true },
        orderBy: { empCode: "asc" },
      });
      return {
        title: layout.title,
        subtitle: `${emps.length} workers — verify the column layout against the association's current template before uploading`,
        layout: "legall",
        table: {
          columns: layout.columns.map((c, i) => ({ key: `c${i}`, label: c.header, width: c.width })),
          groups: [{ rows: emps.map((e) => Object.fromEntries(layout.columns.map((c, i) => [`c${i}`, c.value(e)]))) }],
          grandTotal: false,
          excelPlain: true,
        },
      };
    },
  },
];

function compactDates(dates: Date[]): string {
  const out: string[] = [];
  let start = dates[0], prev = dates[0];
  for (let i = 1; i <= dates.length; i++) {
    const d = dates[i];
    if (d && diffDays(prev, d) === 1) {
      prev = d;
      continue;
    }
    out.push(start === prev ? `${start.getUTCDate()}/${start.getUTCMonth() + 1}` : `${start.getUTCDate()}–${prev.getUTCDate()}/${prev.getUTCMonth() + 1}`);
    start = d;
    prev = d;
  }
  return out.join(", ");
}

function Barcode({ text, height = 24 }: { text: string; height?: number }) {
  const w = code128Width(text);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-[7mm] w-[40mm]" preserveAspectRatio="none" aria-label={`Barcode ${text}`}>
      <rect width={w} height={height} fill="#fff" />
      {code128Bars(text).map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="#000" />
      ))}
    </svg>
  );
}

const CARD = "relative flex h-[85.6mm] w-[54mm] flex-col overflow-hidden rounded-[3mm] border border-neutral-500 bg-white text-[8.5px] leading-tight";

function IdFront({ e, company, bnF }: { e: EmpRow; company: CompanyRow; bnF: boolean }) {
  const t = (b: string, en: string) => (bnF ? b : en);
  return (
    <div className={`${CARD} ${bnF ? "font-bn" : ""}`}>
      <div className="bg-[#1e338a] px-1.5 py-1 text-center text-white">
        <div className="text-[10px] font-bold">{bnF ? company.nameBn || company.nameEn : company.nameEn}</div>
        <div className="text-[7px]">{bnF ? company.addressBn || company.addressEn : company.addressEn}</div>
      </div>
      <div className="mt-1 text-center text-[9px] font-semibold">{t("পরিচয়পত্র", "IDENTITY CARD")}</div>
      <div className="mx-auto mt-1 flex h-[24mm] w-[20mm] items-center justify-center overflow-hidden border border-neutral-400">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {e.photoPath ? <img src={`/api/photo/${e.id}`} alt="" className="h-full w-full object-cover" /> : <span className="text-neutral-400">{t("ছবি", "Photo")}</span>}
      </div>
      <div className="mt-1 text-center text-[10px] font-bold">{bnF ? nameBn(e) : e.nameEn}</div>
      <div className="mt-1 space-y-[1px] px-2">
        <div>{t("পদবী", "Designation")}: {bnF ? desigBn(e) : e.designation.nameEn}</div>
        <div>{t("সেকশন", "Section")}: {bnF ? secBn(e) : e.section.nameEn}</div>
        <div className="font-semibold">{t("আইডি নং", "ID No.")}: {bnF ? bn(e.empCode) : e.empCode}</div>
        <div>{t("যোগদান", "Joined")}: {bnF ? bnDate(e.joinDate) : dmy(e.joinDate)}</div>
        <div>{t("রক্তের গ্রুপ", "Blood group")}: {e.bloodGroup}</div>
      </div>
      <div className="mt-auto flex justify-center">
        <Barcode text={e.empCode} />
      </div>
      <div className="mb-1 flex justify-between px-2 pt-2 text-[7px]">
        <span className="border-t border-black px-1">{t("শ্রমিকের স্বাক্ষর", "Holder's signature")}</span>
        <span className="border-t border-black px-1">{t("কর্তৃপক্ষের স্বাক্ষর", "Authorised signature")}</span>
      </div>
    </div>
  );
}

function IdBack({ e, company, bnF }: { e: EmpRow; company: CompanyRow; bnF: boolean }) {
  const t = (b: string, en: string) => (bnF ? b : en);
  const issue = e.idCardIssueDate ?? e.joinDate;
  return (
    <div className={`${CARD} px-2 py-2 ${bnF ? "font-bn" : ""}`}>
      <div className="space-y-[2px]">
        <div>{t("কার্ড নং", "Card no.")}: {bnF ? bn(e.empCode) : e.empCode}</div>
        <div>{t("ইস্যুর তারিখ", "Date of issue")}: {bnF ? bnDate(issue) : dmy(issue)}</div>
        <div>{t("মেয়াদ", "Validity")}: {t("চাকুরীকালীন", "During employment")}</div>
        <div>{t("কাজের ধরন", "Nature of work")}: {label(EMPLOYMENT_NATURE, e.employmentNature, bnF ? "bn" : "en")}</div>
        <div className="pt-1 font-semibold">{t("স্থায়ী ঠিকানা", "Permanent address")}:</div>
        <div>{bnF ? bnAddress(e, "perm") : enAddress(e, "perm")}</div>
        <div className="pt-1">{t("জরুরী যোগাযোগ", "Emergency contact")}: {bnF ? bn(e.emergencyPhone || e.mobile) : e.emergencyPhone || e.mobile}</div>
        <div>{t("জাতীয় পরিচয়পত্র নং", "NID no.")}: {bnF ? bn(e.nidNo) : e.nidNo}</div>
        <div>{t("রক্তের গ্রুপ", "Blood group")}: {e.bloodGroup}</div>
      </div>
      <div className="mt-2 border-t border-neutral-400 pt-1 text-[7.5px]">
        {t(
          "কার্ডটি হারাইয়া গেলে অবিলম্বে কর্তৃপক্ষকে জানাইতে হইবে। কেউ কার্ডটি পাইলে নিম্নের ঠিকানায় ফেরত দেওয়ার অনুরোধ রইল।",
          "If this card is lost, inform the management immediately. If found, please return it to the address below.",
        )}
      </div>
      <div className="mt-1 text-[7.5px]">
        <div className="font-semibold">{bnF ? company.nameBn || company.nameEn : company.nameEn}</div>
        <div>{bnF ? company.addressBn || company.addressEn : company.addressEn}</div>
        {company.phone && <div>{t("ফোন", "Phone")}: {bnF ? bn(company.phone) : company.phone}</div>}
      </div>
      <div className="mt-auto text-center text-[7px] text-neutral-600">{t("ফরম-৬ [ধারা ৫ ও বিধি ১৯(৫)]", "Form 6 [s.5, Rule 19(5)]")}</div>
    </div>
  );
}

