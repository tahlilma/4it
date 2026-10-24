// Initial data.
//   npm run setup                 → base data + a demo factory (≈150 employees, ~3 months of punches)
//   SEED_DEMO=0 npm run setup     → base data only (company, grades, leave types, teams, shifts, admin)
//   SEED_SCALE=35 npm run setup   → the demo with 35× the workers (≈5,000 people) — for load testing
// The seed never touches a database that already has a company unless SEED_FORCE=1 is set.

import "dotenv/config";
import bcrypt from "bcryptjs";
import { sqliteAdapter } from "../src/lib/sqlite";
import { PrismaClient } from "../src/generated/prisma/client";
import { addDays, addMinutes, addMonths, eachDay, endOfMonth, startOfMonth, todayLocal, utcDate, ymd, diffDays, maxDate } from "../src/lib/dates";
import { round2 } from "../src/lib/num";
import { incrementOnBasic, structureFromGross, type SalaryParts } from "../src/lib/engine/salary";
import { processAttendance } from "../src/lib/services/attendance";
import { processPayroll } from "../src/lib/services/payroll";
import { processBonus } from "../src/lib/services/bonus";
import { calculateSettlement } from "../src/lib/services/settlement";
import { generateIncrementProposals } from "../src/lib/services/increment";
import { computeMaternity } from "../src/lib/engine/maternity";

const db = new PrismaClient({ adapter: sqliteAdapter() });
const SCALE = Math.max(1, Math.floor(Number(process.env.SEED_SCALE) || 1));

// Deterministic pseudo-random numbers so the demo data is reproducible.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261022);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const chance = (p: number) => rnd() < p;

const COMPANY = {
  nameEn: "Sample Garments Ltd.",
  nameBn: "স্যাম্পল গার্মেন্টস লিঃ",
  addressEn: "Konabari, Gazipur Sadar, Gazipur",
  addressBn: "কোনাবাড়ি, গাজীপুর সদর, গাজীপুর",
};

async function wipe() {
  const order = [
    "payslip", "payrollRun", "advanceRecovery", "advance", "payAdjustment", "bonusLine", "bonusRun",
    "elEncashLine", "elEncashRun", "increment", "separation", "leftyCase", "maternityCase", "leaveApplication",
    "attendanceAdjust", "attendanceDay", "punchLog", "employeeDevice", "employeeTeam", "nominee", "salaryHistory",
    "employee", "manpowerBudget", "designation", "grade", "section", "department", "line", "floor", "machineType",
    "shift", "holiday", "leaveType", "team", "buyer", "device", "bankAccount", "session", "user", "auditLog", "company",
  ];
  for (const m of order) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)[m].deleteMany();
  }
}

async function seedBase(demo: boolean) {
  await db.company.create({
    data: {
      ...(demo ? COMPANY : { nameEn: "Your Company Ltd.", nameBn: "", addressEn: "", addressBn: "" }),
      phone: demo ? "+880 1700-000000" : "",
      licenseNo: demo ? "DIFE/GAZ/12345" : "",
      bgmeaRegNo: demo ? "BGMEA-0000" : "",
      hrHeadName: demo ? "Md. Kamrul Hasan" : "",
      hrHeadDesignation: "Manager (HR & Compliance)",
    },
  });

  // 2023 RMG minimum-wage gazette (effective 1 Dec 2023). Update after each annual increment / new gazette.
  const grades: [string, string, string, number, number][] = [
    ["1", "Grade-1", "গ্রেড-১", 15035, 8390],
    ["2", "Grade-2", "গ্রেড-২", 14273, 7882],
    ["3", "Grade-3", "গ্রেড-৩", 13550, 7400],
    ["4", "Grade-4", "গ্রেড-৪", 12500, 6700],
    ["APP", "Apprentice", "শিক্ষাধীন", 9875, 4950],
  ];
  for (const [code, en, bn, gross, basic] of grades) {
    await db.grade.create({
      data: {
        code, nameEn: en, nameBn: bn, empType: "WORKER", minGross: gross, basic, houseRent: round2(gross - basic - 2450),
        medical: 750, transport: 450, food: 1250, sortOrder: grades.findIndex((g) => g[0] === code),
      },
    });
  }
  await db.grade.create({ data: { code: "STAFF", nameEn: "Staff", nameBn: "স্টাফ", empType: "STAFF", sortOrder: 10 } });

  const leaveTypes = [
    { code: "CL", nameEn: "Casual Leave", nameBn: "নৈমিত্তিক ছুটি", annualDays: 10, paid: true, accrual: "FIXED", proRata: true },
    { code: "SL", nameEn: "Sick Leave", nameBn: "অসুস্থতাজনিত ছুটি", annualDays: 14, paid: true, accrual: "FIXED", proRata: true },
    { code: "EL", nameEn: "Earned (Annual) Leave", nameBn: "অর্জিত (বাৎসরিক) ছুটি", annualDays: 0, paid: true, accrual: "EARNED", proRata: false },
    { code: "ML", nameEn: "Maternity Leave", nameBn: "মাতৃত্বকালীন ছুটি", annualDays: 112, paid: false, accrual: "NONE", proRata: false, gender: "FEMALE" },
    { code: "CO", nameEn: "Compensatory Leave", nameBn: "বিকল্প ছুটি", annualDays: 0, paid: true, accrual: "NONE", proRata: false },
    { code: "LWP", nameEn: "Leave Without Pay", nameBn: "বিনা বেতনে ছুটি", annualDays: 0, paid: false, accrual: "NONE", proRata: false },
  ];
  for (const [i, l] of leaveTypes.entries()) await db.leaveType.create({ data: { ...l, sortOrder: i } });

  const teams = [
    ["FIRE", "Fire Fighting Team", "অগ্নি নির্বাপণ দল"],
    ["FIRST_AID", "First Aid Team", "প্রাথমিক চিকিৎসা দল"],
    ["RESCUE", "Rescue Team", "উদ্ধারকারী দল"],
  ];
  for (const [i, [code, en, bn]] of teams.entries()) await db.team.create({ data: { code, nameEn: en, nameBn: bn, requiredPercent: 6, sortOrder: i } });

  await db.shift.create({ data: { code: "G", name: "General (08:00–17:00)", inTime: "08:00", outTime: "17:00" } });
  await db.shift.create({
    data: { code: "N", name: "Night (20:00–05:00)", inTime: "20:00", outTime: "05:00", tiffinAfter: "", nightAfter: "03:00" },
  });

  await db.user.create({ data: { username: "admin", name: "System Administrator", role: "ADMIN", passwordHash: await bcrypt.hash("admin123", 10) } });
}

// ───────────────────────────── demo factory ─────────────────────────────

const MALE: [string, string][] = [
  ["Rahim", "রহিম"], ["Karim", "করিম"], ["Jamal", "জামাল"], ["Kamal", "কামাল"], ["Rafiqul", "রফিকুল"], ["Shafiqul", "শফিকুল"],
  ["Habib", "হাবিব"], ["Nasir", "নাসির"], ["Jahid", "জাহিদ"], ["Sohel", "সোহেল"], ["Rubel", "রুবেল"], ["Masud", "মাসুদ"],
  ["Mizanur", "মিজানুর"], ["Alamgir", "আলমগীর"], ["Shahin", "শাহীন"], ["Hasan", "হাসান"], ["Sumon", "সুমন"], ["Liton", "লিটন"],
  ["Babul", "বাবুল"], ["Faruk", "ফারুক"], ["Monir", "মনির"], ["Raju", "রাজু"], ["Saiful", "সাইফুল"], ["Anisur", "আনিসুর"],
  ["Jewel", "জুয়েল"], ["Ripon", "রিপন"], ["Shamim", "শামীম"], ["Ramjan", "রমজান"], ["Hasain", "হাসাইন"], ["Onik", "অনিক"],
];
const MALE_LAST: [string, string][] = [["Islam", "ইসলাম"], ["Hossain", "হোসেন"], ["Uddin", "উদ্দিন"], ["Mia", "মিয়া"], ["Ahmed", "আহমেদ"], ["Rahman", "রহমান"], ["Ali", "আলী"], ["Sheikh", "শেখ"], ["Sarker", "সরকার"], ["Mollah", "মোল্লা"]];
const FEMALE: [string, string][] = [
  ["Rahima", "রহিমা"], ["Fatema", "ফাতেমা"], ["Ayesha", "আয়েশা"], ["Nasrin", "নাসরিন"], ["Shirin", "শিরিন"], ["Rina", "রিনা"],
  ["Shilpi", "শিল্পী"], ["Rupa", "রুপা"], ["Moriom", "মরিয়ম"], ["Jesmin", "জেসমিন"], ["Salma", "সালমা"], ["Rokeya", "রোকেয়া"],
  ["Sabina", "সাবিনা"], ["Kulsum", "কুলসুম"], ["Josna", "জোসনা"], ["Hasina", "হাসিনা"], ["Parvin", "পারভীন"], ["Shahnaz", "শাহনাজ"],
  ["Laboni", "লাবনী"], ["Mukta", "মুক্তা"], ["Sumi", "সুমি"], ["Bristy", "বৃষ্টি"], ["Taslima", "তাসলিমা"], ["Khadija", "খাদিজা"],
  ["Sathi", "সাথী"], ["Kobita", "কবিতা"], ["Sokina", "ছকিনা"], ["Moyna", "ময়না"], ["Tania", "তানিয়া"], ["Popy", "পপি"],
];
const FEMALE_LAST: [string, string][] = [["Akter", "আক্তার"], ["Begum", "বেগম"], ["Khatun", "খাতুন"], ["Sultana", "সুলতানা"], ["Nahar", "নাহার"]];
const HINDU_MALE: [string, string][] = [["Shyamal Das", "শ্যামল দাস"], ["Gopal Chandra Roy", "গোপাল চন্দ্র রায়"], ["Sujon Mondal", "সুজন মন্ডল"], ["Bikash Sarker", "বিকাশ সরকার"], ["Ratan Kumar Ghosh", "রতন কুমার ঘোষ"]];
const HINDU_FEMALE: [string, string][] = [["Shefali Rani", "শেফালী রানী"], ["Anjali Das", "অঞ্জলি দাস"], ["Puja Rani Roy", "পূজা রানী রায়"], ["Mitu Rani", "মিতু রানী"], ["Swapna Rani Sil", "স্বপ্না রানী শীল"]];
const DISTRICTS: [string, string][] = [
  ["Pabna", "পাবনা"], ["Sherpur", "শেরপুর"], ["Jamalpur", "জামালপুর"], ["Mymensingh", "ময়মনসিংহ"], ["Rangpur", "রংপুর"], ["Kurigram", "কুড়িগ্রাম"],
  ["Bogura", "বগুড়া"], ["Sirajganj", "সিরাজগঞ্জ"], ["Tangail", "টাঙ্গাইল"], ["Netrokona", "নেত্রকোনা"], ["Gaibandha", "গাইবান্ধা"], ["Bhola", "ভোলা"],
];
const VILLAGES: [string, string][] = [["Uttarpara", "উত্তরপাড়া"], ["Dakshinpara", "দক্ষিণপাড়া"], ["Charpara", "চরপাড়া"], ["Notun Bazar", "নতুন বাজার"], ["Mollah Bari", "মোল্লা বাড়ি"], ["Hajipur", "হাজীপুর"], ["Shibpur", "শিবপুর"], ["Kalibari", "কালীবাড়ি"]];
const LOCAL: [string, string][] = [["Konabari", "কোনাবাড়ি"], ["Kashimpur", "কাশিমপুর"], ["Zirani Bazar", "জিরানী বাজার"], ["Basan", "বাসন"], ["Kodda", "কড্ডা"]];
const EDU_WORKER: [string, string][] = [["Class Five", "পঞ্চম শ্রেণী"], ["Class Eight", "অষ্টম শ্রেণী"], ["SSC", "এসএসসি"], ["HSC", "এইচএসসি"]];
const MARKS: [string, string][] = [["Mole on left cheek", "বাম গালে তিল"], ["Scar on right hand", "ডান হাতে কাটা দাগ"], ["Mole on forehead", "কপালে তিল"], ["Scar on left eyebrow", "বাম ভ্রুতে কাটা দাগ"]];

async function seedDemo() {
  const company = await db.company.findFirstOrThrow();
  const today = todayLocal(company.tzOffsetMinutes);
  const yesterday = addDays(today, -1);
  const cy = today.getUTCFullYear();
  const cm = today.getUTCMonth() + 1;
  const prevMonth = addMonths(startOfMonth(cy, cm), -1);
  const dataStart = addMonths(startOfMonth(cy, cm), -2);

  // Users for each role (change these passwords!).
  for (const [username, name, role, pw] of [
    ["hr", "HR Manager", "HR_MANAGER", "hr123"],
    ["payroll", "Payroll Officer", "PAYROLL", "payroll123"],
    ["time", "Timekeeper", "TIMEKEEPER", "time123"],
    ["viewer", "Auditor (read only)", "VIEWER", "viewer123"],
  ] as const) {
    await db.user.create({ data: { username, name, role, passwordHash: await bcrypt.hash(pw, 10) } });
  }

  await db.bankAccount.create({ data: { bankName: "Sample Bank PLC", branch: "Konabari Branch", accountName: COMPANY.nameEn, accountNo: "0123-0210000456", routingNo: "123330456", address: "Konabari, Gazipur" } });

  // Organisation
  const ORG = [
    { code: "ADM", en: "Administration", bn: "প্রশাসন", sections: [["HR & Compliance", "এইচআর ও কমপ্লায়েন্স"], ["Accounts", "হিসাব"], ["Security", "নিরাপত্তা"]] },
    { code: "CUT", en: "Cutting", bn: "কাটিং", sections: [["Cutting", "কাটিং"]] },
    { code: "SEW", en: "Sewing", bn: "সুইং", sections: [["Sewing", "সুইং"]] },
    { code: "FIN", en: "Finishing", bn: "ফিনিশিং", sections: [["Iron", "আয়রন"], ["Packing", "প্যাকিং"]] },
    { code: "QA", en: "Quality", bn: "কোয়ালিটি", sections: [["Quality Inspection", "কোয়ালিটি ইন্সপেকশন"]] },
    { code: "MNT", en: "Maintenance", bn: "মেইনটেন্যান্স", sections: [["Mechanical", "মেকানিক্যাল"], ["Electrical", "ইলেকট্রিক্যাল"]] },
  ];
  const deptIds: Record<string, number> = {};
  const sectionIds: Record<string, number[]> = {};
  for (const [i, d] of ORG.entries()) {
    const dept = await db.department.create({ data: { code: d.code, nameEn: d.en, nameBn: d.bn, sortOrder: i } });
    deptIds[d.code] = dept.id;
    sectionIds[d.code] = [];
    for (const [j, [en, bn]] of d.sections.entries()) {
      const s = await db.section.create({ data: { departmentId: dept.id, nameEn: en, nameBn: bn, sortOrder: j } });
      sectionIds[d.code].push(s.id);
    }
  }
  const floors = [];
  for (const [i, [en, bn]] of [["Ground Floor", "নিচতলা"], ["1st Floor", "১ম তলা"], ["2nd Floor", "২য় তলা"]].entries()) {
    floors.push(await db.floor.create({ data: { nameEn: en, nameBn: bn, sortOrder: i } }));
  }
  const lines = [];
  for (let i = 1; i <= 6; i++) {
    lines.push(await db.line.create({ data: { nameEn: `Line-${String(i).padStart(2, "0")}`, nameBn: `লাইন-${"০১২৩৪৫৬৭৮৯"[0]}${"০১২৩৪৫৬৭৮৯"[i]}`, floorId: floors[i <= 3 ? 1 : 2].id, sortOrder: i } }));
  }
  const machineTypes = [];
  for (const [i, [en, bn]] of [
    ["Single Needle Lock Stitch", "সিঙ্গেল নিডেল"], ["Double Needle Lock Stitch", "ডাবল নিডেল"], ["Overlock", "ওভারলক"],
    ["Flatlock", "ফ্ল্যাটলক"], ["Kansai", "কানসাই"], ["Bartack", "বারটেক"], ["Button Hole", "বাটন হোল"], ["Button Stitch", "বাটন স্টিচ"],
  ].entries()) {
    machineTypes.push(await db.machineType.create({ data: { nameEn: en, nameBn: bn, sortOrder: i } }));
  }

  const gradeRows = await db.grade.findMany();
  const grades = Object.fromEntries(gradeRows.map((g) => [g.code, g]));
  const gradeById = new Map(gradeRows.map((g) => [g.id, g]));
  const DESIG: [string, string, string, string | null, string, boolean, number][] = [
    ["PM", "Production Manager", "প্রোডাকশন ম্যানেজার", null, "MANAGEMENT", false, 0],
    ["HRM", "Manager (HR & Compliance)", "ব্যবস্থাপক (মানব সম্পদ ও কমপ্লায়েন্স)", null, "MANAGEMENT", false, 0],
    ["HRO", "HR Officer", "এইচআর অফিসার", null, "STAFF", false, 0],
    ["CO", "Compliance Officer", "কমপ্লায়েন্স অফিসার", null, "STAFF", false, 0],
    ["AO", "Accounts Officer", "হিসাব কর্মকর্তা", null, "STAFF", false, 0],
    ["SG", "Security Guard", "নিরাপত্তা প্রহরী", "3", "WORKER", true, 500],
    ["CM", "Cutting Master", "কাটিং মাস্টার", null, "STAFF", false, 0],
    ["CT", "Cutter", "কাটার", "3", "WORKER", true, 700],
    ["CH", "Cutting Helper", "কাটিং হেলপার", "4", "WORKER", true, 500],
    ["LC", "Line Chief", "লাইন চীফ", null, "STAFF", false, 0],
    ["SV", "Supervisor", "সুপারভাইজার", null, "STAFF", false, 0],
    ["SSO", "Sr. Sewing Operator", "সিনিয়র সুইং অপারেটর", "2", "WORKER", true, 700],
    ["SO", "Sewing Operator", "সুইং অপারেটর", "3", "WORKER", true, 700],
    ["JSO", "Jr. Sewing Operator", "জুনিয়র সুইং অপারেটর", "4", "WORKER", true, 700],
    ["SH", "Sewing Helper", "সুইং হেলপার", "4", "WORKER", true, 500],
    ["IM", "Ironman", "আয়রনম্যান", "3", "WORKER", true, 700],
    ["PK", "Packer", "প্যাকার", "4", "WORKER", true, 500],
    ["FD", "Folder", "ফোল্ডার", "4", "WORKER", true, 500],
    ["QI", "Quality Inspector", "কোয়ালিটি ইন্সপেক্টর", "2", "WORKER", true, 700],
    ["JQI", "Jr. Quality Inspector", "জুনিয়র কোয়ালিটি ইন্সপেক্টর", "3", "WORKER", true, 700],
    ["MC", "Mechanic", "মেকানিক", "1", "WORKER", true, 700],
    ["EL", "Electrician", "ইলেকট্রিশিয়ান", "1", "WORKER", true, 700],
  ];
  const desig: Record<string, { id: number; gradeId: number | null; empType: string; ot: boolean }> = {};
  for (const [i, [key, en, bn, g, type, ot, bonus]] of DESIG.entries()) {
    const gradeId = g ? grades[g].id : grades.STAFF.id;
    const row = await db.designation.create({ data: { nameEn: en, nameBn: bn, empType: type, gradeId, otEligible: ot, attendanceBonus: bonus, sortOrder: i } });
    desig[key] = { id: row.id, gradeId, empType: type, ot };
  }

  const shiftG = await db.shift.findUniqueOrThrow({ where: { code: "G" } });
  const shiftN = await db.shift.findUniqueOrThrow({ where: { code: "N" } });

  // Staffing plan: designation, department, section index, headcount, gross range (staff), share of women.
  const PLAN: [string, string, number, number, [number, number] | null, number][] = [
    ["PM", "SEW", 0, 1, [85000, 85000], 0],
    ["HRM", "ADM", 0, 1, [65000, 65000], 0],
    ["HRO", "ADM", 0, 1, [28000, 28000], 0],
    ["CO", "ADM", 0, 1, [30000, 30000], 1],
    ["AO", "ADM", 1, 2, [24000, 27000], 0],
    ["SG", "ADM", 2, 6, null, 0],
    ["CM", "CUT", 0, 1, [35000, 35000], 0],
    ["CT", "CUT", 0, 6, null, 0.15],
    ["CH", "CUT", 0, 6, null, 0.4],
    ["LC", "SEW", 0, 2, [32000, 34000], 0],
    ["SV", "SEW", 0, 4, [21000, 24000], 0.5],
    ["SSO", "SEW", 0, 15, null, 0.7],
    ["SO", "SEW", 0, 30, null, 0.75],
    ["JSO", "SEW", 0, 20, null, 0.8],
    ["SH", "SEW", 0, 20, null, 0.8],
    ["IM", "FIN", 0, 8, null, 0.1],
    ["PK", "FIN", 1, 8, null, 0.5],
    ["FD", "FIN", 1, 4, null, 0.7],
    ["QI", "QA", 0, 6, null, 0.6],
    ["JQI", "QA", 0, 4, null, 0.7],
    ["MC", "MNT", 0, 4, null, 0],
    ["EL", "MNT", 1, 2, null, 0],
  ];

  const structure = { houseRentPercent: company.houseRentPercent, medicalAllowance: company.medicalAllowance, transportAllowance: company.transportAllowance, foodAllowance: company.foodAllowance };
  const decIncrements = [utcDate(cy - 2, 12, 1), utcDate(cy - 1, 12, 1)].filter((d) => d.getTime() < today.getTime());
  let code = 10001;
  let guardCount = 0;
  const created: { id: number; key: string; dept: string; gender: string; religion: string; joinDate: Date; shiftId: number; ot: boolean; empType: string }[] = [];

  for (const [key, dept, secIdx, count, grossRange, femaleShare] of PLAN) {
    const d = desig[key];
    // SEED_SCALE multiplies the worker headcount (staff posts stay as they are) for load testing.
    const scaled = grossRange ? count : count * SCALE;
    for (let n = 0; n < scaled; n++) {
      const female = chance(femaleShare);
      const hindu = chance(0.08);
      const gender = female ? "FEMALE" : "MALE";
      const religion = hindu ? "HINDU" : "ISLAM";
      let nameEn: string, nameBn: string;
      if (hindu) {
        [nameEn, nameBn] = pick(female ? HINDU_FEMALE : HINDU_MALE);
      } else if (female) {
        const [f, fb] = pick(FEMALE), [l, lb] = pick(FEMALE_LAST);
        nameEn = `Mst. ${f} ${l}`;
        nameBn = `মোসাঃ ${fb} ${lb}`;
      } else {
        const [f, fb] = pick(MALE), [l, lb] = pick(MALE_LAST);
        nameEn = `Md. ${f} ${l}`;
        nameBn = `মোঃ ${fb} ${lb}`;
      }
      const [fa, fab] = pick(MALE), [fl, flb] = pick(MALE_LAST);
      const [mo, mob] = pick(FEMALE), [ml, mlb] = pick(FEMALE_LAST);
      const married = chance(0.65);
      const [sp, spb] = female ? pick(MALE) : pick(FEMALE);
      const [spl, splb] = female ? pick(MALE_LAST) : pick(FEMALE_LAST);
      const father: [string, string] = hindu ? pick(HINDU_MALE) : [`Md. ${fa} ${fl}`, `মোঃ ${fab} ${flb}`];
      const mother: [string, string] = hindu ? pick(HINDU_FEMALE) : [`Mst. ${mo} ${ml}`, `মোসাঃ ${mob} ${mlb}`];
      const spouse: [string, string] = hindu ? pick(female ? HINDU_MALE : HINDU_FEMALE) : [`${female ? "Md." : "Mst."} ${sp} ${spl}`, `${female ? "মোঃ" : "মোসাঃ"} ${spb} ${splb}`];

      const staff = d.empType !== "WORKER";
      // Recent joiners for the monthly new-employee report.
      const recent = !staff && (code % 37 === 0 || code % 41 === 0);
      let joinDate = recent
        ? addDays(chance(0.5) ? startOfMonth(cy, cm) : prevMonth, between(2, 12))
        : addDays(utcDate(staff ? 2014 : 2016, 1, 1), between(0, diffDays(utcDate(staff ? 2014 : 2016, 1, 1), addMonths(dataStart, -2))));
      if (joinDate.getTime() > yesterday.getTime()) joinDate = addDays(prevMonth, between(2, 12));
      const age = staff ? between(26, 48) : between(19, 40);
      const dob = addDays(utcDate(today.getUTCFullYear() - age, 1, 1), between(0, 360));
      const [dist, distBn] = pick(DISTRICTS), [vil, vilBn] = pick(VILLAGES), [loc, locBn] = pick(LOCAL);

      // Salary: grade minimum, then the 5 % December increments since the 2023 gazette.
      let sal: SalaryParts = grossRange
        ? structureFromGross(between(grossRange[0] / 500, grossRange[1] / 500) * 500, structure)
        : structureFromGross(gradeById.get(d.gradeId!)!.minGross, structure);
      const history: { date: Date; type: string; sal: SalaryParts; amount: number }[] = [{ date: joinDate, type: "JOINING", sal, amount: 0 }];
      if (!staff) {
        for (const dec of decIncrements) {
          if (addMonths(joinDate, 12).getTime() <= dec.getTime()) {
            const next = incrementOnBasic(sal, 5, structure);
            history.push({ date: dec, type: "INCREMENT", sal: next, amount: round2(next.gross - sal.gross) });
            sal = next;
          }
        }
      }
      const serviceMonths = (today.getTime() - joinDate.getTime()) / (30.44 * 86400000);
      const probationMonths = staff ? company.probationStaffMonths : company.probationWorkerMonths;
      const permanent = serviceMonths >= probationMonths;
      const confirmDate = permanent ? addMonths(joinDate, probationMonths) : null;
      const isGuardNight = key === "SG" && guardCount++ < 3;
      const pay = chance(0.6) ? "MFS" : chance(0.6) ? "BANK" : "CASH";
      const lineIdx = dept === "SEW" && ["SSO", "SO", "JSO", "SH", "SV"].includes(key) ? n % 6 : -1;
      const mobile = `01${pick(["3", "4", "5", "6", "7", "8", "9"])}${String(between(10000000, 99999999))}`;
      const elOpeningDate = joinDate.getTime() < dataStart.getTime() ? addDays(dataStart, -1) : null;
      const elOpening = elOpeningDate
        ? Math.min(30, round2((diffDays(maxDate(joinDate, utcDate(cy, 1, 1)), dataStart) * 0.8) / 18) + (joinDate.getUTCFullYear() < cy ? between(3, 10) : 0))
        : 0;

      const emp = await db.employee.create({
        data: {
          empCode: String(code),
          punchId: code,
          nameEn, nameBn,
          fatherEn: father[0], fatherBn: father[1],
          motherEn: mother[0], motherBn: mother[1],
          spouseEn: married ? spouse[0] : "",
          spouseBn: married ? spouse[1] : "",
          gender, dob, religion,
          maritalStatus: married ? "MARRIED" : "SINGLE",
          bloodGroup: pick(["A+", "B+", "O+", "AB+", "A-", "B-", "O-"]),
          nidNo: String(between(1000000000, 9999999999)),
          heightCm: between(female ? 145 : 155, female ? 165 : 178),
          weightKg: between(42, 72),
          ...(() => { const [m, mb] = pick(MARKS); return { identMarkEn: m, identMarkBn: mb }; })(),
          ...(() => {
            if (staff) return { educationEn: pick(["Graduate", "Masters"]), educationBn: "স্নাতক" };
            const [e, eb] = pick(EDU_WORKER);
            return { educationEn: e, educationBn: eb };
          })(),
          childrenCount: married ? between(0, 3) : 0,
          mobile,
          emergencyName: married ? spouse[0] : father[0],
          emergencyPhone: `01${pick(["7", "8", "9"])}${String(between(10000000, 99999999))}`,
          emergencyRelation: married ? (female ? "Husband" : "Wife") : "Father",
          referenceName: chance(0.5) ? "Md. Abdul Karim (Supervisor)" : "",
          experienceYears: staff ? between(2, 12) : between(0, 6),
          experienceDetails: chance(0.4) ? "Previously worked at another garment factory as operator" : "",
          presVillageEn: `${loc}, House ${between(1, 300)}`, presVillageBn: `${locBn}, বাড়ি নং ${between(1, 300)}`,
          presPostEn: loc, presPostBn: locBn,
          presThanaEn: "Gazipur Sadar", presThanaBn: "গাজীপুর সদর",
          presDistrictEn: "Gazipur", presDistrictBn: "গাজীপুর",
          permVillageEn: vil, permVillageBn: vilBn,
          permPostEn: `${vil} Bazar`, permPostBn: `${vilBn} বাজার`,
          permThanaEn: `${dist} Sadar`, permThanaBn: `${distBn} সদর`,
          permDistrictEn: dist, permDistrictBn: distBn,
          departmentId: deptIds[dept],
          sectionId: sectionIds[dept][secIdx],
          designationId: d.id,
          gradeId: d.gradeId,
          lineId: lineIdx >= 0 ? lines[lineIdx].id : null,
          floorId: lineIdx >= 0 ? lines[lineIdx].floorId : floors[0].id,
          machineTypeId: ["SSO", "SO", "JSO"].includes(key) ? pick(machineTypes).id : null,
          shiftId: isGuardNight ? shiftN.id : shiftG.id,
          empType: d.empType,
          employmentNature: permanent ? "PERMANENT" : "PROBATION",
          joinDate,
          probationEnd: addMonths(joinDate, probationMonths),
          confirmDate,
          otEligible: d.ot,
          ...sal,
          salaryEffective: history[history.length - 1].date,
          paymentMode: pay,
          bankName: pay === "BANK" ? "Sample Bank PLC" : "",
          bankBranch: pay === "BANK" ? "Konabari" : "",
          bankAccountNo: pay === "BANK" ? `0123-01-${String(code).padStart(7, "0")}` : "",
          mfsProvider: pay === "MFS" ? pick(["bKash", "Nagad", "Rocket"]) : "",
          mfsNumber: pay === "MFS" ? mobile : "",
          monthlyTax: sal.gross >= 60000 ? 1500 : 0,
          ageProofType: "NID",
          appointmentLetterDate: joinDate,
          idCardIssueDate: addDays(joinDate, 1),
          nomineeFormDate: code % 29 === 0 ? null : joinDate,
          fitnessCertDate: addDays(joinDate, -1),
          serviceBookDate: confirmDate ? addDays(confirmDate, 10) : null,
          elOpening,
          elOpeningDate,
        },
      });
      for (const h of history) {
        await db.salaryHistory.create({
          data: { employeeId: emp.id, effectiveDate: h.date, type: h.type, designationId: d.id, gradeId: d.gradeId, ...h.sal, amount: h.amount, createdBy: "seed" },
        });
      }
      await db.nominee.create({
        data: married
          ? { employeeId: emp.id, nameEn: spouse[0], nameBn: spouse[1], relationEn: female ? "Husband" : "Wife", relationBn: female ? "স্বামী" : "স্ত্রী", age: Math.max(18, age + between(-3, 5)), nidNo: String(between(1000000000, 9999999999)), addressEn: `${vil}, ${dist}`, addressBn: `${vilBn}, ${distBn}` }
          : { employeeId: emp.id, nameEn: father[0], nameBn: father[1], relationEn: "Father", relationBn: "পিতা", age: age + between(22, 30), nidNo: String(between(1000000000, 9999999999)), addressEn: `${vil}, ${dist}`, addressBn: `${vilBn}, ${distBn}` },
      });
      created.push({ id: emp.id, key, dept, gender, religion, joinDate, shiftId: emp.shiftId, ot: d.ot, empType: d.empType });
      code++;
    }
  }

  // Devices & enrolment (two recent joiners not yet enrolled).
  const dev1 = await db.device.create({ data: { name: "Main Gate — Device 1", ip: "192.168.1.201", port: 4370, location: "Main gate", serialNo: "ZK-DEMO-0001" } });
  await db.device.create({ data: { name: "Main Gate — Device 2", ip: "192.168.1.202", port: 4370, location: "Main gate", serialNo: "ZK-DEMO-0002" } });
  const recentJoiners = created.filter((c) => c.joinDate.getTime() >= prevMonth.getTime()).map((c) => c.id);
  for (const c of created) {
    if (recentJoiners.slice(0, 2).includes(c.id)) continue;
    await db.employeeDevice.create({ data: { employeeId: c.id, deviceId: dev1.id, enrolledAt: c.joinDate } });
  }

  // Safety teams (Labour Rules r.55(10): ≥ 6 % of each division per team, ≥ 18 % trained).
  const teams = await db.team.findMany({ orderBy: { sortOrder: "asc" } });
  for (const dept of Object.keys(deptIds)) {
    const members = created.filter((c) => c.dept === dept);
    const pool = [...members].sort(() => rnd() - 0.5);
    const per = Math.max(1, Math.ceil(members.length * 0.07));
    for (const [ti, t] of teams.entries()) {
      if (dept === "FIN" && t.code === "RESCUE") continue; // a gap for the compliance report
      for (const [k, m] of pool.slice(ti * per, ti * per + per).entries()) {
        await db.employeeTeam.create({
          data: { employeeId: m.id, teamId: t.id, role: k === 0 ? "LEADER" : "MEMBER", trainingDate: addDays(dataStart, -between(30, 300)), trainedBy: "Fire Service & Civil Defence", certificateNo: `FSCD-${between(1000, 9999)}` },
        });
      }
    }
  }

  await db.buyer.create({ data: { name: "Buyer A (ETI base code)", maxOtPerDay: 2, maxHoursPerWeek: 60, maxConsecutiveDays: 6 } });
  await db.buyer.create({ data: { name: "Buyer B (56 h weekly cap)", maxOtPerDay: 2, maxHoursPerWeek: 56, maxConsecutiveDays: 6 } });

  // Manpower budget per section.
  const sections = await db.section.findMany({ include: { _count: { select: { employees: true } } } });
  for (const s of sections) {
    await db.manpowerBudget.create({ data: { departmentId: s.departmentId, sectionId: s.id, required: Math.max(1, s._count.employees + between(-1, 3)) } });
  }

  // Holidays (sample calendar — replace with the factory's approved holiday list).
  const holidayRows: [Date, string, string, string][] = [
    [utcDate(cy, 2, 21), "Shaheed Day & International Mother Language Day", "শহীদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস", "GOVERNMENT"],
    [utcDate(cy, 3, 26), "Independence Day", "স্বাধীনতা দিবস", "GOVERNMENT"],
    [utcDate(cy, 4, 14), "Bangla New Year", "পহেলা বৈশাখ", "FESTIVAL"],
    [utcDate(cy, 5, 1), "May Day", "মে দিবস", "GOVERNMENT"],
    [addDays(dataStart, 4), "Sample festival holiday", "নমুনা উৎসব ছুটি", "FESTIVAL"],
    [addDays(startOfMonth(cy, cm), -12), "Durga Puja (sample)", "দুর্গাপূজা (নমুনা)", "FESTIVAL"],
    [utcDate(cy, 12, 16), "Victory Day", "বিজয় দিবস", "GOVERNMENT"],
    [utcDate(cy, 12, 25), "Christmas Day", "বড়দিন", "GOVERNMENT"],
  ];
  for (const [date, en, bn, type] of holidayRows) {
    await db.holiday.upsert({ where: { date }, create: { date, nameEn: en, nameBn: bn, type }, update: {} });
  }
  const holidaySet = new Set(holidayRows.map((h) => ymd(h[0])));

  // Special cases.
  const workers = created.filter((c) => c.empType === "WORKER" && c.joinDate.getTime() < addMonths(dataStart, -12).getTime() && c.shiftId === shiftG.id);
  const leftyEmp = workers.find((c) => c.key === "SO" && c.gender === "MALE")!;
  const resignedEmp = workers.find((c) => c.key === "CT")!;
  const oldResigned = workers.find((c) => c.key === "JSO")!;
  const nightFemale = workers.find((c) => c.key === "QI" && c.gender === "FEMALE") ?? workers.find((c) => c.gender === "FEMALE")!;
  const maternityEmp = workers.find((c) => c.key === "SO" && c.gender === "FEMALE" && c.id !== nightFemale.id)!;
  const leftyFrom = addDays(today, -16);
  const resignLast = addDays(startOfMonth(cy, cm), -1);
  const oldResignLast = addDays(dataStart, 19);
  const expected = addDays(today, 40);
  const mat = computeMaternity({ joinDate: maternityEmp.joinDate, expectedDelivery: expected, survivingChildren: 1, wages3m: 0, daysWorked3m: 1 });
  const special = new Set([leftyEmp.id, resignedEmp.id, oldResigned.id, maternityEmp.id]);

  // Approved / pending leave.
  const leaveTypes = Object.fromEntries((await db.leaveType.findMany()).map((l) => [l.code, l]));
  const leaveDays = new Map<number, Set<string>>();
  const addLeave = async (empId: number, code: string, from: Date, to: Date, status = "APPROVED", reason = "") => {
    await db.leaveApplication.create({
      data: {
        employeeId: empId, leaveTypeId: leaveTypes[code].id, fromDate: from, toDate: to, days: diffDays(from, to) + 1,
        reason: reason || (code === "SL" ? "Fever" : code === "CL" ? "Family matter" : "Leave"),
        appliedOn: addDays(from, -2), status, decidedBy: status === "APPROVED" ? "hr" : "", decidedAt: status === "APPROVED" ? addDays(from, -1) : null,
      },
    });
    if (status === "APPROVED") {
      const set = leaveDays.get(empId) ?? new Set<string>();
      for (const d of eachDay(from, to)) set.add(ymd(d));
      leaveDays.set(empId, set);
    }
  };
  for (const c of created) {
    if (special.has(c.id)) continue;
    if (chance(0.45)) {
      const n = between(1, 2);
      for (let k = 0; k < n; k++) {
        let from = addDays(dataStart, between(3, diffDays(dataStart, yesterday) - 4));
        if (from.getTime() < c.joinDate.getTime()) continue;
        if (from.getUTCDay() === 5) from = addDays(from, 1);
        const code = chance(0.6) ? "CL" : "SL";
        await addLeave(c.id, code, from, addDays(from, code === "SL" ? between(0, 2) : between(0, 1)));
      }
    }
  }
  await addLeave(maternityEmp.id, "ML", mat.leaveFrom, mat.leaveTo, "APPROVED", "Maternity leave (s.46)");
  for (const c of created.slice(20, 24)) await addLeave(c.id, "CL", addDays(today, 3), addDays(today, 4), "PENDING");

  // Punches.
  const punchRows: { punchId: number; employeeId: number; time: Date; deviceId: number; source: string }[] = [];
  const empRows = await db.employee.findMany({ select: { id: true, punchId: true, joinDate: true, departmentId: true } });
  const sewingId = deptIds.SEW;
  const holidayWorkFriday = (() => {
    const fridays = eachDay(prevMonth, endOfMonth(prevMonth.getUTCFullYear(), prevMonth.getUTCMonth() + 1)).filter((d) => d.getUTCDay() === 5);
    return fridays[1] ? ymd(fridays[1]) : "";
  })();
  const createdById = new Map(created.map((x) => [x.id, x]));
  for (const e of empRows) {
    const c = createdById.get(e.id)!;
    const sepLast = e.id === resignedEmp.id ? resignLast : e.id === oldResigned.id ? oldResignLast : null;
    for (const date of eachDay(maxDate(dataStart, e.joinDate), yesterday)) {
      if (sepLast && date.getTime() > sepLast.getTime()) break;
      if (e.id === leftyEmp.id && date.getTime() >= leftyFrom.getTime()) continue;
      if (leaveDays.get(e.id)?.has(ymd(date))) continue;
      const key = ymd(date);
      const isFriday = date.getUTCDay() === 5;
      const isHoliday = holidaySet.has(key);
      const night = c.shiftId === shiftN.id;
      if (isFriday || isHoliday) {
        if (key === holidayWorkFriday && e.departmentId === sewingId && c.empType === "WORKER" && chance(0.9)) {
          punchRows.push({ punchId: e.punchId, employeeId: e.id, time: addMinutes(date, 7 * 60 + between(45, 59)), deviceId: dev1.id, source: "DEVICE" });
          punchRows.push({ punchId: e.punchId, employeeId: e.id, time: addMinutes(date, 13 * 60 + between(0, 12)), deviceId: dev1.id, source: "DEVICE" });
        }
        continue;
      }
      if (chance(c.empType === "WORKER" ? 0.03 : 0.01)) continue; // absent
      if (night) {
        punchRows.push({ punchId: e.punchId, employeeId: e.id, time: addMinutes(date, 19 * 60 + between(40, 59)), deviceId: dev1.id, source: "DEVICE" });
        punchRows.push({ punchId: e.punchId, employeeId: e.id, time: addMinutes(date, 24 * 60 + 5 * 60 + between(0, 10)), deviceId: dev1.id, source: "DEVICE" });
        continue;
      }
      const late = chance(0.06);
      const inMin = late ? 8 * 60 + between(6, 40) : 7 * 60 + between(40, 64);
      punchRows.push({ punchId: e.punchId, employeeId: e.id, time: addMinutes(date, inMin), deviceId: dev1.id, source: "DEVICE" });
      if (chance(0.01)) continue; // forgot to punch out
      let outMin: number;
      if (!c.ot) outMin = 17 * 60 + between(5, 90);
      else {
        const r = rnd();
        const otH = r < 0.08 ? 0 : r < 0.23 ? 1 : r < 0.95 ? 2 : 3;
        outMin = 17 * 60 + otH * 60 + between(0, 20);
      }
      if (e.id === nightFemale.id && (date.getUTCDate() === 10 || date.getUTCDate() === 11)) outMin = 22 * 60 + 30;
      punchRows.push({ punchId: e.punchId, employeeId: e.id, time: addMinutes(date, outMin), deviceId: dev1.id, source: "DEVICE" });
    }
  }
  for (let i = 0; i < punchRows.length; i += 2000) await db.punchLog.createMany({ data: punchRows.slice(i, i + 2000) });
  console.log(`  punches: ${punchRows.length}`);

  // Separations.
  await db.separation.create({ data: { employeeId: oldResigned.id, type: "RESIGNATION", noticeDate: addDays(oldResignLast, -60), effectiveDate: oldResignLast, noticeDaysGiven: 60, reason: "Moving to home district", createdBy: "hr" } });
  await db.employee.update({ where: { id: oldResigned.id }, data: { status: "SEPARATED", separationDate: oldResignLast } });
  await db.separation.create({ data: { employeeId: resignedEmp.id, type: "RESIGNATION", noticeDate: addDays(resignLast, -45), effectiveDate: resignLast, noticeDaysGiven: 45, reason: "Personal reasons", createdBy: "hr" } });
  await db.employee.update({ where: { id: resignedEmp.id }, data: { status: "SEPARATED", separationDate: resignLast } });
  await db.employeeDevice.updateMany({ where: { employeeId: resignedEmp.id }, data: { removedAt: addDays(resignLast, 1) } });

  await processAttendance(db, { from: dataStart, to: yesterday });
  console.log("  attendance processed");

  // Payroll for the two completed months; the older one is locked and paid.
  const months = [dataStart, prevMonth];
  for (const [i, m] of months.entries()) {
    const run = await db.payrollRun.create({ data: { year: m.getUTCFullYear(), month: m.getUTCMonth() + 1 } });
    if (i === 1) {
      const sample = created.filter((c) => c.empType === "WORKER").slice(5, 8);
      await db.payAdjustment.create({ data: { employeeId: sample[0].id, year: run.year, month: run.month, kind: "ARREAR", amount: 500, reason: "Arrear for previous month's OT correction", createdBy: "payroll" } });
      await db.payAdjustment.create({ data: { employeeId: sample[1].id, year: run.year, month: run.month, kind: "ADDITION", amount: 300, reason: "Production incentive", createdBy: "payroll" } });
      for (const c of sample) {
        await db.advance.create({ data: { employeeId: c.id, date: addDays(dataStart, 10), amount: 3000, installments: 3, startYear: prevMonth.getUTCFullYear(), startMonth: prevMonth.getUTCMonth() + 1, reason: "Salary advance (medical)" } });
      }
    }
    await processPayroll(db, run.id, "payroll");
    if (i === 0) {
      await db.payrollRun.update({ where: { id: run.id }, data: { status: "LOCKED", lockedAt: new Date(), lockedBy: "admin", paymentDate: addDays(endOfMonth(m.getUTCFullYear(), m.getUTCMonth() + 1), 7) } });
    }
  }
  console.log("  payroll processed");

  // Settled separation (paid) and a fresh resignation awaiting payment.
  const oldSep = await db.separation.findUniqueOrThrow({ where: { employeeId: oldResigned.id } });
  await calculateSettlement(db, oldSep.id);
  await db.separation.update({ where: { id: oldSep.id }, data: { settlementStatus: "PAID", paidOn: addDays(oldResignLast, 20) } });

  const sep = await db.separation.findUniqueOrThrow({ where: { employeeId: resignedEmp.id } });
  await calculateSettlement(db, sep.id);

  // Lefty case: absent for 16 days, first letter issued after 10 days.
  await db.leftyCase.create({ data: { employeeId: leftyEmp.id, absentFrom: leftyFrom, letter1Date: addDays(leftyFrom, 10), remarks: "First letter sent by registered post" } });

  // Maternity case.
  const paid3 = await db.payslip.aggregate({ where: { employeeId: maternityEmp.id, run: { OR: months.map((m) => ({ year: m.getUTCFullYear(), month: m.getUTCMonth() + 1 })) } }, _sum: { grossPayable: true, presentDays: true } });
  const matCalc = computeMaternity({
    joinDate: maternityEmp.joinDate, expectedDelivery: expected, survivingChildren: 1,
    wages3m: paid3._sum.grossPayable ?? 0, daysWorked3m: paid3._sum.presentDays ?? 0,
  });
  await db.maternityCase.create({
    data: {
      employeeId: maternityEmp.id, noticeDate: addDays(today, -25), expectedDelivery: expected, leaveFrom: matCalc.leaveFrom, leaveTo: matCalc.leaveTo,
      serviceMonths: matCalc.serviceMonths, survivingChildren: 1, benefitEligible: matCalc.benefitEligible,
      wages3m: paid3._sum.grossPayable ?? 0, daysWorked3m: paid3._sum.presentDays ?? 0, avgDailyWage: matCalc.avgDailyWage,
      totalBenefit: matCalc.totalBenefit, firstInstallment: matCalc.firstInstallment, firstPaidOn: addDays(matCalc.leaveFrom, 2),
      secondInstallment: matCalc.secondInstallment, status: "ON_LEAVE",
    },
  });

  // Festival bonus (sample: Durga Puja for Hindu employees) and increment proposals.
  const bonus = await db.bonusRun.create({
    data: {
      title: `Durga Puja Bonus ${cy}`, festival: "DURGA_PUJA", cutoffDate: addDays(startOfMonth(cy, cm), -19), paymentDate: addDays(startOfMonth(cy, cm), -17),
      basis: "BASIC", religions: "HINDU", slabs: JSON.stringify([{ minMonths: 12, percent: 100 }, { minMonths: 6, percent: 50 }]),
    },
  });
  await processBonus(db, bonus.id);
  const nextMonth = addMonths(startOfMonth(cy, cm), 1);
  await generateIncrementProposals(db, { effectiveDate: nextMonth, percent: company.incrementPercent });
  const proposals = await db.increment.findMany({ take: 3, orderBy: { id: "asc" } });
  for (const p of proposals) await db.increment.update({ where: { id: p.id }, data: { status: "APPROVED", decidedBy: "hr" } });

  console.log(`  employees: ${created.length}`);
}

async function main() {
  const demo = process.env.SEED_DEMO !== "0";
  const existing = await db.company.count();
  if (existing > 0 && process.env.SEED_FORCE !== "1") {
    console.log("Database already initialised — seed skipped (set SEED_FORCE=1 to wipe and re-seed).");
    return;
  }
  if (existing > 0) await wipe();
  console.log(`Seeding ${demo ? "base + demo" : "base"} data…`);
  await seedBase(demo);
  if (demo) await seedDemo();
  console.log("Done. Sign in with admin / admin123 and change the password.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
