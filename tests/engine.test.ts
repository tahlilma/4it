import { describe, expect, it } from "vitest";
import { bn, bnTakaWords, bnWords, enTakaWords, enWords } from "@/lib/bangla";
import { addMonths, parseDate, serviceSpan, ageOn, utcDate, addMinutes, eachDay } from "@/lib/dates";
import { round2 } from "@/lib/num";
import { incrementOnBasic, otRate, structureFromGross } from "@/lib/engine/salary";
import { evaluateDay, roundOt, shiftSpec, punchWindow, statusCode, type DayType } from "@/lib/engine/attendance";
import { computePay, type PayDay, type PayPolicy } from "@/lib/engine/payroll";
import { computeSettlement } from "@/lib/engine/settlement";
import { bonusFor, DEFAULT_SLABS } from "@/lib/engine/bonus";
import { elBalance, elEncashable, fixedEntitlement } from "@/lib/engine/leave";
import { computeMaternity } from "@/lib/engine/maternity";
import { dayHours, maxConsecutiveWorked, nightConsentValid, overlapsNight, weekBuckets } from "@/lib/engine/compliance";

const d = (s: string) => parseDate(s)!;
const t = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return addMinutes(d(date), h * 60 + m);
};

const STRUCT = { houseRentPercent: 50, medicalAllowance: 750, transportAllowance: 450, foodAllowance: 1250 };

describe("salary structure (2023 RMG gazette)", () => {
  it("splits the Tk 12,500 entry grade exactly", () => {
    expect(structureFromGross(12500, STRUCT)).toMatchObject({ basic: 6700, houseRent: 3350, medical: 750, transport: 450, food: 1250 });
  });
  it("splits grade 2 (Tk 14,273) as on the sample appointment letter", () => {
    expect(structureFromGross(14273, STRUCT)).toMatchObject({ basic: 7882, houseRent: 3941 });
  });
  it("OT rate is basic × 2 / 208", () => {
    expect(otRate(7882, { otDivisor: 208, otMultiplier: 2 })).toBe(75.79);
    expect(otRate(6700, { otDivisor: 208, otMultiplier: 2 })).toBe(64.42);
  });
  it("5 % annual increment raises basic and house rent only", () => {
    const next = incrementOnBasic(structureFromGross(12500, STRUCT), 5, STRUCT);
    expect(next).toMatchObject({ basic: 7035, houseRent: 3517.5, medical: 750, gross: 13002.5 });
  });
});

describe("bangla & words", () => {
  it("converts digits", () => expect(bn("12,500.00")).toBe("১২,৫০০.০০"));
  it("bangla words", () => {
    expect(bnWords(2909)).toBe("দুই হাজার নয়শত নয়");
    expect(bnWords(12500)).toBe("বারো হাজার পাঁচশত");
    expect(bnWords(123456)).toBe("এক লক্ষ তেইশ হাজার চারশত ছাপ্পান্ন");
    expect(bnTakaWords(150.5)).toBe("একশত পঞ্চাশ টাকা পঞ্চাশ পয়সা মাত্র");
  });
  it("english words in lakh/crore", () => {
    expect(enWords(2909)).toBe("Two Thousand Nine Hundred Nine");
    expect(enWords(12345678)).toBe("One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight");
    expect(enTakaWords(2909)).toBe("Taka Two Thousand Nine Hundred Nine Only");
  });
});

describe("dates", () => {
  it("service length counts the last working day", () => {
    expect(serviceSpan(d("2021-09-12"), d("2024-07-31"))).toEqual({ years: 2, months: 10, days: 20 });
    expect(serviceSpan(d("2025-01-01"), d("2025-12-31"))).toEqual({ years: 1, months: 0, days: 0 });
  });
  it("age and month arithmetic", () => {
    expect(ageOn(d("2008-10-23"), d("2026-10-22"))).toBe(17);
    expect(ageOn(d("2008-10-22"), d("2026-10-22"))).toBe(18);
    expect(addMonths(d("2026-01-31"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(parseDate("2026-02-30")).toBeNull();
  });
});

const DAY_SHIFT = shiftSpec({
  inTime: "08:00", outTime: "17:00", lateGraceMin: 5, earlyGraceMin: 0, breakMinutes: 60,
  otStartAfterMin: 0, otRoundUnitMin: 60, otRoundUpMin: 50, tiffinAfter: "19:30", nightAfter: "22:00", windowBeforeMin: 240,
});

function day(date: string, dayType: DayType, punches: string[], extra: Partial<Parameters<typeof evaluateDay>[0]> = {}) {
  return evaluateDay({
    date: d(date), dayType, spec: DAY_SHIFT, punches: punches.map((p) => t(date, p)),
    otEligible: true, holidayWorkAsOt: true, singlePunchPresent: true, ...extra,
  });
}

describe("attendance evaluation", () => {
  it("present with overtime rounded to whole hours", () => {
    const r = day("2026-10-01", "WORKDAY", ["07:55", "19:10"]);
    // Work counts from the 08:00 shift start, not the 07:55 arrival: 08:00–19:10 less 1 h break.
    expect(r).toMatchObject({ status: "PRESENT", lateMin: 0, otMin: 130, otHours: 2, tiffin: false, workMin: 610 });
  });
  it("late arrival beyond grace", () => {
    const r = day("2026-10-01", "WORKDAY", ["08:12", "17:02"]);
    expect(r).toMatchObject({ status: "LATE", lateMin: 12, otHours: 0 });
  });
  it("remainder at/over threshold rounds up; tiffin after 19:30", () => {
    const r = day("2026-10-01", "WORKDAY", ["07:50", "19:55"]);
    expect(r).toMatchObject({ otMin: 175, otHours: 3, tiffin: true, nightBill: false });
  });
  it("single punch is present but earns no OT", () => {
    const r = day("2026-10-01", "WORKDAY", ["07:58"]);
    expect(r).toMatchObject({ status: "PRESENT", singlePunch: true, otHours: 0 });
    expect(r.inTime).not.toBeNull();
    expect(r.outTime).toBeNull();
  });
  it("double swipe within 10 minutes is a single punch", () => {
    expect(day("2026-10-01", "WORKDAY", ["07:58", "08:01"]).singlePunch).toBe(true);
  });
  it("weekly-holiday work is all overtime", () => {
    const r = day("2026-10-02", "WEEKEND", ["08:00", "13:00"]);
    expect(r).toMatchObject({ status: "PRESENT", dayType: "WEEKEND", workMin: 300, otHours: 5 });
    expect(statusCode(r)).toBe("WP");
  });
  it("absent / off / leave", () => {
    expect(day("2026-10-01", "WORKDAY", []).status).toBe("ABSENT");
    expect(day("2026-10-02", "WEEKEND", []).status).toBe("OFF");
    expect(day("2026-10-01", "WORKDAY", ["08:00", "17:00"], { leaveCode: "CL" })).toMatchObject({ status: "LEAVE", leaveCode: "CL" });
  });
  it("non OT-eligible staff accrue no OT hours", () => {
    expect(day("2026-10-01", "WORKDAY", ["08:00", "20:00"], { otEligible: false })).toMatchObject({ otMin: 180, otHours: 0 });
  });
  it("manual official-duty adjustment marks present", () => {
    expect(day("2026-10-01", "WORKDAY", [], { adjust: { status: "PRESENT" } })).toMatchObject({ status: "PRESENT", adjusted: true });
  });
  it("night shift crossing midnight", () => {
    const night = shiftSpec({
      inTime: "20:00", outTime: "05:00", lateGraceMin: 5, earlyGraceMin: 0, breakMinutes: 60,
      otStartAfterMin: 0, otRoundUnitMin: 60, otRoundUpMin: 50, tiffinAfter: "23:00", nightAfter: "03:00", windowBeforeMin: 240,
    });
    const w = punchWindow(d("2026-10-01"), night);
    expect(w.start.toISOString()).toBe("2026-10-01T16:00:00.000Z");
    const r = evaluateDay({
      date: d("2026-10-01"), dayType: "WORKDAY", spec: night, punches: [t("2026-10-01", "19:50"), t("2026-10-02", "05:55")],
      otEligible: true, holidayWorkAsOt: true, singlePunchPresent: true,
    });
    expect(r).toMatchObject({ status: "PRESENT", otMin: 55, otHours: 1, nightBill: true, workMin: 535 });
  });
  it("roundOt with half-hour units", () => {
    expect(roundOt(90, 30, 25)).toBe(1.5);
    expect(roundOt(115, 30, 25)).toBe(2);
    expect(roundOt(0, 60, 50)).toBe(0);
  });
});

const POLICY: PayPolicy = {
  absentBasis: "BASIC", absentDivisor: "30", otDivisor: 208, otMultiplier: 2, dailyOtLimit: 2, dailyHoursLimit: 10,
  stampCash: 10, stampBank: 0, attBonusMaxLate: 3, attBonusAllowLeave: false, holidayAllowBasis: "GROSS",
};

const EMP = { ...structureFromGross(12500, STRUCT), joinDate: d("2024-01-01"), separationDate: null, otEligible: true, paymentMode: "CASH", monthlyTax: 0, attendanceBonus: 700 };

/** October 2026: Fridays (2, 9, 16, 23, 30) are weekly holidays; every working day 2 h OT. */
function october(over: (date: Date, base: PayDay) => PayDay = (_, b) => b): PayDay[] {
  return eachDay(d("2026-10-01"), d("2026-10-31")).map((date) => {
    const weekend = date.getUTCDay() === 5;
    const base: PayDay = weekend
      ? { date, dayType: "WEEKEND", status: "OFF", otHours: 0 }
      : { date, dayType: "WORKDAY", status: "PRESENT", otHours: 2 };
    return over(date, base);
  });
}

describe("payroll", () => {
  it("full month with overtime and attendance bonus", () => {
    const r = computePay({ year: 2026, month: 10, emp: EMP, days: october() }, POLICY)!;
    expect(r).toMatchObject({
      category: "REGULAR", monthDays: 31, presentDays: 26, weekendDays: 5, absentDays: 0,
      earnedGross: 12500, absentDeduction: 0, otHours: 52, otRate: 64.42, otAmount: 3349.84,
      attendanceBonus: 700, stamp: 10, netPayable: 16540,
    });
  });
  it("absence deducts basic/30 and forfeits attendance bonus", () => {
    const days = october((date, b) => (["2026-10-05", "2026-10-06"].includes(date.toISOString().slice(0, 10)) ? { ...b, status: "ABSENT", otHours: 0 } : b));
    const r = computePay({ year: 2026, month: 10, emp: EMP, days }, POLICY)!;
    expect(r.absentDays).toBe(2);
    expect(r.absentDeduction).toBe(446.67);
    expect(r.attendanceBonus).toBe(0);
  });
  it("mid-month joiner is pro-rated by calendar days", () => {
    const r = computePay({ year: 2026, month: 10, emp: { ...EMP, joinDate: d("2026-10-15") }, days: october() }, POLICY)!;
    expect(r).toMatchObject({ category: "NEW_JOIN", employedDays: 17, earnedGross: 6854.84, attendanceBonus: 0 });
  });
  it("unpaid leave reduces earned gross", () => {
    const days = october((date, b) => (["2026-10-05", "2026-10-06", "2026-10-07"].includes(date.toISOString().slice(0, 10)) ? { ...b, status: "LEAVE", leaveCode: "LWP", leavePaid: false, otHours: 0 } : b));
    const r = computePay({ year: 2026, month: 10, emp: EMP, days }, POLICY)!;
    expect(r.unpaidLeaveDays).toBe(3);
    expect(r.earnedGross).toBe(11290.32);
  });
  it("splits OT into statutory and excess hours (all paid)", () => {
    const days = october((date, b) => (date.toISOString().slice(0, 10) === "2026-10-01" ? { ...b, otHours: 3 } : b));
    const r = computePay({ year: 2026, month: 10, emp: EMP, days }, POLICY)!;
    expect(r.otHours).toBe(53);
    expect(r.otHoursNormal).toBe(52);
    expect(r.otHoursExcess).toBe(1);
    expect(r.otAmount).toBe(round2(53 * 64.42));
  });
  it("not employed in the month ⇒ null", () => {
    expect(computePay({ year: 2026, month: 10, emp: { ...EMP, joinDate: d("2026-11-01") }, days: [] }, POLICY)).toBeNull();
  });
});

describe("final settlement", () => {
  const P = { serviceBenefitBasis: "BASIC", elRateBasis: "GROSS" };
  it("reproduces the sample bill: 6.44 EL days on Tk 13,550 = Tk 2,909", () => {
    const r = computeSettlement(
      { type: "RESIGNATION", joinDate: d("2021-09-12"), lastDay: d("2024-07-31"), permanent: true, basic: 7400, gross: 13550, noticeDaysGiven: 60, elBalanceDays: 6.44 },
      P,
    );
    expect(r.serviceBenefit).toBe(0);
    expect(r.elAmount).toBe(2908.75);
    expect(r.netPayable).toBe(2909);
  });
  it("resignation after 7 years: 14 days per year", () => {
    const r = computeSettlement({ type: "RESIGNATION", joinDate: d("2019-01-01"), lastDay: d("2026-06-30"), permanent: true, basic: 9000, gross: 16000, noticeDaysGiven: 60, elBalanceDays: 0 }, P);
    expect(r.benefitDays).toBe(98);
    expect(r.serviceBenefit).toBe(29400);
  });
  it("resignation after 12 years: 30 days per year", () => {
    const r = computeSettlement({ type: "RESIGNATION", joinDate: d("2014-01-01"), lastDay: d("2026-06-30"), permanent: true, basic: 9000, gross: 16000, noticeDaysGiven: 60, elBalanceDays: 0 }, P);
    expect(r.benefitDays).toBe(360);
  });
  it("resignation without notice deducts 60 days for a permanent worker", () => {
    const r = computeSettlement({ type: "RESIGNATION", joinDate: d("2024-01-01"), lastDay: d("2026-06-30"), permanent: true, basic: 6000, gross: 11000, noticeDaysGiven: 0, elBalanceDays: 0 }, P);
    expect(r.noticeDeductDays).toBe(60);
    expect(r.noticeDeduction).toBe(12000);
  });
  it("lefty (deemed resignation) has no notice deduction", () => {
    const r = computeSettlement({ type: "LEFTY", joinDate: d("2024-01-01"), lastDay: d("2026-06-30"), permanent: true, basic: 6000, gross: 11000, noticeDaysGiven: 0, elBalanceDays: 0 }, P);
    expect(r.noticeDeduction).toBe(0);
  });
  it("termination without notice pays 120 days plus 30 days per year", () => {
    const r = computeSettlement({ type: "TERMINATION", joinDate: d("2020-01-01"), lastDay: d("2026-06-30"), permanent: true, basic: 6000, gross: 11000, noticeDaysGiven: 0, elBalanceDays: 0 }, P);
    expect(r.noticePayDays).toBe(120);
    expect(r.benefitDays).toBe(180);
  });
  it("death benefit needs 2 completed years; a part-year over 6 months counts", () => {
    const short = computeSettlement({ type: "DEATH", joinDate: d("2024-08-01"), lastDay: d("2026-06-30"), permanent: true, basic: 6000, gross: 11000, noticeDaysGiven: 0, elBalanceDays: 0 }, P);
    expect(short.benefitDays).toBe(0);
    const long = computeSettlement({ type: "DEATH", joinDate: d("2023-11-01"), lastDay: d("2026-06-30"), permanent: true, basic: 6000, gross: 11000, noticeDaysGiven: 0, elBalanceDays: 0 }, P);
    expect(long.benefitDays).toBe(90);
  });
});

describe("festival bonus", () => {
  const rule = { cutoffDate: d("2026-03-20"), basis: "BASIC", religions: "ALL", slabs: DEFAULT_SLABS };
  it("slabs by completed months of service", () => {
    expect(bonusFor({ joinDate: d("2025-01-10"), basic: 6700, gross: 12500, religion: "ISLAM" }, rule)).toEqual({ serviceMonths: 14, percent: 100, amount: 6700 });
    expect(bonusFor({ joinDate: d("2025-09-01"), basic: 6700, gross: 12500, religion: "ISLAM" }, rule)?.percent).toBe(50);
    expect(bonusFor({ joinDate: d("2026-01-01"), basic: 6700, gross: 12500, religion: "ISLAM" }, rule)?.amount).toBe(0);
  });
  it("religion-specific festivals", () => {
    expect(bonusFor({ joinDate: d("2020-01-01"), basic: 6700, gross: 12500, religion: "ISLAM" }, { ...rule, religions: "HINDU" })).toBeNull();
  });
});

describe("leave", () => {
  it("pro-rates casual leave for mid-year joiners", () => {
    expect(fixedEntitlement(10, 2026, d("2026-07-01"), true)).toBe(5);
    expect(fixedEntitlement(10, 2026, d("2025-03-01"), true)).toBe(10);
    expect(fixedEntitlement(14, 2026, d("2027-01-01"), true)).toBe(0);
  });
  it("earned leave accrues 1 day per 18 days worked, capped", () => {
    expect(elBalance({ opening: 0, daysWorked: 270, perAccrual: 18, availed: 5, encashed: 0, maxBalance: 40 })).toEqual({ earned: 15, availed: 5, encashed: 0, balance: 10 });
    expect(elBalance({ opening: 30, daysWorked: 540, perAccrual: 18, availed: 0, encashed: 0, maxBalance: 40 }).balance).toBe(40);
    expect(elEncashable(10, 50)).toBe(5);
  });
});

describe("maternity", () => {
  it("eligible worker gets 112 days at the 3-month average daily wage", () => {
    const r = computeMaternity({ joinDate: d("2025-01-01"), expectedDelivery: d("2026-06-01"), survivingChildren: 1, wages3m: 45000, daysWorked3m: 75 });
    expect(r).toMatchObject({ benefitEligible: true, avgDailyWage: 600, totalBenefit: 67200, firstInstallment: 33600, secondInstallment: 33600 });
    expect(r.leaveFrom.toISOString().slice(0, 10)).toBe("2026-04-06");
    expect(r.leaveTo.toISOString().slice(0, 10)).toBe("2026-07-26");
  });
  it("two surviving children: leave but no cash benefit", () => {
    const r = computeMaternity({ joinDate: d("2020-01-01"), expectedDelivery: d("2026-06-01"), survivingChildren: 2, wages3m: 45000, daysWorked3m: 75 });
    expect(r.benefitEligible).toBe(false);
    expect(r.totalBenefit).toBe(0);
  });
});

describe("working-time compliance", () => {
  const L = { dailyOtLimit: 2, dailyHoursLimit: 10, weeklyHoursLimit: 60, maxConsecutiveDays: 6 };
  const days = eachDay(d("2026-10-03"), d("2026-10-16")).map((date) => ({
    date, dayType: date.getUTCDay() === 5 ? "WEEKEND" : "WORKDAY", status: "PRESENT", workMin: 11 * 60, otMin: 180, otHours: 3,
  }));
  it("day hours = regular time + recognised overtime", () => {
    expect(dayHours({ date: d("2026-10-01"), dayType: "WORKDAY", status: "PRESENT", workMin: 620, otMin: 140, otHours: 2 })).toBe(10);
    expect(dayHours({ date: d("2026-10-01"), dayType: "WORKDAY", status: "PRESENT", workMin: 720, otMin: 240, otHours: 0 })).toBe(12);
  });
  it("weekly totals over 60 hours are flagged", () => {
    const weeks = weekBuckets(days, L);
    expect(weeks[0].hours).toBe(77);
    expect(weeks[0].overLimit).toBe(true);
  });
  it("detects missing weekly rest", () => expect(maxConsecutiveWorked(days)).toBe(14));
  it("night window and consent validity", () => {
    expect(overlapsNight({ date: d("2026-10-01"), dayType: "WORKDAY", status: "PRESENT", workMin: 0, otHours: 0, inTime: t("2026-10-01", "08:00"), outTime: t("2026-10-01", "22:30") })).toBe(true);
    expect(overlapsNight({ date: d("2026-10-01"), dayType: "WORKDAY", status: "PRESENT", workMin: 0, otHours: 0, inTime: t("2026-10-01", "08:00"), outTime: t("2026-10-01", "21:00") })).toBe(false);
    expect(nightConsentValid(d("2026-01-01"), false, d("2026-10-01"))).toBe(true);
    expect(nightConsentValid(d("2025-01-01"), false, d("2026-10-01"))).toBe(false);
  });
  it("utcDate sanity", () => expect(utcDate(2026, 10, 22).toISOString()).toBe("2026-10-22T00:00:00.000Z"));
});
