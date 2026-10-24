import type { ReactNode } from "react";
import { Goto, type HelpTopic } from "../kit";

const QA: [string, string, ReactNode][] = [
  [
    "absent-but-came",
    "Someone came to work but shows as absent.",
    <>
      Check, in order: (1) Is the day processed? Run <Goto href="/attendance/process">Process Attendance</Goto>. (2) Are they enrolled on the machine they used? See <Goto href="/attendance/devices">Punch Machines</Goto>. (3) Is
      their <b>punch machine ID</b> in the employee file the same as on the machine? (4) Did the machine work that day? If they really came but there is no punch, add a <Goto href="/attendance/manual">Manual Entry</Goto>{" "}
      with the reason.
    </>,
  ],
  [
    "no-new-punches",
    "Today's punches aren't showing.",
    <>
      The dashboard&apos;s &ldquo;Punched in today&rdquo; is live, but daily attendance only updates after processing. Pull punches from the machine (or wait for the scheduled sync), then process the day. If pulling fails,
      use <b>Test connection</b> and check the machine&apos;s network cable and IP address.
    </>,
  ],
  [
    "late-wrong",
    "People show as late, but they weren't.",
    <>The machine&apos;s clock is probably wrong. Use <b>Sync clock</b> on the Punch Machines screen, then re-process the affected days. Also check the shift&apos;s start time and late grace.</>,
  ],
  [
    "ot-wrong",
    "Overtime looks too low or too high.",
    <>
      Overtime is rounded in whole units by the shift (for example 1 h 49 min pays as 1 hour if the round-up point is 50 min). Only people marked as getting overtime receive it. A single punch has no overtime because the
      real out-time is unknown — correct it with a manual entry.
    </>,
  ],
  [
    "cant-change-locked",
    "I can't re-process or change last month.",
    <>
      That month&apos;s payroll is locked, which freezes its attendance, leave and adjustments so they always match what was paid. Someone with permission can unlock it on the payroll page (a reason is required and
      recorded); then correct, re-process, pay any difference and lock again.
    </>,
  ],
  [
    "cant-save-employee",
    "The app won't save a new employee.",
    <>
      Read the red messages under the fields. The usual reasons: the person is younger than the minimum hiring age, the salary is below the grade&apos;s minimum wage, or the salary parts don&apos;t add up to the gross —
      press <b>Split gross</b> to fix that.
    </>,
  ],
  [
    "leave-refused",
    "A leave application is refused.",
    <>The person may not have enough balance of that type, may be asking for earned leave before completing a year of service, may already have leave on one of those days, or the month&apos;s payroll may be locked.</>,
  ],
  [
    "missing-menu",
    "I can't see a menu item or a button that a colleague has.",
    <>
      Your role doesn&apos;t include it. See what your role allows in <Goto href="/account">My Account</Goto>, and ask an administrator if you need more.
    </>,
  ],
  [
    "no-excel",
    "There is no Excel button on a report.",
    <>Letters and forms (appointment letters, ID cards, pay slips…) are documents, not tables, so they only print. Tabular reports have both Print / PDF and Excel.</>,
  ],
  [
    "print-cut",
    "The printout is cut off or too small.",
    <>
      Use the report&apos;s <b>Print / PDF</b> button rather than the browser menu. In the print window, keep the scale at 100% (or &ldquo;Default&rdquo;) and margins at &ldquo;Default&rdquo;; wide registers already choose
      landscape or legal paper.
    </>,
  ],
  [
    "salary-change",
    "How do I change someone's salary?",
    <>
      Use <Goto href="/payroll/increments">Increment &amp; Promotion</Goto> — propose, approve, apply. It keeps the history and prints the letter. Editing the salary directly is possible only with the &ldquo;change
      salaries&rdquo; permission and asks for a reason.
    </>,
  ],
  [
    "password",
    "I forgot my password.",
    <>Ask your administrator to set a new one in Users &amp; Roles. After signing in, change it to one only you know in My Account.</>,
  ],
  [
    "dark",
    "Why is the app dark on some computers?",
    <>It follows the computer&apos;s or phone&apos;s light / dark setting. Printed documents are always black on white.</>,
  ],
];

export const faq: HelpTopic = {
  slug: "faq",
  title: "Questions & troubleshooting",
  summary: "Quick answers to the questions people ask most — and what to check when something looks wrong.",
  icon: "question",
  color: "orange",
  keywords: "problem help error not working absent wrong late overtime locked cannot save print excel password",
  sections: () =>
    QA.map(([id, q, a]) => ({
      id,
      title: q,
      body: <p className="my-2 text-[15px] leading-[1.7] text-label">{a}</p>,
    })),
};
