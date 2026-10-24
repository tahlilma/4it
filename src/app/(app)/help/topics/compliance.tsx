import { Goto, H3, type HelpTopic, Law, P, Plain, Rules, Setting, Tip } from "../kit";

export const compliance: HelpTopic = {
  slug: "compliance",
  title: "Compliance Monitor",
  summary: "Live checks of your records against the Labour Act and buyers' codes — what each warning means and how to fix it.",
  icon: "shield",
  color: "green",
  keywords: "audit buyer bsci wrap smeta ctpat labour act checks findings severity high medium low overtime hours child labour minimum wage documents",
  sections: ({ company: c }) => [
    {
      id: "what",
      title: "What it is",
      body: (
        <>
          <P>
            <Goto href="/compliance">Compliance Monitor</Goto> runs a set of checks over your current records every time you open it — the same things a labour inspector or a buyer&apos;s social-compliance auditor would look
            for. Each check is either <b>OK</b> or shows how many people or items are affected, with names you can click.
          </P>
          <Plain>It is an early-warning system. Fix the cause in the real records (a missing document, too much overtime, a late payment) — never by changing the evidence. The monitor then turns green by itself.</Plain>
          <P>
            The working-hours checks look at one month at a time; choose it in <b>Working-hours month</b> and press <b>Check</b>.
          </P>
        </>
      ),
    },
    {
      id: "severity",
      title: "High, medium and low",
      body: (
        <Rules
          head={["Level", "Meaning", "What to do"]}
          rows={[
            ["High", "A serious breach that auditors treat as a major finding (e.g. child labour, wages paid late, unsafe hours).", "Act today."],
            ["Medium", "A breach or a gap in records that must be corrected soon.", "Plan the fix this week."],
            ["Low", "Something to watch or tidy up.", "Fix when convenient."],
          ]}
        />
      ),
    },
    {
      id: "checks",
      title: "Every check, in plain words",
      body: (
        <>
          <H3>Workforce</H3>
          <Rules
            head={["Check", "What it looks for"]}
            rows={[
              ["Younger than the minimum hiring age", `Anyone under ${c.minHiringAge}. Child labour is the most serious finding there is.`],
              ["No NID or birth registration (age proof)", "Files without a document proving the person's age."],
              ["Not enrolled on any punch machine", "Active people the machines don't know — their attendance can't be recorded."],
            ]}
          />
          <H3>Personal file</H3>
          <Rules
            head={["Check", "What it looks for"]}
            rows={[
              ["Missing appointment letter, ID card, nominee form or fitness certificate", "Statutory documents not recorded as issued."],
              ["Service book not opened within 15 days of confirmation", "Form 7 must be opened soon after confirmation."],
              ["Probation ended but not confirmed", "People still on probation after the probation period."],
            ]}
          />
          <H3>Wages</H3>
          <Rules
            head={["Check", "What it looks for"]}
            rows={[
              ["Paid below the grade minimum wage", "Salaries lower than the gazette minimum for the grade."],
              ["Components don't add up to gross", "Basic and allowances that don't equal the gross."],
              ["Wages not paid within the deadline", `A payroll not locked as paid within ${c.wageDueWorkingDays} working days.`],
              ["Annual increment overdue", `More than 12 months since joining or the last increment (your rate: ${c.incrementPercent}% of basic).`],
              ["Fewer than two festival bonuses in 12 months", "People with a year's service who missed a festival bonus."],
            ]}
          />
          <H3>Working hours (for the chosen month)</H3>
          <Rules
            head={["Check", "What it looks for"]}
            rows={[
              ["Overtime above the daily limit", `More than ${c.dailyOtLimit} hours of OT on a working day. (All hours are still paid.)`],
              ["Working days longer than the limit", `Days longer than ${c.dailyHoursLimit} hours.`],
              ["Weeks over the limit", `Weeks longer than ${c.weeklyHoursLimit} hours including overtime.`],
              ["No weekly rest day", "Anyone who worked more than 6 days in a row."],
              ["Worked on weekly / festival holidays", "Make sure a substitute holiday was given."],
              ["Women working 10 pm – 6 am without consent", "Night work by women needs written consent (Form 35), renewed every 12 months."],
            ]}
          />
          <H3>Separation, safety and leave</H3>
          <Rules
            head={["Check", "What it looks for"]}
            rows={[
              ["Final settlements unpaid after the deadline", `Dues not paid within ${c.settlementDueWorkingDays} working days.`],
              ["Separated people still on punch machines", "People who left but can still enter the factory (an access-control requirement)."],
              ["Lefty cases with an overdue next letter", "Absence cases where the next letter is late."],
              ["Fire, rescue and first-aid team coverage", "Each team must cover at least 6% of the people in its area, and teams together at least 18% (r.55(10))."],
              ["Maternity instalment due but unpaid", "A maternity payment that should already have been paid."],
            ]}
          />
        </>
      ),
    },
    {
      id: "honest",
      title: "Why the monitor never hides anything",
      body: (
        <>
          <P>
            Some systems offer a &ldquo;compliance&rdquo; mode that quietly trims overtime or moves punch times to make reports look clean. This app does not, on purpose. Auditors compare pay slips, bank records, gate logs
            and interviews with workers; two sets of books are discovered and are treated as a zero-tolerance finding that can cost the factory its buyers.
          </P>
          <Law>
            The Labour Act requires correct registers (attendance and overtime, Form 34; wages, Form 38). Buyers&apos; codes (amfori BSCI, WRAP, SMETA) require transparent, accurate records.
          </Law>
          <Tip>
            The <b>Working Hours Compliance</b> report and the <b>Extra OT</b> report give the details behind the working-hours checks, ready to discuss with production managers.{" "}
            <Setting label="Daily OT limit" value={`${c.dailyOtLimit} h`} /> <Setting label="Weekly limit" value={`${c.weeklyHoursLimit} h`} />
          </Tip>
        </>
      ),
    },
  ],
};
