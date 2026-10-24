import { Code, Def, Example, Goto, H3, type HelpTopic, Law, P, Plain, Rules, Step, Steps, Tip, UL, Warn, WEEKDAY_NAMES } from "../kit";

export const attendance: HelpTopic = {
  slug: "attendance",
  title: "Attendance",
  summary: "How punches become attendance: present, late, absent, overtime and bills — and how to get punches in, correct them and process them.",
  icon: "clock",
  color: "indigo",
  keywords: "punch machine fingerprint card zkteco device sync import attlog csv manual entry missed punch process late early out overtime ot rounding single punch night shift tiffin night bill codes job card",
  sections: ({ company, shifts }) => {
    const s = shifts[0];
    // Worked overtime for the example: out at 19:05 on this shift.
    const mins = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const otMin = s ? Math.max(0, mins("19:05") - (mins(s.outTime) + s.otStartAfterMin)) : 0;
    const unit = s ? Math.max(1, s.otRoundUnitMin) : 60;
    const units = Math.floor(otMin / unit) + (s && otMin % unit >= s.otRoundUpMin ? 1 : 0);
    const paid = (units * unit) / 60;
    const hm = (m: number) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
    return [
      {
        id: "how",
        title: "From punches to attendance",
        body: (
          <>
            <P>
              Every time someone presses their finger or card on a punch machine, the machine stores a <b>punch</b>: the person&apos;s punch ID and the exact time. Punches on their own are just a list of times. To know
              whether someone was present, late or absent, and how much overtime they did, the app <b>processes</b> the punches day by day using the rules of the person&apos;s <b>shift</b>.
            </P>
            <Plain>Raw punches are the evidence and are never changed. Processing reads them (plus approved leave and any manual corrections) and writes the daily attendance record. You can process the same days again at any time — the result is rebuilt from the evidence each time.</Plain>
            <H3>Which day does a punch belong to?</H3>
            <P>
              A punch belongs to a date from <b>4 hours before the shift starts</b>, for 24 hours. So for an 8 am shift, punches from 4 am today to 4 am tomorrow count as today. This is how night shifts that finish after
              midnight are counted on the night they started.
            </P>
            <H3>In and out</H3>
            <P>
              The first punch of the day is the <b>in-time</b> and the last is the <b>out-time</b>. Punches less than 10 minutes apart count as one (people often press twice). If there is only one punch, it is a{" "}
              <b>single punch</b> — see below.
            </P>
          </>
        ),
      },
      {
        id: "rules",
        title: "Late, early out, working hours and overtime",
        body: (
          <>
            <UL>
              <Def term="Late">arriving after the shift start plus the grace minutes. The late minutes are counted from the shift start.</Def>
              <Def term="Early out">leaving before the shift end (minus any early-out grace).</Def>
              <Def term="Working hours">counted from the shift start (coming early does not add working time) to the out-time, less the meal break once the day is longer than 5 hours.</Def>
              <Def term="Overtime (OT)">
                on a working day, the time after the shift end. It is paid in whole units: for example with a 60-minute unit that rounds up at 50 minutes, 1 h 49 min of OT pays as 1 hour and 1 h 50 min pays as 2 hours.
              </Def>
              <Def term="Holiday work">
                {company.holidayWorkAsOt ? "every hour worked on the weekly holiday or a festival holiday counts as overtime." : "is counted as present; it is not overtime under your current policy."}
              </Def>
              <Def term="OT eligibility">only employees marked as getting overtime receive OT hours. Staff without OT who work on a holiday get a holiday-duty allowance instead (see Payroll).</Def>
            </UL>
            {s && (
              <Example title={`Example — shift ${s.code} (${s.inTime}–${s.outTime})`}>
                <p>
                  Late grace {s.lateGraceMin} min · meal break {s.breakMinutes} min · OT unit {s.otRoundUnitMin} min, rounded up at {s.otRoundUpMin} min.
                </p>
                <p>
                  A worker punches in at 07:52 and out at 19:05. The in-time is before the start, so they are <b>present</b>, not late, and working time is counted from {s.inTime}. Overtime runs from {s.outTime} to 19:05 — {hm(otMin)} — which is paid as <b>{paid} hour{paid === 1 ? "" : "s"}</b> after rounding.
                </p>
              </Example>
            )}
            <Law>
              Section 100 limits a working day to 8 hours (10 with overtime) and section 108 says overtime is paid at twice the ordinary rate. The app pays every OT hour worked, and the Compliance Monitor flags days over
              the limits.
            </Law>
          </>
        ),
      },
      {
        id: "shifts",
        title: "Your shifts",
        body: (
          <>
            <P>
              Each employee has a shift. The rules above come from the shift, so check them in <Goto href="/setup/shifts">Shifts &amp; OT Rules</Goto>. These are your active shifts:
            </P>
            <Rules
              head={["Shift", "Hours", "Late grace", "Meal break", "OT unit / round up at", "Tiffin bill", "Night bill"]}
              rows={shifts.map((x) => [
                `${x.code} — ${x.name}`,
                `${x.inTime}–${x.outTime}`,
                `${x.lateGraceMin} min`,
                `${x.breakMinutes} min`,
                `${x.otRoundUnitMin} / ${x.otRoundUpMin} min`,
                x.tiffinAfter ? `out at ${x.tiffinAfter}+` : "—",
                x.nightAfter ? `out at ${x.nightAfter}+` : "—",
              ])}
            />
            <P>
              <b>Tiffin</b> and <b>night bills</b> are small allowances for people who stay late: anyone whose out-punch is at or after the shift&apos;s time earns that day&apos;s bill. The amounts are set in Company &amp;
              Policy.
            </P>
          </>
        ),
      },
      {
        id: "codes",
        title: "What the attendance codes mean",
        body: (
          <>
            <P>Registers, job cards and the employee calendar show one short code per day:</P>
            <Rules
              head={["Code", "Meaning"]}
              rows={[
                [<Code key="p">P</Code>, "Present"],
                [<Code key="l">L</Code>, "Late (present, but arrived after the grace time)"],
                [<Code key="a">A</Code>, "Absent on a working day, without leave"],
                [<Code key="w">W</Code>, `Weekly holiday (your weekly holiday is ${WEEKDAY_NAMES[company.weeklyHoliday] ?? "set in policy"})`],
                [<Code key="h">H</Code>, "Festival or government holiday from the holiday calendar"],
                [<Code key="wp">WP</Code>, "Worked on the weekly holiday"],
                [<Code key="hp">HP</Code>, "Worked on a holiday"],
                [<Code key="lv">CL, SL, EL, ML…</Code>, "On approved leave of that type (see Leave)"],
              ]}
            />
          </>
        ),
      },
      {
        id: "single",
        title: "Single punches",
        body: (
          <>
            <P>
              A single punch means the machine has only one record that day — usually someone forgot to punch out (or in). The app decides whether it was an &ldquo;in&rdquo; or an &ldquo;out&rdquo; by whether it is before or
              after the middle of the shift.
            </P>
            <P>
              {company.singlePunchPresent
                ? "Under your policy a single punch counts as present, but with no overtime, because the real out-time is unknown."
                : "Under your policy a single punch does not count as present — the day stays absent until it is corrected."}{" "}
              Either way, it is flagged on Daily Attendance and in the Single Punch report so it can be corrected with a manual entry.
            </P>
          </>
        ),
      },
      {
        id: "getting-punches",
        title: "Getting punches into the app",
        body: (
          <>
            <H3>From networked machines</H3>
            <P>
              <Goto href="/attendance/devices">Punch Machines</Goto> shows each machine with buttons:
            </P>
            <UL>
              <Def term="Test connection">checks the app can reach the machine.</Def>
              <Def term="Pull punches">copies new punches from the machine. Punches already copied are skipped, so pulling twice is safe.</Def>
              <Def term="Sync clock">sets the machine&apos;s clock to the correct time — wrong clocks make people look late or absent.</Def>
              <Def term="Enrol new employees">adds every active employee who is not yet on that machine.</Def>
              <Def term="Remove separated">deletes people who have left, so they can no longer get in.</Def>
              <Def term="Read device users">compares the machine&apos;s user list with the app.</Def>
            </UL>
            <Tip>Your IT person can schedule an automatic sync (for example every 30 minutes). It pulls every machine and re-processes the affected days by itself.</Tip>
            <H3>From a file</H3>
            <P>
              If a machine is not on the network, copy its log to a USB stick and use <Goto href="/attendance/import">Import Punch Log</Goto>. It accepts the ZKTeco <Code>attlog.dat</Code> file and simple CSV files with one
              punch per line (ID, then date and time). Day-first dates (21/10/2026) and AM/PM times are understood. Duplicates are skipped, so the same file can be imported twice safely. Leave{" "}
              <b>Re-process attendance</b> switched on to update attendance straight away.
            </P>
          </>
        ),
      },
      {
        id: "manual",
        title: "Correcting attendance (manual entry)",
        body: (
          <>
            <P>
              Sometimes the punches don&apos;t tell the truth: the machine was broken, a worker forgot to punch, or someone was on official duty outside the factory. Use <Goto href="/attendance/manual">Manual Entry</Goto>:
            </P>
            <Steps>
              <Step title="Add a missed punch">Enter the employee ID, the date and the in-time and/or out-time. An out-time earlier than the in-time means the next morning (night shift).</Step>
              <Step title="Or mark the day present / absent">For example official duty outside (present) or a punch that was made by mistake (absent).</Step>
              <Step title="Write the reason">A reason is always required — for example &ldquo;Device 1 was offline 07:30–09:00&rdquo;. It is shown to auditors and kept in the audit log.</Step>
            </Steps>
            <P>The day is re-processed immediately. You can remove a manual entry later if it was wrong; the removal is recorded too.</P>
            <Warn>Use manual entries only for real events. Every entry carries your name and reason, and auditors read them.</Warn>
          </>
        ),
      },
      {
        id: "processing",
        title: "Processing, re-processing and locked months",
        body: (
          <>
            <P>
              <Goto href="/attendance/process">Process Attendance</Goto> rebuilds attendance for the dates (and optionally the department) you choose. Do it after importing punches, after changing a shift or the holiday
              calendar, or whenever something looks out of date. <Goto href="/attendance">Daily Attendance</Goto> also has <b>Re-process this date</b>.
            </P>
            <P>
              Once a month&apos;s payroll is locked, that month can&apos;t be re-processed — this guarantees paid wages always match the attendance records. Unlock the payroll first if a correction is truly needed.
            </P>
          </>
        ),
      },
      {
        id: "daily-screen",
        title: "The Daily Attendance screen",
        body: (
          <>
            <P>
              <Goto href="/attendance">Daily Attendance</Goto> shows one day at a time (use <b>Previous Day</b> / <b>Next Day</b>). The figures at the top — Present, Late, Absent, On leave, Off day — are clickable filters.
              Each row shows the in and out times, status, late and early-out minutes, working hours, OT hours and flags such as <b>Single punch</b>, <b>Adjusted</b> (a manual entry was applied), <b>Tiffin</b> or <b>Night</b> (bills earned). <b>Correct</b> opens a manual entry for that person and
              date.
            </P>
          </>
        ),
      },
    ];
  },
};
