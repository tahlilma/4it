// Column layouts for the BGMEA / BKMEA worker (biometric) database bulk upload.
// The associations' templates change from time to time — adjust the headers / order here to match
// the template they currently issue. Each column maps an employee record to a cell value.

import { label, GENDERS, MARITAL, RELIGIONS } from "./constants";
import { dmy } from "./dates";

export interface BioEmployee {
  empCode: string; nameEn: string; nameBn: string; fatherEn: string; motherEn: string; spouseEn: string; gender: string; dob: Date;
  nidNo: string; birthRegNo: string; mobile: string; maritalStatus: string; religion: string; bloodGroup: string; educationEn: string;
  permVillageEn: string; permPostEn: string; permThanaEn: string; permDistrictEn: string;
  presVillageEn: string; presPostEn: string; presThanaEn: string; presDistrictEn: string;
  joinDate: Date; gross: number; status: string; separationDate: Date | null;
  designation: { nameEn: string }; grade: { nameEn: string } | null; section: { nameEn: string }; department: { nameEn: string };
  machineType: { nameEn: string } | null; separation: { type: string; reason: string } | null;
}

export interface BioColumn {
  header: string;
  value: (e: BioEmployee) => string | number;
  width?: number;
}

const common: Record<string, BioColumn> = {
  id: { header: "Worker ID (Factory)", value: (e) => e.empCode, width: 14 },
  name: { header: "Worker Name (English)", value: (e) => e.nameEn, width: 28 },
  nameBn: { header: "Worker Name (Bangla)", value: (e) => e.nameBn, width: 28 },
  father: { header: "Father's Name", value: (e) => e.fatherEn, width: 26 },
  mother: { header: "Mother's Name", value: (e) => e.motherEn, width: 26 },
  spouse: { header: "Spouse's Name", value: (e) => e.spouseEn, width: 24 },
  gender: { header: "Gender", value: (e) => label(GENDERS, e.gender), width: 10 },
  dob: { header: "Date of Birth (DD/MM/YYYY)", value: (e) => dmy(e.dob), width: 14 },
  nid: { header: "NID No.", value: (e) => e.nidNo, width: 18 },
  brn: { header: "Birth Registration No.", value: (e) => e.birthRegNo, width: 20 },
  mobile: { header: "Mobile No.", value: (e) => e.mobile, width: 14 },
  marital: { header: "Marital Status", value: (e) => label(MARITAL, e.maritalStatus), width: 12 },
  religion: { header: "Religion", value: (e) => label(RELIGIONS, e.religion), width: 12 },
  blood: { header: "Blood Group", value: (e) => e.bloodGroup, width: 8 },
  edu: { header: "Education", value: (e) => e.educationEn, width: 14 },
  pVill: { header: "Permanent Village/Road", value: (e) => e.permVillageEn, width: 20 },
  pPost: { header: "Permanent Post Office", value: (e) => e.permPostEn, width: 18 },
  pThana: { header: "Permanent Upazila/Thana", value: (e) => e.permThanaEn, width: 18 },
  pDist: { header: "Permanent District", value: (e) => e.permDistrictEn, width: 14 },
  cVill: { header: "Present Village/Road", value: (e) => e.presVillageEn, width: 20 },
  cPost: { header: "Present Post Office", value: (e) => e.presPostEn, width: 18 },
  cThana: { header: "Present Upazila/Thana", value: (e) => e.presThanaEn, width: 18 },
  cDist: { header: "Present District", value: (e) => e.presDistrictEn, width: 14 },
  desig: { header: "Designation", value: (e) => e.designation.nameEn, width: 22 },
  grade: { header: "Grade", value: (e) => e.grade?.nameEn ?? "", width: 10 },
  section: { header: "Section", value: (e) => e.section.nameEn, width: 18 },
  dept: { header: "Department", value: (e) => e.department.nameEn, width: 16 },
  join: { header: "Date of Joining (DD/MM/YYYY)", value: (e) => dmy(e.joinDate), width: 14 },
  gross: { header: "Gross Salary", value: (e) => e.gross, width: 12 },
  status: { header: "Status", value: (e) => (e.status === "ACTIVE" ? "Active" : "Left"), width: 10 },
  left: { header: "Date of Leaving", value: (e) => dmy(e.separationDate), width: 14 },
  reason: { header: "Reason of Leaving", value: (e) => (e.separation ? `${e.separation.type}${e.separation.reason ? `: ${e.separation.reason}` : ""}` : ""), width: 24 },
  skill: { header: "Skill / Machine", value: (e) => e.machineType?.nameEn ?? "", width: 18 },
};

const c = (...keys: (keyof typeof common)[]) => keys.map((k) => common[k]);

export const BIOMETRIC_LAYOUTS: Record<string, { title: string; columns: BioColumn[] }> = {
  BGMEA: {
    title: "BGMEA Worker Database",
    columns: c("id", "name", "nameBn", "father", "mother", "spouse", "gender", "dob", "nid", "brn", "mobile", "marital", "religion", "blood", "edu",
      "pVill", "pPost", "pThana", "pDist", "cVill", "cPost", "cThana", "cDist", "desig", "grade", "section", "dept", "join", "gross", "status", "left", "reason", "skill"),
  },
  BKMEA: {
    title: "BKMEA Worker Database",
    columns: c("id", "name", "nameBn", "father", "mother", "gender", "dob", "nid", "brn", "mobile", "religion", "marital", "blood",
      "pVill", "pPost", "pThana", "pDist", "cVill", "cThana", "cDist", "dept", "section", "desig", "grade", "join", "gross", "status", "left", "reason"),
  },
};
