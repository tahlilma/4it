import { Calc, Def, Example, Goto, H3, type HelpTopic, Law, P, Plain, Setting, Step, Steps, Tip, tk, UL, Warn } from "../kit";

const r2 = (n: number) => Math.round(n * 100) / 100;

export const payroll: HelpTopic = {
  slug: "payroll",
  title: "Payroll",
  summary: "How each month's wages are calculated — overtime, deductions, bonuses — and how a payroll is processed, paid and locked.",
  icon: "cash",
  color: "green",
  keywords: "salary wages pay slip salary sheet overtime ot rate absence deduction attendance bonus holiday duty stamp tax advance arrear addition deduction process lock unlock payment bank cash mobile banking form 38",
  sections: ({ company: c }) => {
    // Worked example built from this factory's own policy.
    const gross = 12500, basic = 6700, days = 31, absent = 1, otH = 12;
    const absentBase = c.absentBasis === "GROSS" ? gross : basic;
    const absentDiv = c.absentDivisor === "MONTH_DAYS" ? days : 30;
    const absentDed = r2((absent * absentBase) / absentDiv);
    const rate = r2((basic * c.otMultiplier) / c.otDivisor);
    const ot = r2(otH * rate);
    const payable = r2(gross - absentDed + ot);
    const net = Math.round(payable - c.stampCash);
    return [
      {
        id: "overview",
        title: "The big picture",
        body: (
          <>
            <P>
              Wages are calculated once a month, after the month ends, from the <b>processed attendance</b> of that month. The app works out each person&apos;s pay from their salary, the days they worked, their
              overtime, and any additions or deductions you have entered.
            </P>
            <Plain>
              If the attendance and leave are right, the payroll will be right. Most payroll questions are really attendance questions — check the person&apos;s attendance calendar first.
            </Plain>
          </>
        ),
      },
      {
        id: "calculation",
        title: "How one person's pay is worked out",
        body: (
          <>
            <Steps>
              <Step title="Days employed">
                Normally the whole month. Someone who joined or left during the month is paid only for the days they were employed — their gross is divided by the days in the month and multiplied by the days they were
                employed. Leave without pay reduces these days too.
              </Step>
              <Step title="Absence deduction">
                Each day absent without leave is deducted at <Setting label="your rule" value={`${c.absentBasis === "GROSS" ? "gross" : "basic"} ÷ ${c.absentDivisor === "MONTH_DAYS" ? "days in month" : "30"}`} />{" "}
                per day.
              </Step>
              <Step title="Overtime">
                Overtime hours × the hourly OT rate. The rate is <Setting label="your formula" value={`basic × ${c.otMultiplier} ÷ ${c.otDivisor}`} />.
              </Step>
              <Step title="Attendance bonus">A fixed amount (set on the designation) for a perfect month — see below.</Step>
              <Step title="Holiday-duty allowance">For staff who don&apos;t get overtime but worked on a holiday.</Step>
              <Step title="Additions">Arrears and other additions entered for the month.</Step>
              <Step title="Deductions">The month&apos;s advance instalment, the revenue stamp, income tax and any other lawful deduction.</Step>
              <Step title="Net pay">Everything added, deductions taken away, rounded to whole taka. This is what the person receives.</Step>
            </Steps>
          </>
        ),
      },
      {
        id: "example",
        title: "A worked example",
        body: (
          <Example>
            <p>
              A sewing operator earns a gross of {tk(gross)} (basic {tk(basic)}). In a {days}-day month she is absent one day, works {otH} hours of overtime and is paid in cash.
            </p>
            <Calc
              lines={[
                ["Gross salary (full month)", tk(gross)],
                [`Absence: 1 day × ${c.absentBasis === "GROSS" ? "gross" : "basic"} ÷ ${absentDiv}`, `− ${tk(absentDed)}`],
                [`Overtime: ${otH} h × ${tk(rate)} per hour`, `+ ${tk(ot)}`],
                ["Attendance bonus (not earned — she was absent)", tk(0)],
                ["Gross payable", tk(payable)],
                ["Revenue stamp (cash payment)", `− ${tk(c.stampCash)}`],
              ]}
              total={["Net pay (rounded)", tk(net)]}
            />
          </Example>
        ),
      },
      {
        id: "overtime",
        title: "Overtime",
        body: (
          <>
            <P>
              Overtime is paid only to employees marked as getting overtime (most workers; usually not officers). Hours come from processed attendance and are already rounded by the shift&apos;s rules.
            </P>
            <Law>
              Section 108: overtime is paid at twice the ordinary rate of basic wage. Rule 102 fixes the hourly rate as basic × 2 ÷ 208 (208 = 48 hours a week × 52 weeks ÷ 12 months). The app will not let anyone set the
              multiplier below 2.
            </Law>
            <P>
              The law allows up to <Setting label="your daily OT limit" value={`${c.dailyOtLimit} h`} /> of overtime a day. Hours beyond the limit are still paid — nobody loses money — but they appear in the{" "}
              <b>Extra OT</b> report and the Compliance Monitor, so the cause can be fixed.
            </P>
          </>
        ),
      },
      {
        id: "bonus-allowance",
        title: "Attendance bonus and holiday duty",
        body: (
          <>
            <H3>Attendance bonus</H3>
            <P>A reward for a perfect month. It is paid only if all of these are true:</P>
            <UL>
              <li>the person was employed for the whole month;</li>
              <li>no day was absent, and no day is missing from the attendance records;</li>
              <li>
                late days are no more than <Setting label="your limit" value={c.attBonusMaxLate} />;
              </li>
              <li>{c.attBonusAllowLeave ? "approved leave is allowed under your policy;" : "no leave was taken (your policy does not pay the bonus in a month with leave);"}</li>
              <li>the person&apos;s designation has an attendance-bonus amount.</li>
            </UL>
            <H3>Holiday-duty allowance</H3>
            <P>
              {c.holidayAllowBasis === "NONE"
                ? "Your policy does not pay a holiday-duty allowance."
                : `Staff without overtime who work on a weekly or festival holiday get one day's ${c.holidayAllowBasis === "BASIC" ? "basic" : "gross"} (÷ 30) for each such day.`}
            </P>
          </>
        ),
      },
      {
        id: "adjustments",
        title: "Additions, deductions and advances",
        body: (
          <>
            <UL>
              <Def term="Arrear">money owed from an earlier month (for example a late increment).</Def>
              <Def term="Other addition">any other payment, such as a special allowance.</Def>
              <Def term="Other deduction">a lawful deduction — for example for damage or loss proved under the Act.</Def>
            </UL>
            <P>
              Enter these per person, per month, in <Goto href="/payroll/adjustments">Additions &amp; Deductions</Goto>. They are picked up the next time that month is processed.
            </P>
            <H3>Advances</H3>
            <P>
              A salary advance is entered once in <Goto href="/payroll/advances">Advances</Goto> with the total and the monthly instalment. Each payroll deducts the instalment automatically until it is repaid. If the person
              leaves, the remaining balance is recovered in the final settlement. If they repay in cash, use <b>Repaid in cash</b> to close it.
            </P>
            <Law>Section 125 lists the only deductions an employer may make from wages, and section 126 limits fines. Use deductions only for lawful reasons and write the reason down.</Law>
          </>
        ),
      },
      {
        id: "processing",
        title: "Processing the month",
        body: (
          <>
            <Steps>
              <Step title="Open the month">
                In <Goto href="/payroll">Salary Processing</Goto> choose the wage month and press <b>Open Payroll</b>.
              </Step>
              <Step title="Process payroll">
                Press <b>Process payroll</b>. Every employee who worked any day of the month gets a pay record. The state changes from <b>Draft</b> to <b>Processed</b>.
              </Step>
              <Step title="Review">
                The payroll page shows the totals (employees, gross, overtime, net), a breakdown by department and by payment channel, and links to every report for the month — salary sheet, pay slips, bank advice and more.
              </Step>
              <Step title="Fix and re-process">
                Found a mistake? Correct the attendance, leave, salary or adjustment, then press <b>Re-process</b>. You can re-process as often as needed until the month is locked.
              </Step>
            </Steps>
            <Tip>Pay records are grouped as regular, new joiner, separated, or joined-and-separated, so you can see at a glance why someone&apos;s pay is partial.</Tip>
          </>
        ),
      },
      {
        id: "paying",
        title: "Paying wages",
        body: (
          <>
            <P>
              Pay within <Setting label="your deadline" value={`${c.wageDueWorkingDays} working days`} /> after the month ends. The payroll page shows the due date and warns you when it has passed.
            </P>
            <UL>
              <Def term="Cash">print the pay slips (Form 38, in Bangla) for signatures. A revenue stamp of {tk(c.stampCash)} is deducted for cash payments.</Def>
              <Def term="Bank">print the bank advice letter for the company account.</Def>
              <Def term="Mobile banking">print the bKash / Nagad / Rocket / Upay list.</Def>
            </UL>
            <Law>Section 123: wages must be paid before the end of the seventh working day after the last day of the wage period.</Law>
          </>
        ),
      },
      {
        id: "locking",
        title: "Locking and unlocking",
        body: (
          <>
            <P>
              After paying, press <b>Lock Payroll</b> and enter the payment date. A locked month is frozen: its attendance can&apos;t be re-processed and its leave and adjustments can&apos;t change, so what you paid will
              always match the records.
            </P>
            <Warn>
              Unlocking is possible for people with permission, but it asks for a reason and is written to the audit log. After unlocking, re-process, check, pay any difference and lock again.
            </Warn>
            <P>Income tax is a fixed monthly amount set on each employee&apos;s file. Provident fund and workers&apos; participation fund are not handled by the app.</P>
          </>
        ),
      },
    ];
  },
};
