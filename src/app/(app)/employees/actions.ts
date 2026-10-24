"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { FieldErrors, runAction, type FormState } from "@/lib/action";
import { audit, diff } from "@/lib/audit";
import { actionUser, can } from "@/lib/auth";
import { addMonths, ageOn, parseDate, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { round2 } from "@/lib/num";
import { AGE_PROOF, EMP_TYPES, EMPLOYMENT_NATURE, GENDERS, MARITAL, PAYMENT_MODES, RELIGIONS } from "@/lib/constants";

const TEXT_FIELDS = [
  "nameEn", "nameBn", "fatherEn", "fatherBn", "motherEn", "motherBn", "spouseEn", "spouseBn", "bloodGroup", "nationality",
  "nidNo", "birthRegNo", "identMarkEn", "identMarkBn", "educationEn", "educationBn", "mobile", "emergencyName", "emergencyPhone",
  "emergencyRelation", "referenceName", "referenceDetails", "experienceDetails",
  "presVillageEn", "presVillageBn", "presPostEn", "presPostBn", "presThanaEn", "presThanaBn", "presDistrictEn", "presDistrictBn",
  "permVillageEn", "permVillageBn", "permPostEn", "permPostBn", "permThanaEn", "permThanaBn", "permDistrictEn", "permDistrictBn",
  "bankName", "bankBranch", "bankAccountNo", "routingNo", "mfsProvider", "mfsNumber", "remarks",
] as const;
const DOC_DATES = ["appointmentLetterDate", "idCardIssueDate", "nomineeFormDate", "fitnessCertDate", "serviceBookDate", "nightConsentDate", "probationEnd", "confirmDate", "elOpeningDate"] as const;
const SALARY = ["gross", "basic", "houseRent", "medical", "transport", "food", "otherAllowance"] as const;

const oneOf = (list: { value: string }[], v: string) => list.some((o) => o.value === v);

export async function saveEmployee(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("employee.edit");
    const id = Number(fd.get("id") ?? 0) || null;
    const company = await prisma.company.findFirstOrThrow();
    const s = (k: string) => String(fd.get(k) ?? "").trim();
    const n = (k: string) => {
      const v = s(k).replace(/,/g, "");
      return v === "" ? null : Number(v);
    };
    const errors: Record<string, string> = {};

    const data: Record<string, unknown> = {};
    for (const k of TEXT_FIELDS) data[k] = s(k);
    for (const k of DOC_DATES) {
      const raw = s(k);
      const d = parseDate(raw);
      if (raw && !d) errors[k] = "Invalid date";
      data[k] = d;
    }

    const empCode = s("empCode");
    if (!/^[A-Za-z0-9-]{1,20}$/.test(empCode)) errors.empCode = "Letters, digits or dash (max 20).";
    const punchId = n("punchId");
    if (!punchId || !Number.isInteger(punchId) || punchId <= 0 || punchId > 99_999_999) errors.punchId = "Positive whole number.";
    if (!data.nameEn) errors.nameEn = "Required";
    const gender = s("gender");
    if (!oneOf(GENDERS, gender)) errors.gender = "Required";
    const dob = parseDate(s("dob"));
    if (!dob) errors.dob = "Required";
    const joinDate = parseDate(s("joinDate"));
    if (!joinDate) errors.joinDate = "Required";
    if (dob && joinDate) {
      const age = ageOn(dob, joinDate);
      if (age < company.minHiringAge) errors.dob = `Age at joining is ${age}; the minimum hiring age is ${company.minHiringAge} (policy / s.34).`;
    }
    const religion = s("religion");
    if (!oneOf(RELIGIONS, religion)) errors.religion = "Required";
    const marital = s("maritalStatus");
    if (!oneOf(MARITAL, marital)) errors.maritalStatus = "Required";
    const nature = s("employmentNature");
    if (!oneOf(EMPLOYMENT_NATURE, nature)) errors.employmentNature = "Required";
    const empType = s("empType");
    if (!oneOf(EMP_TYPES, empType)) errors.empType = "Required";
    const paymentMode = s("paymentMode") || "CASH";
    if (!oneOf(PAYMENT_MODES, paymentMode)) errors.paymentMode = "Invalid";
    const ageProof = s("ageProofType") || "NID";
    if (!oneOf(AGE_PROOF, ageProof)) errors.ageProofType = "Invalid";

    const ids: Record<string, number | null> = {};
    for (const k of ["departmentId", "sectionId", "designationId", "gradeId", "lineId", "floorId", "machineTypeId", "shiftId"]) ids[k] = n(k);
    for (const k of ["departmentId", "sectionId", "designationId", "shiftId"]) if (!ids[k]) errors[k] = "Required";
    if (ids.sectionId && ids.departmentId) {
      const sec = await prisma.section.findUnique({ where: { id: ids.sectionId } });
      if (!sec || sec.departmentId !== ids.departmentId) errors.sectionId = "Section does not belong to the department.";
    }

    const mobile = s("mobile");
    if (mobile && !/^01[3-9]\d{8}$/.test(mobile)) errors.mobile = "Use an 11-digit mobile number (01XXXXXXXXX).";
    const nid = s("nidNo");
    if (nid && !/^(\d{10}|\d{13}|\d{17})$/.test(nid)) errors.nidNo = "NID has 10, 13 or 17 digits.";
    if (paymentMode === "BANK" && !s("bankAccountNo")) errors.bankAccountNo = "Required for bank payment";
    if (paymentMode === "MFS" && !/^01[3-9]\d{8}$/.test(s("mfsNumber"))) errors.mfsNumber = "Enter the 11-digit wallet number";

    // Salary
    const existing = id ? await prisma.employee.findUnique({ where: { id } }) : null;
    if (id && !existing) return { ok: false, error: "Employee not found." };
    const sal = Object.fromEntries(SALARY.map((k) => [k, round2(n(k) ?? 0)])) as Record<(typeof SALARY)[number], number>;
    const salaryChanged = !existing || SALARY.some((k) => round2(existing[k]) !== sal[k]);
    if (salaryChanged) {
      if (existing && !can(user, "salary.edit")) return { ok: false, error: "Changing salary requires the salary.edit permission." };
      if (sal.gross <= 0) errors.gross = "Required";
      const total = round2(sal.basic + sal.houseRent + sal.medical + sal.transport + sal.food + sal.otherAllowance);
      if (Math.abs(total - sal.gross) > 1) errors.gross = `Components add up to ${total}, not ${sal.gross}. Use “Split”.`;
      if (existing && !s("salaryReason")) errors.salaryReason = "Give a reason (it is kept in the salary history).";
    }
    if (ids.gradeId && empType === "WORKER") {
      const g = await prisma.grade.findUnique({ where: { id: ids.gradeId } });
      if (g && g.minGross > 0 && sal.gross < g.minGross) errors.gross = `Below the minimum wage for ${g.nameEn} (Tk ${g.minGross.toLocaleString("en-IN")}).`;
    }
    if (Object.keys(errors).length) throw new FieldErrors(errors);

    const probationMonths = empType === "WORKER" ? company.probationWorkerMonths : company.probationStaffMonths;
    const record = {
      ...data,
      empCode,
      punchId: punchId!,
      gender,
      dob: dob!,
      religion,
      maritalStatus: marital,
      employmentNature: nature,
      empType,
      ageProofType: ageProof,
      paymentMode,
      joinDate: joinDate!,
      probationEnd: (data.probationEnd as Date | null) ?? addMonths(joinDate!, probationMonths),
      departmentId: ids.departmentId!,
      sectionId: ids.sectionId!,
      designationId: ids.designationId!,
      gradeId: ids.gradeId,
      lineId: ids.lineId,
      floorId: ids.floorId,
      machineTypeId: ids.machineTypeId,
      shiftId: ids.shiftId!,
      weeklyHoliday: s("weeklyHoliday") === "" ? null : Number(s("weeklyHoliday")),
      otEligible: fd.get("otEligible") === "on",
      nightConsentWithdrawn: fd.get("nightConsentWithdrawn") === "on",
      childrenCount: Math.max(0, Math.trunc(n("childrenCount") ?? 0)),
      heightCm: n("heightCm"),
      weightKg: n("weightKg"),
      experienceYears: n("experienceYears") ?? 0,
      monthlyTax: n("monthlyTax") ?? 0,
      elOpening: n("elOpening") ?? 0,
      ...sal,
    };

    if (!existing) {
      const emp = await prisma.$transaction(async (tx) => {
        const e = await tx.employee.create({ data: { ...record, salaryEffective: joinDate! } as never });
        await tx.salaryHistory.create({
          data: { employeeId: e.id, effectiveDate: joinDate!, type: "JOINING", designationId: e.designationId, gradeId: e.gradeId, ...sal, createdBy: user.username },
        });
        return e;
      });
      await audit(user, "CREATE", "Employee", emp.id, `Created employee ${emp.empCode} ${emp.nameEn}`);
      redirect(`/employees/${emp.id}?created=1`);
    }

    const today = todayLocal(company.tzOffsetMinutes);
    const effective = record.joinDate.getTime() > today.getTime() ? record.joinDate : today;
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id: existing.id }, data: { ...record, ...(salaryChanged ? { salaryEffective: effective } : {}) } as never });
      if (salaryChanged) {
        await tx.salaryHistory.create({
          data: {
            employeeId: existing.id,
            effectiveDate: effective,
            type: "ADJUSTMENT",
            designationId: record.designationId,
            gradeId: record.gradeId,
            ...sal,
            amount: round2(sal.gross - existing.gross),
            remarks: s("salaryReason"),
            createdBy: user.username,
          },
        });
      }
    });
    await audit(user, "UPDATE", "Employee", existing.id, `Updated employee ${empCode}`, diff(existing, record));
    redirect(`/employees/${existing.id}?saved=1`);
  });
}

const PHOTO_DIR = path.join(process.cwd(), "data", "uploads", "photos");

export async function savePhoto(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("employee.edit");
    const id = Number(fd.get("id"));
    const dataUrl = String(fd.get("photo") ?? "");
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!m) return { ok: false, error: "Choose a JPEG, PNG or WebP image." };
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 2_000_000) return { ok: false, error: "Image too large." };
    await mkdir(PHOTO_DIR, { recursive: true });
    const file = `${id}.${m[1] === "jpeg" ? "jpg" : m[1]}`;
    await writeFile(path.join(PHOTO_DIR, file), buf);
    await prisma.employee.update({ where: { id }, data: { photoPath: file } });
    await audit(user, "UPDATE", "Employee", id, "Updated photo");
    refresh();
    return { ok: true, message: "Photo saved." };
  });
}

export async function saveNominee(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("employee.edit");
    const employeeId = Number(fd.get("employeeId"));
    const id = Number(fd.get("id") ?? 0);
    const s = (k: string) => String(fd.get(k) ?? "").trim();
    const errors: Record<string, string> = {};
    if (!s("nameEn") && !s("nameBn")) errors.nameEn = "Name required";
    const share = Number(s("sharePercent") || 100);
    if (!(share > 0 && share <= 100)) errors.sharePercent = "1–100";
    if (Object.keys(errors).length) throw new FieldErrors(errors);
    const data = {
      employeeId, nameEn: s("nameEn"), nameBn: s("nameBn"), relationEn: s("relationEn"), relationBn: s("relationBn"),
      age: s("age") ? Number(s("age")) : null, nidNo: s("nidNo"), addressEn: s("addressEn"), addressBn: s("addressBn"),
      mobile: s("mobile"), sharePercent: share,
    };
    if (id) await prisma.nominee.update({ where: { id }, data });
    else await prisma.nominee.create({ data });
    await audit(user, id ? "UPDATE" : "CREATE", "Nominee", employeeId, `${id ? "Updated" : "Added"} nominee ${data.nameEn || data.nameBn}`);
    refresh();
    return { ok: true, message: "Nominee saved." };
  });
}

export async function deleteNominee(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("employee.edit");
    const id = Number(fd.get("id"));
    const n = await prisma.nominee.delete({ where: { id } });
    await audit(user, "DELETE", "Nominee", n.employeeId, `Removed nominee ${n.nameEn}`);
    refresh();
    return { ok: true };
  });
}

export async function saveTeamMember(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("employee.edit");
    const employeeId = Number(fd.get("employeeId"));
    const teamId = Number(fd.get("teamId"));
    if (!teamId) throw new FieldErrors({ teamId: "Choose a team" });
    const trainingDate = parseDate(String(fd.get("trainingDate") ?? ""));
    const data = {
      role: String(fd.get("role") ?? "MEMBER") === "LEADER" ? "LEADER" : "MEMBER",
      trainingDate,
      trainedBy: String(fd.get("trainedBy") ?? "").trim(),
      certificateNo: String(fd.get("certificateNo") ?? "").trim(),
    };
    await prisma.employeeTeam.upsert({ where: { employeeId_teamId: { employeeId, teamId } }, create: { employeeId, teamId, ...data }, update: data });
    await audit(user, "UPDATE", "EmployeeTeam", employeeId, `Team membership saved (team ${teamId})`);
    refresh();
    return { ok: true, message: "Team membership saved." };
  });
}

export async function removeTeamMember(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("employee.edit");
    const id = Number(fd.get("id"));
    const m = await prisma.employeeTeam.delete({ where: { id } });
    await audit(user, "DELETE", "EmployeeTeam", m.employeeId, `Removed from team ${m.teamId}`);
    refresh();
    return { ok: true };
  });
}
