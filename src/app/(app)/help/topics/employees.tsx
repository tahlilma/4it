import { Calc, Code, Def, Example, Goto, H3, type HelpTopic, Law, P, Plain, Setting, Step, Steps, Tip, tk, UL, Warn } from "../kit";

export const employees: HelpTopic = {
  slug: "employees",
  title: "Employees",
  summary: "Personal files: adding people, the checks the app makes, the profile tabs, photos, nominees and the documents to print.",
  icon: "users",
  color: "orange",
  keywords: "personal file worker staff add new employee profile photo nominee safety team documents id card appointment letter salary structure grade minimum wage age",
  sections: ({ company }) => {
    const c = company;
    const basic = 6700;
    const hr = (basic * c.houseRentPercent) / 100;
    const gross = basic + hr + c.medicalAllowance + c.transportAllowance + c.foodAllowance;
    return [
      {
        id: "list",
        title: "Finding people",
        body: (
          <>
            <P>
              <Goto href="/employees">Employees</Goto> lists everyone who is active. Type in <b>Search</b> to find someone by ID, name, NID number or mobile number, or narrow the list by department, section, designation,
              line, type, gender or status. Choose <b>Status → Separated</b> or <b>All</b> to see people who have left.
            </P>
            <Tip>The search box at the top of the sidebar does the same search from any screen.</Tip>
          </>
        ),
      },
      {
        id: "adding",
        title: "Adding a new employee",
        body: (
          <>
            <P>
              Open <Goto href="/employees/new">New Employee</Goto>. The form is in five parts. Fields marked with a red <Code>*</Code> must be filled; everything else can be added later — but the more complete the file, the
              better your reports and audits.
            </P>
            <Steps>
              <Step title="Identity">
                Employee ID (the card number) and <b>punch machine ID</b> (the number the person is enrolled under on the machine — usually the same), names in English and Bangla, parents, spouse, gender, date of birth,
                religion, NID or birth registration, how the age was checked, education, height, weight and an identification mark.
              </Step>
              <Step title="Contact & address">Mobile, an emergency contact, and the present and permanent address in English and Bangla. These print on letters, envelopes and the BGMEA / BKMEA export.</Step>
              <Step title="Job">
                Department, section, designation, class of worker (permanent, probationer, temporary…), line, floor, machine type, shift, weekly holiday, joining date, and probation / confirmation dates.
              </Step>
              <Step title="Salary & payment">
                The gross salary and how it splits into basic and allowances (press <b>Split gross</b> to apply the government structure), whether the person gets overtime, and how they are paid — cash, bank or mobile banking
                (bKash, Nagad, Rocket, Upay).
              </Step>
              <Step title="Personal file & compliance">
                Dates when each statutory document was issued, night-work consent for women, previous experience, a reference, and any earned-leave balance the person already has.
              </Step>
            </Steps>
            <P>
              Press <b>Create Employee</b>. You are taken to the new person&apos;s profile, ready to add a photo and nominees.
            </P>
          </>
        ),
      },
      {
        id: "checks",
        title: "Checks the app makes for you",
        body: (
          <>
            <P>Some mistakes would break the law, so the app refuses to save them and tells you why:</P>
            <UL>
              <Def term="Too young">
                nobody younger than <Setting label="minimum hiring age" value={c.minHiringAge} /> can be employed.
              </Def>
              <Def term="Below the minimum wage">the gross salary can&apos;t be lower than the minimum for the person&apos;s grade.</Def>
              <Def term="Parts don't add up">basic + house rent + medical + transport + food (+ other) must equal the gross.</Def>
            </UL>
            <Law>Section 34 of the Labour Act forbids employing children; the RMG minimum-wage gazette sets the lowest wage for each grade.</Law>
          </>
        ),
      },
      {
        id: "salary",
        title: "How a salary is split",
        body: (
          <>
            <P>Garment wages follow the government pattern: the gross salary is made of a <b>basic</b> plus fixed allowances.</P>
            <Plain>
              Gross = basic + house rent (<Setting label="your rate" value={`${c.houseRentPercent}% of basic`} />) + medical (<Setting label="Tk" value={c.medicalAllowance} />) + transport (
              <Setting label="Tk" value={c.transportAllowance} />) + food (<Setting label="Tk" value={c.foodAllowance} />).
            </Plain>
            <Example>
              <Calc
                lines={[
                  ["Basic", tk(basic)],
                  [`House rent (${c.houseRentPercent}% of basic)`, tk(hr)],
                  ["Medical", tk(c.medicalAllowance)],
                  ["Transport", tk(c.transportAllowance)],
                  ["Food", tk(c.foodAllowance)],
                ]}
                total={["Gross salary", tk(gross)]}
              />
            </Example>
            <P>
              The basic matters most: overtime, absence deductions, bonuses, increments and the service benefit when someone leaves are all worked out from it. <b>Split gross</b> does this split for you from the gross you
              type.
            </P>
            <Warn>To change the salary of an existing employee, use Increment &amp; Promotion rather than editing the salary directly. That keeps a dated history and prints the proper letter.</Warn>
          </>
        ),
      },
      {
        id: "profile",
        title: "The employee profile",
        body: (
          <>
            <P>Click anyone in the list to open their profile. The buttons under the name are shortcuts: Edit, Documents, Payslips and Separate. The bar below switches between tabs:</P>
            <UL>
              <Def term="Overview">personal details, addresses, job, salary, the photo, the personal-file checklist (which statutory documents are issued or missing) and which punch machines they are enrolled on.</Def>
              <Def term="Attendance">a month calendar. Each day shows its code (see Attendance), the in and out times and any overtime. Use the arrows to move between months.</Def>
              <Def term="Leave">balances for each leave type and every application.</Def>
              <Def term="Salary & payslips">the salary history (every change, with the reason) and every month&apos;s pay.</Def>
              <Def term="Nominees">who receives the person&apos;s dues if they die (Form 41), with their share.</Def>
              <Def term="Safety teams">fire-fighting, rescue and first-aid teams the person belongs to.</Def>
              <Def term="Documents">one-click printing of every letter and form for this person.</Def>
              <Def term="Audit trail">every change ever made to this person&apos;s file, by whom and when.</Def>
            </UL>
            <H3>Photo</H3>
            <P>On the Overview tab, choose a picture and press <b>Upload</b>. Any photo works — it is cropped to passport size for the ID card.</P>
          </>
        ),
      },
      {
        id: "documents",
        title: "Documents to print for every worker",
        body: (
          <>
            <P>Open the person&apos;s <b>Documents</b> tab and press <b>Print</b> next to the document. The ones a personal file must contain:</P>
            <UL>
              <Def term="Appointment letter">given on joining, with the terms of employment.</Def>
              <Def term="ID card (Form 6)">with photo and barcode, in Bangla and English.</Def>
              <Def term="Nominee form (Form 41)">who receives dues on death.</Def>
              <Def term="Age & fitness certificate (Form 15)">from a doctor, especially for young workers.</Def>
              <Def term="Confirmation letter">when probation ends.</Def>
              <Def term="Service book (Form 7)">opened within 15 days of confirmation.</Def>
            </UL>
            <Tip>After handing a document over, write its date into the file (Edit → Personal file &amp; compliance). The Compliance Monitor uses those dates to show which files are incomplete.</Tip>
          </>
        ),
      },
    ];
  },
};
