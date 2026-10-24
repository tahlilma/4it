import Link from "next/link";
import { MASTERS } from "@/lib/masters";
import { POLICY_SECTIONS } from "@/lib/policy-fields";
import { Def, Goto, H3, type HelpTopic, Law, P, Plain, Step, Steps, Tip, UL, Warn } from "../kit";

export const administration: HelpTopic = {
  slug: "administration",
  title: "Setup & administration",
  summary: "Company policy, master data, users and roles, the audit log, and keeping the system safe and backed up.",
  icon: "cog",
  color: "gray",
  keywords: "settings company policy master data departments sections lines grades minimum wage designations shifts holidays leave types teams buyers devices bank accounts manpower users roles permissions audit log backup security",
  sections: ({ company }) => [
    {
      id: "policy",
      title: "Company & payroll policy",
      body: (
        <>
          <P>
            <Goto href="/setup/company">Company &amp; Policy</Goto> holds the factory&apos;s details and every rule the calculations use. The defaults follow the Labour Act and Rules, and the form refuses values below the legal
            minimum (for example overtime below twice the rate). Your current values are shown below.
          </P>
          {POLICY_SECTIONS.map((s) => (
            <div key={s.title}>
              <H3>{s.title}</H3>
              {s.note && <p className="mb-2 text-[14px] leading-relaxed text-label-2">{s.note}</p>}
              <ul className="my-2 divide-y divide-sep overflow-hidden rounded-[12px] bg-surface ring-1 ring-sep ring-inset">
                {s.fields.map((f) => {
                  const raw = (company as unknown as Record<string, unknown>)[f.name];
                  const val =
                    f.type === "bool"
                      ? raw
                        ? "Yes"
                        : "No"
                      : f.type === "select"
                        ? (f.options?.find((o) => String(o.value) === String(raw))?.en ?? String(raw ?? ""))
                        : String(raw ?? "");
                  return (
                    <li key={f.name} className="flex items-baseline justify-between gap-4 px-3.5 py-2 text-[14px]">
                      <span className="text-label">
                        {f.label}
                        {f.hint && <span className="block text-[12.5px] text-label-2">{f.hint}</span>}
                      </span>
                      <span className={f.bn ? "font-bn text-right text-label-2" : "text-right font-medium text-label-2 tabular-nums"}>{val || "—"}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <Warn>Changing a rule affects every calculation made after the change. Months that are already locked are not recalculated.</Warn>
        </>
      ),
    },
    {
      id: "masters",
      title: "Master data",
      body: (
        <>
          <P>
            <Goto href="/setup">Master Data</Goto> holds the lists that other screens choose from. Set them up before entering employees:
          </P>
          <ul className="my-3 divide-y divide-sep overflow-hidden rounded-[12px] bg-surface ring-1 ring-sep ring-inset">
            {MASTERS.map((m) => (
              <li key={m.key} className="px-3.5 py-2.5">
                <Link href={`/setup/${m.key}`} className="text-[14.5px] font-medium text-ink-blue hover:underline">
                  {m.title}
                </Link>
                <p className="mt-0.5 text-[13.5px] leading-relaxed text-label-2">{m.description}</p>
              </li>
            ))}
          </ul>
          <Tip>Something in use can&apos;t be deleted — for example a department that still has employees. Move the people first, or, where the list has an <b>Active</b> switch (shifts, punch machines and others), switch it off instead.</Tip>
          <Law>Grades carry the minimum wage from the government gazette. Update them whenever a new gazette is published — the app refuses any salary below the grade minimum.</Law>
        </>
      ),
    },
    {
      id: "users",
      title: "Users and roles",
      body: (
        <>
          <P>
            <Goto href="/setup/users">Users &amp; Roles</Goto> (administrators only) is where accounts are made:
          </P>
          <Steps>
            <Step title="New user">Enter the person&apos;s name, a username, a first password and their role.</Step>
            <Step title="Edit a user">Change the name or role, switch the account off when someone leaves, or set a new password if they forgot theirs. Resetting a password signs them out everywhere.</Step>
            <Step title="Check what roles allow">The bottom of the screen lists what each role can do, in plain words.</Step>
          </Steps>
          <Tip>Give each person the smallest role that lets them do their job, and switch off accounts of people who leave the company the same day.</Tip>
        </>
      ),
    },
    {
      id: "audit",
      title: "The audit log",
      body: (
        <>
          <P>
            <Goto href="/audit">Audit Log</Goto> is a permanent, read-only diary of everything important: sign-ins (and failed attempts), every record created, changed or deleted, attendance and payroll processing, locks and
            unlocks, and exports. Each line shows who, when, what and — for changes — the old and new values.
          </P>
          <Plain>Nobody, not even an administrator, can edit or delete the audit log. That is what makes it trustworthy for auditors.</Plain>
        </>
      ),
    },
    {
      id: "it",
      title: "For the IT person: backups and safety",
      body: (
        <>
          <UL>
            <Def term="Backups">everything is in the app&apos;s <b>data</b> folder (the database and employee photos). Copy it to another disk or PC every day.</Def>
            <Def term="Automatic punch sync">schedule the device sync to run every 30 minutes with Windows Task Scheduler (see the README).</Def>
            <Def term="Access">keep the app on the factory network. If it must be reached from outside, put it behind HTTPS.</Def>
            <Def term="Demo accounts">delete or change the demo usernames and passwords before real use.</Def>
          </UL>
        </>
      ),
    },
  ],
};
