import { Def, Goto, type HelpTopic, P, Plain, Tip, UL } from "../kit";

export const dashboard: HelpTopic = {
  slug: "dashboard",
  title: "Dashboard",
  summary: "The first screen after signing in: today's picture of the factory and the things waiting for you.",
  icon: "home",
  color: "blue",
  keywords: "home overview summary attendance trend figures to do needs attention departments workforce",
  sections: () => [
    {
      id: "overview",
      title: "What the dashboard shows",
      body: (
        <>
          <P>
            The <Goto href="/">Dashboard</Goto> is a summary. Nothing is changed here — every figure is a shortcut: click it to open the screen with the details.
          </P>
          <UL>
            <Def term="The greeting panel">shows today&apos;s date and buttons for the most common jobs: adding an employee, processing attendance and opening reports.</Def>
            <Def term="Attendance">
              the percentage of people who came on the latest processed day, how many of those expected were present, and a small line chart of the last 14 working days. The dashed line is the average for that
              period, so you can see at a glance whether attendance is rising or falling.
            </Def>
          </UL>
          <Plain>The attendance rate counts present and late people out of everyone expected that day (present + late + absent + on leave). Weekly holidays and festival holidays are left out.</Plain>
        </>
      ),
    },
    {
      id: "figures",
      title: "The four figures",
      body: (
        <UL>
          <Def term="Employees on roll">everyone currently active, split into men and women.</Def>
          <Def term="Punched in today">how many different people the punch machines have recorded today. This is live — it does not wait for processing.</Def>
          <Def term="This month">how many people joined, and how many left, in the current month.</Def>
          <Def term="Women in the workforce">the share of active employees who are women — buyers often ask for this figure.</Def>
        </UL>
      ),
    },
    {
      id: "attention",
      title: "Needs attention",
      body: (
        <>
          <P>A short to-do list. A number means items are waiting; a green &ldquo;Clear&rdquo; means nothing is waiting.</P>
          <UL>
            <Def term="Leave requests to decide">applications still pending approval.</Def>
            <Def term="Open lefty cases">workers absent without leave for whom the letter process has started but not finished.</Def>
            <Def term="Settlements not yet paid">people who have left whose final dues are not yet recorded as paid.</Def>
            <Def term="Increment proposals">yearly increments proposed or approved but not yet applied to salaries.</Def>
          </UL>
          <Tip>You only see the items your role is allowed to act on.</Tip>
        </>
      ),
    },
    {
      id: "lists",
      title: "Departments, payroll and workforce mix",
      body: (
        <UL>
          <Def term="People by department">active headcount for each department, with a bar so the biggest departments stand out.</Def>
          <Def term="Payroll">the latest wage month and its state — Processed (calculated, not yet locked) or Locked (paid and frozen). Click it to open that payroll.</Def>
          <Def term="Workforce mix">how many workers, staff and management are on roll, as a bar and as numbers.</Def>
        </UL>
      ),
    },
  ],
};
