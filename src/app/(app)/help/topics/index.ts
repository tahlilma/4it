import type { HelpTopic } from "../kit";
import { administration } from "./administration";
import { attendance } from "./attendance";
import { bonusIncrements } from "./bonus-increments";
import { compliance } from "./compliance";
import { dashboard } from "./dashboard";
import { employees } from "./employees";
import { faq } from "./faq";
import { gettingStarted } from "./getting-started";
import { glossary } from "./glossary";
import { leave } from "./leave";
import { monthlyCycle } from "./monthly-cycle";
import { payroll } from "./payroll";
import { reports } from "./reports";
import { separation } from "./separation";

/** Reading order. */
export const TOPICS: HelpTopic[] = [
  gettingStarted,
  monthlyCycle,
  dashboard,
  employees,
  attendance,
  leave,
  payroll,
  bonusIncrements,
  separation,
  compliance,
  reports,
  administration,
  glossary,
  faq,
];

export function topicBySlug(slug: string): HelpTopic | undefined {
  return TOPICS.find((t) => t.slug === slug);
}
