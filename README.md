# HR & Payroll for Bangladesh RMG factories

A web-based, multi-user HR, attendance and payroll system for garment factories, built around the
**Bangladesh Labour Act 2006 (amended 2013/2018)**, the **Bangladesh Labour Rules 2015**, the **RMG minimum-wage
gazette**, and the record-keeping that **BGMEA / BKMEA** members are checked on in buyer social-compliance audits
(amfori BSCI, WRAP, Sedex SMETA, C-TPAT).

Built with Next.js 16 (App Router, TypeScript), Prisma 7 and SQLite. It runs on a factory LAN; any PC with a browser can use it.

## What it does

| Area | Highlights |
| --- | --- |
| Employees | Bilingual personal file (English / বাংলা), structured addresses, NID / age proof, photo, nominees, safety-team membership, punch-machine enrolment, salary history, statutory document checklist |
| Attendance | ZKTeco punch-machine sync (TCP 4370) or log-file import, shift rules (grace, OT rounding, night shifts across midnight), manual entries with mandatory reasons, daily processing |
| Leave | Casual (s.115), sick (s.116), earned 1 day / 18 days worked (s.117), maternity 16 weeks (s.46), pro-rata for joiners (r.106), balances, approval workflow |
| Payroll | Monthly processing from attendance: pro-rated wages, absence deduction, OT at basic × 2 ÷ 208, attendance bonus, holiday-duty allowance, advances, stamp, tax; lock after payment |
| Bonus & increments | Festival bonus by service slabs (r.111(5)), annual increment proposals (5 % of basic) → approval → application, promotions |
| Separation | Resignation, termination, retrenchment, discharge, dismissal, death, retirement — statutory service benefit, notice pay / deduction, earned-leave encashment, advance recovery; lefty (s.27(3A)) three-letter workflow; maternity benefit |
| Compliance Monitor | Live checks: minimum hiring age, missing statutory documents, wages below grade minimum, wages unpaid after 7 working days, OT > 2 h, days > 10 h, weeks > 60 h, no weekly rest, women 10 pm–6 am without consent, overdue settlements, separated staff still on punch machines, safety-team coverage |
| Reports | 73 reports, letters and statutory forms — print to A4 / legal (Print → Save as PDF); tabular reports export to Excel |
| Security | Role-based access (6 roles), hashed sessions, append-only audit log of every change, sign-in, processing, lock and export |

### Report catalogue

**Personal file:** Job Application · Appointment Letter (all r.19(4) items) · Age & Fitness Certificate (Form 15) · Nominee Form (Form 41) ·
ID Card Bangla & English (Form 6, with barcode) · Confirmation Letter · Lefty Letters 1st / 2nd / 3rd · Lefty Envelopes (present & permanent address) ·
Date-range Absent Report & Show-cause letters · Service Book (Form 7) · Final Settlement · Leave Application · Maternity Benefit statement

**Leave:** Earn Leave Encashment · Leave Register (Form 9) · Leave Details · Leave Balances
**Increment:** Increment Proposal List · Increment List · Increment & Promotion Letter
**Employee:** All Employees · Employee Details · Monthly New Employees · Monthly Drop-outs · Manpower Requisition · Department / Type / Designation & Grade /
Gender / Religion summaries · Salary History · Salary-sheet-wise structure · Safety Teams (members & r.55(10) coverage) · Due Punch Machine Assignment ·
Delete from Punch Machine · Worker Register (Form 8) · **Excel export for the BGMEA / BKMEA worker (biometric) database**
**Attendance:** Attendance Register · Job Card (actual, compliance, buyer) · Daily Summary (section, with requirement, line, designation, machine type) ·
Daily Absent / Present / Status · Single Punch · Early Out · Late (daily & monthly) · Absent Counselling · OT Summary (daily & monthly) ·
Day Salary & OT · Attendance & OT Register (Form 34) · Working-hours compliance
**Bills:** Tiffin Bill (daily & monthly) & summary · Night Bill (daily & monthly) & summary
**Payroll:** Salary Sheet (detailed & Form 38 register) · Pay Slip (Bangla Form 38 & English) · Salary Summary (section / status / type) · Only Salary ·
Only Overtime · Salary with statutory-OT split · OT beyond the daily limit · Holiday Sheet · Bank advice / mobile-banking / cash lists ·
Festival Bonus Sheet & Summary · Compare Salary Summary

### One set of records

Every report is produced from the same attendance and payroll records. Where a report offers "actual" and "compliance" or
"buyer" formats, they are different **layouts of the same data**: the compliance and buyer job cards add limit checks and flag
breaches; they never move punch times or drop hours, and every overtime hour is paid through the one salary sheet and pay slip.
The "Extra OT" report lists hours beyond the daily limit for corrective action — they are already included in wages.
Keeping a second, adjusted set of time or wage records is treated as a zero-tolerance finding by amfori BSCI, WRAP and SMETA
auditors, so the system is deliberately built not to produce one. The Compliance Monitor shows the real position so it can be fixed.

## Requirements

- Node.js 24 LTS (Windows, Linux or macOS)
- For punch-machine sync: ZKTeco-compatible devices reachable over the network (TCP port 4370)

## Quick start (demo data)

```bash
npm install          # also generates the Prisma client
npm run setup        # creates data/hrpayroll.db and loads a demo factory (~150 employees, 3 months of punches)
npm run dev          # http://localhost:3000
```

Demo sign-ins (change them, or delete the users, before real use):

| Username | Password | Role |
| --- | --- | --- |
| admin | admin123 | Administrator |
| hr | hr123 | HR & Compliance Manager |
| payroll | payroll123 | Payroll / Accounts |
| time | time123 | Timekeeper |
| viewer | viewer123 | Viewer (read-only, e.g. for auditors) |

The demo is generated relative to today's date, so the last two months have processed payroll. Some compliance findings
(a Friday worked by Sewing, a few 3-hour OT days, a missing nominee form, a woman working past 10 pm without consent) are
included on purpose so the Compliance Monitor has something to show.

## Production on a factory LAN

```bash
npm install
SEED_DEMO=0 npm run setup   # Windows PowerShell:  $env:SEED_DEMO="0"; npm run setup
npm run build
npm start                   # listens on port 3000 on every network interface; or: npx next start -p 8080
```

- **First sign-in:** `admin` / `admin123` — change it immediately under Administration → Users & Roles (My password).
- **Keep it running:** install it as a Windows service, e.g. with [NSSM](https://nssm.cc): application `C:\Program Files\nodejs\node.exe`,
  arguments `node_modules\next\dist\bin\next start -p 3000`, startup directory = the project folder. Open the port in Windows Firewall for the HR PCs only.
- **HTTPS:** if the app is reached from outside the LAN, put it behind a reverse proxy with TLS (IIS, Caddy, nginx) and set `COOKIE_SECURE="true"` in `.env`.
- **Backups:** everything lives in `data/` (the SQLite database and employee photos). Copy `data/` daily to another disk or PC
  (stop the service or use `sqlite3 data/hrpayroll.db ".backup backup.db"` for a consistent copy).
- **Larger factories:** SQLite comfortably handles a few thousand employees. For bigger groups switch the Prisma datasource to PostgreSQL
  (`provider = "postgresql"` in `prisma/schema.prisma`, the PostgreSQL driver adapter in `src/lib/db.ts`, and a fresh migration).
- The seed never touches a database that already has a company. `SEED_FORCE=1 npm run db:seed` wipes and re-seeds — never run it on live data.

## Going live — checklist

1. **Company & Policy** (Administration): name and address in English and Bangla, licence and BGMEA / BKMEA numbers, weekly holiday,
   OT rounding, absence-deduction basis, stamp, tiffin / night-bill rates, earned-leave rules. Defaults follow the Act and Rules;
   the form refuses values below statutory floors (e.g. OT below 2×, hiring under 14).
2. **Grades & minimum wage** (Master Data): the seed loads the 2023 RMG gazette (effective 1 Dec 2023: grade 4 Tk 12,500 = basic 6,700 +
   house rent 3,350 + medical 750 + transport 450 + food 1,250; grade 3 Tk 13,550; grade 2 Tk 14,273; grade 1 Tk 15,035).
   **Update these to the current gazette and agreed annual increments** — workers below their grade minimum cannot be saved.
3. **Holiday calendar:** the seed only has sample dates. Enter the factory's approved festival (11 days, s.118) and government holidays.
4. **Organisation:** departments, sections, lines, floors, machine types, designations (with grade, OT eligibility, attendance bonus), shifts.
5. **Employees:** enter each personal file (or ask for a bulk importer). Opening earned-leave balances can be entered per employee.
6. **Punch machines:** add devices, use *Read device users* to align enrolment, then schedule `npm run device:sync`.
7. **Safety teams, buyers (code-of-conduct limits), manpower budget, company bank account.**

## Monthly cycle

1. Punches arrive (device sync or file import) → **Process Attendance** (daily, or let the scheduled sync do it).
2. Fix single punches / official duty with **Manual Entry** (a reason is mandatory and logged).
3. Approve leave; record **Additions & Deductions** and **Advances**.
4. After month end: **Salary Processing → Process payroll**. Review the salary sheet, OT and Compliance Monitor.
5. Pay within 7 working days (s.123), then **Lock** with the payment date. Locked months freeze attendance, leave and adjustments; unlocking needs a reason and is audited.
6. Twice a year: **Festival Bonus**. Yearly: **Increment & Promotion** proposals and **EL Encashment** (≤ 50 % of balance, once a year).

## Punch machines

- Network sync uses [`zkteco-js`](https://github.com/coding-libs/zkteco-js) (TCP/UDP 4370): pull logs, enrol active employees, remove separated
  employees (C-TPAT access control), sync the device clock. The library addresses device user slots 1–3000 per device.
- Scheduled sync: `npm run device:sync` (pulls every active device, re-processes affected dates, writes to the audit log). Example Windows
  Task Scheduler action: program `cmd.exe`, arguments `/c cd /d E:\HRPayroll && npm run device:sync`, every 30 minutes.
- Offline: **Import Punch Log** accepts ZKTeco `attlog.dat` and CSV (`ID,date time`; `DD/MM/YYYY` dates and AM/PM times are understood). Duplicates are skipped.
- Punches are append-only. Corrections are separate manual entries with a reason; machine punches can't be edited or deleted.

## How the main calculations work

- **Salary structure:** gross = basic + house rent (50 % of basic) + medical + transport + food (the gazette pattern).
- **Wages for the month:** gross × paid calendar days ÷ days in month (joiners, leavers and unpaid leave), less absence at basic ÷ 30 per day (configurable).
- **Overtime:** basic × 2 ÷ 208 per hour (Rule 102); all hours worked on weekly / festival holidays count as OT (configurable).
- **Attendance:** a punch belongs to a date from 4 h before shift start for 24 h; work time counts from shift start; OT rounds per shift (e.g. whole hours, up after 50 min).
- **Earned leave:** present days ÷ 18 (s.117), usable after one year; the balance is paid at gross ÷ 30 on separation (s.11).
- **Final settlement:** resignation 14 days' basic per year after 5 years and 30 days after 10 (s.27(4)); termination / retrenchment / discharge 30 days per year;
  death 30 days (45 on duty) after 2 years (s.19); notice shortfall deducted (s.27(2)) or notice pay added (s.26); outstanding advances recovered. Manual overrides need remarks.
- **Maternity:** 112 days at the average daily wage of the 3 months before notice (s.48), if 6 months' service and fewer than two surviving children (s.46).

The engines are pure functions in `src/lib/engine/` with unit tests in `tests/`.

## BGMEA / BKMEA worker database export

Report **Excel Export File (Biometric BGMEA & BKMEA)** → choose the association → **Excel**. The file has the header in row 1 and one worker per row.
The associations change their upload templates from time to time, so check the columns against the template you were issued and adjust
`src/lib/biometric.ts` (header text, order and value mapping) if needed.

## Development

```bash
npm run dev         # development server
npm test            # unit tests (payroll, attendance, leave, settlement, bonus, maternity, compliance, Bangla words, barcode, log parsing)
npm run typecheck   # route types + TypeScript
npm run lint
npm run build
```

Project layout:

```
prisma/schema.prisma        data model (dates as UTC-midnight, punch times as factory wall-clock)
prisma/seed.ts              base data + demo factory
src/lib/engine/             pure calculation engines (salary, attendance, payroll, leave, settlement, bonus, maternity, compliance)
src/lib/services/           database services (attendance processing, payroll, leave balances, settlement, device sync, imports)
src/lib/reports/            report registry, definitions (defs/*.tsx), Excel export
src/app/(app)/              screens; each page checks the user's permission before reading data
src/app/api/                Excel export and employee photos (authenticated)
scripts/device-sync.ts      scheduled punch-machine sync
```

## Please verify locally

- Minimum-wage figures, annual increment rates and the holiday calendar against the latest government gazettes.
- The BGMEA / BKMEA upload column layout against your current template.
- Company policies that the law leaves to the employer (attendance bonus rules, OT rounding, absence-deduction basis, tiffin / night rates).
- Income tax is a fixed monthly amount per employee; provident fund and workers' participation fund are not included.
- Increments apply from their effective date; apply an increment before processing the payroll of the month it takes effect.
