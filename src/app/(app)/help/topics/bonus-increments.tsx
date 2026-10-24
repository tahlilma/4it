import { Calc, Def, Example, Goto, H3, type HelpTopic, Law, P, Plain, Setting, Step, Steps, Tip, tk, UL } from "../kit";

const r2 = (n: number) => Math.round(n * 100) / 100;

export const bonusIncrements: HelpTopic = {
  slug: "bonus-increments",
  title: "Bonus, increments & encashment",
  summary: "Festival bonuses twice a year, yearly increments and promotions, and cashing in unused earned leave.",
  icon: "gift",
  color: "pink",
  keywords: "festival bonus eid puja increment promotion raise salary increase el encashment earned leave cash yearly annual",
  sections: ({ company: c }) => {
    const basic = 6700;
    const newBasic = r2(basic * (1 + c.incrementPercent / 100));
    const hrOld = r2((basic * c.houseRentPercent) / 100), hrNew = r2((newBasic * c.houseRentPercent) / 100);
    const fixed = c.medicalAllowance + c.transportAllowance + c.foodAllowance;
    return [
      {
        id: "bonus",
        title: "Festival bonus",
        body: (
          <>
            <P>
              Before each major festival (Eid-ul-Fitr, Eid-ul-Adha, Durga Puja and others) the factory pays a festival bonus. In <Goto href="/payroll/bonus">Festival Bonus</Goto>, create a bonus sheet:
            </P>
            <Steps>
              <Step title="Describe the bonus">A title (e.g. &ldquo;Eid-ul-Fitr Bonus 2027&rdquo;), the festival, whether it is a percentage of basic or gross, and which religions it applies to.</Step>
              <Step title="Set the service slabs">
                How much people get depends on how long they have worked by the cut-off date: by default 100% for a year or more and 50% for six months to a year. People with less service get nothing.
              </Step>
              <Step title="Create, review, print">The sheet lists every eligible person with their service and amount. Print the bonus sheet and summary for payment.</Step>
              <Step title="Lock">After payment, lock the sheet so it can&apos;t change.</Step>
            </Steps>
            <Law>Labour Rules 2015, rule 111(5): a worker with one year of continuous service gets two festival bonuses a year, each up to one month&apos;s basic wage.</Law>
            <Tip>The Compliance Monitor warns you if anyone with a year&apos;s service has received fewer than two festival bonuses in the last 12 months.</Tip>
          </>
        ),
      },
      {
        id: "increments",
        title: "Yearly increments",
        body: (
          <>
            <P>
              Garment workers are due an increase of at least <Setting label="your rate" value={`${c.incrementPercent}% of basic`} /> every year. The house rent rises with the basic; the fixed allowances stay the same.
            </P>
            <Example>
              <Calc
                lines={[
                  ["Basic before", tk(basic)],
                  [`Basic after (+${c.incrementPercent}%)`, tk(newBasic)],
                  ["House rent before → after", `${tk(hrOld)} → ${tk(hrNew)}`],
                  ["Medical + transport + food (unchanged)", tk(fixed)],
                ]}
                total={["New gross", tk(r2(newBasic + hrNew + fixed))]}
              />
            </Example>
            <P>
              It works in three steps in <Goto href="/payroll/increments">Increment &amp; Promotion</Goto>, so that one person proposes and another approves:
            </P>
            <Steps>
              <Step title="Propose">
                <b>Generate proposals</b> lists everyone whose last increment (or joining) was 12 or more months before the effective date, at your rate. Tick <b>Include everyone</b> to propose for all.
              </Step>
              <Step title="Approve">A manager reviews the list and approves (or rejects) each proposal.</Step>
              <Step title="Apply">Approved increments are applied to salaries. The change goes into each person&apos;s salary history and the increment letter can be printed.</Step>
            </Steps>
            <Plain>
              Apply an increment <b>before</b> processing the payroll of the month it starts, so the new salary is used. If you apply it late, add the difference as an arrear in Additions &amp; Deductions.
            </Plain>
          </>
        ),
      },
      {
        id: "promotions",
        title: "Promotions and special increments",
        body: (
          <P>
            Use <b>Create proposal</b> on the same screen for a promotion (new designation and/or grade) or a special increment: enter the new gross and the effective date. It then goes through the same approve → apply
            steps, and the <b>Increment &amp; Promotion Letter</b> report prints the letter.
          </P>
        ),
      },
      {
        id: "encashment",
        title: "Earned-leave encashment",
        body: (
          <>
            <P>
              Once a year, workers may take money instead of some of their unused earned leave — up to <Setting label="your limit" value={`${c.elEncashMaxPercent}% of the balance`} />. Each day is paid at{" "}
              <Setting label="your rate" value={`${c.elRateBasis === "BASIC" ? "basic" : "gross"} ÷ 30`} />.
            </P>
            <Steps>
              <Step title="Create an encashment sheet">
                In <Goto href="/payroll/el-encashment">EL Encashment</Goto>, give it a title and an as-of date. The app lists each eligible person, their balance, the days they can encash and the amount.
              </Step>
              <Step title="Review and print">Check the sheet and print it for payment.</Step>
              <Step title="Post">
                <b>Post</b> makes it final: the encashed days are taken off each person&apos;s earned-leave balance.
              </Step>
            </Steps>
            <UL>
              <Def term="When someone leaves">their whole remaining earned-leave balance is paid in the final settlement — no need to encash it first.</Def>
            </UL>
            <H3>Why only part of the balance?</H3>
            <P>So that people still have leave to rest. Rule 107(2) allows encashing at most half of the balance, once a year.</P>
          </>
        ),
      },
    ];
  },
};
