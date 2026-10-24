-- CreateTable
CREATE TABLE "Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL DEFAULT '',
    "addressEn" TEXT NOT NULL DEFAULT '',
    "addressBn" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "licenseNo" TEXT NOT NULL DEFAULT '',
    "bgmeaRegNo" TEXT NOT NULL DEFAULT '',
    "bkmeaRegNo" TEXT NOT NULL DEFAULT '',
    "hrHeadName" TEXT NOT NULL DEFAULT '',
    "hrHeadDesignation" TEXT NOT NULL DEFAULT '',
    "logoPath" TEXT,
    "houseRentPercent" REAL NOT NULL DEFAULT 50,
    "medicalAllowance" REAL NOT NULL DEFAULT 750,
    "transportAllowance" REAL NOT NULL DEFAULT 450,
    "foodAllowance" REAL NOT NULL DEFAULT 1250,
    "weeklyHoliday" INTEGER NOT NULL DEFAULT 5,
    "dailyOtLimit" REAL NOT NULL DEFAULT 2,
    "dailyHoursLimit" REAL NOT NULL DEFAULT 10,
    "weeklyHoursLimit" REAL NOT NULL DEFAULT 60,
    "holidayWorkAsOt" BOOLEAN NOT NULL DEFAULT true,
    "singlePunchPresent" BOOLEAN NOT NULL DEFAULT true,
    "otDivisor" REAL NOT NULL DEFAULT 208,
    "otMultiplier" REAL NOT NULL DEFAULT 2,
    "absentBasis" TEXT NOT NULL DEFAULT 'BASIC',
    "absentDivisor" TEXT NOT NULL DEFAULT '30',
    "stampCash" REAL NOT NULL DEFAULT 10,
    "stampBank" REAL NOT NULL DEFAULT 0,
    "attBonusMaxLate" INTEGER NOT NULL DEFAULT 3,
    "attBonusAllowLeave" BOOLEAN NOT NULL DEFAULT false,
    "holidayAllowBasis" TEXT NOT NULL DEFAULT 'GROSS',
    "tiffinWorker" REAL NOT NULL DEFAULT 35,
    "tiffinStaff" REAL NOT NULL DEFAULT 50,
    "nightWorker" REAL NOT NULL DEFAULT 100,
    "nightStaff" REAL NOT NULL DEFAULT 150,
    "elDaysPerAccrual" REAL NOT NULL DEFAULT 18,
    "elMaxBalance" REAL NOT NULL DEFAULT 40,
    "elEligibleMonths" INTEGER NOT NULL DEFAULT 12,
    "elEncashMaxPercent" REAL NOT NULL DEFAULT 50,
    "elRateBasis" TEXT NOT NULL DEFAULT 'GROSS',
    "minHiringAge" INTEGER NOT NULL DEFAULT 18,
    "probationWorkerMonths" INTEGER NOT NULL DEFAULT 3,
    "probationStaffMonths" INTEGER NOT NULL DEFAULT 6,
    "incrementPercent" REAL NOT NULL DEFAULT 5,
    "serviceBenefitBasis" TEXT NOT NULL DEFAULT 'BASIC',
    "wageDueWorkingDays" INTEGER NOT NULL DEFAULT 7,
    "settlementDueWorkingDays" INTEGER NOT NULL DEFAULT 30,
    "leftyAbsentDays" INTEGER NOT NULL DEFAULT 10,
    "tzOffsetMinutes" INTEGER NOT NULL DEFAULT 360,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bankName" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT '',
    "accountName" TEXT NOT NULL DEFAULT '',
    "accountNo" TEXT NOT NULL DEFAULT '',
    "routingNo" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Department" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL DEFAULT '',
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Section" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "departmentId" INTEGER NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Section_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Line" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL DEFAULT '',
    "floorId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Line_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MachineType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL DEFAULT '',
    "empType" TEXT NOT NULL DEFAULT 'WORKER',
    "minGross" REAL NOT NULL DEFAULT 0,
    "basic" REAL NOT NULL DEFAULT 0,
    "houseRent" REAL NOT NULL DEFAULT 0,
    "medical" REAL NOT NULL DEFAULT 0,
    "transport" REAL NOT NULL DEFAULT 0,
    "food" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Designation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL DEFAULT '',
    "empType" TEXT NOT NULL DEFAULT 'WORKER',
    "gradeId" INTEGER,
    "otEligible" BOOLEAN NOT NULL DEFAULT true,
    "attendanceBonus" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Designation_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inTime" TEXT NOT NULL,
    "outTime" TEXT NOT NULL,
    "lateGraceMin" INTEGER NOT NULL DEFAULT 5,
    "earlyGraceMin" INTEGER NOT NULL DEFAULT 0,
    "breakMinutes" INTEGER NOT NULL DEFAULT 60,
    "otStartAfterMin" INTEGER NOT NULL DEFAULT 0,
    "otRoundUnitMin" INTEGER NOT NULL DEFAULT 60,
    "otRoundUpMin" INTEGER NOT NULL DEFAULT 50,
    "tiffinAfter" TEXT NOT NULL DEFAULT '19:30',
    "nightAfter" TEXT NOT NULL DEFAULT '22:00',
    "windowBeforeMin" INTEGER NOT NULL DEFAULT 240,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'FESTIVAL'
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL DEFAULT '',
    "annualDays" REAL NOT NULL DEFAULT 0,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "accrual" TEXT NOT NULL DEFAULT 'FIXED',
    "proRata" BOOLEAN NOT NULL DEFAULT true,
    "gender" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Team" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL DEFAULT '',
    "requiredPercent" REAL NOT NULL DEFAULT 6,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Buyer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "maxOtPerDay" REAL NOT NULL DEFAULT 2,
    "maxHoursPerWeek" REAL NOT NULL DEFAULT 60,
    "maxConsecutiveDays" INTEGER NOT NULL DEFAULT 6,
    "notes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Device" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 4370,
    "location" TEXT NOT NULL DEFAULT '',
    "serialNo" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" DATETIME,
    "lastSyncNote" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "ManpowerBudget" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "departmentId" INTEGER NOT NULL,
    "sectionId" INTEGER,
    "designationId" INTEGER,
    "lineId" INTEGER,
    "required" INTEGER NOT NULL,
    CONSTRAINT "ManpowerBudget_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ManpowerBudget_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ManpowerBudget_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ManpowerBudget_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empCode" TEXT NOT NULL,
    "punchId" INTEGER NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL DEFAULT '',
    "fatherEn" TEXT NOT NULL DEFAULT '',
    "fatherBn" TEXT NOT NULL DEFAULT '',
    "motherEn" TEXT NOT NULL DEFAULT '',
    "motherBn" TEXT NOT NULL DEFAULT '',
    "spouseEn" TEXT NOT NULL DEFAULT '',
    "spouseBn" TEXT NOT NULL DEFAULT '',
    "gender" TEXT NOT NULL DEFAULT 'MALE',
    "dob" DATETIME NOT NULL,
    "religion" TEXT NOT NULL DEFAULT 'ISLAM',
    "maritalStatus" TEXT NOT NULL DEFAULT 'SINGLE',
    "bloodGroup" TEXT NOT NULL DEFAULT '',
    "nationality" TEXT NOT NULL DEFAULT 'Bangladeshi',
    "nidNo" TEXT NOT NULL DEFAULT '',
    "birthRegNo" TEXT NOT NULL DEFAULT '',
    "heightCm" REAL,
    "weightKg" REAL,
    "identMarkEn" TEXT NOT NULL DEFAULT '',
    "identMarkBn" TEXT NOT NULL DEFAULT '',
    "educationEn" TEXT NOT NULL DEFAULT '',
    "educationBn" TEXT NOT NULL DEFAULT '',
    "childrenCount" INTEGER NOT NULL DEFAULT 0,
    "mobile" TEXT NOT NULL DEFAULT '',
    "emergencyName" TEXT NOT NULL DEFAULT '',
    "emergencyPhone" TEXT NOT NULL DEFAULT '',
    "emergencyRelation" TEXT NOT NULL DEFAULT '',
    "referenceName" TEXT NOT NULL DEFAULT '',
    "referenceDetails" TEXT NOT NULL DEFAULT '',
    "experienceYears" REAL NOT NULL DEFAULT 0,
    "experienceDetails" TEXT NOT NULL DEFAULT '',
    "presVillageEn" TEXT NOT NULL DEFAULT '',
    "presVillageBn" TEXT NOT NULL DEFAULT '',
    "presPostEn" TEXT NOT NULL DEFAULT '',
    "presPostBn" TEXT NOT NULL DEFAULT '',
    "presThanaEn" TEXT NOT NULL DEFAULT '',
    "presThanaBn" TEXT NOT NULL DEFAULT '',
    "presDistrictEn" TEXT NOT NULL DEFAULT '',
    "presDistrictBn" TEXT NOT NULL DEFAULT '',
    "permVillageEn" TEXT NOT NULL DEFAULT '',
    "permVillageBn" TEXT NOT NULL DEFAULT '',
    "permPostEn" TEXT NOT NULL DEFAULT '',
    "permPostBn" TEXT NOT NULL DEFAULT '',
    "permThanaEn" TEXT NOT NULL DEFAULT '',
    "permThanaBn" TEXT NOT NULL DEFAULT '',
    "permDistrictEn" TEXT NOT NULL DEFAULT '',
    "permDistrictBn" TEXT NOT NULL DEFAULT '',
    "departmentId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "designationId" INTEGER NOT NULL,
    "gradeId" INTEGER,
    "lineId" INTEGER,
    "floorId" INTEGER,
    "machineTypeId" INTEGER,
    "shiftId" INTEGER NOT NULL,
    "empType" TEXT NOT NULL DEFAULT 'WORKER',
    "employmentNature" TEXT NOT NULL DEFAULT 'PROBATION',
    "joinDate" DATETIME NOT NULL,
    "probationEnd" DATETIME,
    "confirmDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "separationDate" DATETIME,
    "weeklyHoliday" INTEGER,
    "otEligible" BOOLEAN NOT NULL DEFAULT true,
    "gross" REAL NOT NULL,
    "basic" REAL NOT NULL,
    "houseRent" REAL NOT NULL,
    "medical" REAL NOT NULL,
    "transport" REAL NOT NULL,
    "food" REAL NOT NULL,
    "otherAllowance" REAL NOT NULL DEFAULT 0,
    "salaryEffective" DATETIME NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'CASH',
    "bankName" TEXT NOT NULL DEFAULT '',
    "bankBranch" TEXT NOT NULL DEFAULT '',
    "bankAccountNo" TEXT NOT NULL DEFAULT '',
    "routingNo" TEXT NOT NULL DEFAULT '',
    "mfsProvider" TEXT NOT NULL DEFAULT '',
    "mfsNumber" TEXT NOT NULL DEFAULT '',
    "monthlyTax" REAL NOT NULL DEFAULT 0,
    "photoPath" TEXT,
    "ageProofType" TEXT NOT NULL DEFAULT 'NID',
    "nightConsentDate" DATETIME,
    "nightConsentWithdrawn" BOOLEAN NOT NULL DEFAULT false,
    "fitnessCertDate" DATETIME,
    "appointmentLetterDate" DATETIME,
    "idCardIssueDate" DATETIME,
    "nomineeFormDate" DATETIME,
    "serviceBookDate" DATETIME,
    "elOpening" REAL NOT NULL DEFAULT 0,
    "elOpeningDate" DATETIME,
    "remarks" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Employee_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Employee_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Employee_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_machineTypeId_fkey" FOREIGN KEY ("machineTypeId") REFERENCES "MachineType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Nominee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL DEFAULT '',
    "relationEn" TEXT NOT NULL DEFAULT '',
    "relationBn" TEXT NOT NULL DEFAULT '',
    "age" INTEGER,
    "nidNo" TEXT NOT NULL DEFAULT '',
    "addressEn" TEXT NOT NULL DEFAULT '',
    "addressBn" TEXT NOT NULL DEFAULT '',
    "mobile" TEXT NOT NULL DEFAULT '',
    "sharePercent" REAL NOT NULL DEFAULT 100,
    CONSTRAINT "Nominee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmployeeTeam" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "trainingDate" DATETIME,
    "trainedBy" TEXT NOT NULL DEFAULT '',
    "certificateNo" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "EmployeeTeam_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmployeeDevice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "enrolledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" DATETIME,
    CONSTRAINT "EmployeeDevice_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeDevice_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalaryHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "designationId" INTEGER,
    "gradeId" INTEGER,
    "gross" REAL NOT NULL,
    "basic" REAL NOT NULL,
    "houseRent" REAL NOT NULL,
    "medical" REAL NOT NULL,
    "transport" REAL NOT NULL,
    "food" REAL NOT NULL,
    "otherAllowance" REAL NOT NULL DEFAULT 0,
    "amount" REAL NOT NULL DEFAULT 0,
    "remarks" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SalaryHistory_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SalaryHistory_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PunchLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "punchId" INTEGER NOT NULL,
    "employeeId" INTEGER,
    "time" DATETIME NOT NULL,
    "deviceId" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'DEVICE',
    "reason" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PunchLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PunchLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttendanceDay" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "dayType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "leaveCode" TEXT,
    "inTime" DATETIME,
    "outTime" DATETIME,
    "punchCount" INTEGER NOT NULL DEFAULT 0,
    "singlePunch" BOOLEAN NOT NULL DEFAULT false,
    "lateMin" INTEGER NOT NULL DEFAULT 0,
    "earlyOutMin" INTEGER NOT NULL DEFAULT 0,
    "workMin" INTEGER NOT NULL DEFAULT 0,
    "otMin" INTEGER NOT NULL DEFAULT 0,
    "otHours" REAL NOT NULL DEFAULT 0,
    "tiffin" BOOLEAN NOT NULL DEFAULT false,
    "nightBill" BOOLEAN NOT NULL DEFAULT false,
    "adjusted" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT NOT NULL DEFAULT '',
    "shiftId" INTEGER,
    CONSTRAINT "AttendanceDay_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttendanceAdjust" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "inTime" DATETIME,
    "outTime" DATETIME,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceAdjust_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaveApplication" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "leaveTypeId" INTEGER NOT NULL,
    "fromDate" DATETIME NOT NULL,
    "toDate" DATETIME NOT NULL,
    "days" REAL NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "appliedOn" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedBy" TEXT NOT NULL DEFAULT '',
    "decidedAt" DATETIME,
    "decisionNote" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveApplication_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeaveApplication_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ElEncashRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "asOfDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ElEncashLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "runId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "earnedDays" REAL NOT NULL,
    "availedDays" REAL NOT NULL,
    "balanceDays" REAL NOT NULL,
    "encashDays" REAL NOT NULL,
    "rate" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "stamp" REAL NOT NULL,
    "net" REAL NOT NULL,
    CONSTRAINT "ElEncashLine_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ElEncashRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ElEncashLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "processedAt" DATETIME,
    "processedBy" TEXT NOT NULL DEFAULT '',
    "lockedAt" DATETIME,
    "lockedBy" TEXT NOT NULL DEFAULT '',
    "paymentDate" DATETIME,
    "notes" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "runId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "designationId" INTEGER NOT NULL,
    "gradeId" INTEGER,
    "lineId" INTEGER,
    "empType" TEXT NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "separationType" TEXT,
    "gross" REAL NOT NULL,
    "basic" REAL NOT NULL,
    "houseRent" REAL NOT NULL,
    "medical" REAL NOT NULL,
    "transport" REAL NOT NULL,
    "food" REAL NOT NULL,
    "otherAllowance" REAL NOT NULL,
    "monthDays" INTEGER NOT NULL,
    "employedDays" INTEGER NOT NULL,
    "presentDays" INTEGER NOT NULL,
    "lateDays" INTEGER NOT NULL,
    "absentDays" INTEGER NOT NULL,
    "paidLeaveDays" REAL NOT NULL,
    "unpaidLeaveDays" REAL NOT NULL,
    "weekendDays" INTEGER NOT NULL,
    "holidayDays" INTEGER NOT NULL,
    "holidayWorkDays" INTEGER NOT NULL,
    "payableDays" REAL NOT NULL,
    "earnedGross" REAL NOT NULL,
    "absentDeduction" REAL NOT NULL,
    "otHours" REAL NOT NULL,
    "otHoursNormal" REAL NOT NULL,
    "otHoursExcess" REAL NOT NULL,
    "otRate" REAL NOT NULL,
    "otAmount" REAL NOT NULL,
    "attendanceBonus" REAL NOT NULL,
    "holidayAllowance" REAL NOT NULL,
    "arrear" REAL NOT NULL,
    "otherAddition" REAL NOT NULL,
    "grossPayable" REAL NOT NULL,
    "advanceDeduction" REAL NOT NULL,
    "stamp" REAL NOT NULL,
    "tax" REAL NOT NULL,
    "otherDeduction" REAL NOT NULL,
    "totalDeduction" REAL NOT NULL,
    "netPayable" REAL NOT NULL,
    CONSTRAINT "Payslip_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payslip_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payslip_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payslip_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payslip_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payslip_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayAdjustment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Advance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "installments" INTEGER NOT NULL,
    "startYear" INTEGER NOT NULL,
    "startMonth" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Advance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdvanceRecovery" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "advanceId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'PAYROLL',
    CONSTRAINT "AdvanceRecovery_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BonusRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "festival" TEXT NOT NULL,
    "cutoffDate" DATETIME NOT NULL,
    "paymentDate" DATETIME,
    "basis" TEXT NOT NULL DEFAULT 'BASIC',
    "religions" TEXT NOT NULL DEFAULT 'ALL',
    "slabs" TEXT NOT NULL,
    "stamp" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BonusLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "runId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "designationId" INTEGER NOT NULL,
    "empType" TEXT NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "serviceMonths" INTEGER NOT NULL,
    "basic" REAL NOT NULL,
    "gross" REAL NOT NULL,
    "percent" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "stamp" REAL NOT NULL,
    "net" REAL NOT NULL,
    CONSTRAINT "BonusLine_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BonusRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BonusLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BonusLine_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BonusLine_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BonusLine_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Increment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ANNUAL',
    "oldDesignationId" INTEGER NOT NULL,
    "newDesignationId" INTEGER NOT NULL,
    "oldGradeId" INTEGER,
    "newGradeId" INTEGER,
    "oldGross" REAL NOT NULL,
    "oldBasic" REAL NOT NULL,
    "oldHouseRent" REAL NOT NULL,
    "oldMedical" REAL NOT NULL,
    "oldTransport" REAL NOT NULL,
    "oldFood" REAL NOT NULL,
    "newGross" REAL NOT NULL,
    "newBasic" REAL NOT NULL,
    "newHouseRent" REAL NOT NULL,
    "newMedical" REAL NOT NULL,
    "newTransport" REAL NOT NULL,
    "newFood" REAL NOT NULL,
    "percent" REAL NOT NULL DEFAULT 0,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "remarks" TEXT NOT NULL DEFAULT '',
    "decidedBy" TEXT NOT NULL DEFAULT '',
    "appliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Increment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Increment_oldDesignationId_fkey" FOREIGN KEY ("oldDesignationId") REFERENCES "Designation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Increment_newDesignationId_fkey" FOREIGN KEY ("newDesignationId") REFERENCES "Designation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Increment_oldGradeId_fkey" FOREIGN KEY ("oldGradeId") REFERENCES "Grade" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Increment_newGradeId_fkey" FOREIGN KEY ("newGradeId") REFERENCES "Grade" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Separation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "noticeDate" DATETIME,
    "effectiveDate" DATETIME NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "noticeDaysGiven" INTEGER NOT NULL DEFAULT 0,
    "diedOnDuty" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settlementStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "serviceText" TEXT NOT NULL DEFAULT '',
    "serviceYears" REAL NOT NULL DEFAULT 0,
    "gross" REAL NOT NULL DEFAULT 0,
    "basic" REAL NOT NULL DEFAULT 0,
    "unpaidDays" REAL NOT NULL DEFAULT 0,
    "unpaidSalary" REAL NOT NULL DEFAULT 0,
    "unpaidOtHours" REAL NOT NULL DEFAULT 0,
    "unpaidOtAmount" REAL NOT NULL DEFAULT 0,
    "benefitDays" REAL NOT NULL DEFAULT 0,
    "serviceBenefit" REAL NOT NULL DEFAULT 0,
    "elDays" REAL NOT NULL DEFAULT 0,
    "elAmount" REAL NOT NULL DEFAULT 0,
    "noticePayDays" REAL NOT NULL DEFAULT 0,
    "noticePay" REAL NOT NULL DEFAULT 0,
    "noticeDeductDays" REAL NOT NULL DEFAULT 0,
    "noticeDeduction" REAL NOT NULL DEFAULT 0,
    "advanceDeduction" REAL NOT NULL DEFAULT 0,
    "otherAddition" REAL NOT NULL DEFAULT 0,
    "otherDeduction" REAL NOT NULL DEFAULT 0,
    "netPayable" REAL NOT NULL DEFAULT 0,
    "calculatedAt" DATETIME,
    "paidOn" DATETIME,
    "remarks" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Separation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeftyCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "absentFrom" DATETIME NOT NULL,
    "letter1Date" DATETIME,
    "letter2Date" DATETIME,
    "letter3Date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "remarks" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeftyCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaternityCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "noticeDate" DATETIME NOT NULL,
    "expectedDelivery" DATETIME NOT NULL,
    "actualDelivery" DATETIME,
    "leaveFrom" DATETIME NOT NULL,
    "leaveTo" DATETIME NOT NULL,
    "serviceMonths" REAL NOT NULL,
    "survivingChildren" INTEGER NOT NULL,
    "benefitEligible" BOOLEAN NOT NULL,
    "wages3m" REAL NOT NULL,
    "daysWorked3m" REAL NOT NULL,
    "avgDailyWage" REAL NOT NULL,
    "benefitDays" INTEGER NOT NULL DEFAULT 112,
    "totalBenefit" REAL NOT NULL,
    "firstInstallment" REAL NOT NULL,
    "firstPaidOn" DATETIME,
    "secondInstallment" REAL NOT NULL,
    "secondPaidOn" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "remarks" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaternityCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "userName" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "changes" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT ''
);

-- CreateIndex
CREATE UNIQUE INDEX "Grade_code_key" ON "Grade"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_code_key" ON "Shift"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_code_key" ON "LeaveType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Team_code_key" ON "Team"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_empCode_key" ON "Employee"("empCode");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_punchId_key" ON "Employee"("punchId");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE INDEX "Employee_departmentId_sectionId_idx" ON "Employee"("departmentId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeTeam_employeeId_teamId_key" ON "EmployeeTeam"("employeeId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeDevice_employeeId_deviceId_key" ON "EmployeeDevice"("employeeId", "deviceId");

-- CreateIndex
CREATE INDEX "SalaryHistory_employeeId_effectiveDate_idx" ON "SalaryHistory"("employeeId", "effectiveDate");

-- CreateIndex
CREATE INDEX "PunchLog_employeeId_time_idx" ON "PunchLog"("employeeId", "time");

-- CreateIndex
CREATE INDEX "PunchLog_time_idx" ON "PunchLog"("time");

-- CreateIndex
CREATE UNIQUE INDEX "PunchLog_punchId_time_key" ON "PunchLog"("punchId", "time");

-- CreateIndex
CREATE INDEX "AttendanceDay_date_idx" ON "AttendanceDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDay_employeeId_date_key" ON "AttendanceDay"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceAdjust_employeeId_date_key" ON "AttendanceAdjust"("employeeId", "date");

-- CreateIndex
CREATE INDEX "LeaveApplication_employeeId_fromDate_idx" ON "LeaveApplication"("employeeId", "fromDate");

-- CreateIndex
CREATE INDEX "LeaveApplication_status_idx" ON "LeaveApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ElEncashLine_runId_employeeId_key" ON "ElEncashLine"("runId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_year_month_key" ON "PayrollRun"("year", "month");

-- CreateIndex
CREATE INDEX "Payslip_employeeId_idx" ON "Payslip"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_runId_employeeId_key" ON "Payslip"("runId", "employeeId");

-- CreateIndex
CREATE INDEX "PayAdjustment_year_month_idx" ON "PayAdjustment"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "AdvanceRecovery_advanceId_year_month_source_key" ON "AdvanceRecovery"("advanceId", "year", "month", "source");

-- CreateIndex
CREATE UNIQUE INDEX "BonusLine_runId_employeeId_key" ON "BonusLine"("runId", "employeeId");

-- CreateIndex
CREATE INDEX "Increment_employeeId_idx" ON "Increment"("employeeId");

-- CreateIndex
CREATE INDEX "Increment_status_idx" ON "Increment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Separation_employeeId_key" ON "Separation"("employeeId");

-- CreateIndex
CREATE INDEX "LeftyCase_status_idx" ON "LeftyCase"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
