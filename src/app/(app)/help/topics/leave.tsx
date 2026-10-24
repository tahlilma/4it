import { Code, Def, Goto, H3, type HelpTopic, Law, P, Plain, Rules, Setting, Step, Steps, Tip, UL, Warn } from "../kit";

export const leave: HelpTopic = {
  slug: "leave",
  title: "Leave",
  summary: "Types of leave, how much each person gets, how balances grow, and how applications are entered, approved and cancelled.",
  icon: "calendar",
  color: "purple",
  keywords: "casual sick earned annual maternity compensatory without pay cl sl el ml co lwp balance apply approve reject cancel pro rata holiday",
  sections: ({ company, leaveTypes }) => [
    {
      id: "types",
      title: "Types of leave",
      body: (
        <>
          <P>These are the leave types set up in your factory:</P>
          <Rules
            head={["Code", "Leave", "How much", "Paid?"]}
            rows={leaveTypes.map((t) => [
              <Code key={t.code}>{t.code}</Code>,
              <span key="n">
                {t.nameEn} <span className="font-bn text-label-2">({t.nameBn})</span>
              </span>,
              t.accrual === "EARNED" ? `1 day for every ${company.elDaysPerAccrual} days worked` : t.annualDays ? `${t.annualDays} days ${t.accrual === "FIXED" ? "a year" : ""}` : "As granted",
              t.paid ? "Yes" : "No",
            ])}
          />
          <UL>
            <Def term="Casual leave (CL)">for personal needs at short notice.</Def>
            <Def term="Sick leave (SL)">when unwell; longer sick leave normally needs a doctor&apos;s certificate.</Def>
            <Def term="Earned leave (EL)">also called annual leave — it builds up as the person works (see below).</Def>
            <Def term="Maternity leave (ML)">16 weeks around childbirth. It is recorded through the Maternity Benefit screen, which also works out the payment.</Def>
            <Def term="Compensatory leave (CO)">a day off given in place of a holiday on which the person worked.</Def>
            <Def term="Leave without pay (LWP)">approved absence that is not paid; it reduces the month&apos;s wages but is not counted as unauthorised absence.</Def>
          </UL>
          <Law>Casual leave 10 days a year (s.115), sick leave 14 days a year (s.116), earned leave one day for every 18 days of work (s.117), maternity 16 weeks (s.46).</Law>
        </>
      ),
    },
    {
      id: "entitlement",
      title: "How much leave each person has",
      body: (
        <>
          <H3>Casual and sick leave</H3>
          <P>
            These are given per calendar year (January to December) and do not carry over into the next year. Someone who joins in the middle of the year gets a proportional share — for example a person joining on 1 July
            gets about half.
          </P>
          <H3>Earned leave</H3>
          <P>
            Earned leave grows with work: one day for every <Setting label="days worked" value={company.elDaysPerAccrual} />. It can be taken, or encashed, only after <Setting label="service" value={`${company.elEligibleMonths} months`} />.
            {company.elMaxBalance > 0 && (
              <>
                {" "}
                The balance can&apos;t grow beyond <Setting label="maximum" value={`${company.elMaxBalance} days`} />.
              </>
            )}{" "}
            Up to <Setting label="encashable" value={`${company.elEncashMaxPercent}%`} /> of the balance can be cashed in once a year, and whatever is left is paid in full when the person leaves.
          </P>
          <Plain>A worker who works 26 days a month earns roughly one and a half days of earned leave each month — about 17 days a year.</Plain>
          <Tip>
            Balances are on each employee&apos;s <b>Leave</b> tab and in the <Goto href="/reports/leave-balances">Leave Balances</Goto> report.
          </Tip>
        </>
      ),
    },
    {
      id: "apply",
      title: "Entering and approving leave",
      body: (
        <>
          <Steps>
            <Step title="Enter the application">
              In <Goto href="/leave">Leave Applications</Goto>, fill in <b>New leave application</b>: employee ID, leave type, first and last day, and the reason. If you are allowed to approve, you can tick{" "}
              <b>Approve now</b>.
            </Step>
            <Step title="Approve or reject">
              Pending applications show <b>Approve</b> and <b>Reject</b> buttons for people with permission. The dashboard counts how many are waiting.
            </Step>
            <Step title="Attendance updates itself">Once approved, those days show the leave code instead of &ldquo;absent&rdquo;.</Step>
          </Steps>
          <UL>
            <Def term="Overlaps are refused">a person can&apos;t have two leave applications covering the same day.</Def>
            <Def term="Weekly holidays inside leave">a weekly holiday that falls inside casual or sick leave counts as part of the leave.</Def>
            <Def term="Not enough balance">the app refuses leave that is more than the person has left of that type, and refuses earned leave before the qualifying service.</Def>
            <Def term="Half days">you can enter the number of days in halves — for example 0.5 for half a day — up to the length of the date range.</Def>
          </UL>
          <P>
            To print the signed application form for the file, use <b>Print form</b> next to the application, or the person&apos;s Documents tab.
          </P>
        </>
      ),
    },
    {
      id: "cancel",
      title: "Cancelling leave",
      body: (
        <>
          <P>
            An approved leave can be cancelled with <b>Cancel</b> (for example if the person came back early). Attendance for those days is re-processed, so they show whatever the punches say.
          </P>
          <Warn>Leave in a month whose payroll is already locked can&apos;t be changed — the month is frozen.</Warn>
        </>
      ),
    },
    {
      id: "holidays",
      title: "Leave versus holidays",
      body: (
        <P>
          Festival and government holidays are not leave — they are in the <Goto href="/setup/holidays">Holiday Calendar</Goto> and apply to everyone. The weekly holiday (
          <Setting label="yours" value={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][company.weeklyHoliday] ?? "—"} />) is set in Company &amp; Policy.
        </P>
      ),
    },
  ],
};
