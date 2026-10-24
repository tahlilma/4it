import { ROLES } from "@/lib/constants";
import { PERM_LABELS, ROLE_BLURBS } from "@/lib/perm-labels";
import { permsOf } from "@/lib/rbac";
import { Code, Def, Goto, H3, type HelpTopic, Law, P, Plain, Rules, Step, Steps, Tip, UL, Warn } from "../kit";

export const gettingStarted: HelpTopic = {
  slug: "getting-started",
  title: "Getting started",
  summary: "What this app is for, how the screen is laid out, and the few ideas that make everything else easy.",
  icon: "flag",
  color: "blue",
  keywords: "introduction basics sign in login password screen sidebar search roles permissions print pdf dark mode phone",
  sections: () => [
    {
      id: "what-it-is",
      title: "What this app does",
      body: (
        <>
          <P>
            A garment factory has to keep careful records about every person who works there: who they are, when they came and went each day, what leave they took, what they were paid and why, and what they received when
            they left. These records are needed for two reasons — to pay people correctly and on time, and to prove to the labour inspector and to buyers&apos; auditors that the factory follows the law.
          </P>
          <P>This app keeps all of those records in one place and does the calculations for you:</P>
          <UL>
            <Def term="People">each worker&apos;s personal file, in English and Bangla, with photo, nominees and the statutory documents.</Def>
            <Def term="Attendance">reads the punch (fingerprint / card) machines and works out who was present, late or absent, and how much overtime they did.</Def>
            <Def term="Leave">casual, sick, earned and maternity leave, with balances worked out automatically.</Def>
            <Def term="Payroll">the monthly wages: basic, allowances, overtime, deductions and the final amount to pay.</Def>
            <Def term="Separation">what happens when someone leaves — the final settlement of all their dues.</Def>
            <Def term="Reports">more than seventy printable reports, letters and government forms, many in Bangla.</Def>
            <Def term="Compliance">a monitor that checks the records against the Labour Act and warns you about problems.</Def>
          </UL>
          <Plain>
            Think of it as the HR office&apos;s register books, the attendance machine, the wage calculator and the filing cabinet joined together — so the numbers in one place always agree with the numbers in another.
          </Plain>
        </>
      ),
    },
    {
      id: "one-record",
      title: "One honest set of records",
      body: (
        <>
          <P>
            Every report, pay slip and form comes from the same records. When the app offers different &ldquo;formats&rdquo; of a report (for example an <b>actual</b> and a <b>compliance</b> job card), those are different
            layouts of the same facts. A compliance layout adds checks and highlights problems; it never moves anybody&apos;s punch times or hides hours.
          </P>
          <Law>
            Buyer auditors (amfori BSCI, WRAP, Sedex SMETA) treat a second, &ldquo;adjusted&rdquo; set of time or wage records as a zero-tolerance finding. This app is deliberately built so that such a second set cannot be
            produced. If the records show a problem — for example too much overtime — the <Goto href="/compliance">Compliance Monitor</Goto> shows it so the cause can be fixed.
          </Law>
          <P>Two more rules protect the records:</P>
          <UL>
            <li>Punches from the machines can never be edited or deleted. Corrections are added as separate manual entries, each with a written reason.</li>
            <li>Every change, sign-in, payroll run, lock and export is written to the <b>audit log</b> with the person&apos;s name and the time.</li>
          </UL>
        </>
      ),
    },
    {
      id: "signing-in",
      title: "Signing in and your password",
      body: (
        <>
          <P>
            Your administrator creates your account and gives you a <b>username</b> and a first <b>password</b>. Open the app in any web browser on the factory network, type them in and press <b>Sign in</b>.
          </P>
          <Steps>
            <Step title="Change your password the first time">
              Click your name at the bottom of the sidebar (on a phone: <b>More</b> → your name) to open <Goto href="/account">My Account</Goto>, and use <b>Change my password</b>. Use at least 8 characters with letters and numbers.
            </Step>
            <Step title="Forgot your password?">Ask your administrator. They can set a new one for you under Users &amp; Roles.</Step>
            <Step title="Sign out when you leave the computer">Use the door icon next to your name at the bottom of the sidebar.</Step>
          </Steps>
          <Warn>Never share your password. Everything you do is recorded under your name, so anything done with your password will look as if you did it.</Warn>
        </>
      ),
    },
    {
      id: "screen",
      title: "Finding your way around",
      body: (
        <>
          <H3>On a computer</H3>
          <UL>
            <Def term="The sidebar (left)">
              lists every part of the app, grouped by subject — Overview, People, Attendance, Leave, Payroll, Separation, Reports, Administration and Help. The highlighted item is where you are. You only see the items your role
              allows.
            </Def>
            <Def term="Search employees">at the top of the sidebar finds a person by ID, name, NID number or mobile number.</Def>
            <Def term="Page title">is the large heading at the top. When you scroll down, it moves into the bar at the top of the window so you always know where you are.</Def>
            <Def term="The ? button">at the top right of every screen opens the part of this guide that explains that screen.</Def>
          </UL>
          <H3>On a phone</H3>
          <P>
            The sidebar is replaced by a bar at the bottom with <b>Home</b>, <b>People</b>, <b>Attendance</b>, <b>Payroll</b> and <b>More</b>. <b>More</b> opens the full menu; swipe it down or tap outside it to close it.
          </P>
          <Tip>The app follows your device&apos;s light or dark setting automatically. Printed documents are always black on white.</Tip>
        </>
      ),
    },
    {
      id: "controls",
      title: "Buttons, colours and confirmations",
      body: (
        <>
          <UL>
            <Def term="The blue button">is the main action on a screen, such as <b>Save</b>, <b>Create Employee</b> or <b>Show Report</b>.</Def>
            <Def term="White buttons">are other actions. Red-tinted buttons remove, reject or cancel something.</Def>
            <Def term="Confirmations">
              before anything that is hard to undo (locking a payroll, removing an entry, recording a settlement as paid) the app asks first in a small window. Read it, then press the action button or <b>Cancel</b>.
            </Def>
            <Def term="Filters">
              many lists and reports have boxes at the top (department, section, month…). Choose what you want and press <b>Apply</b> or <b>Show Report</b>. <b>Reset</b> clears them.
            </Def>
          </UL>
          <P>Small coloured labels show the state of things. The colour always means the same:</P>
          <Rules
            head={["Colour", "Meaning", "Examples"]}
            rows={[
              [<Code key="g">Green</Code>, "Done, good, approved", "Active, Present, Approved, Paid"],
              [<Code key="b">Blue</Code>, "In progress or informational", "Processed, On leave"],
              [<Code key="o">Orange</Code>, "Needs attention or a decision", "Pending, Late, Proposed, Open"],
              [<Code key="r">Red</Code>, "A problem or a final negative state", "Absent, Rejected, Separated"],
              [<Code key="p">Purple</Code>, "Final and frozen", "Locked, Posted, Applied"],
              [<Code key="y">Grey</Code>, "Inactive or not started", "Draft, Off day, Cancelled"],
            ]}
          />
        </>
      ),
    },
    {
      id: "roles",
      title: "What you can see depends on your role",
      body: (
        <>
          <P>
            Each user has one <b>role</b>. The role decides which screens appear in the sidebar and which buttons work. If you need something your role doesn&apos;t allow, ask your administrator — they can change your role
            under Users &amp; Roles.
          </P>
          <Rules
            head={["Role", "Who it is for", "Can do"]}
            rows={ROLES.map((r) => [
              r.en,
              ROLE_BLURBS[r.value],
              <span key={r.value} className="text-[13px]">
                {permsOf(r.value)
                  .map((p) => PERM_LABELS[p])
                  .join(" · ")}
              </span>,
            ])}
          />
          <Tip>
            Open <Goto href="/account">My Account</Goto> to see exactly what your own role allows.
          </Tip>
        </>
      ),
    },
    {
      id: "printing",
      title: "Printing and saving as PDF",
      body: (
        <>
          <P>
            Reports, letters and forms open as a page preview. Press <b>Print / PDF</b>, then choose a printer — or choose <b>Save as PDF</b> to keep a file. The paper size (A4 portrait, A4 landscape or legal) is set by each
            report, so you normally don&apos;t need to change anything.
          </P>
          <P>Tables of figures also have an <b>Excel</b> button that downloads the same data as a spreadsheet.</P>
          <Tip>If the print preview shows the menus or buttons, you are printing the browser page instead of using the Print / PDF button. Use the button — it prints only the document.</Tip>
        </>
      ),
    },
    {
      id: "first-setup",
      title: "Setting up a new factory (administrators)",
      body: (
        <>
          <P>Before real use, an administrator goes through these steps once. Each is explained in Setup &amp; administration.</P>
          <Steps>
            <Step title="Company & payroll policy">
              Name and address in English and Bangla, licence and association numbers, weekly holiday, overtime and deduction rules. <Goto href="/setup/company">Company &amp; Policy</Goto>
            </Step>
            <Step title="Grades and minimum wages">
              Check the wage grades against the current government gazette. <Goto href="/setup/grades">Grades</Goto>
            </Step>
            <Step title="Holiday calendar">
              Enter this year&apos;s festival and government holidays. <Goto href="/setup/holidays">Holidays</Goto>
            </Step>
            <Step title="Organisation">
              Departments, sections, lines, floors, machine types, designations and shifts. <Goto href="/setup">Master Data</Goto>
            </Step>
            <Step title="Employees">
              Enter each person&apos;s file, including any earned-leave balance they already have. <Goto href="/employees/new">New Employee</Goto>
            </Step>
            <Step title="Punch machines">
              Add the machines and enrol everyone. <Goto href="/attendance/devices">Punch Machines</Goto>
            </Step>
            <Step title="Users">
              Create an account for each person who will use the app, with the right role. <Goto href="/setup/users">Users &amp; Roles</Goto>
            </Step>
          </Steps>
        </>
      ),
    },
  ],
};
