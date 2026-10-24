import { Goto, H3, type HelpTopic, Law, P, Plain, Setting, Step, Steps, Tip, Warn } from "../kit";

export const monthlyCycle: HelpTopic = {
  slug: "monthly-cycle",
  title: "The monthly cycle",
  summary: "The routine that keeps everything right: what to do every day, at the end of each month, a few times a year, and when people join or leave.",
  icon: "calendar",
  color: "orange",
  keywords: "routine workflow checklist daily month end steps process lock pay joining leaving yearly",
  sections: ({ company }) => [
    {
      id: "rhythm",
      title: "The rhythm in one picture",
      body: (
        <>
          <P>Almost everything in the app follows one flow:</P>
          <Plain>
            <b>Punches</b> come from the machines → the app <b>processes</b> them into daily attendance → leave and corrections are added → at month end the <b>payroll</b> is calculated from that attendance → wages are paid →
            the month is <b>locked</b> so it can never change quietly.
          </Plain>
          <P>If each step is done in order, the pay slips, registers and reports will all agree with each other automatically.</P>
        </>
      ),
    },
    {
      id: "daily",
      title: "Every working day",
      body: (
        <Steps>
          <Step title="Get the punches in">
            If the machines are connected to the network, punches are pulled automatically on a schedule. Otherwise use <Goto href="/attendance/devices">Punch Machines</Goto> → <b>Pull punches</b>, or{" "}
            <Goto href="/attendance/import">Import Punch Log</Goto> for a file copied from the machine.
          </Step>
          <Step title="Process attendance">
            <Goto href="/attendance/process">Process Attendance</Goto> turns raw punches into present / late / absent, working hours and overtime. The scheduled sync does this for you; run it by hand after imports or
            corrections.
          </Step>
          <Step title="Check yesterday">
            Open <Goto href="/attendance">Daily Attendance</Goto>. Look at the absent list and the <b>single punch</b> flags (someone punched in but not out, or the other way round).
          </Step>
          <Step title="Fix what is wrong — with a reason">
            For a forgotten punch, a broken machine or official duty outside the factory, use <Goto href="/attendance/manual">Manual Entry</Goto>. A reason is always required and is kept for the auditors.
          </Step>
          <Step title="Enter and approve leave">
            Leave applications go into <Goto href="/leave">Leave Applications</Goto>. Approved leave turns those days from &ldquo;absent&rdquo; into &ldquo;leave&rdquo; the next time attendance is processed.
          </Step>
        </Steps>
      ),
    },
    {
      id: "month-end",
      title: "After the month ends",
      body: (
        <>
          <Steps>
            <Step title="Finish the month's attendance and leave">Make sure the last days are processed and all leave for the month is approved or rejected.</Step>
            <Step title="Record extra payments and deductions">
              Arrears and other additions or deductions go in <Goto href="/payroll/adjustments">Additions &amp; Deductions</Goto>; salary advances and their monthly instalments in{" "}
              <Goto href="/payroll/advances">Advances</Goto>.
            </Step>
            <Step title="Apply increments that start this month">
              If someone&apos;s increment or promotion takes effect this month, apply it in <Goto href="/payroll/increments">Increment &amp; Promotion</Goto> <b>before</b> processing the payroll.
            </Step>
            <Step title="Process the payroll">
              In <Goto href="/payroll">Salary Processing</Goto> open the month and press <b>Process payroll</b>. You can re-process as many times as you need until it is locked.
            </Step>
            <Step title="Review">
              Read the salary sheet totals, the overtime, and the <Goto href="/compliance">Compliance Monitor</Goto>. Fix the cause of any mistake (attendance, leave, salary) and re-process.
            </Step>
            <Step title="Pay">
              Print pay slips, bank advice and mobile-banking lists from the payroll page. Pay within <Setting label="your deadline" value={`${company.wageDueWorkingDays} working days`} /> of the month end.
            </Step>
            <Step title="Lock the month">
              Press <b>Lock Payroll</b> and enter the payment date. Locking freezes that month&apos;s attendance, leave and adjustments.
            </Step>
          </Steps>
          <Law>Section 123 of the Labour Act: wages must be paid before the end of the seventh working day after the wage period.</Law>
          <Warn>Once a month is locked, its attendance can&apos;t be re-processed. If a mistake is found later, someone with permission must unlock it — they must give a reason, and the unlock is recorded.</Warn>
        </>
      ),
    },
    {
      id: "yearly",
      title: "A few times a year",
      body: (
        <>
          <H3>Twice a year — festival bonus</H3>
          <P>
            Before each major festival, prepare a bonus sheet in <Goto href="/payroll/bonus">Festival Bonus</Goto>, review it, pay it and lock it. Workers with a year&apos;s service must receive two festival bonuses a year.
          </P>
          <H3>Once a year — increments</H3>
          <P>
            Workers are due a yearly increment of <Setting label="your rate" value={`${company.incrementPercent}% of basic`} />. <Goto href="/payroll/increments">Increment &amp; Promotion</Goto> lists who is due; the
            proposals are approved and then applied.
          </P>
          <H3>Once a year — earned-leave encashment</H3>
          <P>
            Workers may cash in up to <Setting label="your limit" value={`${company.elEncashMaxPercent}%`} /> of their unused earned leave, once a year. See <Goto href="/payroll/el-encashment">EL Encashment</Goto>.
          </P>
          <H3>Every January — the calendar</H3>
          <P>
            Enter the new year&apos;s festival and government holidays in <Goto href="/setup/holidays">Holiday Calendar</Goto>, and check the minimum-wage grades whenever the government publishes a new gazette.
          </P>
        </>
      ),
    },
    {
      id: "joining",
      title: "When someone joins",
      body: (
        <Steps>
          <Step title="Create the employee">
            <Goto href="/employees/new">New Employee</Goto>. The app refuses anyone younger than <Setting label="minimum age" value={company.minHiringAge} /> or a salary below the grade minimum.
          </Step>
          <Step title="Enrol on the punch machine">From <Goto href="/attendance/devices">Punch Machines</Goto>, so their punches are recognised from the first day.</Step>
          <Step title="Print the joining documents">
            From the employee&apos;s <b>Documents</b> tab: appointment letter, ID card (Form 6), nominee form (Form 41) and age &amp; fitness certificate (Form 15). Record the dates they were issued in the personal file.
          </Step>
          <Step title="Add a photo and nominees">On the employee&apos;s Overview and Nominees tabs.</Step>
          <Step title="Confirm after probation">
            When probation ends (<Setting label="workers" value={`${company.probationWorkerMonths} months`} />, <Setting label="staff" value={`${company.probationStaffMonths} months`} />) set the confirmation date and print the
            confirmation letter. The service book (Form 7) must be opened within 15 days of confirmation.
          </Step>
        </Steps>
      ),
    },
    {
      id: "leaving",
      title: "When someone leaves",
      body: (
        <>
          <Steps>
            <Step title="Record the separation">
              <Goto href="/separations/new">Separation &amp; Settlement</Goto> — choose the type (resignation, termination, death…) and the last working day. The app calculates the final settlement.
            </Step>
            <Step title="Check and pay the settlement">
              Review the amounts, print the final settlement, pay within <Setting label="your deadline" value={`${company.settlementDueWorkingDays} working days`} />, then mark it as paid.
            </Step>
            <Step title="Remove them from the punch machines">So they can no longer enter the factory with their card or finger (an access-control requirement of buyers).</Step>
          </Steps>
          <Tip>
            Someone who simply stops coming is handled differently — through the <Goto href="/separations/lefty">Lefty cases</Goto> letters. See Separation &amp; settlement.
          </Tip>
        </>
      ),
    },
  ],
};
