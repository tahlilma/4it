import Link from "next/link";
import { REPORT_GROUPS, REPORTS, STATUTORY } from "@/lib/reports/registry";
import { Code, Def, Goto, H3, type HelpTopic, P, Rules, Step, Steps, Tip, UL } from "../kit";

const FORMS: [string, string, string][] = [
  ["Form 6", "Identity card", "Printed: ID Card report or the employee's Documents tab"],
  ["Form 7", "Service book", "Printed: Service Book report"],
  ["Form 8", "Register of workers", "Printed: Worker Register report"],
  ["Form 9", "Leave register / leave book", "Printed: Leave Register report"],
  ["Form 15", "Certificate of age and fitness", "Printed: Age and Fitness Certificate report"],
  ["Form 18", "Notice of pregnancy", "Recorded when a maternity case is opened"],
  ["Form 34", "Attendance and overtime register", "Printed: Daily Attendance & Overtime Register report"],
  ["Form 35", "Women's consent to night work", "Recorded on the employee's file (consent date)"],
  ["Form 38", "Wage register and pay slip", "Printed: Salary Sheet and Pay Slip reports"],
  ["Form 41", "Nomination form", "Printed: Nominee Form report"],
];

export const reports: HelpTopic = {
  slug: "reports",
  title: "Reports & documents",
  summary: "How to run, print and export reports — and what every report, letter and statutory form in the Report Center is for.",
  icon: "document",
  color: "blue",
  keywords: "report center print pdf excel export statutory forms letters job card salary sheet pay slip register bgmea bkmea biometric database",
  sections: () => [
    {
      id: "using",
      title: "Running a report",
      body: (
        <>
          <Steps>
            <Step title="Find it">
              Open <Goto href="/reports">Report Center</Goto>. Reports are grouped (Personal File, Leave, Increment, Employee, Attendance, Bills, Payroll); type in <b>Search reports</b> to find one by name — Bangla
              names work too.
            </Step>
            <Step title="Choose the filters">Pick the date, month or period, and narrow by department, section, employee IDs and so on. Leave a filter on &ldquo;All&rdquo; to include everyone.</Step>
            <Step title="Show Report">The report appears as a page preview, laid out exactly as it will print.</Step>
            <Step title="Print or export">
              <b>Print / PDF</b> prints it or saves a PDF. <b>Excel</b> (on tabular reports) downloads the same data as a spreadsheet.
            </Step>
          </Steps>
          <UL>
            <Def term="Formats">some reports offer formats — for example the job card in actual, compliance and buyer layouts. They are different presentations of the same records; see Compliance Monitor for why.</Def>
            <Def term="Letters and forms">print one page per employee. Enter several IDs separated by commas to print a batch.</Def>
          </UL>
          <Tip>An employee&apos;s own documents are quicker from their profile: open the person → Documents → Print.</Tip>
        </>
      ),
    },
    {
      id: "forms",
      title: "Government (statutory) forms",
      body: (
        <>
          <P>These are the forms the Bangladesh Labour Rules 2015 require factories to keep, and where each one lives in the app. The printed ones follow the official layout.</P>
          <Rules head={["Form", "What it is", "In the app"]} rows={FORMS.map(([f, d, w]) => [<Code key={f}>{f}</Code>, d, w])} />
        </>
      ),
    },
    {
      id: "bgmea",
      title: "BGMEA / BKMEA worker database",
      body: (
        <>
          <P>
            The associations keep a biometric database of every worker. The <b>Excel Export File (Biometric BGMEA &amp; BKMEA)</b> report produces the upload file: choose the association, press Show Report, then{" "}
            <b>Excel</b>.
          </P>
          <Tip>The associations change their templates from time to time. Compare the columns with the template you were last given before uploading.</Tip>
        </>
      ),
    },
    {
      id: "catalogue",
      title: "Every report, explained",
      body: (
        <>
          <P>The full list, grouped as in the Report Center. Click a name to open it.</P>
          {REPORT_GROUPS.map((g) => (
            <div key={g}>
              <H3>{g}</H3>
              <ul className="my-2 divide-y divide-sep overflow-hidden rounded-[12px] bg-surface ring-1 ring-sep ring-inset">
                {REPORTS.filter((r) => r.group === g).map((r) => (
                  <li key={r.slug} className="px-3.5 py-2.5">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <Link href={`/reports/${r.slug}`} className="text-[14.5px] font-medium text-ink-blue hover:underline">
                        {r.title}
                      </Link>
                      {r.titleBn && <span className="font-bn text-[13px] text-label-2">{r.titleBn}</span>}
                      {STATUTORY[r.slug] && <Code>{STATUTORY[r.slug]}</Code>}
                    </div>
                    <p className="mt-0.5 text-[13.5px] leading-relaxed text-label-2">{r.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      ),
    },
  ],
};
