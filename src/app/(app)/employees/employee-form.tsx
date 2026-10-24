"use client";

import { useState } from "react";
import { ActionForm, CheckField, ErrorText, Field, FormMessage, SelectField, Submit, TextArea } from "@/components/form";
import { AGE_PROOF, BLOOD_GROUPS, EMP_TYPES, EMPLOYMENT_NATURE, GENDERS, MARITAL, MFS_PROVIDERS, PAYMENT_MODES, RELIGIONS, WEEKDAY_OPTS } from "@/lib/constants";
import { saveEmployee } from "./actions";

export interface EmpFormOptions {
  departments: { value: number; label: string }[];
  sections: { value: number; label: string; departmentId?: number }[];
  designations: { value: number; label: string; empType: string; otEligible: boolean; gradeId: number | null }[];
  grades: { value: number; label: string; minGross: number }[];
  lines: { value: number; label: string }[];
  floors: { value: number; label: string }[];
  machineTypes: { value: number; label: string }[];
  shifts: { value: number; label: string }[];
}

export interface EmpPolicy {
  houseRentPercent: number;
  medicalAllowance: number;
  transportAllowance: number;
  foodAllowance: number;
}

export type EmpValues = Record<string, string | number | boolean | null>;

const opts = (list: { value: string; en: string }[]) => list.map((o) => ({ value: o.value, label: o.en }));
const r2 = (n: number) => Math.round(n * 100) / 100;

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="card">
      <div className="card-h">
        <h2 className="text-[17px] leading-6 font-semibold tracking-[-0.016em] text-label">{title}</h2>
      </div>
      <div className="space-y-3 px-5 pb-5">
        {note && <p className="text-xs text-stone-500">{note}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
      </div>
    </section>
  );
}

export function EmployeeForm({ values, options, policy, salaryEditable, isNew }: { values: EmpValues | null; options: EmpFormOptions; policy: EmpPolicy; salaryEditable: boolean; isNew: boolean }) {
  const v = (k: string) => (values ? values[k] : null);
  const [dept, setDept] = useState<string>(String(v("departmentId") ?? ""));
  const [desig, setDesig] = useState<string>(String(v("designationId") ?? ""));
  const [empType, setEmpType] = useState<string>(String(v("empType") ?? "WORKER"));
  const [ot, setOt] = useState<boolean>(values ? Boolean(v("otEligible")) : true);
  const [grade, setGrade] = useState<string>(String(v("gradeId") ?? ""));
  const [pay, setPay] = useState<string>(String(v("paymentMode") ?? "CASH"));
  const [sal, setSal] = useState({
    gross: String(v("gross") ?? ""),
    basic: String(v("basic") ?? ""),
    houseRent: String(v("houseRent") ?? ""),
    medical: String(v("medical") ?? policy.medicalAllowance),
    transport: String(v("transport") ?? policy.transportAllowance),
    food: String(v("food") ?? policy.foodAllowance),
    otherAllowance: String(v("otherAllowance") ?? 0),
  });
  const total = r2(["basic", "houseRent", "medical", "transport", "food", "otherAllowance"].reduce((s, k) => s + (Number(sal[k as keyof typeof sal]) || 0), 0));
  const gradeMin = options.grades.find((g) => String(g.value) === grade)?.minGross ?? 0;
  const original = values ? Number(v("gross")) : null;

  const split = () => {
    const gross = Number(sal.gross) || 0;
    const med = Number(sal.medical) || 0, tr = Number(sal.transport) || 0, fd = Number(sal.food) || 0, oth = Number(sal.otherAllowance) || 0;
    const basic = Math.max(0, r2((gross - med - tr - fd - oth) / (1 + policy.houseRentPercent / 100)));
    const hr = Math.max(0, r2(gross - med - tr - fd - oth - basic));
    setSal({ ...sal, basic: String(basic), houseRent: String(hr) });
  };

  const sections = options.sections.filter((s) => !dept || String(s.departmentId) === dept);
  const salaryChanged = !isNew && original !== null && Number(sal.gross) !== original;

  return (
    <ActionForm action={saveEmployee} className="space-y-5">
      {values?.id && <input type="hidden" name="id" value={String(values.id)} />}

      <Section title="Identity">
        <Field name="empCode" label="Employee ID / card no." required defaultValue={v("empCode") as string} />
        <Field name="punchId" label="Punch machine ID" type="number" required defaultValue={v("punchId") as number} hint="Enrolment number on the device" />
        <Field name="nameEn" label="Name (English)" required defaultValue={v("nameEn") as string} className="lg:col-span-1" />
        <Field name="nameBn" label="নাম (বাংলা)" lang="bn" defaultValue={v("nameBn") as string} />
        <Field name="fatherEn" label="Father's name" defaultValue={v("fatherEn") as string} />
        <Field name="fatherBn" label="পিতার নাম" lang="bn" defaultValue={v("fatherBn") as string} />
        <Field name="motherEn" label="Mother's name" defaultValue={v("motherEn") as string} />
        <Field name="motherBn" label="মাতার নাম" lang="bn" defaultValue={v("motherBn") as string} />
        <Field name="spouseEn" label="Spouse's name" defaultValue={v("spouseEn") as string} />
        <Field name="spouseBn" label="স্বামী/স্ত্রীর নাম" lang="bn" defaultValue={v("spouseBn") as string} />
        <SelectField name="gender" label="Gender" required options={opts(GENDERS)} defaultValue={(v("gender") as string) ?? "FEMALE"} />
        <Field name="dob" label="Date of birth" type="date" required defaultValue={v("dob") as string} />
        <SelectField name="religion" label="Religion" options={opts(RELIGIONS)} defaultValue={(v("religion") as string) ?? "ISLAM"} />
        <SelectField name="maritalStatus" label="Marital status" options={opts(MARITAL)} defaultValue={(v("maritalStatus") as string) ?? "SINGLE"} />
        <Field name="childrenCount" label="Number of children" type="number" defaultValue={(v("childrenCount") as number) ?? 0} />
        <SelectField name="bloodGroup" label="Blood group" options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))} defaultValue={v("bloodGroup") as string} placeholder="—" />
        <Field name="nidNo" label="National ID no." defaultValue={v("nidNo") as string} />
        <Field name="birthRegNo" label="Birth registration no." defaultValue={v("birthRegNo") as string} />
        <SelectField name="ageProofType" label="Age verified by" options={opts(AGE_PROOF)} defaultValue={(v("ageProofType") as string) ?? "NID"} />
        <Field name="nationality" label="Nationality" defaultValue={(v("nationality") as string) ?? "Bangladeshi"} />
        <Field name="heightCm" label="Height (cm)" type="number" defaultValue={v("heightCm") as number} />
        <Field name="weightKg" label="Weight (kg)" type="number" defaultValue={v("weightKg") as number} />
        <Field name="identMarkEn" label="Identification mark" defaultValue={v("identMarkEn") as string} />
        <Field name="identMarkBn" label="সনাক্তকরণ চিহ্ন" lang="bn" defaultValue={v("identMarkBn") as string} />
        <Field name="educationEn" label="Education" defaultValue={v("educationEn") as string} />
        <Field name="educationBn" label="শিক্ষাগত যোগ্যতা" lang="bn" defaultValue={v("educationBn") as string} />
      </Section>

      <Section title="Contact & address" note="Structured addresses are used on letters, envelopes and the BGMEA / BKMEA export.">
        <Field name="mobile" label="Mobile" defaultValue={v("mobile") as string} placeholder="01XXXXXXXXX" />
        <Field name="emergencyName" label="Emergency contact" defaultValue={v("emergencyName") as string} />
        <Field name="emergencyPhone" label="Emergency phone" defaultValue={v("emergencyPhone") as string} />
        <Field name="emergencyRelation" label="Relation" defaultValue={v("emergencyRelation") as string} />
        <div className="col-span-full mt-2 text-[13px] font-semibold text-label-2">Present address</div>
        <Field name="presVillageEn" label="Village / house / road" defaultValue={v("presVillageEn") as string} />
        <Field name="presPostEn" label="Post office" defaultValue={v("presPostEn") as string} />
        <Field name="presThanaEn" label="Thana / upazila" defaultValue={v("presThanaEn") as string} />
        <Field name="presDistrictEn" label="District" defaultValue={v("presDistrictEn") as string} />
        <Field name="presVillageBn" label="গ্রাম / বাড়ি" lang="bn" defaultValue={v("presVillageBn") as string} />
        <Field name="presPostBn" label="ডাকঘর" lang="bn" defaultValue={v("presPostBn") as string} />
        <Field name="presThanaBn" label="থানা / উপজেলা" lang="bn" defaultValue={v("presThanaBn") as string} />
        <Field name="presDistrictBn" label="জেলা" lang="bn" defaultValue={v("presDistrictBn") as string} />
        <div className="col-span-full mt-2 text-[13px] font-semibold text-label-2">Permanent address</div>
        <Field name="permVillageEn" label="Village / house / road" defaultValue={v("permVillageEn") as string} />
        <Field name="permPostEn" label="Post office" defaultValue={v("permPostEn") as string} />
        <Field name="permThanaEn" label="Thana / upazila" defaultValue={v("permThanaEn") as string} />
        <Field name="permDistrictEn" label="District" defaultValue={v("permDistrictEn") as string} />
        <Field name="permVillageBn" label="গ্রাম / বাড়ি" lang="bn" defaultValue={v("permVillageBn") as string} />
        <Field name="permPostBn" label="ডাকঘর" lang="bn" defaultValue={v("permPostBn") as string} />
        <Field name="permThanaBn" label="থানা / উপজেলা" lang="bn" defaultValue={v("permThanaBn") as string} />
        <Field name="permDistrictBn" label="জেলা" lang="bn" defaultValue={v("permDistrictBn") as string} />
      </Section>

      <Section title="Job">
        <div>
          <label className="label">
            Department <span className="text-ink-red">*</span>
          </label>
          <select name="departmentId" className="input" value={dept} onChange={(e) => setDept(e.target.value)} required>
            <option value="">— Select —</option>
            {options.departments.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ErrorText name="departmentId" />
        </div>
        <SelectField key={`sec-${dept}`} name="sectionId" label="Section" required options={sections} defaultValue={v("sectionId") as number} placeholder="— Select —" />
        <div>
          <label className="label">
            Designation <span className="text-ink-red">*</span>
          </label>
          <select
            name="designationId"
            className="input"
            value={desig}
            required
            onChange={(e) => {
              setDesig(e.target.value);
              const d = options.designations.find((x) => String(x.value) === e.target.value);
              if (d) {
                setEmpType(d.empType);
                setOt(d.otEligible);
                if (d.gradeId) setGrade(String(d.gradeId));
              }
            }}
          >
            <option value="">— Select —</option>
            {options.designations.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ErrorText name="designationId" />
        </div>
        <div>
          <label className="label">Grade</label>
          <select name="gradeId" className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">—</option>
            {options.grades.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ErrorText name="gradeId" />
        </div>
        <div>
          <label className="label">Employee type</label>
          <select name="empType" className="input" value={empType} onChange={(e) => setEmpType(e.target.value)}>
            {EMP_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.en}
              </option>
            ))}
          </select>
        </div>
        <SelectField name="employmentNature" label="Class of worker (s.4)" options={opts(EMPLOYMENT_NATURE)} defaultValue={(v("employmentNature") as string) ?? "PROBATION"} />
        <SelectField name="lineId" label="Line" options={options.lines} defaultValue={v("lineId") as number} placeholder="—" />
        <SelectField name="floorId" label="Floor" options={options.floors} defaultValue={v("floorId") as number} placeholder="—" />
        <SelectField name="machineTypeId" label="Machine type" options={options.machineTypes} defaultValue={v("machineTypeId") as number} placeholder="—" />
        <SelectField name="shiftId" label="Shift" required options={options.shifts} defaultValue={(v("shiftId") as number) ?? options.shifts[0]?.value} />
        <SelectField name="weeklyHoliday" label="Weekly holiday" options={WEEKDAY_OPTS.map((o) => ({ value: o.value, label: o.en }))} defaultValue={v("weeklyHoliday") === null || v("weeklyHoliday") === undefined ? null : String(v("weeklyHoliday"))} placeholder="Company default" />
        <Field name="joinDate" label="Joining date" type="date" required defaultValue={v("joinDate") as string} />
        <Field name="probationEnd" label="Probation ends" type="date" defaultValue={v("probationEnd") as string} hint="Blank = joining date + policy months" />
        <Field name="confirmDate" label="Confirmation date" type="date" defaultValue={v("confirmDate") as string} />
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" name="otEligible" checked={ot} onChange={(e) => setOt(e.target.checked)} className="h-4 w-4 rounded border-stone-300" />
            Overtime eligible
          </label>
        </div>
      </Section>

      <Section title="Salary & payment" note={salaryEditable ? "Gross = basic + house rent + medical + transport + food (+ other). Use “Split gross” to apply the gazette structure." : "Salary changes require the salary.edit permission (use Increment & Promotion for routine changes)."}>
        <div>
          <label className="label">
            Gross salary (Tk) <span className="text-ink-red">*</span>
          </label>
          <div className="flex gap-1">
            <input name="gross" type="number" step="0.01" className="input" value={sal.gross} readOnly={!salaryEditable} onChange={(e) => setSal({ ...sal, gross: e.target.value })} />
            {salaryEditable && (
              <button type="button" onClick={split} className="btn btn-secondary">
                Split
              </button>
            )}
          </div>
          {gradeMin > 0 && Number(sal.gross) > 0 && Number(sal.gross) < gradeMin && <p className="mt-1 text-xs text-ink-red">Below the grade minimum of Tk {gradeMin.toLocaleString("en-IN")}.</p>}
          <ErrorText name="gross" />
        </div>
        {(["basic", "houseRent", "medical", "transport", "food", "otherAllowance"] as const).map((k) => (
          <div key={k}>
            <label className="label">{{ basic: "Basic", houseRent: "House rent", medical: "Medical", transport: "Transport", food: "Food", otherAllowance: "Other allowance" }[k]}</label>
            <input name={k} type="number" step="0.01" className="input" value={sal[k]} readOnly={!salaryEditable} onChange={(e) => setSal({ ...sal, [k]: e.target.value })} />
          </div>
        ))}
        <div className="flex items-end text-sm">
          <span className={total === r2(Number(sal.gross) || 0) ? "text-ink-green" : "text-ink-red"}>Components total: {total.toLocaleString("en-IN")}</span>
        </div>
        {salaryChanged && <Field name="salaryReason" label="Reason for salary change" required className="col-span-full" />}
        <div>
          <label className="label">Payment mode</label>
          <select name="paymentMode" className="input" value={pay} onChange={(e) => setPay(e.target.value)}>
            {PAYMENT_MODES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.en}
              </option>
            ))}
          </select>
        </div>
        {pay === "BANK" && (
          <>
            <Field name="bankName" label="Bank" defaultValue={v("bankName") as string} />
            <Field name="bankBranch" label="Branch" defaultValue={v("bankBranch") as string} />
            <Field name="bankAccountNo" label="Account no." required defaultValue={v("bankAccountNo") as string} />
            <Field name="routingNo" label="Routing no." defaultValue={v("routingNo") as string} />
          </>
        )}
        {pay === "MFS" && (
          <>
            <SelectField name="mfsProvider" label="Provider" options={MFS_PROVIDERS.map((m) => ({ value: m, label: m }))} defaultValue={(v("mfsProvider") as string) ?? "bKash"} />
            <Field name="mfsNumber" label="Wallet number" required defaultValue={v("mfsNumber") as string} />
          </>
        )}
        <Field name="monthlyTax" label="Monthly income tax (Tk)" type="number" defaultValue={(v("monthlyTax") as number) ?? 0} />
      </Section>

      <Section title="Personal file & compliance" note="Dates when statutory documents were issued (Rule 19: appointment letter & ID card; Rule 22: service book within 15 days of confirmation; Form 41 nominee; Form 15 fitness certificate).">
        <Field name="appointmentLetterDate" label="Appointment letter issued" type="date" defaultValue={v("appointmentLetterDate") as string} />
        <Field name="idCardIssueDate" label="ID card issued (Form 6)" type="date" defaultValue={v("idCardIssueDate") as string} />
        <Field name="nomineeFormDate" label="Nominee form (Form 41)" type="date" defaultValue={v("nomineeFormDate") as string} />
        <Field name="fitnessCertDate" label="Age & fitness certificate (Form 15)" type="date" defaultValue={v("fitnessCertDate") as string} />
        <Field name="serviceBookDate" label="Service book opened (Form 7)" type="date" defaultValue={v("serviceBookDate") as string} />
        <Field name="nightConsentDate" label="Night-work consent (Form 35)" type="date" defaultValue={v("nightConsentDate") as string} hint="Women working 10 pm – 6 am; valid 12 months" />
        <CheckField name="nightConsentWithdrawn" label="Consent withdrawn (Form 35A)" defaultChecked={Boolean(v("nightConsentWithdrawn"))} />
        <Field name="referenceName" label="Reference (পরিচয় প্রদানকারী)" defaultValue={v("referenceName") as string} />
        <Field name="experienceYears" label="Previous experience (years)" type="number" defaultValue={(v("experienceYears") as number) ?? 0} />
        <Field name="experienceDetails" label="Experience details" defaultValue={v("experienceDetails") as string} className="lg:col-span-3" />
        <Field name="elOpening" label="Opening earned-leave balance" type="number" defaultValue={(v("elOpening") as number) ?? 0} hint="For employees migrated from another system" />
        <Field name="elOpeningDate" label="Opening balance as of" type="date" defaultValue={v("elOpeningDate") as string} />
        <TextArea name="remarks" label="Remarks" defaultValue={v("remarks") as string} className="col-span-full" rows={2} />
      </Section>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+84px)] z-10 flex items-center gap-3 rounded-[20px] material material-edge px-3 py-2.5 lg:bottom-4">
        <Submit>{isNew ? "Create Employee" : "Save Changes"}</Submit>
        <FormMessage className="flex-1" />
      </div>
    </ActionForm>
  );
}
