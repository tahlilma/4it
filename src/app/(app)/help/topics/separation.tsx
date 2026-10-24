import { Calc, Def, Example, Goto, H3, type HelpTopic, Law, P, Plain, Rules, Setting, Step, Steps, Tip, tk, UL, Warn } from "../kit";

const r2 = (n: number) => Math.round(n * 100) / 100;

export const separation: HelpTopic = {
  slug: "separation",
  title: "Separation & settlement",
  summary: "When someone leaves: the types of separation, how final dues are calculated and paid, the lefty (absence) letters, and maternity benefit.",
  icon: "door",
  color: "red",
  keywords: "leaving resignation termination dismissal discharge retrenchment death retirement final settlement dues service benefit notice pay lefty absence letters deemed resignation maternity benefit pregnancy",
  sections: ({ company: c }) => {
    const basic = 6700, gross = 12500, years = 6, el = 12;
    const daily = r2((c.serviceBenefitBasis === "GROSS" ? gross : basic) / 30);
    const benefitDays = years >= 10 ? 30 * years : years >= 5 ? 14 * years : 0;
    const benefit = r2(benefitDays * daily);
    const elRate = r2((c.elRateBasis === "BASIC" ? basic : gross) / 30);
    const elAmt = r2(el * elRate);
    return [
      {
        id: "types",
        title: "Types of separation",
        body: (
          <>
            <P>Every way of leaving is treated differently by the law. Choose the right type when you record the separation — the calculation depends on it.</P>
            <Rules
              head={["Type", "What it means", "Service benefit (per completed year)"]}
              rows={[
                ["Resignation (s.27)", "The worker chooses to leave and gives notice.", "14 days' wages after 5 years; 30 days after 10 years"],
                ["Lefty — deemed resignation (s.27(3A))", "Absent without leave for more than 10 days and didn't respond to the letters.", "Same as resignation"],
                ["Termination (s.26)", "The employer ends a permanent job without giving a reason, with notice.", "30 days"],
                ["Retrenchment (s.20)", "Job cut because work is reduced.", "30 days (after 1 year)"],
                ["Discharge (s.22)", "Unfit to work because of illness or disability, on a doctor's certificate.", "30 days (after 1 year)"],
                ["Dismissal (s.23)", "For proven misconduct after an inquiry.", "None"],
                ["Death (s.19)", "Died while employed. Paid to the nominee.", "30 days after 2 years; 45 if on duty or in an accident"],
                ["Retirement (s.28)", "Reached retirement age.", "30 days"],
              ]}
            />
            <Plain>&ldquo;Days&apos; wages&rdquo; means days of <Setting label="your basis" value={c.serviceBenefitBasis === "GROSS" ? "gross ÷ 30" : "basic ÷ 30"} />.</Plain>
          </>
        ),
      },
      {
        id: "settlement",
        title: "How the final settlement is calculated",
        body: (
          <>
            <P>
              In <Goto href="/separations/new">Record a separation</Goto> enter the employee ID, the type, the last working day and any notice given. The app then adds up:
            </P>
            <UL>
              <Def term="Unpaid wages">for days worked in the last month that haven&apos;t been paid yet, with their overtime.</Def>
              <Def term="Service benefit">the days per year from the table above × completed years of service × one day&apos;s wage.</Def>
              <Def term="Earned leave">the whole remaining earned-leave balance, paid at one day&apos;s rate per day.</Def>
              <Def term="Notice">
                if the employer gave less notice than the law requires, the missing days are <b>paid</b>; if a worker resigned without enough notice, the missing days are <b>deducted</b>.
              </Def>
              <Def term="Recoveries">any outstanding salary advance, and other lawful deductions.</Def>
            </UL>
            <Example>
              <p>
                A worker resigns after {years} years with basic {tk(basic)}, gross {tk(gross)} and {el} days of earned leave left, giving full notice.
              </p>
              <Calc
                lines={[
                  [`Service benefit: 14 days × ${years} years × ${tk(daily)}`, tk(benefit)],
                  [`Earned leave: ${el} days × ${tk(elRate)}`, tk(elAmt)],
                  ["Notice shortfall", tk(0)],
                ]}
                total={["Settlement (plus any unpaid wages)", tk(Math.round(benefit + elAmt))]}
              />
            </Example>
            <Tip>If the factory pays more than the law requires (for example by agreement or a court order), the benefit days can be overridden — a remark explaining why is required.</Tip>
          </>
        ),
      },
      {
        id: "paying",
        title: "Paying the settlement",
        body: (
          <>
            <Steps>
              <Step title="Check and print">Open the separation to see every line of the calculation. Print the final settlement bill for signatures.</Step>
              <Step title="Pay on time">
                Final dues must be paid within <Setting label="your deadline" value={`${c.settlementDueWorkingDays} working days`} />. The Compliance Monitor warns about late ones.
              </Step>
              <Step title="Mark as paid">
                Press <b>Mark as Paid</b> with the payment date. After that the settlement can&apos;t be recalculated.
              </Step>
              <Step title="Remove from the punch machines">
                From <Goto href="/attendance/devices">Punch Machines</Goto> → <b>Remove separated</b>.
              </Step>
            </Steps>
            <Law>Section 30: all dues must be paid within 30 working days of the separation.</Law>
            <P>
              If a separation was recorded by mistake, or the person returns before it is paid, use <b>Withdraw Separation</b> with a reason; the employee becomes active again.
            </P>
          </>
        ),
      },
      {
        id: "lefty",
        title: "Lefty cases — when someone stops coming",
        body: (
          <>
            <P>
              A worker who stops coming without leave can&apos;t simply be struck off. The law sets out a fair process, and <Goto href="/separations/lefty">Lefty (Absence) Cases</Goto> walks you through it.
            </P>
            <Steps>
              <Step title="The app spots the absence">
                The screen lists everyone absent without a break for more than <Setting label="your trigger" value={`${c.leftyAbsentDays} days`} /> (weekly holidays and holidays don&apos;t break the run). Open a case for
                the person.
              </Step>
              <Step title="First letter">
                Send a letter to the present and permanent addresses asking them to explain and rejoin within 10 days. Print it (and the envelopes) from the case, then press <b>1st letter sent</b> with the date.
              </Step>
              <Step title="Second letter">If there is no reply, send the second letter giving 7 more days to defend themselves, and press <b>2nd letter sent</b>.</Step>
              <Step title="Third letter and decision">
                If there is still no response, send the third letter (<b>3rd letter sent</b>), which informs them that they are treated as having resigned. <b>Record deemed resignation</b> then creates the separation, with dues calculated as for a resignation.
              </Step>
            </Steps>
            <P>If the person comes back at any point, press <b>Rejoined</b> instead — the case closes and they carry on working.</P>
            <Law>Section 27(3A): a worker absent for more than 10 days without leave is first given 10 days to explain, then 7 more days for self-defence; only then can they be treated as having resigned.</Law>
          </>
        ),
      },
      {
        id: "maternity",
        title: "Maternity benefit",
        body: (
          <>
            <P>
              When a woman gives notice of pregnancy (Form 18), open a case in <Goto href="/maternity">Maternity Benefit</Goto> with the expected delivery date. The app:
            </P>
            <UL>
              <li>creates 16 weeks of maternity leave — 8 weeks before and 8 weeks after delivery (112 days);</li>
              <li>checks whether she is entitled to the cash benefit;</li>
              <li>works out the benefit and splits it into two equal instalments, before and after delivery.</li>
            </UL>
            <H3>Who gets the cash benefit</H3>
            <P>She must have worked at least 6 months before the delivery and have fewer than two surviving children. Otherwise she still gets the leave, but not the payment.</P>
            <H3>How much</H3>
            <P>
              Her average daily wage — the wages of the 3 months before the notice divided by the days she actually worked — × 112 days.
            </P>
            <Warn>Each instalment must be paid on time. The Compliance Monitor flags an instalment that is due but unpaid.</Warn>
            <Law>Sections 45–50 of the Labour Act.</Law>
          </>
        ),
      },
    ];
  },
};
