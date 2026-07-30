import { useState, useRef, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";
import {
  LayoutDashboard, AlertTriangle, HardHat, Wrench, ClipboardCheck,
  Plus, X, Camera, ArrowLeft, ChevronRight, Menu, Users, MapPin, ShieldAlert,
  Wind, GraduationCap, LogOut, FlaskConical, FileText, Settings,
} from "lucide-react";

// ---------------------------------------------------------------
// Mock data — สถานะทั้งหมดอยู่ใน memory เท่านั้น ไม่มีการเชื่อม backend
// ---------------------------------------------------------------

const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function formatThaiDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${thaiMonths[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// รับ ISO datetime เต็ม (มีเวลาอยู่แล้ว) ต่างจาก formatThaiDate ที่รับแค่วันที่
function formatThaiDateTime(isoDateTime) {
  if (!isoDateTime) return "-";
  const d = new Date(isoDateTime);
  const datePart = `${d.getDate()} ${thaiMonths[d.getMonth()]} ${d.getFullYear() + 543}`;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${datePart} เวลา ${hh}:${mm} น.`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(iso) {
  const diffMs = Date.now() - new Date(iso + "T00:00:00").getTime();
  return Math.max(0, Math.floor(diffMs / 86400000));
}

const incidentStatusOptions = ["รายงานแล้ว", "กำลังตรวจสอบ", "อยู่ระหว่างแก้ไข", "ปิดเคส"];

// ---------------------------------------------------------------
// Incidents <-> Supabase mapping
// severity/status ในหน้าจอเป็นข้อความไทย แต่ในฐานข้อมูลเป็น enum ภาษาอังกฤษ
// (incident_severity / incident_status) จึงต้องแปลงไป-กลับทุกครั้งที่ read/write
// ---------------------------------------------------------------
const severityDbToUi = {
  near_miss: "เกือบเกิดเหตุ", minor: "เล็กน้อย", moderate: "ปานกลาง", severe: "รุนแรง", fatal: "รุนแรง",
};
const severityUiToDb = {
  "เกือบเกิดเหตุ": "near_miss", "เล็กน้อย": "minor", "ปานกลาง": "moderate", "รุนแรง": "severe",
};
const incidentStatusDbToUi = {
  reported: "รายงานแล้ว", investigating: "กำลังตรวจสอบ", corrective_action: "อยู่ระหว่างแก้ไข", closed: "ปิดเคส",
};
const incidentStatusUiToDb = {
  "รายงานแล้ว": "reported", "กำลังตรวจสอบ": "investigating", "อยู่ระหว่างแก้ไข": "corrective_action", "ปิดเคส": "closed",
};

// รวม incident + พนักงานบาดเจ็บ (incident_injured_employees) + ความคืบหน้า (incident_updates)
// ที่ดึงแยกกัน 3 ตาราง ให้เป็น object เดียวที่หน้าจอ IncidentsPage/IncidentDetail คาดหวัง
function mapIncidentRow(row, injuredRows, updateRows, updatedByNameById) {
  return {
    id: row.id,
    location: row.location || "-",
    type: row.injury_type || "-",
    severity: severityDbToUi[row.severity] || row.severity,
    incidentDate: row.incident_date ? row.incident_date.slice(0, 10) : "",
    incidentTime: row.incident_time ? row.incident_time.slice(0, 5) : "",
    department: row.department || "-",
    status: incidentStatusDbToUi[row.status] || row.status,
    description: row.description || "-",
    firstAidGiven: row.first_aid_given || "-",
    probableCause: row.probable_cause || "-",
    reporterName: row.reporter_name || "-",
    reporterPhone: row.reporter_phone || "-",
    injuredEmployees: (injuredRows || []).map((e) => ({
      rowId: e.id,
      employeeId: e.employee_id,
      lostWorkdays: e.lost_workdays,
      injuryType: e.injury_description || "-",
      bodyPart: e.body_part || "-",
    })),
    updates: (updateRows || []).map((u) => ({
      rowId: u.id,
      date: u.created_at ? u.created_at.slice(0, 10) : "",
      by: updatedByNameById?.[u.updated_by] || "-",
      note: u.note,
      newStatus: u.new_status ? incidentStatusDbToUi[u.new_status] : null,
    })),
  };
}

// อุบัติเหตุหนึ่งครั้งอาจมีพนักงานบาดเจ็บได้หลายคน แต่ละคนมีจำนวนวันหยุดงานของตัวเอง
function incidentHasLTI(incident) {
  return incident.injuredEmployees.some((e) => e.lostWorkdays > 0);
}
function incidentTotalLostWorkdays(incident) {
  return incident.injuredEmployees.reduce((sum, e) => sum + e.lostWorkdays, 0);
}

const initialIncidents = [
  {
    id: 1, location: "คลังสินค้า A ชั้น 2", type: "หกล้ม", severity: "ปานกลาง", incidentDate: "2026-07-21",
    status: "กำลังตรวจสอบ", injuredEmployees: [{ employeeId: 3, lostWorkdays: 0, injuryType: "ฟกช้ำเล็กน้อยที่สะโพก" }],
    description: "พนักงานลื่นล้มบนพื้นเปียกบริเวณทางเดินหลักใกล้ประตูโหลดสินค้า",
    updates: [
      { date: "2026-07-22", by: "สมชาย จป.วิชาชีพ", note: "เก็บภาพถ่ายที่เกิดเหตุและตรวจสอบกล้องวงจรปิดแล้ว พบว่าท่อน้ำรั่วบริเวณดังกล่าว", newStatus: null },
    ],
  },
  {
    id: 2, location: "ไลน์ผลิต 2", type: "ของหล่นทับ", severity: "เล็กน้อย", incidentDate: "2026-07-18",
    status: "ปิดเคส", injuredEmployees: [{ employeeId: 2, lostWorkdays: 0, injuryType: "แขนฟกช้ำจากของหล่นทับ" }],
    description: "กล่องชิ้นงานตกจากชั้นวางโดนแขนพนักงาน บาดเจ็บเล็กน้อย ปฐมพยาบาลแล้วกลับมาทำงานต่อได้",
    updates: [
      { date: "2026-07-19", by: "วิภา จป.เทคนิค", note: "ตรวจสอบชั้นวางแล้ว พบว่ายึดไม่แน่น ดำเนินการซ่อมเรียบร้อย ปิดเคส", newStatus: "ปิดเคส" },
    ],
  },
  {
    id: 3, location: "ไลน์ผลิต 1", type: "บาดจากของมีคม", severity: "รุนแรง", incidentDate: "2026-07-05",
    status: "ปิดเคส", injuredEmployees: [{ employeeId: 1, lostWorkdays: 3, injuryType: "มือบาดจากใบมีดเครื่องตัด เย็บแผล 4 เข็ม" }],
    description: "พนักงานมือบาดจากใบมีดเครื่องตัดขณะเปลี่ยนใบมีด ต้องหยุดงาน 3 วัน",
    updates: [
      { date: "2026-07-06", by: "สมชาย จป.วิชาชีพ", note: "ส่งพนักงานพบแพทย์ เย็บแผล 4 เข็ม", newStatus: null },
      { date: "2026-07-08", by: "สมชาย จป.วิชาชีพ", note: "ติดตั้งการ์ดป้องกันใบมีดเพิ่มเติม และอบรมขั้นตอนเปลี่ยนใบมีดใหม่ ปิดเคส", newStatus: "ปิดเคส" },
    ],
  },
];

const userTypeLabel = { free: "Free", silver: "Silver", gold: "Gold" };
const userTypeOptions = Object.keys(userTypeLabel);

// รายการหน้าทั้งหมดในระบบที่กำหนดสิทธิ์การเข้าถึงได้ต่อประเภทผู้ใช้งาน (ไม่รวมหน้าแอดมิน)
const PAGE_OPTIONS = [
  { key: "dashboard", label: "แดชบอร์ด" },
  { key: "incidents", label: "อุบัติเหตุ" },
  { key: "unsafeActs", label: "การกระทำที่ไม่ปลอดภัย" },
  { key: "environmental", label: "ตรวจวัดสิ่งแวดล้อม" },
  { key: "trainingMatrix", label: "Training Matrix" },
  { key: "checklist", label: "ตรวจสอบ" },
  { key: "employees", label: "พนักงาน" },
  { key: "locations", label: "สถานที่ทำงาน" },
  { key: "ppe", label: "PPE" },
  { key: "equipment", label: "อุปกรณ์ความปลอดภัย" },
  { key: "machinery", label: "ทะเบียนเครื่องจักร" },
  { key: "chemicals", label: "ทะเบียนสารเคมี" },
  { key: "govReports", label: "รายงานราชการ" },
];
const ALL_PAGE_KEYS = PAGE_OPTIONS.map((p) => p.key);

// แปลงแถวจากตาราง users (join กับ organizations + subscriptions + subscription_plans)
// ให้เป็นรูปแบบ object ที่โค้ดฝั่งหน้าจอทั้งหมดคาดหวัง (name, companyName, userType ฯลฯ)
// เพราะชื่อฟิลด์ในฐานข้อมูลจริง (full_name, role, approval_status) ต่างจากชื่อที่ใช้
// ในหน้าจอ (name, status, userType) ตั้งแต่ตอนออกแบบ schema ครั้งแรก
function mapUserRow(row) {
  if (!row) return null;
  const planName = row.organization?.subscriptions?.[0]?.plan?.name?.toLowerCase() ?? "free";
  return {
    id: row.id,
    name: row.full_name,
    companyName: row.organization?.name ?? "-",
    organizationId: row.organization?.id ?? null,
    ltiBaselineDate: row.organization?.lti_baseline_date ? row.organization.lti_baseline_date.slice(0, 10) : null,
    orgProfile: {
      name: row.organization?.name || "",
      taxId: row.organization?.tax_id || "",
      industryType: row.organization?.industry_type || "",
      accountTier: row.organization?.account_tier || "",
      address: row.organization?.address || "",
      employeeCount: row.organization?.employee_count ?? "",
      contactEmail: row.organization?.contact_email || "",
      contactPhone: row.organization?.contact_phone || "",
      jorporProfessionalName: row.organization?.jorpor_professional_name || "",
      jorporTechnicalName: row.organization?.jorpor_technical_name || "",
      committeeEmployerNames: row.organization?.committee_employer_names || "",
      committeeEmployeeNames: row.organization?.committee_employee_names || "",
      committeeAppointedDate: row.organization?.committee_appointed_date ? row.organization.committee_appointed_date.slice(0, 10) : "",
      committeeTermEndDate: row.organization?.committee_term_end_date ? row.organization.committee_term_end_date.slice(0, 10) : "",
    },
    email: row.email,
    userType: row.role === "super_admin" ? null : planName,
    status: row.approval_status,
    isAdmin: row.role === "super_admin",
    registeredAt: row.created_at ? row.created_at.slice(0, 10) : null,
  };
}

const USER_SELECT_QUERY = `
  id, email, full_name, role, approval_status, created_at,
  organization:organizations (
    id, name, lti_baseline_date,
    tax_id, industry_type, account_tier, address, employee_count, contact_email, contact_phone,
    jorpor_professional_name, jorpor_technical_name,
    committee_employer_names, committee_employee_names, committee_appointed_date, committee_term_end_date,
    subscriptions ( status, plan:subscription_plans ( name ) )
  )
`;

// แปลงแถวจากตาราง employees จริง (employee_code, full_name, primary_location_id) ให้เป็น
// รูปแบบที่หน้าจอทั้งหมดคาดหวัง (code, name, primaryLocationId) เพราะชื่อฟิลด์ในฐานข้อมูล
// เขียนแบบ snake_case ตาม schema แต่โค้ดหน้าจอเขียนไว้ตั้งแต่แรกแบบ camelCase
function mapEmployeeRow(row) {
  return {
    id: row.id,
    code: row.employee_code || "-",
    name: row.full_name,
    position: row.position || "-",
    department: row.department || "-",
    primaryLocationId: row.primary_location_id,
    isJorporManagement: !!row.is_jorpor_management,
    isJorporSupervisor: !!row.is_jorpor_supervisor,
    isSafetyCommittee: !!row.is_safety_committee,
  };
}

// แปลงกลับจากรูปแบบหน้าจอ ให้เป็นชื่อคอลัมน์จริงตอนจะ insert/update เข้า Supabase
function toEmployeeRow(emp, organizationId) {
  return {
    organization_id: organizationId,
    employee_code: emp.code === "-" ? null : emp.code,
    full_name: emp.name,
    position: emp.position === "-" ? null : emp.position,
    department: emp.department === "-" ? null : emp.department,
    primary_location_id: emp.primaryLocationId || null,
    is_jorpor_management: !!emp.isJorporManagement,
    is_jorpor_supervisor: !!emp.isJorporSupervisor,
    is_safety_committee: !!emp.isSafetyCommittee,
  };
}

// รวมข้อมูล 3 ตาราง (work_locations + work_location_hazards + location_risk_assessments
// รอบล่าสุด) ให้เป็น object เดียวที่หน้าจอใช้งานอยู่แล้ว — assessorName ใช้ currentUser.name
// ตรงๆ แทนการ join ไปตาราง users เพราะตอนนี้ 1 บริษัท = 1 ผู้ใช้เท่านั้น
function mapLocationRow(loc, hazardRows, latestAssessment, assessorName, ppeRows) {
  return {
    id: loc.id,
    name: loc.name,
    building: loc.building || "-",
    description: loc.description || "-",
    riskLevel: loc.risk_level,
    hazards: (hazardRows || []).map((h) => h.hazard_type),
    ppeRequired: (ppeRows || []).map((p) => p.ppe_type),
    riskAssessment: latestAssessment
      ? {
          riskLevel: latestAssessment.risk_level,
          findings: latestAssessment.findings || "-",
          controlMeasures: latestAssessment.control_measures || "-",
          nextDue: latestAssessment.next_assessment_due || "",
          updatedAt: latestAssessment.assessment_date,
          updatedBy: assessorName || "-",
        }
      : {
          riskLevel: loc.risk_level, findings: "-", controlMeasures: "-", nextDue: "",
          updatedAt: loc.created_at, updatedBy: "-",
        },
    // ยังไม่รองรับรูปสถานที่ผ่าน Supabase Storage — ผูกเข้ากับ state ท้องถิ่นแยกต่างหาก
    // ที่ระดับ App component แทน (ดู locationPhotos)
    photoUrl: null,
  };
}

// หลักสูตร (training_courses) — validity_period_days → validityDays
function mapCourseRow(row) {
  return { id: row.id, name: row.name, category: row.category || null, validityDays: row.validity_period_days };
}

// ---------------------------------------------------------------
// ทะเบียนสารเคมี (chemicals) <-> Supabase mapping
// ---------------------------------------------------------------
function mapChemicalRow(row) {
  return {
    id: row.id,
    name: row.name,
    casNumber: row.cas_number || "-",
    quantity: row.quantity ?? "-",
    unit: row.unit || "-",
    storageLocation: row.storage_location || "-",
    hazardType: row.hazard_type || "-",
    ppeRequired: row.ppe_required || [],
    sdsStatus: row.sds_status || "pending",
    recordedDate: row.recorded_date ? row.recorded_date.slice(0, 10) : "",
  };
}

// ---------------------------------------------------------------
// การกระทำที่ไม่ปลอดภัย / ไม่สวมใส่ PPE (ppe_noncompliance_records) <-> Supabase mapping
// ---------------------------------------------------------------
const noncomplianceActionUiToDb = { "เตือนวาจา": "verbal_warning", "ออกใบเตือน": "written_warning", "ให้หยุดงาน": "work_stopped" };
const noncomplianceActionDbToUi = Object.fromEntries(Object.entries(noncomplianceActionUiToDb).map(([k, v]) => [v, k]));

function mapNoncomplianceRow(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    ppeName: row.ppe_name || "-",
    location: row.location || "-",
    date: row.observed_at ? row.observed_at.slice(0, 10) : "",
    action: noncomplianceActionDbToUi[row.action_taken] || row.action_taken,
    notes: row.notes || "-",
  };
}

// ---------------------------------------------------------------
// ตรวจวัดสิ่งแวดล้อม (environmental_measurements) <-> Supabase mapping
// ตารางเก็บ 1 แถว = 1 จุดตรวจวัด แต่หน้าจอต้องการ "1 รอบตรวจวัด" ที่รวมหลายจุดย่อยไว้ด้วยกัน
// จึง group แถวที่มี location_id + measurement_type + measured_at ตรงกันทุกแถวเป็นก้อนเดียว
// (แถวเหล่านี้จะถูก insert พร้อมกันเป็นชุดเดียวเสมอตอนบันทึกใหม่ ทำให้ 3 ค่านี้ตรงกันเป๊ะ)
function mapMeasurementRowsToRounds(rows) {
  const groups = {};
  (rows || []).forEach((r) => {
    const key = `${r.location_id}__${r.measurement_type}__${r.measured_at}`;
    if (!groups[key]) {
      groups[key] = {
        id: key,
        rowIds: [],
        locationId: r.location_id,
        measurementType: r.measurement_type,
        unit: r.unit,
        standardLimit: r.standard_limit,
        measuredAt: r.measured_at ? r.measured_at.slice(0, 10) : "",
        nextDue: r.next_measurement_due,
        notes: r.notes || "-",
        correctionStatus: r.correction_status || "none",
        points: [],
        planFileName: null,
        planFileUrl: null,
      };
    }
    groups[key].rowIds.push(r.id);
    groups[key].points.push({ label: r.point_label || "-", value: r.measured_value, result: r.result });
  });
  return Object.values(groups).map((g) => ({
    ...g,
    failCount: g.points.filter((p) => p.result === "fail").length,
    result: g.points.some((p) => p.result === "fail") ? "fail" : "pass",
  }));
}


const equipmentCategoryUiToDb = {
  "SCBA": "scba", "เครื่องวัดแก๊ส": "gas_detector", "ถังดับเพลิง": "fire_extinguisher",
  "ฝักบัวฉุกเฉิน": "emergency_shower", "ตู้สายฉีดน้ำดับเพลิง": "fire_hose_cabinet",
  "ชุดอุปกรณ์ที่อับอากาศ": "confined_space_kit", "อื่นๆ": "other",
};
const equipmentCategoryDbToUi = Object.fromEntries(Object.entries(equipmentCategoryUiToDb).map(([k, v]) => [v, k]));

const inspectionFrequencyUiToDb = {
  "ทุกวัน (bump test)": "daily", "ทุกสัปดาห์": "weekly", "ทุก 1 เดือน": "monthly",
  "ทุก 3 เดือน": "quarterly", "ทุก 6 เดือน": "semi_annual", "ทุกปี": "annual",
};
const inspectionFrequencyDbToUi = Object.fromEntries(Object.entries(inspectionFrequencyUiToDb).map(([k, v]) => [v, k]));
// จำนวนวันต่อรอบ ใช้คำนวณ next_inspection_due = วันที่ตรวจล่าสุด + จำนวนวันนี้
const inspectionFrequencyDays = { daily: 1, weekly: 7, monthly: 30, quarterly: 90, semi_annual: 182, annual: 365, custom: 30 };

const inspectionResultUiToDb = { "ผ่าน": "pass", "ผ่านแบบมีข้อสังเกต": "pass_with_notes", "ไม่ผ่าน": "fail" };
const inspectionResultDbToUi = Object.fromEntries(Object.entries(inspectionResultUiToDb).map(([k, v]) => [v, k]));

const equipmentStatusDbToUi = {
  normal: "ปกติ", due_soon: "ใกล้ครบกำหนด", overdue: "เกินกำหนด", pending_reinspection: "รอตรวจซ้ำ",
  damaged: "ชำรุด", out_of_service: "เลิกใช้งานชั่วคราว", retired: "ปลดระวาง",
};

function mapEquipmentRow(row) {
  return {
    id: row.id,
    code: row.asset_code,
    name: equipmentCategoryDbToUi[row.category] || row.category,
    location: row.location,
    brand: row.brand || "-",
    frequency: inspectionFrequencyDbToUi[row.inspection_frequency] || row.inspection_frequency,
    lastDate: row.last_inspection_date ? row.last_inspection_date.slice(0, 10) : "-",
    nextDate: row.next_inspection_due ? row.next_inspection_due.slice(0, 10) : "-",
    status: equipmentStatusDbToUi[row.status] || row.status,
    pendingReinspectionDue: row.pending_reinspection_due ? row.pending_reinspection_due.slice(0, 10) : null,
    history: [],
  };
}

function mapInspectionRow(row, inspectorNameById) {
  return {
    rowId: row.id,
    date: row.inspection_date ? row.inspection_date.slice(0, 10) : "",
    inspector: inspectorNameById?.[row.inspected_by] || "-",
    result: inspectionResultDbToUi[row.result] || row.result,
    findings: row.findings || "-",
    action: row.action_taken || "-",
    correctiveDeadline: row.corrective_deadline,
    isFollowUp: row.is_follow_up,
  };
}

// ---------------------------------------------------------------
// เครื่องจักร (machinery) <-> Supabase mapping — แยกจากอุปกรณ์ความปลอดภัย เพราะกลุ่มนี้
// กฎหมายบังคับให้วิศวกรที่ขึ้นทะเบียนเป็นผู้ตรวจ/รับรอง ไม่ใช่ จป. ตรวจเอง
// ---------------------------------------------------------------
const machineryCategoryUiToDb = {
  "ปั้นจั่น/เครน": "crane", "หม้อไอน้ำ": "boiler", "ถังรับความดัน": "pressure_vessel",
  "ลิฟต์": "elevator", "รถยก": "forklift", "อื่นๆ": "other",
};
const machineryCategoryDbToUi = Object.fromEntries(Object.entries(machineryCategoryUiToDb).map(([k, v]) => [v, k]));
const machineryCategoryOptions = Object.keys(machineryCategoryUiToDb);

const machineryStatusDbToUi = {
  normal: "ปกติ", due_soon: "ใกล้ครบกำหนด", overdue: "เกินกำหนด", pending_reinspection: "รอตรวจซ้ำ",
  out_of_service: "เลิกใช้งานชั่วคราว", retired: "ปลดระวาง",
};

const machineryResultUiToDb = { "ผ่าน": "pass", "ผ่านแบบมีข้อสังเกต": "pass_with_notes", "ไม่ผ่าน": "fail" };
const machineryResultDbToUi = Object.fromEntries(Object.entries(machineryResultUiToDb).map(([k, v]) => [v, k]));

function mapMachineryRow(row) {
  return {
    id: row.id,
    code: row.asset_code,
    name: machineryCategoryDbToUi[row.category] || row.category,
    location: row.location || "-",
    frequencyMonths: row.inspection_frequency_months,
    lastDate: row.last_inspection_date ? row.last_inspection_date.slice(0, 10) : "-",
    nextDate: row.next_inspection_due ? row.next_inspection_due.slice(0, 10) : "-",
    status: machineryStatusDbToUi[row.status] || row.status,
    history: [],
  };
}

function mapMachineryInspectionRow(row) {
  return {
    rowId: row.id,
    date: row.inspected_at ? row.inspected_at.slice(0, 10) : "",
    engineerName: row.engineer_name || "-",
    engineerLicenseNumber: row.engineer_license_number || "-",
    certificateNumber: row.certificate_number || "-",
    result: machineryResultDbToUi[row.result] || row.result,
    findings: row.findings || "-",
    correctiveDeadline: row.corrective_deadline,
  };
}

// ประเภท/รุ่นอุปกรณ์ PPE (ppe_catalog) — standard_ref/lifespan_days → camelCase
// หมายเหตุ: ตาราง ppe_catalog ในสคีมาเดิมไม่มีคอลัมน์ "model" (มีแค่ category ซึ่งคนละความหมาย)
// ต้องรัน ALTER TABLE ppe_catalog ADD COLUMN model VARCHAR(255); เพิ่มก่อนใช้งานส่วนนี้
function mapPpeCatalogRow(row) {
  return {
    id: row.id,
    name: row.name,
    model: row.model || "-",
    standard: row.standard_ref || "-",
    lifespanDays: row.lifespan_days,
  };
}

// การเบิก PPE (ppe_issuance) — ไม่มีชื่อ/รุ่น/มาตรฐานอุปกรณ์เก็บซ้ำในตารางนี้ (เก็บแค่
// ppe_catalog_id) จึงต้อง join กับ ppe_catalog ฝั่งโค้ดเสมอ (catalogById ส่งเข้ามาจากตอน fetch)
function mapPpeIssuanceRow(row, catalogById) {
  const cat = catalogById?.[row.ppe_catalog_id];
  return {
    id: row.id,
    employeeId: row.employee_id,
    catalogId: row.ppe_catalog_id,
    name: cat?.name || "-",
    model: cat?.model || "-",
    standard: cat?.standard_ref || "-",
    issuedDate: row.issued_date,
    expiry: row.expiry_date,
    quantity: row.quantity,
    reason: row.issuance_reason,
  };
}

// requirement ของ Training Matrix (position/hazard_type → course) — course_id เก็บเป็น
// UUID ตรงๆ ไม่ต้องแปลงชื่อฟิลด์อะไรมาก
function mapRequirementRow(row) {
  return { id: row.id, position: row.position, hazardType: row.hazard_type, courseId: row.course_id };
}

// ผลอบรมของพนักงานรายคน (training_records) — completion_date/expiry_date → camelCase
function mapTrainingRecordRow(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    courseId: row.course_id,
    completionDate: row.completion_date,
    expiryDate: row.expiry_date,
    certificateNumber: row.certificate_number || "",
    trainingProvider: row.training_provider || "",
  };
}

async function fetchUserProfile(authUserId) {
  const { data, error } = await supabase
    .from("users")
    .select(USER_SELECT_QUERY)
    .eq("id", authUserId)
    .maybeSingle();
  if (error) {
    console.error("fetchUserProfile error:", error);
    return null;
  }
  return mapUserRow(data);
}

// ผู้ใช้แต่ละคน = แต่ละบริษัท (tenant) แยกข้อมูลกันคนละชุดโดยสมบูรณ์ — ไม่มีแนวคิด
// "หลายคนใช้ร่วมกันในบริษัทเดียว" อีกต่อไป มีเพียงบัญชีแอดมินระบบ (isAdmin) เท่านั้นที่แยกต่างหาก
// (รายชื่อผู้ใช้จริงตอนนี้มาจาก Supabase ผ่าน fetchAllUsers()/fetchUserProfile() ด้านบนแล้ว
// ไม่ใช้ mock array นี้อีกต่อไป)

// สิทธิ์การเข้าถึงหน้ากำหนดตาม "ประเภทผู้ใช้งาน" (free/silver/gold) ไม่ใช่รายบุคคล — แก้ไขได้
// ที่หน้า "จัดการประเภทผู้ใช้งาน" เท่านั้น ผู้ใช้ที่มีประเภทเดียวกันจะเห็นเมนูเหมือนกันทั้งหมด
const initialTierPermissions = {
  free: ["dashboard", "incidents", "employees", "checklist"],
  silver: ["dashboard", "incidents", "ppe", "equipment", "machinery", "employees", "locations", "checklist", "chemicals", "govReports"],
  gold: [...ALL_PAGE_KEYS],
};

// ข้อจำกัดการบันทึกข้อมูลตามประเภทผู้ใช้งาน — ตอนนี้รองรับจำกัดจำนวนพนักงานสูงสุด
// ค่า null = ไม่จำกัด ขยายเพิ่มรายการอื่น (เช่น สถานที่, อุปกรณ์) ได้ในอนาคตตามรูปแบบเดียวกัน
const initialTierLimits = {
  free: { maxEmployees: 5 },
  silver: { maxEmployees: 50 },
  gold: { maxEmployees: null },
};

const initialEmployees = [
  { id: 1, code: "EMP-001", name: "สมศักดิ์ ใจดี", position: "ช่างเทคนิค", department: "ซ่อมบำรุง", primaryLocationId: 1 },
  { id: 2, code: "EMP-002", name: "วิภา สายใจ", position: "ผู้ควบคุมเครื่องจักร", department: "ไลน์ผลิต 2", primaryLocationId: 2 },
  { id: 3, code: "EMP-003", name: "ประยุทธ มั่นคง", position: "พนักงานคลังสินค้า", department: "คลังสินค้า", primaryLocationId: 1 },
];

const hazardTypeLabel = {
  work_at_height: "ที่สูง",
  confined_space: "ที่อับอากาศ",
  chemical: "สารเคมี",
  heat: "ความร้อน",
  cold: "ความเย็น",
  electrical: "ไฟฟ้า",
  noise: "เสียงดัง",
  mechanical: "เครื่องจักร",
  biological: "ชีวภาพ",
  radiation: "รังสี",
  other: "อื่นๆ",
};

// รายการประเภท PPE มาตรฐาน — ใช้ทั้งเป็นตัวเลือกตอนเพิ่มประเภท/รุ่นอุปกรณ์ในคลัง PPE
// และเป็นตัวเลือก "PPE ที่ต้องใส่" ต่อสถานที่ทำงาน
const ppeTypeLabel = {
  hard_hat: "หมวกนิรภัย",
  safety_glasses: "แว่นตานิรภัย",
  face_shield: "กระบังหน้า",
  welding_mask: "หน้ากากเชื่อม",
  ear_plugs: "ปลั๊กอุดหู",
  ear_muffs: "ที่ครอบหู",
  dust_mask: "หน้ากากกรองฝุ่น",
  chemical_mask: "หน้ากากกรองสารเคมี",
  scba: "หน้ากาก SCBA (เฉพาะที่ให้ใช้ส่วนตัว)",
  chemical_gloves: "ถุงมือกันสารเคมี",
  electrical_gloves: "ถุงมือกันไฟฟ้า",
  cut_resistant_gloves: "ถุงมือกันบาด",
  leather_gloves: "ถุงมือหนัง",
  safety_shoes: "รองเท้านิรภัย",
  safety_boots: "รองเท้าบูทเซฟตี้",
  full_body_harness: "เข็มขัดนิรภัยเต็มตัว",
  fall_arrest_lanyard: "เชือกกันตก",
};
const ppeTypeOptions = Object.keys(ppeTypeLabel);

const riskLevelLabel = { low: "ต่ำ", medium: "ปานกลาง", high: "สูง", critical: "วิกฤต" };

const riskLevelTone = (level) => {
  if (level === "critical") return "bg-red-50 text-red-700";
  if (level === "high") return "bg-orange-50 text-orange-700";
  if (level === "medium") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
};

const initialLocations = [
  {
    id: 1, name: "คลังสินค้า A ชั้น 2", building: "อาคาร A",
    description: "พื้นที่จัดเก็บสินค้าและขนถ่ายด้วยรถยก", riskLevel: "medium",
    hazards: ["mechanical", "work_at_height"],
    riskAssessment: {
      riskLevel: "medium", findings: "พื้นเปียกลื่นบางจุดบริเวณทางเดินหลัก",
      controlMeasures: "ติดป้ายเตือนพื้นลื่นและเพิ่มความถี่ทำความสะอาด", nextDue: "2026-12-01",
      updatedAt: "2026-06-01T09:15:00", updatedBy: "สมชาย จป.วิชาชีพ",
    },
  },
  {
    id: 2, name: "ไลน์ผลิต 2", building: "อาคาร B",
    description: "สายการผลิตหลัก มีเครื่องจักรตัดและกดขึ้นรูป", riskLevel: "high",
    hazards: ["mechanical", "noise"],
    riskAssessment: {
      riskLevel: "high", findings: "ระดับเสียงเกิน 85 dB(A) ในบางช่วงเวลา",
      controlMeasures: "กำหนดสวมที่อุดหูลดเสียงตลอดกะ และหมุนเวียนพนักงานลดเวลาสัมผัสเสียง", nextDue: "2026-11-15",
      updatedAt: "2026-05-15T13:40:00", updatedBy: "วิภา จป.เทคนิค",
    },
  },
  {
    id: 3, name: "ห้องปฏิบัติการเคมี", building: "อาคาร C",
    description: "จัดเก็บและใช้งานสารเคมีสำหรับทดสอบคุณภาพ", riskLevel: "high",
    hazards: ["chemical"],
    riskAssessment: {
      riskLevel: "high", findings: "SDS บางรายการล้าสมัย ตู้ดูดควันทำงานปกติ",
      controlMeasures: "อัปเดต SDS ทุกรายการ และอบรมการใช้ PPE เคมีเพิ่มเติม", nextDue: "2026-10-10",
      updatedAt: "2026-04-10T10:30:00", updatedBy: "สมชาย จป.วิชาชีพ",
    },
  },
  {
    id: 4, name: "ถังปฏิกรณ์ 2", building: "อาคาร D",
    description: "พื้นที่อับอากาศ ต้องขออนุญาตเข้าทำงานทุกครั้ง", riskLevel: "critical",
    hazards: ["confined_space", "chemical"],
    riskAssessment: {
      riskLevel: "critical", findings: "ระบบระบายอากาศฉุกเฉินทำงานช้ากว่ามาตรฐาน 5 วินาที",
      controlMeasures: "ซ่อมระบบระบายอากาศและซ้อมแผนกู้ภัยที่อับอากาศทุกไตรมาส", nextDue: "2026-10-01",
      updatedAt: "2026-07-01T08:20:00", updatedBy: "สมชาย จป.วิชาชีพ",
    },
  },
  {
    id: 5, name: "ไลน์ผลิต 1", building: "อาคาร B",
    description: "สายการผลิตรอง มีเครื่องตัดใบมีดสำหรับตัดชิ้นงาน", riskLevel: "high",
    hazards: ["mechanical"],
    riskAssessment: {
      riskLevel: "high", findings: "หลังเกิดอุบัติเหตุมือบาดจากใบมีด พบว่าการ์ดป้องกันเดิมไม่ครอบคลุมจุดเปลี่ยนใบมีด",
      controlMeasures: "ติดตั้งการ์ดป้องกันใบมีดเพิ่มเติม และอบรมขั้นตอนเปลี่ยนใบมีดใหม่ทั้งกะ", nextDue: "2027-01-08",
      updatedAt: "2026-07-08T11:05:00", updatedBy: "สมชาย จป.วิชาชีพ",
    },
  },
];

const measurementTypeLabel = {
  noise: "เสียง",
  heat: "ความร้อน (WBGT)",
  light: "ความเข้มแสง",
  dust: "ฝุ่นละออง",
  chemical_vapor: "ไอสารเคมี",
  ventilation: "อัตราการระบายอากาศ",
  other: "อื่นๆ",
};
const measurementTypeOptions = Object.keys(measurementTypeLabel);

// สถานะการแก้ไขสำหรับติดตามผลตรวจวัดที่ไม่ผ่านมาตรฐาน จนกว่าจะแก้ไขเสร็จ
const correctionStatusLabel = { none: "ยังไม่มีการแก้ไข", in_progress: "อยู่ระหว่างดำเนินการ", resolved: "แก้ไขแล้ว" };
const correctionStatusOptions = Object.keys(correctionStatusLabel);
const correctionStatusTone = (s) => {
  if (s === "resolved") return "bg-emerald-50 text-emerald-700";
  if (s === "in_progress") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
};

const initialEnvironmentalMeasurements = [
  {
    id: 1, locationId: 2, measurementType: "noise", unit: "dB(A)", standardLimit: 85,
    measuredAt: "2026-05-15", nextDue: "2026-11-15",
    notes: "เกินมาตรฐานเล็กน้อยช่วงเครื่องจักรทำงานพร้อมกันหลายเครื่อง",
    points: [
      { label: "จุดที่ 1 ใกล้เครื่องปั๊ม", value: 87, result: "fail" },
      { label: "จุดที่ 2 กลางไลน์ผลิต", value: 82, result: "pass" },
      { label: "จุดที่ 3 ใกล้ทางเข้า", value: 79, result: "pass" },
    ],
    failCount: 1, result: "fail", correctionStatus: "in_progress",
    planFileName: null, planFileUrl: null,
  },
  {
    id: 2, locationId: 3, measurementType: "chemical_vapor", unit: "ppm", standardLimit: 25,
    measuredAt: "2026-04-10", nextDue: "2026-10-10",
    notes: "อยู่ในเกณฑ์ปลอดภัย",
    points: [
      { label: "จุดที่ 1 หน้าตู้ดูดควัน", value: 12, result: "pass" },
      { label: "จุดที่ 2 กลางห้องปฏิบัติการ", value: 8, result: "pass" },
    ],
    failCount: 0, result: "pass",
    planFileName: null, planFileUrl: null,
  },
  {
    id: 3, locationId: 4, measurementType: "ventilation", unit: "ACH", standardLimit: 10,
    measuredAt: "2026-07-01", nextDue: "2026-10-01",
    notes: "อัตราการระบายอากาศต่ำกว่ามาตรฐานที่กำหนด",
    points: [
      { label: "จุดที่ 1 ทางเข้าถังปฏิกรณ์", value: 8, result: "fail" },
    ],
    failCount: 1, result: "fail", correctionStatus: "none",
    planFileName: null, planFileUrl: null,
  },
];

// ---------------------------------------------------------------
// Training Matrix — หลักสูตรที่ต้องอบรมตามตำแหน่งงานและ/หรือความเสี่ยงของสถานที่ประจำ
// ---------------------------------------------------------------

const initialTrainingCourses = [
  { id: 1, name: "เจ้าหน้าที่ความปลอดภัยหัวหน้างาน", validityDays: null },
  { id: 2, name: "การทำงานบนที่สูง", validityDays: 365 },
  { id: 3, name: "การทำงานในที่อับอากาศ", validityDays: 365 },
  { id: 4, name: "ความปลอดภัยในการทำงานกับสารเคมี", validityDays: 365 },
  { id: 5, name: "ดับเพลิงขั้นต้น", validityDays: 365 },
  { id: 6, name: "การป้องกันเสียงดังในสถานที่ทำงาน", validityDays: 365 },
];

// position/hazardType อย่างน้อยต้องมี 1 อย่าง — ถ้ามีทั้งคู่ ต้องตรงทั้งสองเงื่อนไข
const initialTrainingRequirements = [
  { id: 1, position: null, hazardType: "work_at_height", courseId: 2 },
  { id: 2, position: null, hazardType: "confined_space", courseId: 3 },
  { id: 3, position: null, hazardType: "chemical", courseId: 4 },
  { id: 4, position: "ช่างเทคนิค", hazardType: null, courseId: 5 },
  { id: 5, position: null, hazardType: "noise", courseId: 6 },
];

const initialTrainingRecords = [
  { id: 1, employeeId: 1, courseId: 2, completionDate: "2026-03-01", expiryDate: "2027-03-01" },
  { id: 2, employeeId: 3, courseId: 2, completionDate: "2024-01-01", expiryDate: "2025-01-01" },
];

// หา courseId ทั้งหมดที่พนักงานคนนี้ต้องอบรม ตามตำแหน่ง + ความเสี่ยงของสถานที่ประจำ
// หมวดหมู่หลักสูตร (training_courses.category) ที่ผูกกับบทบาทด้านความปลอดภัยของพนักงาน
// โดยตรง — ถ้าพนักงานถูกระบุว่าเป็นบทบาทใดบทบาทหนึ่งนี้ หลักสูตรที่มี category ตรงกัน
// จะกลายเป็นหลักสูตรบังคับของพนักงานคนนั้นโดยอัตโนมัติ ไม่ต้องตั้ง training_requirements เอง
const safetyRoleCourseCategory = {
  isJorporManagement: "จป.บริหาร",
  isJorporSupervisor: "จป.หัวหน้างาน",
  isSafetyCommittee: "คปอ.",
};

function getRequiredCourseIds(employee, locations, requirements, courses) {
  const loc = locations.find((l) => l.id === employee.primaryLocationId);
  const locationHazards = loc ? loc.hazards : [];
  // normalize ("NFC") ช่วยกันกรณีข้อความตำแหน่งงานที่พิมพ์/วางมาจากที่ต่างกัน (เช่น LINE, Word)
  // มีอักขระที่มองไม่เห็นด้วยตาเปล่าปนอยู่ ทำให้ === ไม่ตรงกันทั้งที่ดูเหมือนข้อความเดียวกัน
  const normalizePosition = (s) => (s || "").trim().normalize("NFC");
  const empPosition = normalizePosition(employee.position);
  const ids = new Set();
  requirements.forEach((r) => {
    const reqPosition = normalizePosition(r.position);
    if (r.position && r.hazardType) {
      if (reqPosition === empPosition && locationHazards.includes(r.hazardType)) ids.add(r.courseId);
    } else if (r.position) {
      if (reqPosition === empPosition) ids.add(r.courseId);
    } else if (r.hazardType) {
      if (locationHazards.includes(r.hazardType)) ids.add(r.courseId);
    }
  });
  if (courses) {
    Object.entries(safetyRoleCourseCategory).forEach(([flag, category]) => {
      if (employee[flag]) {
        courses.filter((c) => c.category === category).forEach((c) => ids.add(c.id));
      }
    });
  }
  return [...ids];
}

// สถานะการอบรมของพนักงานต่อหลักสูตรหนึ่ง: missing / expired / expiring_soon / compliant
function getTrainingComplianceStatus(employeeId, courseId, trainingRecords) {
  const records = trainingRecords.filter((r) => r.employeeId === employeeId && r.courseId === courseId);
  if (records.length === 0) return "missing";
  const validRecord = records.find((r) => !r.expiryDate || daysUntil(r.expiryDate) > 0);
  if (!validRecord) return "expired";
  if (validRecord.expiryDate && daysUntil(validRecord.expiryDate) <= 30) return "expiring_soon";
  return "compliant";
}

const trainingStatusLabel = { missing: "ยังไม่ผ่าน", expired: "หมดอายุ", expiring_soon: "ใกล้หมดอายุ", compliant: "ผ่านแล้ว" };
const trainingStatusTone = (s) => {
  if (s === "compliant") return "bg-emerald-50 text-emerald-700";
  if (s === "expiring_soon") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
};

const reasonLabel = {
  initial_issue: "เบิกครั้งแรก",
  lost: "ของหาย",
  damaged: "ชำรุด",
  scheduled_replacement: "เปลี่ยนตามรอบ",
};

// คำนวณจำนวนวันที่เหลือก่อนถึงวันหมดอายุ (ค่าติดลบ = เลยกำหนดมาแล้ว)
function daysUntil(iso) {
  const diffMs = new Date(iso + "T00:00:00").getTime() - Date.now();
  return Math.ceil(diffMs / 86400000);
}

// เพิ่มจำนวนวันเข้ากับวันที่ ISO แล้วคืนค่าวันที่ ISO ใหม่ — ใช้คำนวณ "กำหนดแจกครั้งถัดไป"
// จากวันที่รับ + อายุการใช้งานของอุปกรณ์แต่ละประเภทใน PPE catalog
function addDaysIso(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonthsIso(iso, months) {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// ทะเบียนประเภท/รุ่นอุปกรณ์ PPE พร้อมอายุการใช้งานมาตรฐาน (วัน) — ใช้คำนวณรอบการแจกครั้งถัดไป
// อัตโนมัติเมื่อบันทึกการรับมอบ แทนที่จะต้องกรอกวันหมดอายุเองทุกครั้ง
const initialPpeCatalog = [
  { id: 1, name: "หมวกนิรภัย", model: "MSA V-Gard", standard: "มอก. 368-2562", lifespanDays: 180 },
  { id: 2, name: "ถุงมือกันบาด", model: "Ansell HyFlex 11-435", standard: "EN 388:2018", lifespanDays: 180 },
  { id: 3, name: "รองเท้านิรภัย", model: "Cat Diagnostic", standard: "มอก. 523-2564", lifespanDays: 365 },
  { id: 4, name: "แว่นตานิรภัย", model: "3M SecureFit 400", standard: "ANSI Z87.1-2025", lifespanDays: 365 },
];

const initialPpe = [
  { id: 1, employeeId: 1, catalogId: 1, name: "หมวกนิรภัย", standard: "มอก. 368-2562", issuedDate: "2026-01-28", expiry: "2026-07-28", quantity: 1, reason: "initial_issue" },
  { id: 2, employeeId: 1, catalogId: 2, name: "ถุงมือกันบาด", standard: "EN 388:2018", issuedDate: "2026-02-06", expiry: "2026-08-06", quantity: 2, reason: "scheduled_replacement" },
  { id: 3, employeeId: 2, catalogId: 2, name: "ถุงมือกันบาด", standard: "EN 388:2018", issuedDate: "2026-07-01", expiry: "2027-01-01", quantity: 1, reason: "lost" },
  { id: 4, employeeId: 2, catalogId: 1, name: "หมวกนิรภัย", standard: "มอก. 368-2562", issuedDate: "2026-03-03", expiry: "2026-09-03", quantity: 1, reason: "initial_issue" },
  { id: 5, employeeId: 3, catalogId: 3, name: "รองเท้านิรภัย", standard: "มอก. 523-2564", issuedDate: "2026-05-02", expiry: "2026-11-02", quantity: 1, reason: "initial_issue" },
];

const initialNoncompliance = [
  { id: 1, employeeId: 2, ppeName: "หมวกนิรภัย", location: "ไลน์ผลิต 2", date: "2026-07-19", action: "เตือนวาจา", notes: "ไม่ได้สวมหมวกขณะเดินผ่านพื้นที่เครื่องจักร" },
  { id: 2, employeeId: 2, ppeName: "ถุงมือกันบาด", location: "ไลน์ผลิต 2", date: "2026-06-02", action: "เตือนวาจา", notes: "ถอดถุงมือขณะหยิบชิ้นงานที่มีคม" },
];

const initialEquipment = [
  {
    id: 1, code: "SCBA-014", name: "SCBA", location: "อาคาร B ชั้น 1", brand: "Scott Safety AV-3000",
    frequency: "ทุก 1 เดือน", lastDate: "1 มิ.ย. 2569", nextDate: "1 ก.ค. 2569",
    status: "รอตรวจซ้ำ", pendingReinspectionDue: "10 มิ.ย. 2569",
    history: [
      { date: "1 มิ.ย. 2569", inspector: "สมชาย จป.วิชาชีพ", result: "ไม่ผ่าน", isFollowUp: false,
        findings: "แรงดันอากาศในถังต่ำกว่าเกณฑ์ (180 บาร์ จากมาตรฐาน 300 บาร์) วาล์วควบคุมแรงดันรั่วเล็กน้อย",
        action: "เปลี่ยนวาล์วควบคุมแรงดัน (P/N: SC-RV-220) ส่งถังอากาศไปอัดเติมใหม่",
        correctiveDeadline: "10 มิ.ย. 2569" },
      { date: "1 พ.ค. 2569", inspector: "สมชาย จป.วิชาชีพ", result: "ผ่าน", isFollowUp: false,
        findings: "แรงดันอากาศ 300 บาร์ หน้ากากไม่มีรอยรั่ว",
        action: "ทำความสะอาดหน้ากากตามรอบ ไม่มีการเปลี่ยนอะไหล่" },
    ],
  },
  {
    id: 2, code: "GD-007", name: "เครื่องวัดแก๊ส", location: "ถังปฏิกรณ์ 2", brand: "MSA Altair 4X",
    frequency: "ทุกวัน (bump test)", lastDate: "22 ก.ค. 2569", nextDate: "24 ก.ค. 2569",
    status: "ใกล้ครบกำหนด", pendingReinspectionDue: null,
    history: [
      { date: "22 ก.ค. 2569", inspector: "วิภา จป.เทคนิค", result: "ผ่าน", isFollowUp: false,
        findings: "ค่าเซนเซอร์ตรงตามมาตรฐาน แบตเตอรี่ 80%", action: "ไม่มีการซ่อม/เปลี่ยนอะไหล่" },
    ],
  },
  {
    id: 3, code: "FE-102", name: "ถังดับเพลิง", location: "โกดังวัตถุดิบ", brand: "ABC Dry Chemical",
    frequency: "ทุก 6 เดือน", lastDate: "10 พ.ค. 2569", nextDate: "10 พ.ย. 2569",
    status: "ปกติ", pendingReinspectionDue: null,
    history: [
      { date: "10 พ.ค. 2569", inspector: "สมชาย จป.วิชาชีพ", result: "ผ่าน", isFollowUp: false,
        findings: "เข็มวัดแรงดันอยู่ในช่วงสีเขียว สลักนิรภัยครบ", action: "ไม่มีการซ่อม/เปลี่ยนอะไหล่" },
    ],
  },
  {
    id: 4, code: "ES-005", name: "ฝักบัวฉุกเฉิน", location: "ห้องปฏิบัติการเคมี", brand: "Haws 8300",
    frequency: "ทุกสัปดาห์", lastDate: "20 ก.ค. 2569", nextDate: "27 ก.ค. 2569",
    status: "ปกติ", pendingReinspectionDue: null,
    history: [
      { date: "20 ก.ค. 2569", inspector: "วิภา จป.เทคนิค", result: "ผ่าน", isFollowUp: false,
        findings: "แรงดันน้ำและอัตราการไหลปกติ", action: "ไม่มีการซ่อม/เปลี่ยนอะไหล่" },
    ],
  },
];

const checklistItems = [
  { id: 1, text: "สวมใส่สายรัดนิรภัยครบถ้วน" },
  { id: 2, text: "ตรวจสอบจุดยึดเกี่ยวมั่นคง" },
  { id: 3, text: "บันไดอยู่ในสภาพใช้งานได้" },
  { id: 4, text: "มีป้ายเตือนพื้นที่ทำงานชัดเจน" },
];

const workTypes = [
  "งานที่สูง",
  "งานในที่อับอากาศ",
  "งานเชื่อม/ตัด (Hot Work)",
  "งานไฟฟ้า",
  "งานขุดเจาะ",
  "งานยกของด้วยเครื่องจักร/เครน",
];

const equipmentTypeOptions = ["SCBA", "เครื่องวัดแก๊ส", "ถังดับเพลิง", "ฝักบัวฉุกเฉิน", "ตู้สายฉีดน้ำดับเพลิง", "ชุดอุปกรณ์ที่อับอากาศ", "อื่นๆ"];
const frequencyOptions = ["ทุกวัน (bump test)", "ทุกสัปดาห์", "ทุก 1 เดือน", "ทุก 3 เดือน", "ทุก 6 เดือน", "ทุกปี"];

// ---------------------------------------------------------------
// Shared UI bits
// ---------------------------------------------------------------

const statusTone = (status) => {
  if (["เกินกำหนด", "ชำรุด", "ไม่ผ่าน", "รอตรวจซ้ำ"].includes(status)) return "bg-red-50 text-red-700";
  if (["ใกล้ครบกำหนด", "กำลังตรวจสอบ", "ผ่านแบบมีข้อสังเกต", "อยู่ระหว่างแก้ไข"].includes(status)) return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
};

function Badge({ children, tone }) {
  return (
    <span className={`text-xs px-2.5 py-1 rounded ${tone}`}>{children}</span>
  );
}

function MetricCard({ label, value, tone = "text-slate-900" }) {
  return (
    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

// การ์ดสรุปตัวเลขสีสันสำหรับหน้าแดชบอร์ดโดยเฉพาะ — ใช้ gradient + เงา + ไอคอน ให้ดูมีชีวิตชีวา
// กว่า MetricCard ธรรมดาที่ใช้ในหน้าอื่นๆ (อุปกรณ์ความปลอดภัย ฯลฯ) ซึ่งยังคงสไตล์เรียบเดิมไว้
function DashboardMetricCard({ label, value, icon: Icon, tone = "slate" }) {
  const styles = {
    slate: { bg: "from-slate-50 to-slate-100", text: "text-slate-900", iconBg: "bg-slate-200 text-slate-600" },
    emerald: { bg: "from-emerald-50 to-emerald-100", text: "text-emerald-700", iconBg: "bg-emerald-200 text-emerald-700" },
    amber: { bg: "from-amber-50 to-amber-100", text: "text-amber-700", iconBg: "bg-amber-200 text-amber-700" },
    red: { bg: "from-red-50 to-red-100", text: "text-red-700", iconBg: "bg-red-200 text-red-700" },
  };
  const s = styles[tone] || styles.slate;
  return (
    <div className={`bg-gradient-to-br ${s.bg} rounded-xl p-4 border border-white shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-700 font-bold">{label}</p>
        {Icon && (
          <div className={`w-7 h-7 rounded-lg ${s.iconBg} flex items-center justify-center shrink-0`}>
            <Icon size={14} />
          </div>
        )}
      </div>
      <p className={`text-2xl font-bold ${s.text}`}>{value}</p>
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl shadow-sm p-5 ${className}`}>
      {children}
    </div>
  );
}

// ปุ่มลบพร้อมยืนยัน — ไม่ใช้ window.confirm() ของเบราว์เซอร์ เพราะบางสภาพแวดล้อม (เช่น
// iframe preview/sandbox ตอนทดสอบ) บล็อก dialog ของเบราว์เซอร์แบบเงียบๆ ทำให้กดแล้วดูเหมือน
// ไม่มีอะไรเกิดขึ้นเลย จึงทำเป็น UI ยืนยันในตัวแอปเองแทน ใช้ได้ทุกสภาพแวดล้อมแน่นอน
function ConfirmDeleteButton({ onConfirm, label = "ลบ", className = "" }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
        <span className="text-slate-500">ยืนยันลบ?</span>
        <button
          onClick={() => {
            onConfirm();
            setConfirming(false);
          }}
          className="text-red-600 underline font-medium"
        >
          ใช่ ลบเลย
        </button>
        <button onClick={() => setConfirming(false)} className="text-slate-400 underline">
          ยกเลิก
        </button>
      </span>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} className={`text-xs text-slate-400 underline hover:text-red-600 ${className}`}>
      {label}
    </button>
  );
}

// ---------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------

function Dashboard({
  incidents, ppe, equipment, locations, noncompliance, environmentalMeasurements,
  employees, trainingRequirements, trainingRecords, trainingCourses, ltiBaselineDate, onSetLtiBaselineDate, currentUser,
}) {
  const equipmentAttention = equipment.filter((e) => e.status !== "ปกติ").length;
  const ppeSoon = ppe.filter((p) => daysUntil(p.expiry) <= 30).length;
  const incidents30d = incidents.filter((i) => daysBetween(i.incidentDate) <= 30).length;
  const noncompliance30d = noncompliance.filter((r) => daysBetween(r.date) <= 30).length;
  const highRiskLocations = locations.filter((l) => l.riskLevel === "high" || l.riskLevel === "critical");
  const envFailingMeasurements = [...environmentalMeasurements]
    .filter((m) => m.result === "fail")
    .sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1));

  // นับหลักสูตรที่พนักงานแต่ละคน "ยังไม่ผ่าน" หรือ "หมดอายุ" เทียบกับ Training Matrix
  const trainingGaps = [];
  employees.forEach((emp) => {
    getRequiredCourseIds(emp, locations, trainingRequirements, trainingCourses).forEach((cid) => {
      const status = getTrainingComplianceStatus(emp.id, cid, trainingRecords);
      if (status === "missing" || status === "expired") {
        trainingGaps.push({ employee: emp, courseId: cid, status });
      }
    });
  });

  // "วันไม่มีอุบัติเหตุ" นับตามหลัก Lost Time Injury (LTI): หาอุบัติเหตุล่าสุดที่ทำให้ต้อง
  // หยุดงานจริง (lostWorkdays > 0) แล้วนับวันจากวันนั้นถึงวันนี้ — เกือบเกิดเหตุหรือบาดเจ็บ
  // เล็กน้อยที่ไม่ต้องหยุดงานจะไม่ทำให้ตัวเลขนี้รีเซ็ต
  // ltiBaselineDate คือวันฐานที่กรอกเองตอนเริ่มใช้ระบบ (อ้างอิงจากบันทึกเอกสารเดิมก่อนหน้า)
  // ระบบจะเทียบกับอุบัติเหตุจริงที่บันทึกในระบบ แล้วใช้อันที่ "ล่าสุดกว่า" เสมอ — พอมีอุบัติเหตุ
  // จริงเกิดขึ้นใหม่ วันฐานเดิมจะถูกแทนที่โดยอัตโนมัติโดยไม่ต้องลบเอง
  const ltiIncidents = incidents.filter(incidentHasLTI);
  const candidateDays = ltiIncidents.map((i) => daysBetween(i.incidentDate));
  if (ltiBaselineDate) candidateDays.push(daysBetween(ltiBaselineDate));
  // วันที่สมัครใช้งานใช้เป็น "ทางเลือกสุดท้าย" เท่านั้น (ไม่ใช่ตัวเลือกที่มาแข่ง "ล่าสุดกว่า" กับ
  // วันฐานที่กรอกเอง) เพราะวันที่สมัครจะใหม่กว่าบันทึกเอกสารเดิมที่เป็นเหตุการณ์ในอดีตเสมอ ถ้าเอา
  // ไปแข่งด้วยจะกลบวันฐานที่กรอกเองทุกครั้ง ใช้ต่อเมื่อไม่มีทั้งอุบัติเหตุจริงและวันฐานที่กรอกเอง
  let daysSinceLastLti;
  if (candidateDays.length > 0) {
    daysSinceLastLti = Math.min(...candidateDays);
  } else if (currentUser?.registeredAt) {
    daysSinceLastLti = daysBetween(currentUser.registeredAt);
  } else {
    daysSinceLastLti = null;
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-slate-900 to-slate-700 rounded-xl p-5 shadow-md text-white">
        <h1 className="text-lg font-bold">สวัสดี {currentUser?.name ?? ""}</h1>
        <p className="text-sm text-slate-300 mt-0.5">{currentUser?.companyName ?? "-"} · อัปเดตล่าสุด {formatThaiDate(todayIso())}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <DashboardMetricCard label="อุบัติเหตุในรอบ 30 วัน" value={incidents30d} icon={AlertTriangle} tone="slate" />
        <DashboardMetricCard label="วันไม่มีอุบัติเหตุ (LTI)" value={daysSinceLastLti ?? "-"} icon={ClipboardCheck} tone="emerald" />
        <DashboardMetricCard label="PPE ใกล้หมดอายุ" value={ppeSoon} icon={HardHat} tone="amber" />
        <DashboardMetricCard label="อุปกรณ์ต้องเฝ้าระวัง" value={equipmentAttention} icon={Wrench} tone="red" />
        <DashboardMetricCard label="หลักสูตรยังไม่ผ่าน" value={trainingGaps.length} icon={GraduationCap} tone="amber" />
        <DashboardMetricCard label="การกระทำไม่ปลอดภัยใน 30 วัน" value={noncompliance30d} icon={ShieldAlert} tone="slate" />
      </div>

      <Card className="!p-3">
        <p className="text-xs text-slate-500">
          พนักงาน <span className="text-slate-800 font-medium">{employees.length}</span> คน ·
          {" "}สถานที่ <span className="text-slate-800 font-medium">{locations.length}</span> แห่ง ·
          {" "}อุปกรณ์ความปลอดภัย <span className="text-slate-800 font-medium">{equipment.length}</span> ชิ้น ·
          {" "}รายการ PPE ที่แจกแล้ว <span className="text-slate-800 font-medium">{ppe.length}</span> รายการ
        </p>
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs font-bold text-slate-500">
          วันเกิดเหตุ LTI ล่าสุดก่อนใช้ระบบ <span className="text-slate-400">(กรอกครั้งเดียวจากบันทึกเอกสารเดิม ถ้ามี)</span>
        </label>
        <input
          type="date"
          value={ltiBaselineDate ?? ""}
          onChange={(e) => onSetLtiBaselineDate(e.target.value || null)}
          className="border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-700"
        />
        {ltiBaselineDate && (
          <button
            onClick={() => onSetLtiBaselineDate(null)}
            className="text-xs text-slate-400 underline hover:text-slate-600"
          >
            ล้างค่า
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm font-bold text-slate-900 mb-3">อุบัติเหตุล่าสุด</p>
          <div className="space-y-3">
            {[...incidents].sort((a, b) => (a.incidentDate < b.incidentDate ? 1 : -1)).slice(0, 3).map((inc) => (
              <div key={inc.id} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm text-slate-800">{inc.location} · {inc.type}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatThaiDate(inc.incidentDate)}</p>
                </div>
                <Badge tone={statusTone(inc.status)}>{inc.status}</Badge>
              </div>
            ))}
            {incidents.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีอุบัติเหตุที่บันทึกไว้</p>}
          </div>
        </Card>

        <Card>
          <p className="text-sm font-bold text-slate-900 mb-3">อุปกรณ์ที่ต้องเฝ้าระวัง</p>
          <div className="space-y-3">
            {equipment.filter((e) => e.status !== "ปกติ").map((eq) => (
              <div key={eq.id} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm text-slate-800">{eq.name} · {eq.code}</p>
                  <p className="text-xs text-slate-400 mt-0.5">ครบกำหนด {eq.nextDate === "-" ? "-" : formatThaiDate(eq.nextDate)}</p>
                </div>
                <Badge tone={statusTone(eq.status)}>{eq.status}</Badge>
              </div>
            ))}
            {equipment.filter((e) => e.status !== "ปกติ").length === 0 && (
              <p className="text-sm text-slate-400">อุปกรณ์ทุกชิ้นอยู่ในสภาพปกติ</p>
            )}
          </div>
        </Card>

        <Card>
          <p className="text-sm font-bold text-slate-900 mb-3">สถานที่ที่ต้องเฝ้าระวัง</p>
          <div className="space-y-3">
            {highRiskLocations.map((l) => (
              <div key={l.id} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm text-slate-800">{l.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{l.building}</p>
                </div>
                <Badge tone={riskLevelTone(l.riskLevel)}>{riskLevelLabel[l.riskLevel]}</Badge>
              </div>
            ))}
            {highRiskLocations.length === 0 && <p className="text-sm text-slate-400">ไม่มีสถานที่ความเสี่ยงสูง/วิกฤตในขณะนี้</p>}
          </div>
        </Card>

        <Card>
          <p className="text-sm font-bold text-slate-900 mb-3">การกระทำที่ไม่ปลอดภัยล่าสุด</p>
          <div className="space-y-3">
            {noncompliance.slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm text-slate-800">{r.ppeName} · {r.location}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatThaiDate(r.date)}</p>
                </div>
                <Badge tone={r.action === "ให้หยุดงาน" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}>{r.action}</Badge>
              </div>
            ))}
            {noncompliance.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีบันทึกการไม่ปฏิบัติตาม</p>}
          </div>
        </Card>
      </div>

      <div>
        <p className="text-sm font-bold text-slate-900 mb-3">หลักสูตรที่ยังไม่ผ่านตาม Training Matrix</p>
        <Card className="p-0 overflow-hidden">
          {trainingGaps.length === 0 ? (
            <p className="text-sm text-slate-400 p-4">พนักงานทุกคนผ่านหลักสูตรที่กำหนดครบแล้ว</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left">
                    <th className="px-4 py-2.5 font-bold">พนักงาน</th>
                    <th className="px-4 py-2.5 font-bold">หลักสูตร</th>
                    <th className="px-4 py-2.5 font-bold">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {trainingGaps.slice(0, 5).map((g, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-4 py-2.5">{g.employee.name}</td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {trainingCourses.find((c) => c.id === g.courseId)?.name ?? "-"}
                      </td>
                      <td className="px-4 py-2.5"><Badge tone={trainingStatusTone(g.status)}>{trainingStatusLabel[g.status]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div>
        <p className="text-sm font-bold text-slate-900 mb-3">ผลการตรวจวัดสิ่งแวดล้อมที่ไม่ผ่าน</p>
        <Card className="p-0 overflow-hidden">
          {envFailingMeasurements.length === 0 ? (
            <p className="text-sm text-slate-400 p-4">ยังไม่มีผลตรวจวัดที่ไม่ผ่านมาตรฐาน</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left">
                    <th className="px-4 py-2.5 font-bold">สถานที่</th>
                    <th className="px-4 py-2.5 font-bold">ประเภทการตรวจวัด</th>
                    <th className="px-4 py-2.5 font-bold">จุดที่ไม่ผ่าน</th>
                    <th className="px-4 py-2.5 font-bold">วันที่วัด</th>
                  </tr>
                </thead>
                <tbody>
                  {envFailingMeasurements.slice(0, 5).map((m) => (
                    <tr key={m.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5">{locations.find((l) => l.id === m.locationId)?.name ?? "-"}</td>
                      <td className="px-4 py-2.5 text-slate-500">{measurementTypeLabel[m.measurementType]}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone="bg-red-50 text-red-700">
                          {m.failCount ?? (m.points || []).filter((p) => p.result === "fail").length}/{m.points?.length ?? 1} จุด
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{formatThaiDate(m.measuredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------

function IncidentsPage({ incidents, onAdd, onUpdate, onAddProgress, onRemoveProgress, onDeleteIncident, onAddInjured, onUpdateInjured, onRemoveInjured, locations, employees }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [locationMode, setLocationMode] = useState("select"); // "select" | "custom"
  const [form, setForm] = useState({
    location: "", type: "หกล้ม", severity: "ปานกลาง", description: "",
    incidentDate: todayIso(), incidentTime: "", department: "",
    firstAidGiven: "", probableCause: "", reporterName: "", reporterPhone: "",
    injuredEmployees: [],
  });
  const [newInjured, setNewInjured] = useState({ employeeId: "", lostWorkdays: "0", injuryType: "", bodyPart: "" });
  const positionOf = (id) => employees.find((e) => e.id === id)?.position ?? "-";
  const departmentOf = (id) => employees.find((e) => e.id === id)?.department ?? "-";
  const nameOfEmp = (id) => employees.find((e) => e.id === id)?.name ?? "-";

  const addInjuredToForm = () => {
    if (!newInjured.employeeId) return;
    setForm({
      ...form,
      injuredEmployees: [
        ...form.injuredEmployees,
        {
          tempId: Date.now(),
          employeeId: newInjured.employeeId,
          lostWorkdays: Number(newInjured.lostWorkdays) || 0,
          injuryType: newInjured.injuryType || "-",
          bodyPart: newInjured.bodyPart || "-",
        },
      ],
    });
    setNewInjured({ employeeId: "", lostWorkdays: "0", injuryType: "", bodyPart: "" });
  };

  const removeInjuredFromForm = (tempId) => {
    setForm({ ...form, injuredEmployees: form.injuredEmployees.filter((e) => e.tempId !== tempId) });
  };

  const autoLatestIncidentDate = incidents.length
    ? incidents.reduce((latest, i) => (i.incidentDate > latest ? i.incidentDate : latest), incidents[0].incidentDate)
    : null;

  const submit = () => {
    if (!form.location.trim() || !form.incidentDate) return;
    onAdd({
      id: Date.now(),
      location: form.location,
      type: form.type,
      severity: form.severity,
      incidentDate: form.incidentDate,
      incidentTime: form.incidentTime,
      department: form.department || "-",
      status: "รายงานแล้ว",
      injuredEmployees: form.injuredEmployees,
      description: form.description || "-",
      firstAidGiven: form.firstAidGiven || "-",
      probableCause: form.probableCause || "-",
      reporterName: form.reporterName || "-",
      reporterPhone: form.reporterPhone || "-",
      updates: [],
    });
    setForm({
      location: "", type: "หกล้ม", severity: "ปานกลาง", description: "",
      incidentDate: todayIso(), incidentTime: "", department: "",
      firstAidGiven: "", probableCause: "", reporterName: "", reporterPhone: "",
      injuredEmployees: [],
    });
    setNewInjured({ employeeId: "", lostWorkdays: "0", injuryType: "", bodyPart: "" });
    setShowForm(false);
  };

  const selected = incidents.find((i) => i.id === selectedId);
  if (selected) {
    return (
      <IncidentDetail
        incident={selected}
        employees={employees}
        onBack={() => setSelectedId(null)}
        onUpdate={onUpdate}
        onAddProgress={onAddProgress}
        onRemoveProgress={onRemoveProgress}
        onAddInjured={onAddInjured}
        onUpdateInjured={onUpdateInjured}
        onRemoveInjured={onRemoveInjured}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">ทะเบียนอุบัติเหตุ</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <label className="text-sm font-bold text-slate-500">วันเกิดเหตุล่าสุด:</label>
            <span className="text-sm text-slate-700">
              {autoLatestIncidentDate ? formatThaiDate(autoLatestIncidentDate) : "ยังไม่มีข้อมูล"}
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-800"
        >
          <Plus size={16} /> รายงานอุบัติเหตุ
        </button>
      </div>

      {showForm && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-900">รายงานอุบัติเหตุใหม่</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">สถานที่เกิดเหตุ (จุดที่ชัดเจน)</label>
              <select
                value={locationMode === "custom" ? "__custom__" : form.location}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setLocationMode("custom");
                    setForm({ ...form, location: "" });
                  } else {
                    setLocationMode("select");
                    setForm({ ...form, location: e.target.value });
                  }
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">-- เลือกสถานที่ --</option>
                {locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
                <option value="__custom__">อื่นๆ (ระบุเอง)</option>
              </select>
              {locationMode === "custom" && (
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="ระบุสถานที่"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-2"
                />
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">ลักษณะการบาดเจ็บ</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option>หกล้ม</option>
                <option>ของหล่นทับ</option>
                <option>บาดจากของมีคม</option>
                <option>ไฟฟ้าช็อต</option>
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">
                วันที่เกิดเหตุ <span className="text-slate-400">(ค่าเริ่มต้นคือวันนี้ แก้ไขได้กรณีรายงานย้อนหลัง)</span>
              </label>
              <input
                type="date"
                value={form.incidentDate}
                onChange={(e) => setForm({ ...form, incidentDate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">เวลาโดยประมาณ</label>
              <input
                type="time"
                value={form.incidentTime}
                onChange={(e) => setForm({ ...form, incidentTime: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs font-bold text-slate-500 block mb-1">แผนก/หน่วยงาน</label>
            <input
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              placeholder="เช่น แผนกผลิต 2"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="mb-3">
            <label className="text-xs font-bold text-slate-500 block mb-1">ระดับความรุนแรง</label>
            <div className="flex gap-2 flex-wrap">
              {["เกือบเกิดเหตุ", "เล็กน้อย", "ปานกลาง", "รุนแรง"].map((s) => (
                <button
                  key={s}
                  onClick={() => setForm({ ...form, severity: s })}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${
                    form.severity === s ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4 border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-bold text-slate-600">พนักงานที่ได้รับบาดเจ็บ/เกี่ยวข้อง (ถ้ามี)</p>
            </div>
            {form.injuredEmployees.length > 0 && (
              <div className="divide-y divide-slate-100">
                {form.injuredEmployees.map((e) => (
                  <div key={e.tempId} className="px-3 py-2 flex items-center justify-between gap-2 text-sm">
                    <div>
                      <span className="font-bold text-base text-slate-900">{nameOfEmp(e.employeeId)}</span>
                      <span className="text-slate-400"> · {positionOf(e.employeeId)} · {departmentOf(e.employeeId)}</span>
                      <div className="text-xs text-slate-500">
                        {e.bodyPart !== "-" && <>ส่วนที่บาดเจ็บ: {e.bodyPart} · </>}
                        {e.injuryType !== "-" && <>{e.injuryType} · </>}
                        หยุดงาน {e.lostWorkdays} วัน
                      </div>
                    </div>
                    <button onClick={() => removeInjuredFromForm(e.tempId)} className="text-xs text-slate-400 underline hover:text-red-600 shrink-0">
                      ลบ
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="p-3 bg-white">
              <div className="grid sm:grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">พนักงาน</label>
                  <select
                    value={newInjured.employeeId}
                    onChange={(e) => setNewInjured({ ...newInjured, employeeId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  >
                    <option value="">เลือกพนักงาน...</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  {newInjured.employeeId && (
                    <p className="text-xs text-slate-400 mt-1">ตำแหน่งงาน: {positionOf(newInjured.employeeId)} · แผนก: {departmentOf(newInjured.employeeId)}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">ส่วนของร่างกายที่บาดเจ็บ</label>
                  <input
                    value={newInjured.bodyPart}
                    onChange={(e) => setNewInjured({ ...newInjured, bodyPart: e.target.value })}
                    placeholder="เช่น มือขวา"
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">ลักษณะการบาดเจ็บ</label>
                  <input
                    value={newInjured.injuryType}
                    onChange={(e) => setNewInjured({ ...newInjured, injuryType: e.target.value })}
                    placeholder="เช่น มือบาดจากใบมีด"
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">จำนวนวันหยุดงาน</label>
                  <input
                    type="number"
                    min="0"
                    value={newInjured.lostWorkdays}
                    onChange={(e) => setNewInjured({ ...newInjured, lostWorkdays: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={addInjuredToForm}
                  disabled={!newInjured.employeeId}
                  className="flex items-center gap-1.5 text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={13} /> เพิ่มในรายการ
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">แก้ไขหรือเพิ่มเติมภายหลังได้ที่หน้ารายละเอียดของอุบัติเหตุนี้</p>
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs font-bold text-slate-500 block mb-1">เหตุการณ์ที่เกิดขึ้น (บรรยายสั้นๆ ว่าเกิดอะไรขึ้น)</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="อธิบายสิ่งที่เกิดขึ้นตามลำดับเวลา"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
          <div className="mb-3">
            <label className="text-xs font-bold text-slate-500 block mb-1">การปฐมพยาบาลเบื้องต้นที่ทำไปแล้ว</label>
            <textarea
              rows={2}
              value={form.firstAidGiven}
              onChange={(e) => setForm({ ...form, firstAidGiven: e.target.value })}
              placeholder="เช่น ล้างแผลด้วยน้ำสะอาด พันผ้าก๊อซ"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
          <div className="mb-3">
            <label className="text-xs font-bold text-slate-500 block mb-1">สาเหตุเบื้องต้นที่คาดว่าเป็นไปได้</label>
            <textarea
              rows={2}
              value={form.probableCause}
              onChange={(e) => setForm({ ...form, probableCause: e.target.value })}
              placeholder="เช่น พื้นเปียกลื่น ไม่มีป้ายเตือน"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">ชื่อผู้แจ้ง (หัวหน้างาน)</label>
              <input
                value={form.reporterName}
                onChange={(e) => setForm({ ...form, reporterName: e.target.value })}
                placeholder="ชื่อ-นามสกุล"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">เบอร์ติดต่อกลับ</label>
              <input
                value={form.reporterPhone}
                onChange={(e) => setForm({ ...form, reporterPhone: e.target.value })}
                placeholder="เช่น 08x-xxx-xxxx"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-600">
              ยกเลิก
            </button>
            <button onClick={submit} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white">
              ส่งรายงาน
            </button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-2.5 font-bold">สถานที่</th>
              <th className="px-4 py-2.5 font-bold">ลักษณะ</th>
              <th className="px-4 py-2.5 font-bold">ความรุนแรง</th>
              <th className="px-4 py-2.5 font-bold">วันที่</th>
              <th className="px-4 py-2.5 font-bold">หยุดงาน</th>
              <th className="px-4 py-2.5 font-bold">สถานะ</th>
              <th className="px-4 py-2.5"></th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {[...incidents].sort((a, b) => (a.incidentDate < b.incidentDate ? 1 : -1)).map((inc) => (
              <tr
                key={inc.id}
                onClick={() => setSelectedId(inc.id)}
                className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
              >
                <td className="px-4 py-2.5">{inc.location}</td>
                <td className="px-4 py-2.5">{inc.type}</td>
                <td className="px-4 py-2.5 text-slate-500">{inc.severity}</td>
                <td className="px-4 py-2.5 text-slate-500">{formatThaiDate(inc.incidentDate)}</td>
                <td className="px-4 py-2.5">
                  {incidentHasLTI(inc) ? (
                    <span className="text-red-600">{incidentTotalLostWorkdays(inc)} วัน (LTI)</span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-4 py-2.5"><Badge tone={statusTone(inc.status)}>{inc.status}</Badge></td>
                <td className="px-4 py-2.5 text-slate-300"><ChevronRight size={16} /></td>
                <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <ConfirmDeleteButton onConfirm={() => onDeleteIncident(inc.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
// Incident detail — แก้ไขสถานะ/รายละเอียด และบันทึกความคืบหน้า
// ---------------------------------------------------------------

function IncidentDetail({ incident, employees, onBack, onUpdate, onAddProgress, onRemoveProgress, onAddInjured, onUpdateInjured, onRemoveInjured }) {
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({
    location: incident.location,
    severity: incident.severity,
    description: incident.description,
    status: incident.status,
    incidentTime: incident.incidentTime,
    department: incident.department === "-" ? "" : incident.department,
    firstAidGiven: incident.firstAidGiven === "-" ? "" : incident.firstAidGiven,
    probableCause: incident.probableCause === "-" ? "" : incident.probableCause,
    reporterName: incident.reporterName === "-" ? "" : incident.reporterName,
    reporterPhone: incident.reporterPhone === "-" ? "" : incident.reporterPhone,
  });
  const [progressNote, setProgressNote] = useState("");
  const [progressStatus, setProgressStatus] = useState("");
  const [newInjured, setNewInjured] = useState({ employeeId: "", lostWorkdays: "0", injuryType: "", bodyPart: "" });

  const nameOf = (id) => employees.find((e) => e.id === id)?.name ?? "-";
  const positionOf = (id) => employees.find((e) => e.id === id)?.position ?? "-";
  const departmentOf = (id) => employees.find((e) => e.id === id)?.department ?? "-";

  const saveEdit = () => {
    onUpdate(incident.id, {
      location: edit.location,
      severity: edit.severity,
      description: edit.description,
      status: edit.status,
      incidentTime: edit.incidentTime,
      department: edit.department || "-",
      firstAidGiven: edit.firstAidGiven || "-",
      probableCause: edit.probableCause || "-",
      reporterName: edit.reporterName || "-",
      reporterPhone: edit.reporterPhone || "-",
    });
    setEditing(false);
  };

  const submitProgress = () => {
    if (!progressNote.trim()) return;
    onAddProgress(incident.id, {
      note: progressNote,
      newStatus: progressStatus || null,
    });
    setProgressNote("");
    setProgressStatus("");
  };

  const addInjuredEmployee = () => {
    if (!newInjured.employeeId) return;
    onAddInjured(incident.id, {
      employeeId: newInjured.employeeId,
      lostWorkdays: Number(newInjured.lostWorkdays) || 0,
      injuryType: newInjured.injuryType || "-",
      bodyPart: newInjured.bodyPart || "-",
    });
    setNewInjured({ employeeId: "", lostWorkdays: "0", injuryType: "", bodyPart: "" });
  };

  const updateInjuredField = (rowId, field, value) => {
    onUpdateInjured(incident.id, rowId, field, field === "lostWorkdays" ? Number(value) || 0 : value);
  };

  const removeInjuredEmployee = (rowId) => {
    onRemoveInjured(incident.id, rowId);
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> กลับไปทะเบียนอุบัติเหตุ
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{incident.location} · {incident.type}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {formatThaiDate(incident.incidentDate)}
            {incident.incidentTime ? ` ${incident.incidentTime} น.` : ""} · ความรุนแรง {incident.severity}
            {incident.department !== "-" ? ` · ${incident.department}` : ""}
          </p>
        </div>
        <Badge tone={statusTone(incident.status)}>{incident.status}</Badge>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-slate-900">รายละเอียดและสถานะ</p>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-xs text-slate-500 underline hover:text-slate-700">
              แก้ไข
            </button>
          )}
        </div>

        {!editing ? (
          <div className="space-y-3 text-sm">
            <p className="text-slate-700 whitespace-pre-wrap">{incident.description}</p>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-slate-100">
              <p><span className="text-slate-500">การปฐมพยาบาลเบื้องต้น:</span> {incident.firstAidGiven}</p>
              <p><span className="text-slate-500">สาเหตุเบื้องต้นที่คาดว่าเป็นไปได้:</span> {incident.probableCause}</p>
              <p><span className="text-slate-500">ชื่อผู้แจ้ง:</span> {incident.reporterName}</p>
              <p><span className="text-slate-500">เบอร์ติดต่อกลับ:</span> {incident.reporterPhone}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">สถานที่</label>
                <input
                  value={edit.location}
                  onChange={(e) => setEdit({ ...edit, location: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">สถานะ</label>
                <select
                  value={edit.status}
                  onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  {incidentStatusOptions.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">เวลาโดยประมาณ</label>
                <input
                  type="time"
                  value={edit.incidentTime}
                  onChange={(e) => setEdit({ ...edit, incidentTime: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">แผนก/หน่วยงาน</label>
                <input
                  value={edit.department}
                  onChange={(e) => setEdit({ ...edit, department: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">ระดับความรุนแรง</label>
              <select
                value={edit.severity}
                onChange={(e) => setEdit({ ...edit, severity: e.target.value })}
                className="w-full sm:w-1/2 border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                {["เกือบเกิดเหตุ", "เล็กน้อย", "ปานกลาง", "รุนแรง"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">เหตุการณ์ที่เกิดขึ้น</label>
              <textarea
                rows={3}
                value={edit.description}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">การปฐมพยาบาลเบื้องต้นที่ทำไปแล้ว</label>
              <textarea
                rows={2}
                value={edit.firstAidGiven}
                onChange={(e) => setEdit({ ...edit, firstAidGiven: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">สาเหตุเบื้องต้นที่คาดว่าเป็นไปได้</label>
              <textarea
                rows={2}
                value={edit.probableCause}
                onChange={(e) => setEdit({ ...edit, probableCause: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">ชื่อผู้แจ้ง (หัวหน้างาน)</label>
                <input
                  value={edit.reporterName}
                  onChange={(e) => setEdit({ ...edit, reporterName: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">เบอร์ติดต่อกลับ</label>
                <input
                  value={edit.reporterPhone}
                  onChange={(e) => setEdit({ ...edit, reporterPhone: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-600">
                ยกเลิก
              </button>
              <button onClick={saveEdit} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white">
                บันทึก
              </button>
            </div>
          </div>
        )}
      </Card>

      <div>
        <p className="text-sm font-bold text-slate-900 mb-3">พนักงานที่ได้รับบาดเจ็บ</p>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-left">
                <th className="px-4 py-2.5 font-bold">พนักงาน</th>
                <th className="px-4 py-2.5 font-bold">ตำแหน่งงาน</th>
                <th className="px-4 py-2.5 font-bold">แผนก</th>
                <th className="px-4 py-2.5 font-bold">ส่วนของร่างกายที่บาดเจ็บ</th>
                <th className="px-4 py-2.5 font-bold">ลักษณะการบาดเจ็บ</th>
                <th className="px-4 py-2.5 font-bold">จำนวนวันหยุดงาน</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {incident.injuredEmployees.map((e) => (
                <tr key={e.rowId} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-bold text-slate-900">{nameOf(e.employeeId)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{positionOf(e.employeeId)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{departmentOf(e.employeeId)}</td>
                  <td className="px-4 py-2.5">
                    <input
                      value={e.bodyPart === "-" ? "" : e.bodyPart || ""}
                      onChange={(ev) => updateInjuredField(e.rowId, "bodyPart", ev.target.value)}
                      placeholder="เช่น มือขวา"
                      className="w-full min-w-[8rem] border border-slate-300 rounded-lg px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      value={e.injuryType || ""}
                      onChange={(ev) => updateInjuredField(e.rowId, "injuryType", ev.target.value)}
                      placeholder="เช่น มือบาดจากใบมีด"
                      className="w-full min-w-[10rem] border border-slate-300 rounded-lg px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      min="0"
                      value={e.lostWorkdays}
                      onChange={(ev) => updateInjuredField(e.rowId, "lostWorkdays", ev.target.value)}
                      className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-sm"
                    />
                    <span className="text-slate-500 ml-1.5">วัน</span>
                    {e.lostWorkdays > 0 && <span className="text-xs text-red-600 ml-2">(LTI)</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => removeInjuredEmployee(e.rowId)} className="text-xs text-slate-400 underline hover:text-red-600">
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
              {incident.injuredEmployees.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-sm text-slate-400">ไม่มีพนักงานได้รับบาดเจ็บที่บันทึกไว้</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs font-bold text-slate-600 mb-2">เพิ่มพนักงานที่ได้รับบาดเจ็บ</p>
            <div className="grid sm:grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">พนักงาน</label>
                <select
                  value={newInjured.employeeId}
                  onChange={(e) => setNewInjured({ ...newInjured, employeeId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="">เลือกพนักงาน...</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                {newInjured.employeeId && (
                  <p className="text-xs text-slate-400 mt-1">ตำแหน่งงาน: {positionOf(newInjured.employeeId)} · แผนก: {departmentOf(newInjured.employeeId)}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">ส่วนของร่างกายที่บาดเจ็บ</label>
                <input
                  value={newInjured.bodyPart}
                  onChange={(e) => setNewInjured({ ...newInjured, bodyPart: e.target.value })}
                  placeholder="เช่น มือขวา"
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">ลักษณะการบาดเจ็บ</label>
                <input
                  value={newInjured.injuryType}
                  onChange={(e) => setNewInjured({ ...newInjured, injuryType: e.target.value })}
                  placeholder="เช่น มือบาดจากใบมีด"
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">จำนวนวันหยุดงาน</label>
                <input
                  type="number"
                  min="0"
                  value={newInjured.lostWorkdays}
                  onChange={(e) => setNewInjured({ ...newInjured, lostWorkdays: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={addInjuredEmployee}
                disabled={!newInjured.employeeId}
                className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={15} /> บันทึกพนักงานบาดเจ็บ
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div>
        <p className="text-sm font-bold text-slate-900 mb-3">ความคืบหน้า</p>
        <Card className="mb-4">
          <label className="text-xs font-bold text-slate-500 block mb-1">บันทึกความคืบหน้าใหม่</label>
          <textarea
            rows={2}
            value={progressNote}
            onChange={(e) => setProgressNote(e.target.value)}
            placeholder="เช่น ติดตั้งการ์ดป้องกันเพิ่มเติมแล้ว รอทดสอบใช้งานจริง"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none mb-3"
          />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500">เปลี่ยนสถานะไปด้วย (ไม่บังคับ):</label>
              <select
                value={progressStatus}
                onChange={(e) => setProgressStatus(e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
              >
                <option value="">ไม่เปลี่ยนสถานะ</option>
                {incidentStatusOptions.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={submitProgress} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white">
              บันทึกความคืบหน้า
            </button>
          </div>
        </Card>

        <div className="space-y-4">
          {[...incident.updates].reverse().map((u, i, arr) => (
            <div key={u.rowId} className="flex gap-3">
              <div className="flex flex-col items-center pt-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-400" />
                {i < arr.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
              </div>
              <div className="pb-4 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">
                    {formatThaiDate(u.date)} · {u.by}
                    {u.newStatus && (
                      <span className="ml-2 text-xs font-normal bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        เปลี่ยนสถานะเป็น {u.newStatus}
                      </span>
                    )}
                  </p>
                  <ConfirmDeleteButton
                    className="shrink-0"
                    onConfirm={() => onRemoveProgress(incident.id, u.rowId)}
                  />
                </div>
                <p className="text-sm text-slate-600 mt-1">{u.note}</p>
              </div>
            </div>
          ))}
          {incident.updates.length === 0 && (
            <p className="text-sm text-slate-400">ยังไม่มีการบันทึกความคืบหน้า</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// PPE registry
// ---------------------------------------------------------------

function ppeStatusOf(daysLeft) {
  if (daysLeft <= 7) return "เกินกำหนด";
  if (daysLeft <= 30) return "ใกล้ครบกำหนด";
  return "ปกติ";
}

function PpeByItemView({ employees, ppe }) {
  const [openName, setOpenName] = useState(null);
  const nameOf = (id) => employees.find((e) => e.id === id)?.name ?? "-";

  const grouped = Object.values(
    ppe.reduce((acc, p) => {
      if (!acc[p.name]) acc[p.name] = { name: p.name, items: [] };
      acc[p.name].items.push(p);
      return acc;
    }, {})
  );

  return (
    <div className="space-y-3">
      {grouped.map((g) => {
        const totalQuantity = g.items.reduce((sum, p) => sum + p.quantity, 0);
        const expiringSoon = g.items.filter((p) => daysUntil(p.expiry) <= 90).length;
        const isOpen = openName === g.name;
        return (
          <Card key={g.name} className="p-0 overflow-hidden">
            <button
              onClick={() => setOpenName(isOpen ? null : g.name)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-bold text-slate-900">{g.name}</p>
                <p className="text-xs text-slate-500">จำนวนทั้งหมด {totalQuantity} · ถือครองโดย {g.items.length} คน</p>
              </div>
              <div className="flex items-center gap-3">
                {expiringSoon > 0 ? (
                  <Badge tone="bg-amber-50 text-amber-700">ใกล้หมดอายุ {expiringSoon} ชิ้น</Badge>
                ) : (
                  <span className="text-xs text-slate-400">ไม่มีใกล้หมดอายุ</span>
                )}
                <ChevronRight size={16} className={`text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </div>
            </button>
            {isOpen && (
              <div className="overflow-x-auto">
              <table className="w-full text-sm border-t border-slate-100">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left">
                    <th className="px-4 py-2 font-medium">พนักงานที่ได้รับมอบ</th>
                    <th className="px-4 py-2 font-medium">จำนวน</th>
                    <th className="px-4 py-2 font-medium">ใกล้ถึงกำหนดเปลี่ยนหรือยัง</th>
                    <th className="px-4 py-2 font-medium">วันที่รับ</th>
                    <th className="px-4 py-2 font-medium">วันหมดอายุ</th>
                    <th className="px-4 py-2 font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((p) => {
                    const remaining = daysUntil(p.expiry);
                    const nearingReplacement = remaining <= 90;
                    return (
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="px-4 py-2">{nameOf(p.employeeId)}</td>
                        <td className="px-4 py-2 text-slate-500">{p.quantity}</td>
                        <td className="px-4 py-2">
                          {nearingReplacement ? (
                            <Badge tone="bg-amber-50 text-amber-700">ใกล้ถึงกำหนด (เหลือ {remaining} วัน)</Badge>
                          ) : (
                            <span className="text-slate-400">ยังไม่ถึงกำหนด</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-500">{formatThaiDate(p.issuedDate)}</td>
                        <td className="px-4 py-2 text-slate-500">{formatThaiDate(p.expiry)}</td>
                        <td className="px-4 py-2"><Badge tone={statusTone(ppeStatusOf(remaining))}>เหลือ {remaining} วัน</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function NoncomplianceView({ employees, locations, records, onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employeeId: employees[0]?.id ?? "", ppeName: "", location: locations[0]?.name ?? "", date: todayIso(), action: "เตือนวาจา", notes: "" });
  const nameOf = (id) => employees.find((e) => e.id === id)?.name ?? "-";

  // employees/locations มาจาก Supabase (โหลดแบบ async) — ถ้าคอมโพเนนต์นี้ mount ก่อนโหลดเสร็จ
  // ค่าเริ่มต้นจะติดอยู่ที่ "" ตลอดไปถ้าไม่ sync ใหม่ตอนข้อมูลมาถึงจริง (ดูคำอธิบายเดียวกันใน PpeIssuanceView)
  useEffect(() => {
    if (!form.employeeId && employees.length > 0) {
      setForm((f) => ({ ...f, employeeId: employees[0].id }));
    }
  }, [employees]);
  useEffect(() => {
    if (!form.location && locations.length > 0) {
      setForm((f) => ({ ...f, location: locations[0].name }));
    }
  }, [locations]);

  const submit = () => {
    if (!form.employeeId || !form.ppeName.trim() || !form.location.trim()) return;
    onAdd({ ...form });
    setForm({ employeeId: employees[0]?.id ?? "", ppeName: "", location: locations[0]?.name ?? "", date: todayIso(), action: "เตือนวาจา", notes: "" });
    setShowForm(false);
  };

  const countByEmployee = (id) => records.filter((r) => r.employeeId === id).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-800"
        >
          <Plus size={16} /> บันทึกการไม่ปฏิบัติตาม
        </button>
      </div>

      {showForm && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-900">บันทึกพบพนักงานไม่สวมใส่ PPE</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">พนักงาน</label>
              <select
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">-- เลือกพนักงาน --</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">อุปกรณ์ที่ไม่ได้สวมใส่</label>
              <input
                value={form.ppeName}
                onChange={(e) => setForm({ ...form, ppeName: e.target.value })}
                placeholder="เช่น หมวกนิรภัย"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">สถานที่พบเหตุ</label>
              <select
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">-- เลือกสถานที่ --</option>
                {locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">การดำเนินการ</label>
              <select
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option>เตือนวาจา</option>
                <option>ออกใบเตือน</option>
                <option>ให้หยุดงาน</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">วันที่พบ</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs font-bold text-slate-500 block mb-1">หมายเหตุ</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="อธิบายสถานการณ์ที่พบ"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-600">
              ยกเลิก
            </button>
            <button
              onClick={submit}
              disabled={!form.employeeId || !form.location}
              className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              บันทึก
            </button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-2.5 font-bold">พนักงาน</th>
              <th className="px-4 py-2.5 font-bold">อุปกรณ์ที่ไม่ได้สวมใส่</th>
              <th className="px-4 py-2.5 font-bold">สถานที่</th>
              <th className="px-4 py-2.5 font-bold">วันที่พบ</th>
              <th className="px-4 py-2.5 font-bold">การดำเนินการ</th>
              <th className="px-4 py-2.5 font-bold">สะสม</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5">{nameOf(r.employeeId)}</td>
                <td className="px-4 py-2.5">{r.ppeName}</td>
                <td className="px-4 py-2.5 text-slate-500">{r.location}</td>
                <td className="px-4 py-2.5 text-slate-500">{formatThaiDate(r.date)}</td>
                <td className="px-4 py-2.5"><Badge tone={r.action === "ให้หยุดงาน" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}>{r.action}</Badge></td>
                <td className="px-4 py-2.5 text-slate-500">{countByEmployee(r.employeeId)} ครั้ง</td>
                <td className="px-4 py-2.5 text-right">
                  <ConfirmDeleteButton onConfirm={() => onDelete(r.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}

function PpeIssuanceView({ employees, ppe, catalog, onAddIssuance, onDeleteIssuance }) {
  const [form, setForm] = useState({
    employeeId: employees[0]?.id ?? "", catalogId: catalog[0]?.id ?? "",
    quantity: "1", receivedDate: todayIso(), reason: "initial_issue",
  });
  const [justAdded, setJustAdded] = useState(null);

  // employees/catalog มาจาก Supabase ซึ่งโหลดแบบ async — ถ้าคอมโพเนนต์นี้ mount ก่อนโหลดเสร็จ
  // ค่าเริ่มต้นข้างบนจะติดอยู่ที่ "" ตลอดไป (useState คำนวณค่าเริ่มต้นแค่ครั้งเดียวตอน mount)
  // ทำให้ dropdown แสดงตัวเลือกแรกให้ดู แต่ state จริงยังว่าง กดบันทึกแล้ว employee_id ที่ส่ง
  // ไปอาจไม่ตรงกับที่เห็นบนจอ จึงต้อง sync ให้ใหม่ทันทีที่ข้อมูลมาถึงจริง
  useEffect(() => {
    if (!form.employeeId && employees.length > 0) {
      setForm((f) => ({ ...f, employeeId: employees[0].id }));
    }
  }, [employees]);
  useEffect(() => {
    if (!form.catalogId && catalog.length > 0) {
      setForm((f) => ({ ...f, catalogId: catalog[0].id }));
    }
  }, [catalog]);

  const selectedCatalogItem = catalog.find((c) => c.id === form.catalogId);
  const computedExpiry = selectedCatalogItem
    ? addDaysIso(form.receivedDate, selectedCatalogItem.lifespanDays)
    : null;

  const nameOf = (id) => employees.find((e) => e.id === id)?.name ?? "-";

  const submit = () => {
    if (!form.employeeId || !selectedCatalogItem || !form.receivedDate) return;
    onAddIssuance({
      employeeId: form.employeeId,
      catalogId: selectedCatalogItem.id,
      name: selectedCatalogItem.name,
      model: selectedCatalogItem.model || "-",
      standard: selectedCatalogItem.standard,
      issuedDate: form.receivedDate,
      expiry: computedExpiry,
      quantity: Number(form.quantity) || 1,
      reason: form.reason,
    });
    setJustAdded({ employeeName: employees.find((e) => e.id === form.employeeId)?.name, name: selectedCatalogItem.name, expiry: computedExpiry });
    setForm({ ...form, quantity: "1", receivedDate: todayIso(), reason: "initial_issue" });
  };

  const sortedPpe = [...ppe].sort((a, b) => (a.issuedDate < b.issuedDate ? 1 : -1));

  return (
    <div className="space-y-5">
      <Card className="max-w-2xl">
        <p className="text-sm font-bold text-slate-900 mb-4">บันทึกการเบิก PPE</p>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">พนักงานผู้รับมอบ</label>
            <select
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">-- เลือกพนักงาน --</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">ประเภท/รุ่นอุปกรณ์</label>
            <select
              value={form.catalogId}
              onChange={(e) => setForm({ ...form, catalogId: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">-- เลือกประเภทอุปกรณ์ --</option>
              {catalog.map((c) => <option key={c.id} value={c.id}>{c.name}{c.model && c.model !== "-" ? ` (${c.model})` : ""}</option>)}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">จำนวน</label>
            <input
              type="number" min="1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">วันที่รับ</label>
            <input
              type="date"
              value={form.receivedDate}
              onChange={(e) => setForm({ ...form, receivedDate: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">เหตุผลการเบิก</label>
            <select
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              {Object.entries(reasonLabel).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>
        </div>

        {selectedCatalogItem && (
          <div className="bg-slate-50 rounded-lg px-3 py-2.5 text-xs text-slate-600 mb-4">
            มาตรฐาน: {selectedCatalogItem.standard} · อายุการใช้งาน {selectedCatalogItem.lifespanDays} วัน
            {" — "}
            <span className="text-slate-800 font-medium">
              กำหนดแจกครั้งถัดไป (ตามอายุใช้งาน): {formatThaiDate(computedExpiry)}
            </span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={submit}
            disabled={!form.employeeId || !selectedCatalogItem}
            className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            บันทึกการเบิก
          </button>
        </div>

        {justAdded && (
          <p className="text-xs text-emerald-700 mt-3">
            บันทึกแล้ว: {justAdded.employeeName} ได้รับ {justAdded.name} · กำหนดแจกครั้งถัดไป {formatThaiDate(justAdded.expiry)}
          </p>
        )}
      </Card>

      <div>
        <p className="text-sm font-bold text-slate-900 mb-3">ประวัติการเบิก PPE</p>
        {sortedPpe.length === 0 ? (
          <Card><p className="text-sm text-slate-400">ยังไม่มีประวัติการเบิก PPE</p></Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left">
                    <th className="px-4 py-2.5 font-bold">พนักงาน</th>
                    <th className="px-4 py-2.5 font-bold">อุปกรณ์</th>
                    <th className="px-4 py-2.5 font-bold">มาตรฐาน</th>
                    <th className="px-4 py-2.5 font-bold">จำนวน</th>
                    <th className="px-4 py-2.5 font-bold">เหตุผลเบิก</th>
                    <th className="px-4 py-2.5 font-bold">วันที่รับ</th>
                    <th className="px-4 py-2.5 font-bold">วันหมดอายุ</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPpe.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5">{nameOf(p.employeeId)}</td>
                      <td className="px-4 py-2.5">{p.name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{p.standard}</td>
                      <td className="px-4 py-2.5 text-slate-500">{p.quantity}</td>
                      <td className="px-4 py-2.5 text-slate-500">{reasonLabel[p.reason]}</td>
                      <td className="px-4 py-2.5 text-slate-500">{formatThaiDate(p.issuedDate)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{formatThaiDate(p.expiry)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <ConfirmDeleteButton onConfirm={() => onDeleteIssuance(p.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function PpeCatalogView({ catalog, onAddCatalogItem, onUpdateCatalogItem, onDeleteCatalogItem }) {
  const [showCatalogForm, setShowCatalogForm] = useState(false);
  const [catalogForm, setCatalogForm] = useState({ name: ppeTypeLabel[ppeTypeOptions[0]], model: "", standard: "", lifespanDays: "180" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ model: "", standard: "", lifespanDays: "" });

  const submitCatalog = () => {
    if (!catalogForm.name.trim()) return;
    onAddCatalogItem({
      id: Date.now(),
      name: catalogForm.name,
      model: catalogForm.model || "-",
      standard: catalogForm.standard || "-",
      lifespanDays: Number(catalogForm.lifespanDays) || 180,
    });
    setCatalogForm({ name: ppeTypeLabel[ppeTypeOptions[0]], model: "", standard: "", lifespanDays: "180" });
    setShowCatalogForm(false);
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditForm({ model: c.model || "", standard: c.standard, lifespanDays: String(c.lifespanDays) });
  };

  const saveEdit = (id) => {
    onUpdateCatalogItem(id, {
      model: editForm.model || "-",
      standard: editForm.standard || "-",
      lifespanDays: Number(editForm.lifespanDays) || 1,
    });
    setEditingId(null);
  };

  return (
    <Card className="max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-slate-900">ประเภท/รุ่นอุปกรณ์ในระบบ</p>
        <button
          onClick={() => setShowCatalogForm(true)}
          className="flex items-center gap-1.5 text-xs text-slate-600 underline hover:text-slate-900"
        >
          <Plus size={14} /> เพิ่มประเภทใหม่
        </button>
      </div>

      {showCatalogForm && (
        <div className="border border-slate-200 rounded-lg p-3 mb-3 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">ชื่อประเภทอุปกรณ์</label>
              <select
                value={catalogForm.name}
                onChange={(e) => setCatalogForm({ ...catalogForm, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                {ppeTypeOptions.map((p) => <option key={p} value={ppeTypeLabel[p]}>{ppeTypeLabel[p]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">ชื่อรุ่น</label>
              <input
                value={catalogForm.model}
                onChange={(e) => setCatalogForm({ ...catalogForm, model: e.target.value })}
                placeholder="เช่น 3M 1110"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">มาตรฐานอ้างอิง</label>
              <input
                value={catalogForm.standard}
                onChange={(e) => setCatalogForm({ ...catalogForm, standard: e.target.value })}
                placeholder="เช่น EN 352-2"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">อายุการใช้งาน (วัน)</label>
              <input
                type="number" min="1"
                value={catalogForm.lifespanDays}
                onChange={(e) => setCatalogForm({ ...catalogForm, lifespanDays: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCatalogForm(false)} className="text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-600">
              ยกเลิก
            </button>
            <button onClick={submitCatalog} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white">
              บันทึก
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-500 text-left">
            <th className="py-1.5 font-medium">ชื่อประเภทอุปกรณ์</th>
            <th className="py-1.5 font-medium">ชื่อรุ่น</th>
            <th className="py-1.5 font-medium">มาตรฐาน</th>
            <th className="py-1.5 font-medium">อายุการใช้งาน</th>
            <th className="py-1.5"></th>
            <th className="py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {catalog.map((c) => {
            const isEditing = editingId === c.id;
            return (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="py-1.5">{c.name}</td>
                {isEditing ? (
                  <>
                    <td className="py-1.5 pr-2">
                      <input
                        value={editForm.model}
                        onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        value={editForm.standard}
                        onChange={(e) => setEditForm({ ...editForm, standard: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min="1"
                          value={editForm.lifespanDays}
                          onChange={(e) => setEditForm({ ...editForm, lifespanDays: e.target.value })}
                          className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-sm"
                        />
                        <span className="text-slate-500">วัน</span>
                      </div>
                    </td>
                    <td className="py-1.5">
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(c.id)} className="text-xs text-emerald-700 underline">บันทึก</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-slate-400 underline">ยกเลิก</button>
                      </div>
                    </td>
                    <td className="py-1.5"></td>
                  </>
                ) : (
                  <>
                    <td className="py-1.5 text-slate-500">{c.model || "-"}</td>
                    <td className="py-1.5 text-slate-500">{c.standard}</td>
                    <td className="py-1.5 text-slate-500">{c.lifespanDays} วัน</td>
                    <td className="py-1.5">
                      <button onClick={() => startEdit(c)} className="text-xs text-slate-500 underline hover:text-slate-800">
                        แก้ไข
                      </button>
                    </td>
                    <td className="py-1.5">
                      <ConfirmDeleteButton onConfirm={() => onDeleteCatalogItem(c.id)} />
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <p className="text-xs text-slate-400 mt-3">
        การแก้ไขอายุการใช้งานจะมีผลกับการคำนวณ "กำหนดแจกครั้งถัดไป" ของการรับมอบครั้งใหม่เท่านั้น
        ไม่กระทบรายการที่บันทึกไปแล้ว
      </p>
    </Card>
  );
}

function PpePage({ employees, ppe, catalog, onAddIssuance, onDeleteIssuance, onAddCatalogItem, onUpdateCatalogItem, onDeleteCatalogItem }) {
  const [tab, setTab] = useState("item");
  const tabs = [
    { key: "item", label: "รายงานสถานะ PPE" },
    { key: "issuance", label: "บันทึกการเบิก PPE" },
    { key: "catalog", label: "ประเภท/รุ่นอุปกรณ์" },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-slate-900">ทะเบียน PPE</h1>

      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-sm px-3 py-2 border-b-2 -mb-px ${
              tab === t.key ? "border-slate-900 text-slate-900 font-medium" : "border-transparent text-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "item" && <PpeByItemView employees={employees} ppe={ppe} />}
      {tab === "issuance" && <PpeIssuanceView employees={employees} ppe={ppe} catalog={catalog} onAddIssuance={onAddIssuance} onDeleteIssuance={onDeleteIssuance} />}
      {tab === "catalog" && (
        <PpeCatalogView catalog={catalog} onAddCatalogItem={onAddCatalogItem} onUpdateCatalogItem={onUpdateCatalogItem} onDeleteCatalogItem={onDeleteCatalogItem} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Unsafe acts (การกระทำที่ไม่ปลอดภัย) — เดิมเป็นแท็บในหน้า PPE ย้ายมาเป็นเมนูหลักแยก
// ---------------------------------------------------------------

// ---------------------------------------------------------------
// ทะเบียนสารเคมี — ฟอร์มบันทึกด่วนตามแบบฟอร์มกระดาษ "แบบฟอร์มบันทึกสารเคมี (ฉบับย่อ)"
// ไม่ได้เก็บไฟล์ SDS ฉบับเต็มไว้ในระบบ แค่สถานะเตือนความจำว่าแนบไว้ที่อื่นแล้วหรือยัง
// ---------------------------------------------------------------
const sdsStatusLabel = { attached: "แนบแล้ว", pending: "รอเพิ่ม" };
const sdsStatusTone = (s) => (s === "attached" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700");

function ChemicalsPage({ chemicals, currentUserName, onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const emptyForm = {
    name: "", casNumber: "", quantity: "", unit: "", storageLocation: "",
    hazardType: "", ppeRequired: [], sdsStatus: "pending", recordedDate: todayIso(),
  };
  const [form, setForm] = useState(emptyForm);

  const togglePpe = (p) => {
    setForm({
      ...form,
      ppeRequired: form.ppeRequired.includes(p) ? form.ppeRequired.filter((x) => x !== p) : [...form.ppeRequired, p],
    });
  };

  const submit = () => {
    if (!form.name.trim()) return;
    onAdd(form);
    setForm(emptyForm);
    setShowForm(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">ทะเบียนสารเคมี</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-2 rounded-lg"
        >
          <Plus size={16} /> บันทึกสารเคมีใหม่
        </button>
      </div>

      {showForm && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-900">บันทึกสารเคมีใหม่</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">
              <X size={18} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">ชื่อสารเคมี</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น โซเดียมไฮดรอกไซด์"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">CAS No. (ถ้าทราบ)</label>
              <input
                value={form.casNumber}
                onChange={(e) => setForm({ ...form, casNumber: e.target.value })}
                placeholder="เช่น 1310-73-2"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">ปริมาณ</label>
              <input
                type="number"
                min="0"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="เช่น 20"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">หน่วย</label>
              <input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="เช่น ลิตร, กก., แกลลอน"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs font-bold text-slate-500 block mb-1">สถานที่จัดเก็บ</label>
            <input
              value={form.storageLocation}
              onChange={(e) => setForm({ ...form, storageLocation: e.target.value })}
              placeholder="เช่น คลังสารเคมี อาคาร B"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="mb-3">
            <label className="text-xs font-bold text-slate-500 block mb-1">ประเภทความอันตรายหลัก (เช่น กัดกร่อน/ไวไฟ/พิษ)</label>
            <input
              value={form.hazardType}
              onChange={(e) => setForm({ ...form, hazardType: e.target.value })}
              placeholder="เช่น กัดกร่อน"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="mb-3">
            <label className="text-xs font-bold text-slate-500 block mb-1">PPE ที่ต้องใช้</label>
            <div className="flex flex-wrap gap-2">
              {ppeTypeOptions.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePpe(p)}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${
                    form.ppeRequired.includes(p) ? "bg-blue-700 text-white border-blue-700" : "border-slate-300 text-slate-500"
                  }`}
                >
                  {ppeTypeLabel[p]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">ไฟล์ SDS แนบแล้วหรือยัง</label>
              <div className="flex gap-2">
                {["pending", "attached"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setForm({ ...form, sdsStatus: s })}
                    className={`text-xs px-3 py-1.5 rounded-lg border ${
                      form.sdsStatus === s ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"
                    }`}
                  >
                    {sdsStatusLabel[s]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">วันที่บันทึก</label>
              <input
                type="date"
                value={form.recordedDate}
                onChange={(e) => setForm({ ...form, recordedDate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            ผู้บันทึก: {currentUserName} (ใช้บัญชีที่ล็อกอินอยู่โดยอัตโนมัติ) — ฟอร์มนี้สำหรับบันทึกข้อมูลเบื้องต้นอย่างรวดเร็ว
            กรุณาแนบไฟล์ SDS ฉบับเต็มไว้อ้างอิงนอกระบบ ไม่ต้อง copy รายละเอียดจาก SDS ลงในฟอร์มนี้
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-600">
              ยกเลิก
            </button>
            <button onClick={submit} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white">
              บันทึก
            </button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-left">
                <th className="px-4 py-2.5 font-bold">ชื่อสารเคมี</th>
                <th className="px-4 py-2.5 font-bold">CAS No.</th>
                <th className="px-4 py-2.5 font-bold">ปริมาณ</th>
                <th className="px-4 py-2.5 font-bold">สถานที่จัดเก็บ</th>
                <th className="px-4 py-2.5 font-bold">ความอันตรายหลัก</th>
                <th className="px-4 py-2.5 font-bold">PPE ที่ต้องใช้</th>
                <th className="px-4 py-2.5 font-bold">SDS</th>
                <th className="px-4 py-2.5 font-bold">บันทึกเมื่อ</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {chemicals.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-bold text-slate-900">{c.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{c.casNumber}</td>
                  <td className="px-4 py-2.5 text-slate-500">{c.quantity} {c.unit !== "-" ? c.unit : ""}</td>
                  <td className="px-4 py-2.5 text-slate-500">{c.storageLocation}</td>
                  <td className="px-4 py-2.5 text-slate-500">{c.hazardType}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {c.ppeRequired.map((p) => (
                        <span key={p} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{ppeTypeLabel[p]}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><Badge tone={sdsStatusTone(c.sdsStatus)}>{sdsStatusLabel[c.sdsStatus]}</Badge></td>
                  <td className="px-4 py-2.5 text-slate-500">{formatThaiDate(c.recordedDate)}</td>
                  <td className="px-4 py-2.5 text-right"><ConfirmDeleteButton onConfirm={() => onDelete(c.id)} /></td>
                </tr>
              ))}
              {chemicals.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-3 text-sm text-slate-400">ยังไม่มีข้อมูลสารเคมีที่บันทึกไว้</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
// รายงานราชการ — ข้อมูลองค์กร/คปอ. + ชั่วโมงทำงานรายเดือน + export ตามไตรมาส
// ---------------------------------------------------------------
const accountTierDbToUi = { "บัญชี_1": "บัญชี 1", "บัญชี_2": "บัญชี 2", "บัญชี_3": "บัญชี 3" };
const accountTierOptions = ["บัญชี_1", "บัญชี_2", "บัญชี_3"];

function monthDateOptions(count) {
  // สร้างรายการ "วันที่ 1 ของเดือน" ย้อนหลังจากเดือนปัจจุบัน ให้เลือกกรอก/แก้ไขย้อนหลังได้
  // (ไม่ล็อกไว้แค่เดือนปัจจุบันเดือนเดียว เพราะเพิ่งเริ่มใช้ระบบกลางไตรมาสก็ต้องกรอกย้อนหลังได้)
  const out = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    out.push({ value: iso, label: `${thaiMonths[d.getMonth()]} ${d.getFullYear() + 543}` });
  }
  return out;
}

function GovReportsPage({ orgProfile, onUpdateOrgProfile, workingHours, onUpsertWorkingHours, onDeleteWorkingHours, incidents, employees, chemicals, equipment, machinery, environmentalMeasurements, trainingRecords, trainingCourses, locations }) {
  const [editingOrg, setEditingOrg] = useState(false);
  const [orgForm, setOrgForm] = useState(orgProfile);
  const monthOptions = monthDateOptions(18); // ย้อนหลังได้ถึง 18 เดือน
  const [monthForm, setMonthForm] = useState({ monthDate: monthOptions[0].value, totalHours: "", avgEmployeeCount: "", notes: "" });

  // พอเลือกเดือนไหน ถ้ามีข้อมูลเดือนนั้นอยู่แล้ว ให้ดึงมาเติมในฟอร์มทันที (กลายเป็นแก้ไขแทนเพิ่มใหม่)
  useEffect(() => {
    const existing = workingHours.find((w) => w.monthDate === monthForm.monthDate);
    setMonthForm((f) => ({
      ...f,
      totalHours: existing?.totalHours ?? "",
      avgEmployeeCount: existing?.avgEmployeeCount ?? "",
      notes: existing?.notes ?? "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthForm.monthDate]);

  const startEditOrg = () => {
    setOrgForm(orgProfile);
    setEditingOrg(true);
  };
  const saveOrg = () => {
    onUpdateOrgProfile(orgForm);
    setEditingOrg(false);
  };
  const saveMonth = () => {
    if (monthForm.totalHours === "" && monthForm.avgEmployeeCount === "") return;
    onUpsertWorkingHours(monthForm.monthDate, monthForm);
  };

  // --- คำนวณสถานะ/สถิติรายไตรมาส (ไตรมาสปัจจุบัน + ย้อนหลัง 3 ไตรมาส) ---
  const today = new Date();
  const currentAbsQ = today.getFullYear() * 4 + Math.floor(today.getMonth() / 3);
  const quarters = [0, 1, 2, 3].map((i) => {
    const absQ = currentAbsQ - i;
    const year = Math.floor(absQ / 4);
    const quarterNum = (absQ % 4) + 1;
    const startMonthIndex = (quarterNum - 1) * 3; // 0-based
    const monthDates = [0, 1, 2].map((m) => `${year}-${String(startMonthIndex + m + 1).padStart(2, "0")}-01`);
    const monthEntries = monthDates.map((md) => workingHours.find((w) => w.monthDate === md) || null);
    const isCurrent = i === 0;
    const readyMonths = monthEntries.filter(Boolean).length;
    const totalHours = monthEntries.reduce((sum, e) => sum + (e?.totalHours ? Number(e.totalHours) : 0), 0);
    const avgEmployeeVals = monthEntries.filter((e) => e?.avgEmployeeCount != null).map((e) => Number(e.avgEmployeeCount));
    const avgEmployeeCount = avgEmployeeVals.length ? Math.round(avgEmployeeVals.reduce((a, b) => a + b, 0) / avgEmployeeVals.length) : null;

    const quarterStart = monthDates[0];
    const quarterEndDate = new Date(year, startMonthIndex + 3, 0); // วันสุดท้ายของเดือนที่ 3
    const quarterEnd = `${quarterEndDate.getFullYear()}-${String(quarterEndDate.getMonth() + 1).padStart(2, "0")}-${String(quarterEndDate.getDate()).padStart(2, "0")}`;
    const incidentsInQuarter = incidents.filter((inc) => inc.incidentDate >= quarterStart && inc.incidentDate <= quarterEnd);
    const ltiIncidents = incidentsInQuarter.filter((inc) => inc.injuredEmployees.some((e) => e.lostWorkdays > 0));
    const totalLostDays = incidentsInQuarter.reduce(
      (sum, inc) => sum + inc.injuredEmployees.reduce((s, e) => s + (e.lostWorkdays || 0), 0),
      0
    );
    const ifr = totalHours > 0 ? ((ltiIncidents.length * 1000000) / totalHours).toFixed(2) : null;
    const isr = totalHours > 0 ? ((totalLostDays * 1000000) / totalHours).toFixed(2) : null;

    return {
      key: `${year}-Q${quarterNum}`, year, quarterNum, monthDates, monthEntries, readyMonths,
      isComplete: readyMonths === 3, isCurrent, totalHours, avgEmployeeCount,
      incidentCount: incidentsInQuarter.length, ltiCount: ltiIncidents.length, totalLostDays, ifr, isr,
    };
  });

  const exportQuarter = async (q) => {
    const XLSX = await import("xlsx");
    const row = {
      "ไตรมาส/ปี": `Q${q.quarterNum}/${q.year + 543} (${thaiMonths[(q.quarterNum - 1) * 3]}-${thaiMonths[(q.quarterNum - 1) * 3 + 2]})`,
      "จำนวนลูกจ้างเฉลี่ย": q.avgEmployeeCount ?? "",
      "ชั่วโมงทำงานรวม": q.totalHours || "",
      "จำนวนอุบัติเหตุถึงขั้นหยุดงาน": q.ltiCount,
      "จำนวนวันหยุดงานรวม": q.totalLostDays,
      "IFR (อัตราความถี่)": q.ifr ?? "",
      "ISR (อัตราความรุนแรง)": q.isr ?? "",
      "จำนวนอุบัติเหตุที่ต้องแจ้ง กท.16": "", // ระบบยังไม่มีการทำเครื่องหมายนี้ ให้ จป. กรอกเองก่อนยื่นจริง
      "หมายเหตุ": !q.isComplete ? `กรอกชั่วโมงทำงานไม่ครบ (${q.readyMonths}/3 เดือน) ตัวเลขนี้อาจไม่แม่นยำ` : "",
    };
    const worksheet = XLSX.utils.json_to_sheet([row]);
    worksheet["!cols"] = Object.keys(row).map(() => ({ wch: 22 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "สถิติอุบัติเหตุรายไตรมาส");
    XLSX.writeFile(workbook, `สถิติอุบัติเหตุ_Q${q.quarterNum}_${q.year + 543}.xlsx`);
  };

  // รวมทุก sheet ที่มีข้อมูลจริงพร้อมอยู่แล้วไว้ในไฟล์เดียว — sheet ที่ระบบยังไม่มีฟีเจอร์รองรับ
  // (ตรวจความปลอดภัย, ใบอนุญาตทำงานเสี่ยง, กท.16 รายกรณี) จะไม่ถูกสร้างในไฟล์นี้ เพราะยังไม่มี
  // ข้อมูลจริงให้ใส่ — ใส่แค่ sheet เปล่าพร้อมหัวคอลัมน์ไว้แทน กันสับสนว่าไฟล์หายไปไหน
  const employeeName = (id) => employees.find((e) => e.id === id)?.name ?? "-";
  const employeePosition = (id) => employees.find((e) => e.id === id)?.position ?? "-";
  const locationName = (id) => locations.find((l) => l.id === id)?.name ?? "-";
  const courseName = (id) => trainingCourses.find((c) => c.id === id)?.name ?? "-";
  const courseCategory = (id) => trainingCourses.find((c) => c.id === id)?.category ?? "-";

  const exportFullReport = async () => {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();

    // --- ข้อมูลองค์กร-คปอ. ---
    const orgRows = [
      ["ชื่อสถานประกอบการ", orgProfile.name || ""],
      ["เลขทะเบียนนิติบุคคล", orgProfile.taxId || ""],
      ["ประเภทกิจการ (บัญชี 1/2/3)", accountTierDbToUi[orgProfile.accountTier] || ""],
      ["ที่อยู่สถานประกอบการ", orgProfile.address || ""],
      ["จำนวนลูกจ้างทั้งหมด", orgProfile.employeeCount ?? ""],
      ["ชื่อ จป.บริหาร", employeeNamesByRole("isJorporManagement")],
      ["ชื่อ จป.หัวหน้างาน", employeeNamesByRole("isJorporSupervisor")],
      ["ชื่อ จป.วิชาชีพ", orgProfile.jorporProfessionalName || ""],
      ["ชื่อ จป.เทคนิค", orgProfile.jorporTechnicalName || ""],
      ["รายชื่อกรรมการ คปอ. ฝ่ายนายจ้าง", orgProfile.committeeEmployerNames || ""],
      ["รายชื่อกรรมการ คปอ. ฝ่ายลูกจ้าง", orgProfile.committeeEmployeeNames || ""],
      ["วันที่แต่งตั้ง คปอ. ชุดปัจจุบัน", orgProfile.committeeAppointedDate ? formatThaiDate(orgProfile.committeeAppointedDate) : ""],
      ["วาระ คปอ. สิ้นสุดวันที่", orgProfile.committeeTermEndDate ? formatThaiDate(orgProfile.committeeTermEndDate) : ""],
    ];
    const orgSheet = XLSX.utils.aoa_to_sheet([["รายการ", "ข้อมูล"], ...orgRows]);
    orgSheet["!cols"] = [{ wch: 32 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(workbook, orgSheet, "ข้อมูลองค์กร-คปอ");

    // --- สถิติอุบัติเหตุรายไตรมาส (ทั้ง 4 ไตรมาสล่าสุด) ---
    const statsRows = quarters.map((q) => ({
      "ไตรมาส/ปี": `Q${q.quarterNum}/${q.year + 543} (${thaiMonths[(q.quarterNum - 1) * 3]}-${thaiMonths[(q.quarterNum - 1) * 3 + 2]})`,
      "จำนวนลูกจ้างเฉลี่ย": q.avgEmployeeCount ?? "",
      "ชั่วโมงทำงานรวม": q.totalHours || "",
      "จำนวนอุบัติเหตุถึงขั้นหยุดงาน": q.ltiCount,
      "จำนวนวันหยุดงานรวม": q.totalLostDays,
      "IFR (อัตราความถี่)": q.ifr ?? "",
      "ISR (อัตราความรุนแรง)": q.isr ?? "",
      "จำนวนอุบัติเหตุที่ต้องแจ้ง กท.16": "",
      "หมายเหตุ": !q.isComplete ? `กรอกชั่วโมงทำงานไม่ครบ (${q.readyMonths}/3 เดือน)` : "",
    }));
    const statsSheet = XLSX.utils.json_to_sheet(statsRows);
    statsSheet["!cols"] = Object.keys(statsRows[0] || {}).map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(workbook, statsSheet, "สถิติอุบัติเหตุรายไตรมาส");

    // --- บันทึกอุบัติเหตุ (1 แถวต่อ 1 พนักงานบาดเจ็บ ถ้าไม่มีใครบาดเจ็บ = 1 แถวต่อเคส) ---
    const sortedIncidents = [...incidents].sort((a, b) => (a.incidentDate < b.incidentDate ? -1 : 1));
    const incidentRows = [];
    sortedIncidents.forEach((inc, idx) => {
      const caseNo = `ACC-${inc.incidentDate?.slice(0, 4) || "0000"}-${String(idx + 1).padStart(3, "0")}`;
      const latestUpdate = inc.updates[inc.updates.length - 1];
      const baseRow = {
        "เลขที่บันทึก": caseNo,
        "วันที่เกิดเหตุ": inc.incidentDate,
        "เวลา": inc.incidentTime || "",
        "แผนก/หน่วยงาน": inc.department !== "-" ? inc.department : "",
        "สถานที่เกิดเหตุ": inc.location,
        "ประเภทเหตุการณ์": inc.type,
        "ระดับความรุนแรง": inc.severity,
        "สาเหตุเบื้องต้น": inc.probableCause !== "-" ? inc.probableCause : "",
        "การปฐมพยาบาล/รักษา": inc.firstAidGiven !== "-" ? inc.firstAidGiven : "",
        "มาตรการแก้ไข/ป้องกัน": latestUpdate ? latestUpdate.note : "",
        "ผู้รับผิดชอบแก้ไข": "",
        "กำหนดแล้วเสร็จ": "",
        "สถานะ": inc.status,
        "ผู้บันทึก": inc.reporterName !== "-" ? inc.reporterName : "",
      };
      if (inc.injuredEmployees.length === 0) {
        incidentRows.push({ ...baseRow, "ชื่อผู้บาดเจ็บ/ผู้เกี่ยวข้อง": "-", "ตำแหน่งงาน": "-", "ส่วนของร่างกายที่บาดเจ็บ": "-", "จำนวนวันหยุดงาน": 0 });
      } else {
        inc.injuredEmployees.forEach((e) => {
          incidentRows.push({
            ...baseRow,
            "ชื่อผู้บาดเจ็บ/ผู้เกี่ยวข้อง": employeeName(e.employeeId),
            "ตำแหน่งงาน": employeePosition(e.employeeId),
            "ส่วนของร่างกายที่บาดเจ็บ": e.bodyPart !== "-" ? e.bodyPart : "",
            "จำนวนวันหยุดงาน": e.lostWorkdays,
          });
        });
      }
    });
    if (incidentRows.length > 0) {
      const incidentSheet = XLSX.utils.json_to_sheet(incidentRows);
      incidentSheet["!cols"] = Object.keys(incidentRows[0]).map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(workbook, incidentSheet, "บันทึกอุบัติเหตุ");
    }

    // --- ทะเบียนสารเคมี ---
    if (chemicals.length > 0) {
      const chemRows = chemicals.map((c, idx) => ({
        "ลำดับ": idx + 1,
        "ชื่อสารเคมี": c.name,
        "CAS No.": c.casNumber !== "-" ? c.casNumber : "",
        "ปริมาณ": c.quantity !== "-" ? c.quantity : "",
        "หน่วย": c.unit !== "-" ? c.unit : "",
        "สถานที่จัดเก็บ": c.storageLocation !== "-" ? c.storageLocation : "",
        "ประเภทความอันตรายหลัก": c.hazardType !== "-" ? c.hazardType : "",
        "PPE ที่ต้องใช้": c.ppeRequired.map((p) => ppeTypeLabel[p]).join(", "),
        "สถานะ SDS": sdsStatusLabel[c.sdsStatus] || "",
        "วันที่บันทึก": c.recordedDate,
      }));
      const chemSheet = XLSX.utils.json_to_sheet(chemRows);
      chemSheet["!cols"] = Object.keys(chemRows[0]).map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(workbook, chemSheet, "ทะเบียนสารเคมี");
    }

    // --- บันทึกการฝึกอบรม ---
    if (trainingRecords.length > 0) {
      const trainingRows = trainingRecords.map((r) => {
        const emp = employees.find((e) => e.id === r.employeeId);
        return {
          "รหัสพนักงาน": emp?.code ?? "-",
          "ชื่อ-นามสกุล": emp?.name ?? "-",
          "แผนก": emp?.department ?? "-",
          "ตำแหน่ง": emp?.position ?? "-",
          "หลักสูตรที่อบรม": courseName(r.courseId),
          "ระดับ จป. (ถ้ามี)": courseCategory(r.courseId) !== "-" ? courseCategory(r.courseId) : "",
          "วันที่อบรม": r.completionDate,
          "จำนวนชั่วโมง": "",
          "สถาบัน/วิทยากร": r.trainingProvider || "",
          "ผลการอบรม": "ผ่าน",
          "เลขที่วุฒิบัตร": r.certificateNumber || "",
          "วันหมดอายุใบรับรอง": r.expiryDate || "",
          "สถานะ": trainingStatusLabel[getTrainingComplianceStatus(r.employeeId, r.courseId, trainingRecords)] || "",
        };
      });
      const trainingSheet = XLSX.utils.json_to_sheet(trainingRows);
      trainingSheet["!cols"] = Object.keys(trainingRows[0]).map(() => ({ wch: 18 }));
      XLSX.utils.book_append_sheet(workbook, trainingSheet, "บันทึกการฝึกอบรม");
    }

    // --- ทะเบียนเครื่องจักร (ที่ต้องมีวิศวกรตรวจรับรอง) ---
    if (machinery.length > 0) {
      const machineryRows = machinery.map((m) => {
        const latest = m.history[0];
        return {
          "รหัสอุปกรณ์": m.code,
          "ชื่อเครื่องจักร": m.name,
          "ประเภท": m.name,
          "สถานที่ติดตั้ง/ใช้งาน": m.location,
          "รอบตรวจสอบ (เดือน)": m.frequencyMonths,
          "วันที่ตรวจครั้งล่าสุด": m.lastDate !== "-" ? m.lastDate : "",
          "ผลการตรวจ": latest ? latest.result : "",
          "วันที่ครบกำหนดตรวจครั้งถัดไป": m.nextDate !== "-" ? m.nextDate : "",
          "ผู้ตรวจสอบ/วิศวกรที่รับรอง": latest ? latest.engineerName : "",
          "เลขที่ใบอนุญาตวิศวกร": latest ? latest.engineerLicenseNumber : "",
          "เลขที่ใบรับรอง": latest ? latest.certificateNumber : "",
          "สถานะการใช้งาน": m.status,
        };
      });
      const machinerySheet = XLSX.utils.json_to_sheet(machineryRows);
      machinerySheet["!cols"] = Object.keys(machineryRows[0]).map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(workbook, machinerySheet, "ทะเบียนเครื่องจักรอุปกรณ์");
    }

    // --- ทะเบียนอุปกรณ์ความปลอดภัย (เพิ่มเติมนอกเทมเพลต แต่มีข้อมูลจริงพร้อมอยู่แล้ว) ---
    if (equipment.length > 0) {
      const equipmentRows = equipment.map((eq) => {
        const latest = eq.history[0];
        return {
          "รหัสอุปกรณ์": eq.code,
          "ชื่ออุปกรณ์": eq.name,
          "สถานที่ติดตั้ง/ใช้งาน": eq.location,
          "รอบตรวจสอบ": eq.frequency,
          "วันที่ตรวจครั้งล่าสุด": eq.lastDate !== "-" ? eq.lastDate : "",
          "ผลการตรวจ": latest ? latest.result : "",
          "วันครบกำหนดตรวจครั้งถัดไป": eq.nextDate !== "-" ? eq.nextDate : "",
          "ผู้ตรวจ": latest ? latest.inspector : "",
          "สถานะ": eq.status,
        };
      });
      const equipmentSheet = XLSX.utils.json_to_sheet(equipmentRows);
      equipmentSheet["!cols"] = Object.keys(equipmentRows[0]).map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(workbook, equipmentSheet, "ทะเบียนอุปกรณ์ความปลอดภัย");
    }

    // --- ผลตรวจวัดสภาพแวดล้อม ---
    if (environmentalMeasurements.length > 0) {
      const envRows = environmentalMeasurements.map((m) => ({
        "วันที่ตรวจวัด": m.measuredAt,
        "รายการที่ตรวจ": measurementTypeLabel[m.measurementType] || m.measurementType,
        "จุด/พื้นที่ที่ตรวจ": locationName(m.locationId),
        "หน่วยงานที่ตรวจ": "",
        "ผลประเมินภาพรวม": m.result === "fail" ? "ไม่ผ่าน" : "ผ่าน",
        "ชื่อไฟล์ PDF ที่จะอัปโหลด": "",
        "วันครบกำหนดตรวจครั้งถัดไป": m.nextDue || "",
        "ผู้รับผิดชอบ": "",
      }));
      const envSheet = XLSX.utils.json_to_sheet(envRows);
      envSheet["!cols"] = Object.keys(envRows[0]).map(() => ({ wch: 22 }));
      XLSX.utils.book_append_sheet(workbook, envSheet, "ผลตรวจวัดสภาพแวดล้อม");
    }

    // sheet ที่ยังไม่มีข้อมูลจริงในระบบ (ตรวจความปลอดภัย / ใบอนุญาตทำงานเสี่ยง / กท.16 รายกรณี)
    // ใส่แค่หัวคอลัมน์เปล่าไว้กันสับสน พร้อมข้อความอธิบายว่าต้องกรอกเองนอกระบบไปก่อน
    const placeholderSheets = {
      "ตรวจความปลอดภัย": ["เลขที่ตรวจ", "วันที่ตรวจ", "พื้นที่/แผนกที่ตรวจ", "หัวข้อที่ตรวจ", "สิ่งที่พบ", "ระดับความเสี่ยง", "มาตรการแก้ไข", "ผู้รับผิดชอบแก้ไข", "กำหนดแล้วเสร็จ", "สถานะแก้ไข", "ผู้ตรวจ"],
      "ใบอนุญาตทำงานเสี่ยง": ["เลขที่ใบอนุญาต", "ประเภทงาน", "วันที่/เวลาเริ่ม-สิ้นสุด", "ผู้ปฏิบัติงาน", "ผู้อนุญาต", "รายการตรวจสอบ", "ผลการตรวจสอบ", "สถานะ"],
      "กท16 รายกรณี": ["เลขที่อ้างอิงภายใน", "ชื่อ-นามสกุลผู้ประสบเหตุ", "เลขบัตรประชาชน", "วันที่เกิดเหตุ", "สถานที่เกิดเหตุ", "ลักษณะการประสบอันตราย", "ส่วนของร่างกายที่บาดเจ็บ", "จำนวนวันหยุดงาน", "โรงพยาบาลที่รักษา", "สถานะการยื่น กท.16"],
    };
    Object.entries(placeholderSheets).forEach(([sheetName, headers]) => {
      const sheet = XLSX.utils.aoa_to_sheet([headers, ["ฟีเจอร์นี้ยังไม่มีในระบบ กรุณากรอกข้อมูลส่วนนี้นอกระบบไปก่อน"]]);
      sheet["!cols"] = headers.map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    });

    XLSX.writeFile(workbook, `รายงานราชการ_${todayIso()}.xlsx`);
  };

  const exportOrgInfo = async () => {
    const XLSX = await import("xlsx");
    const rows = [
      ["ชื่อสถานประกอบการ", orgProfile.name || "", "ตามหนังสือรับรองนิติบุคคล"],
      ["เลขทะเบียนนิติบุคคล", orgProfile.taxId || "", ""],
      ["ประเภทกิจการ (บัญชี 1/2/3)", accountTierDbToUi[orgProfile.accountTier] || "", "อ้างอิงท้ายกฎกระทรวง 2565"],
      ["ที่อยู่สถานประกอบการ", orgProfile.address || "", ""],
      ["จำนวนลูกจ้างทั้งหมด", orgProfile.employeeCount ?? "", "อัปเดตทุกไตรมาส"],
      ["ชื่อ จป.บริหาร", employeeNamesByRole("isJorporManagement"), ""],
      ["ชื่อ จป.หัวหน้างาน", employeeNamesByRole("isJorporSupervisor"), ""],
      ["ชื่อ จป.วิชาชีพ", orgProfile.jorporProfessionalName || "", ""],
      ["ชื่อ จป.เทคนิค", orgProfile.jorporTechnicalName || "", ""],
      ["รายชื่อกรรมการ คปอ. ฝ่ายนายจ้าง", orgProfile.committeeEmployerNames || "", "คั่นด้วย ; ถ้ามีหลายคน"],
      ["รายชื่อกรรมการ คปอ. ฝ่ายลูกจ้าง", orgProfile.committeeEmployeeNames || "", "คั่นด้วย ; ถ้ามีหลายคน"],
      ["วันที่แต่งตั้ง คปอ. ชุดปัจจุบัน", orgProfile.committeeAppointedDate ? formatThaiDate(orgProfile.committeeAppointedDate) : "", ""],
      ["วาระ คปอ. สิ้นสุดวันที่", orgProfile.committeeTermEndDate ? formatThaiDate(orgProfile.committeeTermEndDate) : "", ""],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet([["รายการ", "ข้อมูล", "หมายเหตุ"], ...rows]);
    worksheet["!cols"] = [{ wch: 32 }, { wch: 40 }, { wch: 30 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ข้อมูลองค์กร-คปอ");
    XLSX.writeFile(workbook, "ข้อมูลองค์กร-คปอ.xlsx");
  };

  // ชื่อ จป.บริหาร/จป.หัวหน้างาน ดึงจากพนักงานที่ติ๊กบทบาทไว้ในหน้าพนักงาน — ถ้ามีมากกว่า 1 คน
  // ต่อชื่อด้วย ; (ระบบยังไม่รองรับการเลือกแค่ 1 คนเป็น "ตัวแทนหลัก" สำหรับรายงานนี้โดยเฉพาะ)
  function employeeNamesByRole(flag) {
    const names = employees.filter((e) => e[flag]).map((e) => e.name);
    return names.length > 0 ? names.join("; ") : "-";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-slate-900">รายงานราชการ</h1>

      {/* ส่วนที่ 1: ข้อมูลองค์กร */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-slate-900">ข้อมูลองค์กร-คปอ.</p>
          {!editingOrg && (
            <button onClick={startEditOrg} className="text-xs text-slate-500 underline hover:text-slate-700">แก้ไข</button>
          )}
        </div>
        <Card>
          {!editingOrg ? (
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <p><span className="text-slate-500">ชื่อสถานประกอบการ:</span> {orgProfile.name || "-"}</p>
              <p><span className="text-slate-500">เลขทะเบียนนิติบุคคล:</span> {orgProfile.taxId || "-"}</p>
              <p><span className="text-slate-500">ประเภทกิจการ:</span> {accountTierDbToUi[orgProfile.accountTier] || "-"}</p>
              <p><span className="text-slate-500">จำนวนลูกจ้างทั้งหมด:</span> {orgProfile.employeeCount || "-"}</p>
              <p className="sm:col-span-2"><span className="text-slate-500">ที่อยู่:</span> {orgProfile.address || "-"}</p>
              <p><span className="text-slate-500">ชื่อ จป.บริหาร:</span> {employeeNamesByRole("isJorporManagement")}</p>
              <p><span className="text-slate-500">ชื่อ จป.หัวหน้างาน:</span> {employeeNamesByRole("isJorporSupervisor")}</p>
              <p><span className="text-slate-500">ชื่อ จป.วิชาชีพ:</span> {orgProfile.jorporProfessionalName || "-"}</p>
              <p><span className="text-slate-500">ชื่อ จป.เทคนิค:</span> {orgProfile.jorporTechnicalName || "-"}</p>
              <p className="sm:col-span-2"><span className="text-slate-500">คปอ. ฝ่ายนายจ้าง:</span> {orgProfile.committeeEmployerNames || "-"}</p>
              <p className="sm:col-span-2"><span className="text-slate-500">คปอ. ฝ่ายลูกจ้าง:</span> {orgProfile.committeeEmployeeNames || "-"}</p>
              <p><span className="text-slate-500">วันแต่งตั้ง คปอ.:</span> {orgProfile.committeeAppointedDate ? formatThaiDate(orgProfile.committeeAppointedDate) : "-"}</p>
              <p><span className="text-slate-500">วาระสิ้นสุด:</span> {orgProfile.committeeTermEndDate ? formatThaiDate(orgProfile.committeeTermEndDate) : "-"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">ชื่อสถานประกอบการ</label>
                  <input value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">เลขทะเบียนนิติบุคคล</label>
                  <input value={orgForm.taxId} onChange={(e) => setOrgForm({ ...orgForm, taxId: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">ประเภทกิจการ</label>
                  <select value={orgForm.accountTier} onChange={(e) => setOrgForm({ ...orgForm, accountTier: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">ยังไม่ระบุ</option>
                    {accountTierOptions.map((t) => <option key={t} value={t}>{accountTierDbToUi[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">จำนวนลูกจ้างทั้งหมด</label>
                  <input type="number" min="0" value={orgForm.employeeCount} onChange={(e) => setOrgForm({ ...orgForm, employeeCount: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">ที่อยู่สถานประกอบการ</label>
                <textarea rows={2} value={orgForm.address} onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">ชื่อ จป.วิชาชีพ</label>
                  <input value={orgForm.jorporProfessionalName} onChange={(e) => setOrgForm({ ...orgForm, jorporProfessionalName: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">ชื่อ จป.เทคนิค</label>
                  <input value={orgForm.jorporTechnicalName} onChange={(e) => setOrgForm({ ...orgForm, jorporTechnicalName: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <p className="text-xs text-slate-400">ชื่อ จป.บริหาร/จป.หัวหน้างาน ดึงจากพนักงานที่ระบุบทบาทไว้ในหน้า "พนักงาน" โดยอัตโนมัติ ไม่ต้องกรอกซ้ำที่นี่</p>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">รายชื่อกรรมการ คปอ. ฝ่ายนายจ้าง (คั่นด้วย ;)</label>
                <input value={orgForm.committeeEmployerNames} onChange={(e) => setOrgForm({ ...orgForm, committeeEmployerNames: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">รายชื่อกรรมการ คปอ. ฝ่ายลูกจ้าง (คั่นด้วย ;)</label>
                <input value={orgForm.committeeEmployeeNames} onChange={(e) => setOrgForm({ ...orgForm, committeeEmployeeNames: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">วันที่แต่งตั้ง คปอ. ชุดปัจจุบัน</label>
                  <input type="date" value={orgForm.committeeAppointedDate} onChange={(e) => setOrgForm({ ...orgForm, committeeAppointedDate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">วาระ คปอ. สิ้นสุดวันที่</label>
                  <input type="date" value={orgForm.committeeTermEndDate} onChange={(e) => setOrgForm({ ...orgForm, committeeTermEndDate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditingOrg(false)} className="text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-600">ยกเลิก</button>
                <button onClick={saveOrg} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white">บันทึก</button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ส่วนที่ 2: ชั่วโมงทำงานรายเดือน */}
      <div>
        <p className="text-sm font-bold text-slate-900 mb-3">บันทึกชั่วโมงทำงานรายเดือน</p>
        <Card className="mb-3">
          <div className="grid sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">เดือน/ปี</label>
              <select
                value={monthForm.monthDate}
                onChange={(e) => setMonthForm({ ...monthForm, monthDate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">ชั่วโมงทำงานรวม</label>
              <input
                type="number" min="0" value={monthForm.totalHours}
                onChange={(e) => setMonthForm({ ...monthForm, totalHours: e.target.value })}
                placeholder="เช่น 51200" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">จำนวนพนักงานเฉลี่ยเดือนนี้</label>
              <input
                type="number" min="0" value={monthForm.avgEmployeeCount}
                onChange={(e) => setMonthForm({ ...monthForm, avgEmployeeCount: e.target.value })}
                placeholder="เช่น 320" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={saveMonth} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white">บันทึกเดือนนี้</button>
          </div>
        </Card>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-left">
                  <th className="px-4 py-2.5 font-bold">เดือน</th>
                  <th className="px-4 py-2.5 font-bold">ชั่วโมงทำงานรวม</th>
                  <th className="px-4 py-2.5 font-bold">พนักงานเฉลี่ย</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {workingHours.map((w) => (
                  <tr key={w.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5">{monthOptions.find((m) => m.value === w.monthDate)?.label || w.monthDate}</td>
                    <td className="px-4 py-2.5 text-slate-500">{w.totalHours ?? "-"}</td>
                    <td className="px-4 py-2.5 text-slate-500">{w.avgEmployeeCount ?? "-"}</td>
                    <td className="px-4 py-2.5 text-right"><ConfirmDeleteButton onConfirm={() => onDeleteWorkingHours(w.id)} /></td>
                  </tr>
                ))}
                {workingHours.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-3 text-sm text-slate-400">ยังไม่มีข้อมูลชั่วโมงทำงานที่บันทึกไว้</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ส่วนที่ 3: Export รายไตรมาส */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-sm font-bold text-slate-900">Export รายงานราชการ</p>
          <div className="flex gap-2">
            <button onClick={exportOrgInfo} className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200">
              Export ข้อมูลองค์กร-คปอ.
            </button>
            <button onClick={exportFullReport} className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800">
              Export รายงานทั้งหมด (.xlsx)
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          "Export รายงานทั้งหมด" จะรวมทุกข้อมูลที่มีอยู่จริงในระบบไว้ในไฟล์เดียว (อุบัติเหตุ, สารเคมี,
          การฝึกอบรม, อุปกรณ์, ตรวจวัดสิ่งแวดล้อม, สถิติไตรมาส) ส่วนที่ระบบยังไม่มีฟีเจอร์รองรับ
          (ตรวจความปลอดภัย, ใบอนุญาตทำงานเสี่ยง, กท.16 รายกรณี) จะได้แค่ sheet เปล่าพร้อมหัวคอลัมน์
        </p>
        <div className="space-y-3">
          {quarters.map((q) => (
            <Card key={q.key}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Q{q.quarterNum}/{q.year + 543}
                    {q.isCurrent && <span className="ml-2 text-xs font-normal bg-blue-50 text-blue-700 px-2 py-0.5 rounded">ไตรมาสปัจจุบัน</span>}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {thaiMonths[(q.quarterNum - 1) * 3]}-{thaiMonths[(q.quarterNum - 1) * 3 + 2]} {q.year + 543}
                  </p>
                  <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                    <p>ข้อมูลชั่วโมงทำงาน: {q.readyMonths}/3 เดือน {q.isComplete ? "✅ ครบแล้ว" : "— ยังไม่ครบ"}</p>
                    {q.totalHours > 0 && (
                      <p>อุบัติเหตุถึงขั้นหยุดงาน {q.ltiCount} ครั้ง · วันหยุดงานรวม {q.totalLostDays} วัน · IFR {q.ifr} · ISR {q.isr}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => exportQuarter(q)}
                  className={`text-xs px-3 py-2 rounded-lg shrink-0 ${
                    q.isComplete ? "bg-slate-900 text-white" : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  {q.isComplete ? "Export ไตรมาสนี้" : "Export (ข้อมูลไม่ครบ)"}
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function UnsafeActsPage({ employees, locations, records, onAdd, onDelete }) {
  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-slate-900">บันทึกการกระทำที่ไม่ปลอดภัย</h1>
      <NoncomplianceView employees={employees} locations={locations} records={records} onAdd={onAdd} onDelete={onDelete} />
    </div>
  );
}

// ---------------------------------------------------------------
// Safety equipment registry + inspection history
// ---------------------------------------------------------------

function EquipmentPage({ equipment, onAddInspection, onAddEquipment, onDeleteInspection, onDeleteEquipment }) {
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ result: "ผ่าน", findings: "", action: "", correctiveDeadline: "" });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: equipmentTypeOptions[0], code: "", location: "", brand: "", frequency: frequencyOptions[0] });

  const selected = equipment.find((e) => e.id === selectedId);

  if (selected) {
    const needsDeadline = form.result === "ไม่ผ่าน";
    const canSubmit = !needsDeadline || form.correctiveDeadline.trim() !== "";
    const isFollowUpNow = Boolean(selected.pendingReinspectionDue);

    const submit = () => {
      if (!canSubmit) return;
      onAddInspection(selected.id, {
        date: todayIso(),
        result: form.result,
        findings: form.findings || "-",
        action: form.action || "ไม่มีการซ่อม/เปลี่ยนอะไหล่",
        correctiveDeadline: needsDeadline ? form.correctiveDeadline : null,
        isFollowUp: isFollowUpNow,
      });
      setForm({ result: "ผ่าน", findings: "", action: "", correctiveDeadline: "" });
      setShowForm(false);
    };

    return (
      <div className="space-y-5">
        <button
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={16} /> กลับไปทะเบียนอุปกรณ์
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">{selected.code}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{selected.location} · {selected.brand}</p>
          </div>
          <Badge tone={statusTone(selected.status)}>{selected.status}</Badge>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="รอบตรวจ" value={selected.frequency} />
          <MetricCard label="ตรวจล่าสุด" value={selected.lastDate === "-" ? "-" : formatThaiDate(selected.lastDate)} />
          <MetricCard label="กำหนดครั้งถัดไป" value={selected.nextDate === "-" ? "-" : formatThaiDate(selected.nextDate)} />
        </div>

        {selected.pendingReinspectionDue && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">
              ต้องตรวจซ้ำภายในวันที่ <span className="font-medium">{formatThaiDate(selected.pendingReinspectionDue)}</span>
              {" "}— เป็นการตรวจพิเศษนอกรอบเพื่อยืนยันว่าแก้ไขจากผลตรวจครั้งก่อนเสร็จแล้ว
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900">ประวัติการตรวจสภาพ</p>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-800"
          >
            <Plus size={16} /> {isFollowUpNow ? "บันทึกผลตรวจซ้ำ (นอกรอบ)" : "บันทึกการตรวจ"}
          </button>
        </div>

        {showForm && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-slate-900">
                {isFollowUpNow ? "บันทึกผลตรวจซ้ำนอกรอบ" : "บันทึกผลตรวจใหม่"}
              </p>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="mb-3">
              <label className="text-xs font-bold text-slate-500 block mb-1">ผลตรวจ</label>
              <div className="flex gap-2">
                {["ผ่าน", "ผ่านแบบมีข้อสังเกต", "ไม่ผ่าน"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setForm({ ...form, result: r })}
                    className={`text-xs px-3 py-1.5 rounded-lg border ${
                      form.result === r ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs font-bold text-slate-500 block mb-1">สิ่งที่พบ</label>
              <textarea
                rows={2}
                value={form.findings}
                onChange={(e) => setForm({ ...form, findings: e.target.value })}
                placeholder="เช่น แรงดันอากาศต่ำกว่าเกณฑ์"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>
            <div className="mb-3">
              <label className="text-xs font-bold text-slate-500 block mb-1">การซ่อม / เปลี่ยนอะไหล่</label>
              <textarea
                rows={2}
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value })}
                placeholder="เช่น เปลี่ยนวาล์วควบคุมแรงดัน P/N: SC-RV-220"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>
            {needsDeadline && (
              <div className="mb-4">
                <label className="text-xs font-bold text-slate-500 block mb-1">
                  กำหนดแก้ไขให้เสร็จภายในวันที่ <span className="text-red-600">(บังคับกรอกเมื่อไม่ผ่าน)</span>
                </label>
                <input
                  type="date"
                  value={form.correctiveDeadline}
                  onChange={(e) => setForm({ ...form, correctiveDeadline: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <p className="text-xs text-slate-400 mt-1">
                  ระบบจะตั้งอุปกรณ์นี้เป็น "รอตรวจซ้ำ" และแทรกรายการตรวจพิเศษนอกรอบให้อัตโนมัติ
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-600">
                ยกเลิก
              </button>
              <button
                onClick={submit}
                disabled={!canSubmit}
                className={`text-sm px-3 py-2 rounded-lg text-white ${canSubmit ? "bg-slate-900" : "bg-slate-300 cursor-not-allowed"}`}
              >
                บันทึก
              </button>
            </div>
          </Card>
        )}

        <div className="space-y-4">
          {selected.history.map((h, i) => (
            <div key={h.rowId} className="flex gap-3">
              <div className="flex flex-col items-center pt-1.5">
                <div className={`w-2 h-2 rounded-full ${h.result === "ไม่ผ่าน" ? "bg-red-500" : h.result === "ผ่านแบบมีข้อสังเกต" ? "bg-amber-500" : "bg-emerald-500"}`} />
                {i < selected.history.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
              </div>
              <div className="pb-4 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-800">
                    {formatThaiDate(h.date)} · {h.inspector}
                    {h.isFollowUp && (
                      <span className="ml-2 text-xs font-normal bg-blue-50 text-blue-700 px-2 py-0.5 rounded">ตรวจพิเศษนอกรอบ</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(h.result)}>{h.result}</Badge>
                    <ConfirmDeleteButton onConfirm={() => onDeleteInspection(selected.id, h.rowId)} />
                  </div>
                </div>
                <p className="text-sm text-slate-500 mt-1.5">พบ: {h.findings}</p>
                <p className="text-sm text-slate-700 mt-1">ดำเนินการ: {h.action}</p>
                {h.correctiveDeadline && (
                  <p className="text-sm text-red-600 mt-1">กำหนดแก้ไขภายในวันที่ {formatThaiDate(h.correctiveDeadline)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">อุปกรณ์ความปลอดภัย</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-800"
        >
          <Plus size={16} /> เพิ่มอุปกรณ์
        </button>
      </div>

      {showAddForm && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-900">เพิ่มอุปกรณ์ใหม่</p>
            <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">ประเภทอุปกรณ์</label>
              <select
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                {equipmentTypeOptions.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">รหัสอุปกรณ์</label>
              <input
                value={addForm.code}
                onChange={(e) => setAddForm({ ...addForm, code: e.target.value })}
                placeholder="เช่น SCBA-020"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">ตำแหน่งติดตั้ง</label>
              <input
                value={addForm.location}
                onChange={(e) => setAddForm({ ...addForm, location: e.target.value })}
                placeholder="เช่น อาคาร C ชั้น 2"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">ยี่ห้อ / รุ่น</label>
              <input
                value={addForm.brand}
                onChange={(e) => setAddForm({ ...addForm, brand: e.target.value })}
                placeholder="เช่น Scott Safety AV-3000"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs font-bold text-slate-500 block mb-1">รอบตรวจ</label>
            <select
              value={addForm.frequency}
              onChange={(e) => setAddForm({ ...addForm, frequency: e.target.value })}
              className="w-full sm:w-1/2 border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              {frequencyOptions.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAddForm(false)} className="text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-600">
              ยกเลิก
            </button>
            <button
              onClick={() => {
                if (!addForm.code.trim() || !addForm.location.trim()) return;
                onAddEquipment({
                  id: Date.now(),
                  code: addForm.code,
                  name: addForm.name,
                  location: addForm.location,
                  brand: addForm.brand || "-",
                  frequency: addForm.frequency,
                  lastDate: "-",
                  nextDate: "-",
                  status: "ปกติ",
                  pendingReinspectionDue: null,
                  history: [],
                });
                setAddForm({ name: equipmentTypeOptions[0], code: "", location: "", brand: "", frequency: frequencyOptions[0] });
                setShowAddForm(false);
              }}
              className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white"
            >
              บันทึก
            </button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="อุปกรณ์ทั้งหมด" value={equipment.length} />
        <MetricCard label="รอตรวจซ้ำ" value={equipment.filter((e) => e.status === "รอตรวจซ้ำ").length} tone="text-red-600" />
        <MetricCard label="ใกล้ครบกำหนด" value={equipment.filter((e) => e.status === "ใกล้ครบกำหนด").length} tone="text-amber-600" />
        <MetricCard label="ปกติ" value={equipment.filter((e) => e.status === "ปกติ").length} tone="text-emerald-600" />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-2.5 font-bold">อุปกรณ์ / รหัส</th>
              <th className="px-4 py-2.5 font-bold">ตำแหน่งติดตั้ง</th>
              <th className="px-4 py-2.5 font-bold">รอบตรวจ</th>
              <th className="px-4 py-2.5 font-bold">กำหนดถัดไป</th>
              <th className="px-4 py-2.5 font-bold">สถานะ</th>
              <th className="px-4 py-2.5"></th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((eq) => (
              <tr
                key={eq.id}
                onClick={() => setSelectedId(eq.id)}
                className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
              >
                <td className="px-4 py-2.5">{eq.name} <span className="text-slate-400">· {eq.code}</span></td>
                <td className="px-4 py-2.5">{eq.location}</td>
                <td className="px-4 py-2.5 text-slate-500">{eq.frequency}</td>
                <td className="px-4 py-2.5 text-slate-500">
                  {eq.pendingReinspectionDue ? (
                    <span className="text-red-600">ตรวจซ้ำ {formatThaiDate(eq.pendingReinspectionDue)}</span>
                  ) : (
                    eq.nextDate === "-" ? "-" : formatThaiDate(eq.nextDate)
                  )}
                </td>
                <td className="px-4 py-2.5"><Badge tone={statusTone(eq.status)}>{eq.status}</Badge></td>
                <td className="px-4 py-2.5 text-slate-300"><ChevronRight size={16} /></td>
                <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <ConfirmDeleteButton onConfirm={() => onDeleteEquipment(eq.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
// ทะเบียนเครื่องจักร — แยกจากอุปกรณ์ความปลอดภัย ต้องมีวิศวกรที่ขึ้นทะเบียนมาตรวจ/รับรอง
// ---------------------------------------------------------------
function MachineryPage({ machinery, onAddInspection, onAddMachinery, onDeleteInspection, onDeleteMachinery }) {
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ result: "ผ่าน", engineerName: "", engineerLicenseNumber: "", certificateNumber: "", findings: "", correctiveDeadline: "" });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: machineryCategoryOptions[0], code: "", location: "", frequencyMonths: "12" });

  const selected = machinery.find((m) => m.id === selectedId);

  if (selected) {
    const needsDeadline = form.result === "ไม่ผ่าน";
    const canSubmit = !needsDeadline || form.correctiveDeadline.trim() !== "";

    const submit = () => {
      if (!canSubmit) return;
      onAddInspection(selected.id, {
        date: todayIso(),
        engineerName: form.engineerName || "-",
        engineerLicenseNumber: form.engineerLicenseNumber || "-",
        certificateNumber: form.certificateNumber || "-",
        result: form.result,
        findings: form.findings || "-",
        correctiveDeadline: needsDeadline ? form.correctiveDeadline : null,
      });
      setForm({ result: "ผ่าน", engineerName: "", engineerLicenseNumber: "", certificateNumber: "", findings: "", correctiveDeadline: "" });
      setShowForm(false);
    };

    return (
      <div className="space-y-5">
        <button onClick={() => setSelectedId(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> กลับไปทะเบียนเครื่องจักร
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">{selected.code}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{selected.name} · {selected.location}</p>
          </div>
          <Badge tone={statusTone(selected.status)}>{selected.status}</Badge>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="รอบตรวจ" value={`ทุก ${selected.frequencyMonths} เดือน`} />
          <MetricCard label="ตรวจล่าสุด" value={selected.lastDate === "-" ? "-" : formatThaiDate(selected.lastDate)} />
          <MetricCard label="ครบกำหนดครั้งถัดไป" value={selected.nextDate === "-" ? "-" : formatThaiDate(selected.nextDate)} />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900">ประวัติการตรวจรับรองโดยวิศวกร</p>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-800">
            <Plus size={16} /> บันทึกผลตรวจ
          </button>
        </div>

        {showForm && (
          <Card>
            <div className="mb-3">
              <label className="text-xs font-bold text-slate-500 block mb-1">ผลการตรวจ</label>
              <div className="flex gap-2 flex-wrap">
                {["ผ่าน", "ผ่านแบบมีข้อสังเกต", "ไม่ผ่าน"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setForm({ ...form, result: r })}
                    className={`text-xs px-3 py-1.5 rounded-lg border ${form.result === r ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">ชื่อวิศวกรที่รับรอง</label>
                <input value={form.engineerName} onChange={(e) => setForm({ ...form, engineerName: e.target.value })} placeholder="ชื่อ-นามสกุล" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">เลขที่ใบอนุญาตวิศวกร</label>
                <input value={form.engineerLicenseNumber} onChange={(e) => setForm({ ...form, engineerLicenseNumber: e.target.value })} placeholder="เช่น กว.12345" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs font-bold text-slate-500 block mb-1">เลขที่ใบรับรองการตรวจ</label>
              <input value={form.certificateNumber} onChange={(e) => setForm({ ...form, certificateNumber: e.target.value })} placeholder="เช่น CR-2569-018" className="w-full sm:w-1/2 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="mb-3">
              <label className="text-xs font-bold text-slate-500 block mb-1">ข้อสังเกต/รายละเอียด</label>
              <textarea rows={2} value={form.findings} onChange={(e) => setForm({ ...form, findings: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" />
            </div>
            {needsDeadline && (
              <div className="mb-3">
                <label className="text-xs font-bold text-slate-500 block mb-1">กำหนดแก้ไข/ตรวจซ้ำภายในวันที่</label>
                <input type="date" value={form.correctiveDeadline} onChange={(e) => setForm({ ...form, correctiveDeadline: e.target.value })} className="w-full sm:w-1/2 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-600">ยกเลิก</button>
              <button onClick={submit} disabled={!canSubmit} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white disabled:opacity-40">บันทึก</button>
            </div>
          </Card>
        )}

        <div className="space-y-4">
          {selected.history.map((h, i) => (
            <div key={h.rowId} className="flex gap-3">
              <div className="flex flex-col items-center pt-1.5">
                <div className={`w-2 h-2 rounded-full ${h.result === "ไม่ผ่าน" ? "bg-red-500" : h.result === "ผ่านแบบมีข้อสังเกต" ? "bg-amber-500" : "bg-emerald-500"}`} />
                {i < selected.history.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
              </div>
              <div className="pb-4 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-800">{formatThaiDate(h.date)}</p>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(h.result)}>{h.result}</Badge>
                    <ConfirmDeleteButton onConfirm={() => onDeleteInspection(selected.id, h.rowId)} />
                  </div>
                </div>
                <p className="text-sm text-slate-700 mt-1">วิศวกร: {h.engineerName} · เลขใบอนุญาต: {h.engineerLicenseNumber}</p>
                <p className="text-sm text-slate-500 mt-0.5">เลขที่ใบรับรอง: {h.certificateNumber}</p>
                {h.findings !== "-" && <p className="text-sm text-slate-600 mt-1">{h.findings}</p>}
                {h.correctiveDeadline && (
                  <p className="text-sm text-red-600 mt-1">กำหนดแก้ไขภายในวันที่ {formatThaiDate(h.correctiveDeadline)}</p>
                )}
              </div>
            </div>
          ))}
          {selected.history.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีประวัติการตรวจ</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">ทะเบียนเครื่องจักร</h1>
        <button onClick={() => setShowAddForm(true)} className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-2 rounded-lg">
          <Plus size={16} /> เพิ่มเครื่องจักร
        </button>
      </div>

      <p className="text-xs text-slate-400 -mt-3">
        สำหรับเครื่องจักร/อุปกรณ์ที่กฎหมายบังคับให้วิศวกรที่ขึ้นทะเบียนมาตรวจรับรอง เช่น ปั้นจั่น, หม้อไอน้ำ,
        ถังรับความดัน, ลิฟต์, รถยก — ถ้าเป็นอุปกรณ์ความปลอดภัยทั่วไปที่ จป. ตรวจเองได้ ให้ใช้เมนู "อุปกรณ์ความปลอดภัย" แทน
      </p>

      {showAddForm && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-slate-900">เพิ่มเครื่องจักร</p>
            <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">ประเภทเครื่องจักร</label>
              <select value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                {machineryCategoryOptions.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">รหัสทรัพย์สิน</label>
              <input value={addForm.code} onChange={(e) => setAddForm({ ...addForm, code: e.target.value })} placeholder="เช่น CRANE-001" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">สถานที่ติดตั้ง/ใช้งาน</label>
              <input value={addForm.location} onChange={(e) => setAddForm({ ...addForm, location: e.target.value })} placeholder="เช่น โกดังสินค้า A" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">รอบตรวจ (เดือน)</label>
              <input type="number" min="1" value={addForm.frequencyMonths} onChange={(e) => setAddForm({ ...addForm, frequencyMonths: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAddForm(false)} className="text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-600">ยกเลิก</button>
            <button
              onClick={() => {
                if (!addForm.code.trim()) return;
                onAddMachinery(addForm);
                setAddForm({ name: machineryCategoryOptions[0], code: "", location: "", frequencyMonths: "12" });
                setShowAddForm(false);
              }}
              className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white"
            >
              บันทึก
            </button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-left">
                <th className="px-4 py-2.5 font-bold">รหัส</th>
                <th className="px-4 py-2.5 font-bold">ประเภท</th>
                <th className="px-4 py-2.5 font-bold">สถานที่</th>
                <th className="px-4 py-2.5 font-bold">ครบกำหนดครั้งถัดไป</th>
                <th className="px-4 py-2.5 font-bold">สถานะ</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {machinery.map((m) => (
                <tr key={m.id} onClick={() => setSelectedId(m.id)} className="border-t border-slate-100 cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-bold text-slate-900">{m.code}</td>
                  <td className="px-4 py-2.5 text-slate-500">{m.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{m.location}</td>
                  <td className="px-4 py-2.5 text-slate-500">{m.nextDate === "-" ? "-" : formatThaiDate(m.nextDate)}</td>
                  <td className="px-4 py-2.5"><Badge tone={statusTone(m.status)}>{m.status}</Badge></td>
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <ConfirmDeleteButton onConfirm={() => onDeleteMachinery(m.id)} />
                  </td>
                </tr>
              ))}
              {machinery.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-3 text-sm text-slate-400">ยังไม่มีเครื่องจักรที่บันทึกไว้</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}



function ChecklistPage() {
  const [header, setHeader] = useState({
    projectName: "", location: "", workType: workTypes[0],
    scheduledDate: "", scheduledStart: "", scheduledEnd: "",
  });
  const [headerLocked, setHeaderLocked] = useState(false);
  const [answers, setAnswers] = useState({});
  const [notes, setNotes] = useState("");
  const [correctiveDeadline, setCorrectiveDeadline] = useState("");
  const [submissions, setSubmissions] = useState([]); // ประวัติแต่ละรอบตรวจของงานนี้
  const [approved, setApproved] = useState(false);

  const passCount = Object.values(answers).filter((v) => v === "pass").length;
  const failCount = Object.values(answers).filter((v) => v === "fail").length;
  const answeredCount = passCount + failCount;
  const allAnswered = answeredCount === checklistItems.length;
  const needsDeadline = failCount > 0;
  const canSubmit = allAnswered && (!needsDeadline || correctiveDeadline.trim() !== "");

  const lastSubmission = submissions[0];
  const awaitingReinspection = lastSubmission && lastSubmission.result === "fail";
  const readyToApprove = lastSubmission && lastSubmission.result === "pass" && !approved;
  const inspectionInProgress = !lastSubmission || awaitingReinspection;

  const submit = () => {
    if (!canSubmit) return;
    const record = {
      id: Date.now(),
      date: "วันนี้",
      inspector: "ผู้ใช้งานปัจจุบัน",
      result: needsDeadline ? "fail" : "pass",
      passCount, failCount,
      notes: notes || "-",
      correctiveDeadline: needsDeadline ? correctiveDeadline : null,
      isFollowUp: submissions.length > 0,
    };
    setSubmissions([record, ...submissions]);
    setHeaderLocked(true);
    setAnswers({});
    setNotes("");
    setCorrectiveDeadline("");
  };

  const approve = () => setApproved(true);

  const resetAll = () => {
    setHeader({ projectName: "", location: "", workType: workTypes[0], scheduledDate: "", scheduledStart: "", scheduledEnd: "" });
    setHeaderLocked(false);
    setAnswers({});
    setNotes("");
    setCorrectiveDeadline("");
    setSubmissions([]);
    setApproved(false);
  };

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-slate-900">แบบตรวจสภาพหน้างานก่อนเริ่มงานเสี่ยงสูง</h1>

      <Card className="max-w-xl">
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">ชื่อโครงการ / งาน</label>
            <input
              value={header.projectName}
              disabled={headerLocked}
              onChange={(e) => setHeader({ ...header, projectName: e.target.value })}
              placeholder="เช่น ซ่อมบำรุงหลังคาโกดัง B"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">ตำแหน่งสถานที่</label>
            <input
              value={header.location}
              disabled={headerLocked}
              onChange={(e) => setHeader({ ...header, location: e.target.value })}
              placeholder="เช่น หลังคาโกดัง B ชั้น 3"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">ประเภทงานเสี่ยงสูง</label>
            <select
              value={header.workType}
              disabled={headerLocked}
              onChange={(e) => setHeader({ ...header, workType: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
            >
              {workTypes.map((w) => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">วันที่จะเข้าทำงาน</label>
            <input
              type="date"
              value={header.scheduledDate}
              disabled={headerLocked}
              onChange={(e) => setHeader({ ...header, scheduledDate: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">เวลาเริ่มงาน</label>
            <input
              type="time"
              value={header.scheduledStart}
              disabled={headerLocked}
              onChange={(e) => setHeader({ ...header, scheduledStart: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">เวลาสิ้นสุดงาน (โดยประมาณ)</label>
            <input
              type="time"
              value={header.scheduledEnd}
              disabled={headerLocked}
              onChange={(e) => setHeader({ ...header, scheduledEnd: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </div>

        {submissions.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-medium text-slate-500">ประวัติการตรวจของงานนี้</p>
            {submissions.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2">
                <span className="text-slate-700">
                  {s.date}
                  {s.isFollowUp && <span className="ml-2 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">ตรวจซ้ำ</span>}
                </span>
                <Badge tone={s.result === "fail" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}>
                  {s.result === "fail" ? "ไม่ผ่าน" : "ผ่าน"}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {awaitingReinspection && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
            <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">
              ต้องแก้ไขและตรวจซ้ำภายในวันที่ <span className="font-medium">{lastSubmission.correctiveDeadline}</span>
              {" "}ก่อนจึงจะอนุมัติและออกเอกสารประกอบใบอนุญาตเข้าทำงานได้
            </p>
          </div>
        )}

        {inspectionInProgress && (
          <>
            <p className="text-xs font-medium text-slate-500 mb-2">
              {awaitingReinspection ? "ตรวจซ้ำ — รายการตรวจสภาพ" : "รายการตรวจสภาพ"}
            </p>
            <div className="space-y-3 mb-4">
              {checklistItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{item.id}. {item.text}</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setAnswers({ ...answers, [item.id]: "pass" })}
                      className={`text-xs px-3 py-1 rounded-lg border ${
                        answers[item.id] === "pass" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "border-slate-300 text-slate-500"
                      }`}
                    >
                      ผ่าน
                    </button>
                    <button
                      onClick={() => setAnswers({ ...answers, [item.id]: "fail" })}
                      className={`text-xs px-3 py-1 rounded-lg border ${
                        answers[item.id] === "fail" ? "bg-red-50 text-red-700 border-red-200" : "border-slate-300 text-slate-500"
                      }`}
                    >
                      ไม่ผ่าน
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <label className="text-xs font-bold text-slate-500 block mb-1">หมายเหตุ / ข้อบกพร่องที่พบ</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น บันไดขั้นที่ 3 หลวม ต้องซ่อมก่อนใช้งาน"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none mb-3"
            />

            <div className="border border-dashed border-slate-300 rounded-lg py-4 text-center text-slate-400 text-sm mb-4">
              <Camera size={20} className="mx-auto mb-1.5" />
              แตะเพื่อถ่ายรูปหรือแนบไฟล์
            </div>

            {needsDeadline && (
              <div className="mb-4">
                <label className="text-xs font-bold text-slate-500 block mb-1">
                  กำหนดแก้ไขให้เสร็จภายในวันที่ <span className="text-red-600">(บังคับกรอกเมื่อมีข้อไม่ผ่าน)</span>
                </label>
                <input
                  type="date"
                  value={correctiveDeadline}
                  onChange={(e) => setCorrectiveDeadline(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">ผ่าน {passCount} · ไม่ผ่าน {failCount} · รอตรวจ {checklistItems.length - answeredCount}</span>
              <button
                onClick={submit}
                disabled={!canSubmit}
                className={`text-sm px-3 py-2 rounded-lg text-white ${canSubmit ? "bg-slate-900" : "bg-slate-300 cursor-not-allowed"}`}
              >
                ส่งผลตรวจสอบ
              </button>
            </div>
          </>
        )}

        {readyToApprove && (
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
            <p className="text-sm text-emerald-700">ผ่านครบทุกข้อแล้ว พร้อมอนุมัติ</p>
            <button onClick={approve} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white">
              อนุมัติผลตรวจสอบ
            </button>
          </div>
        )}

        {approved && (
          <div className="space-y-3">
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 text-sm text-slate-700 space-y-1">
              <p className="font-bold text-slate-900 mb-1">สรุปสำหรับพิมพ์ประกอบใบอนุญาตเข้าทำงาน</p>
              <p>โครงการ: {header.projectName || "-"}</p>
              <p>สถานที่: {header.location || "-"}</p>
              <p>ประเภทงาน: {header.workType}</p>
              <p>กำหนดเข้าทำงาน: {header.scheduledDate || "-"} เวลา {header.scheduledStart || "-"} - {header.scheduledEnd || "-"}</p>
              <p>ผลตรวจสภาพ: ผ่านครบทุกข้อ · อนุมัติโดยผู้ใช้งานปัจจุบัน · วันนี้</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={resetAll} className="text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-600">
                ตรวจสอบงานใหม่
              </button>
              <button onClick={() => window.print()} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white">
                พิมพ์รายงาน
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
// Employees registry
// ---------------------------------------------------------------

function EmployeeDetail({ employee, ppe, noncompliance, incidents, trainingRecords, trainingCourses, onBack }) {
  const employeePpe = ppe.filter((p) => p.employeeId === employee.id);
  const employeeNoncompliance = noncompliance.filter((r) => r.employeeId === employee.id);
  const employeeIncidents = incidents
    .filter((inc) => inc.injuredEmployees.some((e) => e.employeeId === employee.id))
    .map((inc) => ({ ...inc, myInjury: inc.injuredEmployees.find((e) => e.employeeId === employee.id) }))
    .sort((a, b) => (a.incidentDate < b.incidentDate ? 1 : -1));
  const employeeTrainings = trainingRecords
    .filter((r) => r.employeeId === employee.id)
    .sort((a, b) => (a.completionDate < b.completionDate ? 1 : -1));
  const courseName = (id) => trainingCourses.find((c) => c.id === id)?.name ?? "-";

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> กลับไปทะเบียนพนักงาน
      </button>

      <div>
        <h1 className="text-lg font-bold text-slate-900">{employee.name} <span className="text-slate-400 font-normal text-base">· {employee.code || "-"}</span></h1>
        <p className="text-sm text-slate-500 mt-0.5">{employee.position} · {employee.department}</p>
      </div>

      <div>
        <p className="text-sm font-bold text-slate-900 mb-3">ประวัติรับมอบ PPE</p>
        {employeePpe.length === 0 ? (
          <Card><p className="text-sm text-slate-400">ยังไม่มีประวัติรับมอบ PPE</p></Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left">
                    <th className="px-4 py-2.5 font-bold">อุปกรณ์</th>
                    <th className="px-4 py-2.5 font-bold">มาตรฐาน</th>
                    <th className="px-4 py-2.5 font-bold">จำนวน</th>
                    <th className="px-4 py-2.5 font-bold">เหตุผลเบิก</th>
                    <th className="px-4 py-2.5 font-bold">วันที่รับ</th>
                    <th className="px-4 py-2.5 font-bold">วันหมดอายุ</th>
                    <th className="px-4 py-2.5 font-bold">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {employeePpe.map((p) => {
                    const remaining = daysUntil(p.expiry);
                    return (
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="px-4 py-2.5">{p.name}</td>
                        <td className="px-4 py-2.5 text-slate-500">{p.standard}</td>
                        <td className="px-4 py-2.5 text-slate-500">{p.quantity}</td>
                        <td className="px-4 py-2.5 text-slate-500">{reasonLabel[p.reason]}</td>
                        <td className="px-4 py-2.5 text-slate-500">{formatThaiDate(p.issuedDate)}</td>
                        <td className="px-4 py-2.5 text-slate-500">{formatThaiDate(p.expiry)}</td>
                        <td className="px-4 py-2.5"><Badge tone={statusTone(ppeStatusOf(remaining))}>เหลือ {remaining} วัน</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <div>
        <p className="text-sm font-bold text-slate-900 mb-3">ประวัติการอบรม</p>
        {employeeTrainings.length === 0 ? (
          <Card><p className="text-sm text-slate-400">ยังไม่มีประวัติการอบรม</p></Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left">
                    <th className="px-4 py-2.5 font-bold">หลักสูตร</th>
                    <th className="px-4 py-2.5 font-bold">วันที่อบรมผ่าน</th>
                    <th className="px-4 py-2.5 font-bold">วันหมดอายุ</th>
                    <th className="px-4 py-2.5 font-bold">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeTrainings.map((t) => {
                    const status = getTrainingComplianceStatus(employee.id, t.courseId, trainingRecords);
                    return (
                      <tr key={t.id} className="border-t border-slate-100">
                        <td className="px-4 py-2.5">{courseName(t.courseId)}</td>
                        <td className="px-4 py-2.5 text-slate-500">{formatThaiDate(t.completionDate)}</td>
                        <td className="px-4 py-2.5 text-slate-500">{t.expiryDate ? formatThaiDate(t.expiryDate) : "ไม่มีวันหมดอายุ"}</td>
                        <td className="px-4 py-2.5"><Badge tone={trainingStatusTone(status)}>{trainingStatusLabel[status]}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <div>
        <p className="text-sm font-bold text-slate-900 mb-3">ประวัติไม่ปฏิบัติตาม</p>
        {employeeNoncompliance.length === 0 ? (
          <Card><p className="text-sm text-slate-400">ยังไม่มีประวัติไม่ปฏิบัติตาม</p></Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left">
                    <th className="px-4 py-2.5 font-bold">อุปกรณ์ที่ไม่ได้สวมใส่</th>
                    <th className="px-4 py-2.5 font-bold">สถานที่</th>
                    <th className="px-4 py-2.5 font-bold">วันที่พบ</th>
                    <th className="px-4 py-2.5 font-bold">การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeNoncompliance.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5">{r.ppeName}</td>
                      <td className="px-4 py-2.5 text-slate-500">{r.location}</td>
                      <td className="px-4 py-2.5 text-slate-500">{formatThaiDate(r.date)}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={r.action === "ให้หยุดงาน" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}>{r.action}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <div>
        <p className="text-sm font-bold text-slate-900 mb-3">ประวัติอุบัติเหตุ</p>
        {employeeIncidents.length === 0 ? (
          <Card><p className="text-sm text-slate-400">ยังไม่มีประวัติอุบัติเหตุ</p></Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left">
                    <th className="px-4 py-2.5 font-bold">วันที่</th>
                    <th className="px-4 py-2.5 font-bold">สถานที่</th>
                    <th className="px-4 py-2.5 font-bold">ลักษณะการบาดเจ็บ</th>
                    <th className="px-4 py-2.5 font-bold">หยุดงาน</th>
                    <th className="px-4 py-2.5 font-bold">สถานะเคส</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeIncidents.map((inc) => (
                    <tr key={inc.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 text-slate-500">{formatThaiDate(inc.incidentDate)}</td>
                      <td className="px-4 py-2.5">{inc.location}</td>
                      <td className="px-4 py-2.5">{inc.myInjury?.injuryType || "-"}</td>
                      <td className="px-4 py-2.5">
                        {inc.myInjury?.lostWorkdays > 0 ? (
                          <span className="text-red-600">{inc.myInjury.lostWorkdays} วัน (LTI)</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5"><Badge tone={statusTone(inc.status)}>{inc.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function EmployeesPage({ employees, locations, ppe, noncompliance, incidents, trainingRecords, trainingCourses, employeeLimit, onAdd, onAddMany, onDelete, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({ code: "", name: "", position: "", department: "", primaryLocationId: "", isJorporManagement: false, isJorporSupervisor: false, isSafetyCommittee: false });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ code: "", name: "", position: "", department: "", primaryLocationId: "", isJorporManagement: false, isJorporSupervisor: false, isSafetyCommittee: false });
  const [importMessage, setImportMessage] = useState(null);
  const fileInputRef = useRef(null);

  const atLimit = employeeLimit != null && employees.length >= employeeLimit;
  const locationName = (id) => locations.find((l) => l.id === id)?.name ?? "ยังไม่ระบุ";

  const submit = () => {
    if (!form.name.trim()) return;
    if (atLimit) {
      setImportMessage({ type: "error", text: `แพ็กเกจปัจจุบันบันทึกพนักงานได้สูงสุด ${employeeLimit} คน กรุณาอัปเกรดแพ็กเกจเพื่อเพิ่มจำนวน` });
      return;
    }
    onAdd({
      id: Date.now(),
      code: form.code || "-",
      name: form.name,
      position: form.position || "-",
      department: form.department || "-",
      primaryLocationId: form.primaryLocationId || null,
      isJorporManagement: form.isJorporManagement,
      isJorporSupervisor: form.isJorporSupervisor,
      isSafetyCommittee: form.isSafetyCommittee,
    });
    setForm({ code: "", name: "", position: "", department: "", primaryLocationId: "", isJorporManagement: false, isJorporSupervisor: false, isSafetyCommittee: false });
    setShowForm(false);
  };

  const startEdit = (emp) => {
    setEditingId(emp.id);
    setEditForm({
      code: emp.code || "",
      name: emp.name,
      position: emp.position || "",
      department: emp.department || "",
      primaryLocationId: emp.primaryLocationId != null ? String(emp.primaryLocationId) : "",
      isJorporManagement: !!emp.isJorporManagement,
      isJorporSupervisor: !!emp.isJorporSupervisor,
      isSafetyCommittee: !!emp.isSafetyCommittee,
    });
  };

  const saveEdit = () => {
    if (!editForm.name.trim()) return;
    onUpdate(editingId, {
      code: editForm.code || "-",
      name: editForm.name,
      position: editForm.position || "-",
      department: editForm.department || "-",
      primaryLocationId: editForm.primaryLocationId || null,
      isJorporManagement: editForm.isJorporManagement,
      isJorporSupervisor: editForm.isJorporSupervisor,
      isSafetyCommittee: editForm.isSafetyCommittee,
    });
    setEditingId(null);
  };

  const handleImportClick = () => {
    if (atLimit) {
      setImportMessage({ type: "error", text: `แพ็กเกจปัจจุบันบันทึกพนักงานได้สูงสุด ${employeeLimit} คน กรุณาอัปเกรดแพ็กเกจเพื่อนำเข้าเพิ่ม` });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleDownloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const templateData = [
      { "รหัสพนักงาน": "EMP-004", "ชื่อ-สกุล": "สมหญิง รักงาน", "ตำแหน่ง": "ช่างเทคนิค", "แผนก": "ซ่อมบำรุง" },
      { "รหัสพนักงาน": "EMP-005", "ชื่อ-สกุล": "สมชาย มั่นคง", "ตำแหน่ง": "พนักงานคลังสินค้า", "แผนก": "คลังสินค้า" },
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 22 }, { wch: 18 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "พนักงาน");
    XLSX.writeFile(workbook, "template_นำเข้าพนักงาน.xlsx");
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      const getField = (row, keys) => {
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return String(row[k]).trim();
        }
        return "";
      };

      const newEmployees = rows
        .map((row) => ({
          id: Date.now() + Math.random(),
          code: getField(row, ["รหัสพนักงาน", "รหัส", "code", "Code"]) || "-",
          name: getField(row, ["ชื่อ-สกุล", "ชื่อ", "name", "Name"]),
          position: getField(row, ["ตำแหน่ง", "position", "Position"]) || "-",
          department: getField(row, ["แผนก", "หน่วยงาน", "department", "Department"]) || "-",
        }))
        .filter((r) => r.name);

      if (newEmployees.length === 0) {
        setImportMessage({ type: "error", text: "ไม่พบข้อมูลที่นำเข้าได้ ตรวจสอบว่ามีคอลัมน์ 'ชื่อ-สกุล' หรือไม่" });
      } else if (employeeLimit != null) {
        const remaining = Math.max(0, employeeLimit - employees.length);
        if (remaining === 0) {
          setImportMessage({ type: "error", text: `แพ็กเกจปัจจุบันบันทึกพนักงานได้สูงสุด ${employeeLimit} คน ไม่สามารถนำเข้าเพิ่มได้` });
        } else {
          const toImport = newEmployees.slice(0, remaining);
          onAddMany(toImport);
          const skipped = newEmployees.length - toImport.length;
          setImportMessage({
            type: skipped > 0 ? "error" : "success",
            text: skipped > 0
              ? `นำเข้าได้ ${toImport.length} คน (ข้าม ${skipped} คน เพราะเกินโควตาสูงสุด ${employeeLimit} คนของแพ็กเกจปัจจุบัน)`
              : `นำเข้าพนักงานสำเร็จ ${toImport.length} คน`,
          });
        }
      } else {
        onAddMany(newEmployees);
        setImportMessage({ type: "success", text: `นำเข้าพนักงานสำเร็จ ${newEmployees.length} คน` });
      }
    } catch (err) {
      setImportMessage({ type: "error", text: "อ่านไฟล์ไม่สำเร็จ ตรวจสอบว่าเป็นไฟล์ .xlsx หรือ .csv ที่ถูกต้อง" });
    }
    e.target.value = "";
  };

  const selected = employees.find((e) => e.id === selectedId);
  if (selected) {
    return (
      <EmployeeDetail
        employee={selected}
        ppe={ppe}
        noncompliance={noncompliance}
        incidents={incidents}
        trainingRecords={trainingRecords}
        trainingCourses={trainingCourses}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-slate-900">ทะเบียนพนักงาน</h1>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={handleDownloadTemplate}
            className="text-sm text-slate-500 underline hover:text-slate-700"
          >
            ดาวน์โหลด Template
          </button>
          <button
            onClick={handleImportClick}
            className="flex items-center gap-1.5 text-sm border border-slate-300 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-50"
          >
            นำเข้าจาก Excel
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-800"
          >
            <Plus size={16} /> เพิ่มพนักงาน
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-400 -mt-3">
        ไฟล์ต้องมีคอลัมน์ "ชื่อ-สกุล" (บังคับ), "รหัสพนักงาน", "ตำแหน่ง" และ "แผนก" — ดาวน์โหลด Template ด้านบนเพื่อดูตัวอย่าง
      </p>

      {employeeLimit != null && (
        <div className={`text-sm px-3 py-2 rounded-lg ${atLimit ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-600"}`}>
          บันทึกพนักงานแล้ว {employees.length} / {employeeLimit} คน (ตามแพ็กเกจปัจจุบัน)
          {atLimit && " — ครบโควตาสูงสุดแล้ว กรุณาอัปเกรดแพ็กเกจเพื่อเพิ่มจำนวน"}
        </div>
      )}

      {importMessage && (
        <div className={`text-sm px-3 py-2 rounded-lg ${importMessage.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {importMessage.text}
        </div>
      )}

      {showForm && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-900">เพิ่มพนักงานใหม่</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <div className="grid sm:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">รหัสพนักงาน</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="เช่น EMP-004"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">ชื่อ-สกุล</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น สมหญิง รักงาน"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">ตำแหน่ง</label>
              <input
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                placeholder="เช่น ช่างเทคนิค"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">แผนก / หน่วยงาน</label>
              <input
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="เช่น ไลน์ผลิต 1"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">สถานที่ประจำ</label>
              <select
                value={form.primaryLocationId}
                onChange={(e) => setForm({ ...form, primaryLocationId: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">ยังไม่ระบุ</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs font-bold text-slate-500 block mb-1.5">บทบาทด้านความปลอดภัย (ถ้ามี)</label>
            <p className="text-xs text-slate-400 mb-2">ถ้าเลือกไว้ ระบบจะขึ้นหลักสูตรฝึกอบรมบังคับที่เกี่ยวข้องให้อัตโนมัติใน Training Matrix</p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "isJorporManagement", label: "จป.บริหาร" },
                { key: "isJorporSupervisor", label: "จป.หัวหน้างาน" },
                { key: "isSafetyCommittee", label: "คปอ. (คณะกรรมการความปลอดภัย)" },
              ].map((r) => (
                <button
                  key={r.key}
                  onClick={() => setForm({ ...form, [r.key]: !form[r.key] })}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${
                    form[r.key] ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-500"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-600">
              ยกเลิก
            </button>
            <button onClick={submit} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white">
              บันทึก
            </button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-2.5 font-bold">รหัสพนักงาน</th>
              <th className="px-4 py-2.5 font-bold">ชื่อ-สกุล</th>
              <th className="px-4 py-2.5 font-bold">ตำแหน่ง</th>
              <th className="px-4 py-2.5 font-bold">แผนก</th>
              <th className="px-4 py-2.5 font-bold">สถานที่ประจำ</th>
              <th className="px-4 py-2.5 font-bold">PPE ที่ถือครอง</th>
              <th className="px-4 py-2.5 font-bold">บทบาทด้านความปลอดภัย</th>
              <th className="px-4 py-2.5"></th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const isEditing = editingId === emp.id;
              if (isEditing) {
                return (
                  <tr key={emp.id} className="border-t border-slate-100 bg-slate-50">
                    <td className="px-4 py-2">
                      <input
                        value={editForm.code}
                        onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editForm.position}
                        onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editForm.department}
                        onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={editForm.primaryLocationId}
                        onChange={(e) => setEditForm({ ...editForm, primaryLocationId: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1 text-sm"
                      >
                        <option value="">ยังไม่ระบุ</option>
                        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {[
                          { key: "isJorporManagement", label: "จป.บริหาร" },
                          { key: "isJorporSupervisor", label: "จป.หัวหน้างาน" },
                          { key: "isSafetyCommittee", label: "คปอ." },
                        ].map((r) => (
                          <button
                            key={r.key}
                            onClick={() => setEditForm({ ...editForm, [r.key]: !editForm[r.key] })}
                            className={`text-xs px-2 py-1 rounded border ${
                              editForm[r.key] ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-500"
                            }`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2" colSpan={2}>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingId(null)} className="text-xs text-slate-500 underline">ยกเลิก</button>
                        <button onClick={saveEdit} className="text-xs bg-slate-900 text-white px-2 py-1 rounded-lg">บันทึก</button>
                      </div>
                    </td>
                  </tr>
                );
              }
              return (
                <tr
                  key={emp.id}
                  onClick={() => setSelectedId(emp.id)}
                  className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-2.5 text-slate-500">{emp.code || "-"}</td>
                  <td className="px-4 py-2.5">{emp.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{emp.position}</td>
                  <td className="px-4 py-2.5 text-slate-500">{emp.department}</td>
                  <td className="px-4 py-2.5 text-slate-500">{locationName(emp.primaryLocationId)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{ppe.filter((p) => p.employeeId === emp.id).length} รายการ</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {emp.isJorporManagement && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">จป.บริหาร</span>}
                      {emp.isJorporSupervisor && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">จป.หัวหน้างาน</span>}
                      {emp.isSafetyCommittee && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">คปอ.</span>}
                      {!emp.isJorporManagement && !emp.isJorporSupervisor && !emp.isSafetyCommittee && (
                        <span className="text-slate-300">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => startEdit(emp)} className="text-xs text-slate-500 underline hover:text-slate-800">
                      แก้ไข
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span onClick={(e) => e.stopPropagation()}>
                      <ConfirmDeleteButton onConfirm={() => onDelete(emp.id)} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
// Work locations registry
// ---------------------------------------------------------------

const hazardOptions = Object.keys(hazardTypeLabel);
const riskLevelOptions = ["low", "medium", "high", "critical"];

function MeasurementSubForm({ onSubmit, onCancel, initialRecord }) {
  const isEditMode = !!initialRecord;
  const [shared, setShared] = useState(
    initialRecord
      ? {
          measurementType: initialRecord.measurementType, unit: initialRecord.unit,
          standardLimit: initialRecord.standardLimit ?? "", measuredAt: initialRecord.measuredAt,
          nextDue: initialRecord.nextDue || "", notes: initialRecord.notes === "-" ? "" : initialRecord.notes || "",
        }
      : { measurementType: measurementTypeOptions[0], unit: "", standardLimit: "", measuredAt: todayIso(), nextDue: "", notes: "" }
  );
  const [points, setPoints] = useState(
    initialRecord
      ? initialRecord.points.map((p, i) => ({ id: i + 1, label: p.label, value: String(p.value), result: p.result }))
      : [{ id: 1, label: "จุดที่ 1", value: "", result: "pass" }]
  );
  const [planFile, setPlanFile] = useState(
    initialRecord?.planFileUrl ? { name: initialRecord.planFileName, dataUrl: initialRecord.planFileUrl } : null
  );
  const planInputRef = useRef(null);

  const addPoint = () => setPoints([...points, { id: Date.now(), label: `จุดที่ ${points.length + 1}`, value: "", result: "pass" }]);
  const removePoint = (id) => setPoints(points.filter((p) => p.id !== id));
  const updatePoint = (id, field, value) => setPoints(points.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

  const handlePlanFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPlanFile({ name: file.name, dataUrl: reader.result });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const submit = () => {
    const validPoints = points.filter((p) => p.label.trim() && p.value !== "");
    if (validPoints.length === 0 || !shared.unit) return;
    const failCount = validPoints.filter((p) => p.result === "fail").length;
    onSubmit({
      measurementType: shared.measurementType,
      unit: shared.unit,
      standardLimit: shared.standardLimit === "" ? null : Number(shared.standardLimit),
      measuredAt: shared.measuredAt,
      nextDue: shared.nextDue || null,
      notes: shared.notes || "-",
      planFileName: planFile?.name || null,
      planFileUrl: planFile?.dataUrl || null,
      points: validPoints.map((p) => ({ label: p.label, value: Number(p.value), result: p.result })),
      failCount,
      result: failCount > 0 ? "fail" : "pass",
    });
  };

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-slate-900">{isEditMode ? "แก้ไขผลตรวจวัด" : "บันทึกผลตรวจวัดใหม่"}</p>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X size={18} />
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">ประเภทการตรวจวัด</label>
          <select
            value={shared.measurementType}
            onChange={(e) => setShared({ ...shared, measurementType: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            {measurementTypeOptions.map((t) => <option key={t} value={t}>{measurementTypeLabel[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">หน่วย</label>
          <input
            value={shared.unit}
            onChange={(e) => setShared({ ...shared, unit: e.target.value })}
            placeholder="เช่น dB(A), ppm, lux"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">ค่ามาตรฐาน (ถ้ามี)</label>
          <input
            type="number"
            value={shared.standardLimit}
            onChange={(e) => setShared({ ...shared, standardLimit: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">วันที่ตรวจวัด</label>
          <input
            type="date"
            value={shared.measuredAt}
            onChange={(e) => setShared({ ...shared, measuredAt: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">กำหนดตรวจรอบถัดไป</label>
          <input
            type="date"
            value={shared.nextDue}
            onChange={(e) => setShared({ ...shared, nextDue: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-500">จุดย่อยที่เข้าไปตรวจวัด</label>
          <button onClick={addPoint} className="flex items-center gap-1 text-xs text-slate-600 underline hover:text-slate-900">
            <Plus size={13} /> เพิ่มจุดย่อย
          </button>
        </div>
        <div className="space-y-2">
          {points.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <input
                value={p.label}
                onChange={(e) => updatePoint(p.id, "label", e.target.value)}
                placeholder="ชื่อจุดย่อย เช่น จุดที่ 1 ใกล้เครื่องจักร A"
                className="flex-1 min-w-[10rem] border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                value={p.value}
                onChange={(e) => updatePoint(p.id, "value", e.target.value)}
                placeholder="ค่าที่วัดได้"
                className="w-28 border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => updatePoint(p.id, "result", "pass")}
                  className={`text-xs px-2 py-1 rounded-lg border ${p.result === "pass" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "border-slate-300 text-slate-500"}`}
                >
                  ผ่าน
                </button>
                <button
                  onClick={() => updatePoint(p.id, "result", "fail")}
                  className={`text-xs px-2 py-1 rounded-lg border ${p.result === "fail" ? "bg-red-50 text-red-700 border-red-200" : "border-slate-300 text-slate-500"}`}
                >
                  ไม่ผ่าน
                </button>
              </div>
              {points.length > 1 && (
                <button onClick={() => removePoint(p.id)} className="text-xs text-slate-400 underline hover:text-red-600">
                  ลบ
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs font-bold text-slate-500 block mb-1">แผนผังตำแหน่งจุดย่อย (ถ้ามี)</label>
        <input ref={planInputRef} type="file" accept="image/*,.pdf" onChange={handlePlanFileChange} className="hidden" />
        {planFile ? (
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
            <span className="text-slate-700 truncate">{planFile.name}</span>
            <div className="flex gap-2">
              <button onClick={() => planInputRef.current?.click()} className="text-xs text-slate-500 underline">เปลี่ยนไฟล์</button>
              <button onClick={() => setPlanFile(null)} className="text-xs text-red-600 underline">ลบ</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => planInputRef.current?.click()}
            className="w-full border border-dashed border-slate-300 rounded-lg py-4 text-center text-slate-400 hover:border-slate-400 hover:text-slate-500 text-sm"
          >
            แตะเพื่อแนบไฟล์แผนผัง (รูปภาพหรือ PDF)
          </button>
        )}
      </div>

      <div className="mb-4">
        <label className="text-xs font-bold text-slate-500 block mb-1">หมายเหตุ</label>
        <textarea
          rows={2}
          value={shared.notes}
          onChange={(e) => setShared({ ...shared, notes: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-600">
          ยกเลิก
        </button>
        <button onClick={submit} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white">
          {isEditMode ? "บันทึกการแก้ไข" : "บันทึก"}
        </button>
      </div>
    </Card>
  );
}

function MeasurementRecordCard({ record, showLocationName, locationName, onEdit, onDelete, onUpdateStatus }) {
  const totalPoints = record.points?.length || 0;
  const failCount = record.failCount ?? (record.points || []).filter((p) => p.result === "fail").length;
  return (
    <Card>
      <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
        <div>
          {showLocationName && <p className="text-sm font-bold text-slate-900">{locationName}</p>}
          <p className="text-sm text-slate-700">
            {measurementTypeLabel[record.measurementType]}
            {record.standardLimit != null && <span className="text-slate-400"> · มาตรฐาน {record.standardLimit} {record.unit}</span>}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            วัดเมื่อ {formatThaiDate(record.measuredAt)}
            {record.nextDue && ` · รอบถัดไป ${formatThaiDate(record.nextDue)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalPoints === 0 ? (
            <Badge tone={record.result === "pass" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}>
              {record.result === "pass" ? "ผ่าน" : "ไม่ผ่าน"}
            </Badge>
          ) : failCount > 0 ? (
            <Badge tone="bg-red-50 text-red-700">ไม่ผ่าน {failCount}/{totalPoints} จุด</Badge>
          ) : (
            <Badge tone="bg-emerald-50 text-emerald-700">ผ่านทั้งหมด ({totalPoints} จุด)</Badge>
          )}
          {onEdit && (
            <button onClick={onEdit} className="text-xs text-slate-500 underline hover:text-slate-700">
              แก้ไข
            </button>
          )}
          {onDelete && <ConfirmDeleteButton onConfirm={onDelete} />}
        </div>
      </div>

      {totalPoints > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-left">
                <th className="px-3 py-1.5 font-medium">จุดย่อย</th>
                <th className="px-3 py-1.5 font-medium">ค่าที่วัดได้</th>
                <th className="px-3 py-1.5 font-medium">ผล</th>
              </tr>
            </thead>
            <tbody>
              {record.points.map((p, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">{p.label}</td>
                  <td className="px-3 py-1.5 text-slate-500">{p.value} {record.unit}</td>
                  <td className="px-3 py-1.5">
                    <Badge tone={p.result === "pass" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}>
                      {p.result === "pass" ? "ผ่าน" : "ไม่ผ่าน"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {record.planFileUrl && (
        <a
          href={record.planFileUrl}
          download={record.planFileName || "floor-plan"}
          className="inline-flex items-center gap-1 text-xs text-slate-500 underline hover:text-slate-700 mt-3"
        >
          📎 ดูไฟล์แผนผัง: {record.planFileName}
        </a>
      )}

      {record.notes && record.notes !== "-" && (
        <p className="text-xs text-slate-500 mt-3">หมายเหตุ: {record.notes}</p>
      )}

      {failCount > 0 && onUpdateStatus && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
          <label className="text-xs font-bold text-slate-500">สถานะการแก้ไขปัจจุบัน:</label>
          <select
            value={record.correctionStatus || "none"}
            onChange={(e) => onUpdateStatus(e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-1 text-xs"
          >
            {correctionStatusOptions.map((s) => <option key={s} value={s}>{correctionStatusLabel[s]}</option>)}
          </select>
          <Badge tone={correctionStatusTone(record.correctionStatus || "none")}>
            {correctionStatusLabel[record.correctionStatus || "none"]}
          </Badge>
        </div>
      )}
    </Card>
  );
}

function LocationDetail({ location, incidents, measurements, onBack, onUpdate, onAddMeasurement, onUpdateMeasurement, onDeleteMeasurement }) {
  const [editingAssessment, setEditingAssessment] = useState(false);
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [editingMeasurementId, setEditingMeasurementId] = useState(null);
  const photoInputRef = useRef(null);
  const [form, setForm] = useState({
    riskLevel: location.riskAssessment.riskLevel,
    findings: location.riskAssessment.findings,
    controlMeasures: location.riskAssessment.controlMeasures,
    nextDue: location.riskAssessment.nextDue,
    hazards: location.hazards,
    ppeRequired: location.ppeRequired,
  });

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onUpdate(location.id, { photoUrl: reader.result });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removePhoto = () => onUpdate(location.id, { photoUrl: null });

  // ดึงจากข้อมูลจริงในหน้าอุบัติเหตุ (ไม่ใช่ข้อมูลแยกต่างหาก) — กรองด้วยชื่อสถานที่ตรงกัน
  const locationIncidents = incidents
    .filter((i) => i.location === location.name)
    .sort((a, b) => (a.incidentDate < b.incidentDate ? 1 : -1));

  const locationMeasurements = measurements
    .filter((m) => m.locationId === location.id)
    .sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1));

  const startEdit = () => {
    setForm({
      riskLevel: location.riskAssessment.riskLevel,
      findings: location.riskAssessment.findings,
      controlMeasures: location.riskAssessment.controlMeasures,
      nextDue: location.riskAssessment.nextDue,
      hazards: location.hazards,
      ppeRequired: location.ppeRequired,
    });
    setEditingAssessment(true);
  };

  const toggleFormHazard = (h) => {
    setForm({
      ...form,
      hazards: form.hazards.includes(h) ? form.hazards.filter((x) => x !== h) : [...form.hazards, h],
    });
  };

  const toggleFormPpe = (p) => {
    setForm({
      ...form,
      ppeRequired: form.ppeRequired.includes(p) ? form.ppeRequired.filter((x) => x !== p) : [...form.ppeRequired, p],
    });
  };

  const saveEdit = () => {
    onUpdate(location.id, {
      hazards: form.hazards,
      ppeRequired: form.ppeRequired,
      riskLevel: form.riskLevel,
      // บันทึกประวัติการประเมินความเสี่ยงรอบใหม่ก็ต่อเมื่อมีกำหนดรอบถัดไปเท่านั้น (เพราะ
      // next_assessment_due เป็น NOT NULL ในตาราง) แต่ hazards/ppeRequired/riskLevel ข้างบน
      // ต้องบันทึกได้เสมอ ไม่ควรถูกกันไว้ด้วยเงื่อนไขนี้เหมือนโค้ดเดิม (นั่นคือสาเหตุที่กดบันทึก
      // แล้วดูเหมือนไม่มีอะไรเกิดขึ้นเลยถ้ายังไม่เคยกรอกกำหนดรอบถัดไปมาก่อน)
      ...(form.nextDue
        ? {
            riskAssessment: {
              riskLevel: form.riskLevel,
              findings: form.findings || "-",
              controlMeasures: form.controlMeasures || "-",
              nextDue: form.nextDue,
              updatedAt: new Date().toISOString(),
              updatedBy: "ผู้ใช้งานปัจจุบัน",
            },
          }
        : {}),
    });
    setEditingAssessment(false);
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> กลับไปทะเบียนสถานที่ทำงาน
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{location.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{location.building} · {location.description}</p>
          <p className="text-xs text-slate-400 mt-1">
            แก้ไขล่าสุด: {formatThaiDateTime(location.riskAssessment.updatedAt)} โดย {location.riskAssessment.updatedBy}
          </p>
        </div>
        <Badge tone={riskLevelTone(location.riskLevel)}>ความเสี่ยง {riskLevelLabel[location.riskLevel]}</Badge>
      </div>

      <div>
        <p className="text-sm font-bold text-slate-900 mb-3">ภาพสถานที่</p>
        <Card>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
          {location.photoUrl ? (
            <div className="space-y-3">
              <img
                src={location.photoUrl}
                alt={`ภาพสถานที่ ${location.name}`}
                className="w-full max-h-80 object-cover rounded-lg border border-slate-200"
              />
              <div className="flex justify-end gap-2">
                <button onClick={removePhoto} className="text-xs text-red-600 underline hover:text-red-700">
                  ลบภาพ
                </button>
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="text-xs text-slate-500 underline hover:text-slate-700"
                >
                  เปลี่ยนภาพ
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => photoInputRef.current?.click()}
              className="w-full border border-dashed border-slate-300 rounded-lg py-8 text-center text-slate-400 hover:border-slate-400 hover:text-slate-500"
            >
              <Camera size={22} className="mx-auto mb-2" />
              <span className="text-sm">แตะเพื่ออัปโหลดภาพสถานที่</span>
            </button>
          )}
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-slate-900">การประเมินความเสี่ยง</p>
          {!editingAssessment && (
            <button onClick={startEdit} className="text-xs text-slate-500 underline hover:text-slate-700">
              แก้ไข
            </button>
          )}
        </div>

        <Card>
          {!editingAssessment ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1.5">รูปแบบความเสี่ยงที่เกี่ยวข้อง</p>
                <div className="flex flex-wrap gap-1.5">
                  {location.hazards.length === 0 ? (
                    <span className="text-sm text-slate-400">ไม่ได้ระบุ</span>
                  ) : (
                    location.hazards.map((h) => (
                      <span key={h} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{hazardTypeLabel[h]}</span>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1.5">ประเภท PPE ที่ต้องใส่</p>
                <div className="flex flex-wrap gap-1.5">
                  {location.ppeRequired.length === 0 ? (
                    <span className="text-sm text-slate-400">ไม่ได้ระบุ</span>
                  ) : (
                    location.ppeRequired.map((p) => (
                      <span key={p} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{ppeTypeLabel[p]}</span>
                    ))
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-slate-500">ระดับความเสี่ยง</span>
                <Badge tone={riskLevelTone(location.riskAssessment.riskLevel)}>{riskLevelLabel[location.riskAssessment.riskLevel]}</Badge>
              </div>
              <p className="text-sm text-slate-700">พบ: {location.riskAssessment.findings}</p>
              <p className="text-sm text-slate-700">มาตรการควบคุม: {location.riskAssessment.controlMeasures}</p>
              <p className="text-xs text-slate-400">ประเมินรอบถัดไป: {formatThaiDate(location.riskAssessment.nextDue)}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">รูปแบบความเสี่ยงที่เกี่ยวข้อง</label>
                <div className="flex flex-wrap gap-2">
                  {hazardOptions.map((h) => (
                    <button
                      key={h}
                      onClick={() => toggleFormHazard(h)}
                      className={`text-xs px-3 py-1.5 rounded-lg border ${
                        form.hazards.includes(h) ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-500"
                      }`}
                    >
                      {hazardTypeLabel[h]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">ประเภท PPE ที่ต้องใส่</label>
                <div className="flex flex-wrap gap-2">
                  {ppeTypeOptions.map((p) => (
                    <button
                      key={p}
                      onClick={() => toggleFormPpe(p)}
                      className={`text-xs px-3 py-1.5 rounded-lg border ${
                        form.ppeRequired.includes(p) ? "bg-blue-700 text-white border-blue-700" : "border-slate-300 text-slate-500"
                      }`}
                    >
                      {ppeTypeLabel[p]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">ระดับความเสี่ยง</label>
                <div className="flex gap-2 flex-wrap">
                  {riskLevelOptions.map((r) => (
                    <button
                      key={r}
                      onClick={() => setForm({ ...form, riskLevel: r })}
                      className={`text-xs px-3 py-1.5 rounded-lg border ${
                        form.riskLevel === r ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"
                      }`}
                    >
                      {riskLevelLabel[r]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">สิ่งที่พบ</label>
                <textarea
                  rows={2}
                  value={form.findings}
                  onChange={(e) => setForm({ ...form, findings: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">มาตรการควบคุมความเสี่ยง</label>
                <textarea
                  rows={2}
                  value={form.controlMeasures}
                  onChange={(e) => setForm({ ...form, controlMeasures: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">กำหนดประเมินรอบถัดไป</label>
                <input
                  type="date"
                  value={form.nextDue}
                  onChange={(e) => setForm({ ...form, nextDue: e.target.value })}
                  className="w-full sm:w-56 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <p className="text-xs text-slate-400 mt-1">
                  ถ้าเว้นว่างไว้ ระบบจะไม่บันทึกรอบประเมินความเสี่ยงใหม่ แต่รูปแบบความเสี่ยงและ PPE ที่ต้องใส่จะบันทึกตามปกติ
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setEditingAssessment(false)} className="text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-600">
                  ยกเลิก
                </button>
                <button onClick={saveEdit} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white">
                  บันทึก
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div>
        <p className="text-sm font-bold text-slate-900 mb-3">
          ประวัติอุบัติเหตุในพื้นที่ <span className="text-xs font-normal text-slate-400">(ดึงจากทะเบียนอุบัติเหตุอัตโนมัติ)</span>
        </p>
        {locationIncidents.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-400">ยังไม่มีอุบัติเหตุที่บันทึกไว้ในสถานที่นี้</p>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-left">
                  <th className="px-4 py-2.5 font-bold">วันที่</th>
                  <th className="px-4 py-2.5 font-bold">ลักษณะ</th>
                  <th className="px-4 py-2.5 font-bold">ความรุนแรง</th>
                  <th className="px-4 py-2.5 font-bold">หยุดงาน</th>
                </tr>
              </thead>
              <tbody>
                {locationIncidents.map((inc) => (
                  <tr key={inc.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 text-slate-500">{formatThaiDate(inc.incidentDate)}</td>
                    <td className="px-4 py-2.5">{inc.type}</td>
                    <td className="px-4 py-2.5 text-slate-500">{inc.severity}</td>
                    <td className="px-4 py-2.5">
                      {incidentHasLTI(inc) ? (
                        <span className="text-red-600">{incidentTotalLostWorkdays(inc)} วัน (LTI)</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
        )}
        <p className="text-xs text-slate-400 mt-2">ดูรายละเอียด/แก้ไขแต่ละรายการได้ที่หน้า "อุบัติเหตุ"</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-slate-900">ผลการตรวจวัดสิ่งแวดล้อม</p>
          <button
            onClick={() => setShowMeasurementForm(true)}
            className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-800"
          >
            <Plus size={16} /> บันทึกผลตรวจวัด
          </button>
        </div>

        {showMeasurementForm && (
          <MeasurementSubForm
            onCancel={() => setShowMeasurementForm(false)}
            onSubmit={(data) => {
              onAddMeasurement({ id: Date.now(), locationId: location.id, ...data });
              setShowMeasurementForm(false);
            }}
          />
        )}

        {editingMeasurementId != null && (
          <MeasurementSubForm
            initialRecord={locationMeasurements.find((m) => m.id === editingMeasurementId)}
            onCancel={() => setEditingMeasurementId(null)}
            onSubmit={(data) => {
              onUpdateMeasurement(editingMeasurementId, data);
              setEditingMeasurementId(null);
            }}
          />
        )}

        {locationMeasurements.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-400">ยังไม่มีผลตรวจวัดสิ่งแวดล้อมของสถานที่นี้</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {locationMeasurements.map((m) => (
              <MeasurementRecordCard
                key={m.id}
                record={m}
                onEdit={() => setEditingMeasurementId(m.id)}
                onDelete={() => onDeleteMeasurement(m.id)}
                onUpdateStatus={(status) => onUpdateMeasurement(m.id, { correctionStatus: status })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LocationsPage({ locations, incidents, measurements, onAdd, onUpdate, onDelete, onAddMeasurement, onUpdateMeasurement, onDeleteMeasurement }) {
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", building: "", description: "", riskLevel: "low", hazards: [], ppeRequired: [] });

  const selected = locations.find((l) => l.id === selectedId);
  if (selected) {
    return (
      <LocationDetail
        location={selected}
        incidents={incidents}
        measurements={measurements}
        onBack={() => setSelectedId(null)}
        onUpdate={onUpdate}
        onAddMeasurement={onAddMeasurement}
        onUpdateMeasurement={onUpdateMeasurement}
        onDeleteMeasurement={onDeleteMeasurement}
      />
    );
  }

  const toggleFormHazard = (h) => {
    setForm({
      ...form,
      hazards: form.hazards.includes(h) ? form.hazards.filter((x) => x !== h) : [...form.hazards, h],
    });
  };

  const toggleFormPpe = (p) => {
    setForm({
      ...form,
      ppeRequired: form.ppeRequired.includes(p) ? form.ppeRequired.filter((x) => x !== p) : [...form.ppeRequired, p],
    });
  };

  const submit = () => {
    if (!form.name.trim()) return;
    onAdd({
      id: Date.now(),
      name: form.name,
      building: form.building || "-",
      description: form.description || "-",
      riskLevel: form.riskLevel,
      hazards: form.hazards,
      ppeRequired: form.ppeRequired,
      riskAssessment: {
        riskLevel: form.riskLevel, findings: "-", controlMeasures: "-", nextDue: "",
        updatedAt: new Date().toISOString(), updatedBy: "ผู้ใช้งานปัจจุบัน",
      },
    });
    setForm({ name: "", building: "", description: "", riskLevel: "low", hazards: [], ppeRequired: [] });
    setShowForm(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">ทะเบียนสถานที่ทำงาน</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-800"
        >
          <Plus size={16} /> เพิ่มสถานที่
        </button>
      </div>

      {showForm && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-900">เพิ่มสถานที่ทำงานใหม่</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">ชื่อสถานที่</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น คลังสินค้า B ชั้น 1"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">อาคาร/โซน</label>
              <input
                value={form.building}
                onChange={(e) => setForm({ ...form, building: e.target.value })}
                placeholder="เช่น อาคาร B"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs font-bold text-slate-500 block mb-1">คำอธิบาย</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="อธิบายลักษณะงาน/พื้นที่โดยย่อ"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
          <div className="mb-3">
            <label className="text-xs font-bold text-slate-500 block mb-1">ระดับความเสี่ยงเริ่มต้น</label>
            <div className="flex gap-2 flex-wrap">
              {riskLevelOptions.map((r) => (
                <button
                  key={r}
                  onClick={() => setForm({ ...form, riskLevel: r })}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${
                    form.riskLevel === r ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"
                  }`}
                >
                  {riskLevelLabel[r]}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs font-bold text-slate-500 block mb-1">รูปแบบความเสี่ยงที่เกี่ยวข้อง</label>
            <div className="flex flex-wrap gap-2">
              {hazardOptions.map((h) => (
                <button
                  key={h}
                  onClick={() => toggleFormHazard(h)}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${
                    form.hazards.includes(h) ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-500"
                  }`}
                >
                  {hazardTypeLabel[h]}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs font-bold text-slate-500 block mb-1">ประเภท PPE ที่ต้องใส่</label>
            <div className="flex flex-wrap gap-2">
              {ppeTypeOptions.map((p) => (
                <button
                  key={p}
                  onClick={() => toggleFormPpe(p)}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${
                    form.ppeRequired.includes(p) ? "bg-blue-700 text-white border-blue-700" : "border-slate-300 text-slate-500"
                  }`}
                >
                  {ppeTypeLabel[p]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-600">
              ยกเลิก
            </button>
            <button onClick={submit} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white">
              บันทึก
            </button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-2.5 font-bold">ชื่อสถานที่</th>
              <th className="px-4 py-2.5 font-bold">อาคาร/โซน</th>
              <th className="px-4 py-2.5 font-bold">รูปแบบความเสี่ยง</th>
              <th className="px-4 py-2.5 font-bold">PPE ที่ต้องใส่</th>
              <th className="px-4 py-2.5 font-bold">ระดับความเสี่ยง</th>
              <th className="px-4 py-2.5 font-bold">ผลตรวจวัดสิ่งแวดล้อม</th>
              <th className="px-4 py-2.5"></th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {locations.map((l) => {
              const locationMeasurements = measurements.filter((m) => m.locationId === l.id);
              const failCount = locationMeasurements.filter((m) => m.result === "fail").length;
              return (
                <tr
                  key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-2.5">{l.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{l.building}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {l.hazards.map((h) => (
                        <span key={h} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{hazardTypeLabel[h]}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {l.ppeRequired.map((p) => (
                        <span key={p} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{ppeTypeLabel[p]}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><Badge tone={riskLevelTone(l.riskLevel)}>{riskLevelLabel[l.riskLevel]}</Badge></td>
                  <td className="px-4 py-2.5">
                    {locationMeasurements.length === 0 ? (
                      <span className="text-slate-400">ยังไม่มีข้อมูล</span>
                    ) : failCount > 0 ? (
                      <Badge tone="bg-red-50 text-red-700">ไม่ผ่าน {failCount} รายการ</Badge>
                    ) : (
                      <Badge tone="bg-emerald-50 text-emerald-700">ผ่านทั้งหมด ({locationMeasurements.length})</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-300"><ChevronRight size={16} /></td>
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <ConfirmDeleteButton onConfirm={() => onDelete(l.id)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
// Environmental monitoring — บันทึกผลตรวจวัดสิ่งแวดล้อม ผูกกับสถานที่
// ---------------------------------------------------------------

function EnvironmentalMonitoringPage({ locations, measurements, onAdd, onUpdateMeasurement, onDeleteMeasurement }) {
  const [showForm, setShowForm] = useState(false);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [editingId, setEditingId] = useState(null);

  const locationName = (id) => locations.find((l) => l.id === id)?.name ?? "-";

  // จัดกลุ่มตามประเภทการตรวจวัดก่อน แล้วค่อยแยกตามสถานที่ภายในแต่ละประเภท
  const grouped = {};
  measurements.forEach((m) => {
    if (!grouped[m.measurementType]) grouped[m.measurementType] = {};
    if (!grouped[m.measurementType][m.locationId]) grouped[m.measurementType][m.locationId] = [];
    grouped[m.measurementType][m.locationId].push(m);
  });
  const typesPresent = measurementTypeOptions.filter((t) => grouped[t]);

  const editingRecord = editingId != null ? measurements.find((m) => m.id === editingId) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">บันทึกผลการตรวจวัดสิ่งแวดล้อม</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-800"
        >
          <Plus size={16} /> บันทึกผลตรวจวัด
        </button>
      </div>

      {showForm && (
        <div className="space-y-3">
          <div className="max-w-2xl">
            <label className="text-xs font-bold text-slate-500 block mb-1">สถานที่</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full sm:w-72 border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <MeasurementSubForm
            onCancel={() => setShowForm(false)}
            onSubmit={(data) => {
              onAdd({ id: Date.now(), locationId: locationId, ...data });
              setShowForm(false);
            }}
          />
        </div>
      )}

      {editingRecord && (
        <MeasurementSubForm
          initialRecord={editingRecord}
          onCancel={() => setEditingId(null)}
          onSubmit={(data) => {
            onUpdateMeasurement(editingId, data);
            setEditingId(null);
          }}
        />
      )}

      {typesPresent.length === 0 ? (
        <Card><p className="text-sm text-slate-400">ยังไม่มีผลตรวจวัด</p></Card>
      ) : (
        <div className="space-y-6">
          {typesPresent.map((type) => (
            <div key={type}>
              <p className="text-sm font-bold text-slate-900 mb-3">หมวด: {measurementTypeLabel[type]}</p>
              <div className="space-y-4 pl-3 border-l-2 border-slate-100">
                {Object.keys(grouped[type]).map((locId) => {
                  const records = [...grouped[type][locId]].sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1));
                  return (
                    <div key={locId}>
                      <p className="text-base font-bold text-slate-800 mb-2">สถานที่: {locationName(locId)}</p>
                      <div className="space-y-3">
                        {records.map((m) => (
                          <MeasurementRecordCard
                            key={m.id}
                            record={m}
                            onEdit={() => setEditingId(m.id)}
                            onDelete={() => onDeleteMeasurement(m.id)}
                            onUpdateStatus={(status) => onUpdateMeasurement(m.id, { correctionStatus: status })}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Training Matrix — หลักสูตรตามตำแหน่งงาน/ความเสี่ยง + สถานะการอบรมของพนักงาน
// ---------------------------------------------------------------

function TrainingMatrixPage({ employees, locations, courses, requirements, records, onAddRequirement, onRemoveRequirement, onUpsertRecord, onDeleteRecord }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ position: "", hazardType: "", courseId: courses[0]?.id ?? "" });
  const [editingCell, setEditingCell] = useState(null); // { employeeId, courseId } | null
  const [recordForm, setRecordForm] = useState({ completionDate: todayIso(), expiryDate: "" });
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [activeTab, setActiveTab] = useState("status"); // "status" | "requirements"
  const positions = [...new Set(employees.map((e) => e.position))];

  const submit = () => {
    if (!form.position && !form.hazardType) return; // ต้องมีอย่างน้อย 1 อย่าง
    if (!form.courseId) return; // กันไว้กรณียังไม่มีหลักสูตรในระบบให้เลือกเลย (dropdown ว่าง)
    onAddRequirement({
      id: Date.now(),
      position: form.position || null,
      hazardType: form.hazardType || null,
      courseId: form.courseId,
    });
    setForm({ position: "", hazardType: "", courseId: courses[0]?.id ?? "" });
    setShowForm(false);
  };

  const courseName = (id) => courses.find((c) => c.id === id)?.name ?? "-";

  // พนักงานทุกคนที่ต้องอบรมหลักสูตรนี้ (ทั้งจาก training_requirements ปกติ และจากบทบาท
  // จป./คปอ. ที่ผูกอัตโนมัติ) — ใช้สร้างทั้งตารางสรุปและหน้ารายละเอียดรายหลักสูตร
  const employeesRequiringCourse = (courseId) =>
    employees.filter((emp) => getRequiredCourseIds(emp, locations, requirements, courses).includes(courseId));

  const lastCompletionDate = (employeeId, courseId) => {
    const recs = records.filter((r) => r.employeeId === employeeId && r.courseId === courseId && r.completionDate);
    if (recs.length === 0) return null;
    return recs.reduce((latest, r) => (r.completionDate > latest ? r.completionDate : latest), recs[0].completionDate);
  };

  // สรุปทุกหลักสูตรที่มีพนักงานอย่างน้อย 1 คนต้องอบรม เรียงหลักสูตรที่มีคนยังไม่ผ่านมากสุดไว้บนสุด
  const courseSummaries = courses
    .map((c) => {
      const requiredEmployees = employeesRequiringCourse(c.id);
      const notPassedEmployees = requiredEmployees.filter((emp) => {
        const status = getTrainingComplianceStatus(emp.id, c.id, records);
        return status === "missing" || status === "expired";
      });
      return { course: c, requiredEmployees, notPassedCount: notPassedEmployees.length };
    })
    .filter((s) => s.requiredEmployees.length > 0)
    .sort((a, b) => b.notPassedCount - a.notPassedCount);

  const startEditRecord = (employeeId, courseId) => {
    const existing = records.find((r) => r.employeeId === employeeId && r.courseId === courseId);
    setRecordForm({
      completionDate: existing?.completionDate || todayIso(),
      expiryDate: existing?.expiryDate || "",
    });
    setEditingCell({ employeeId, courseId });
  };

  const saveRecord = () => {
    onUpsertRecord(editingCell.employeeId, editingCell.courseId, {
      completionDate: recordForm.completionDate,
      expiryDate: recordForm.expiryDate || null,
    });
    setEditingCell(null);
  };

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-slate-900">Training Matrix</h1>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("status")}
          className={`text-sm px-3 py-2 -mb-px border-b-2 ${
            activeTab === "status" ? "border-slate-900 font-bold text-slate-900" : "border-transparent text-slate-500"
          }`}
        >
          สถานะการอบรม
        </button>
        <button
          onClick={() => { setActiveTab("requirements"); setSelectedCourseId(null); }}
          className={`text-sm px-3 py-2 -mb-px border-b-2 ${
            activeTab === "requirements" ? "border-slate-900 font-bold text-slate-900" : "border-transparent text-slate-500"
          }`}
        >
          ตารางกำหนดหลักสูตร
        </button>
      </div>

      {activeTab === "requirements" && (
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-slate-900">ตารางกำหนดหลักสูตรตามตำแหน่ง/ความเสี่ยง</p>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-800"
          >
            <Plus size={16} /> เพิ่ม requirement
          </button>
        </div>

        {showForm && (
          <Card className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-slate-900">เพิ่ม requirement ใหม่</p>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">ระบุตำแหน่งงาน และ/หรือ ความเสี่ยง อย่างน้อย 1 อย่าง</p>
            <div className="grid sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">ตำแหน่งงาน (ไม่บังคับ)</label>
                <select
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">ทุกตำแหน่ง</option>
                  {positions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">ความเสี่ยง (ไม่บังคับ)</label>
                <select
                  value={form.hazardType}
                  onChange={(e) => setForm({ ...form, hazardType: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">ทุกความเสี่ยง</option>
                  {hazardOptions.map((h) => <option key={h} value={h}>{hazardTypeLabel[h]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">หลักสูตรที่ต้องอบรม</label>
                {courses.length === 0 ? (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    ยังไม่มีหลักสูตรในระบบ กรุณาติดต่อผู้ดูแลระบบให้เพิ่มหลักสูตรก่อน
                  </p>
                ) : (
                  <select
                    value={form.courseId}
                    onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-600">
                ยกเลิก
              </button>
              <button onClick={submit} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white">
                บันทึก
              </button>
            </div>
          </Card>
        )}

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-left">
                  <th className="px-4 py-2.5 font-bold">ตำแหน่งงาน</th>
                  <th className="px-4 py-2.5 font-bold">ความเสี่ยง</th>
                  <th className="px-4 py-2.5 font-bold">หลักสูตรที่ต้องอบรม</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {requirements.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5">{r.position ?? <span className="text-slate-400">ทุกตำแหน่ง</span>}</td>
                    <td className="px-4 py-2.5 text-slate-500">{r.hazardType ? hazardTypeLabel[r.hazardType] : <span className="text-slate-400">ทุกความเสี่ยง</span>}</td>
                    <td className="px-4 py-2.5">{courseName(r.courseId)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => onRemoveRequirement(r.id)} className="text-xs text-slate-400 underline hover:text-red-600">
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      )}

      {activeTab === "status" && (
      <>
      {selectedCourseId == null ? (
        <div>
          <p className="text-sm font-bold text-slate-900 mb-3">สถานะการอบรมตามหลักสูตร</p>
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left">
                    <th className="px-4 py-2.5 font-bold">หลักสูตรที่ต้องฝึกอบรม</th>
                    <th className="px-4 py-2.5 font-bold">จำนวนพนักงานที่ต้องอบรม</th>
                    <th className="px-4 py-2.5 font-bold">จำนวนพนักงานที่ยังไม่ผ่าน</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {courseSummaries.map(({ course, requiredEmployees, notPassedCount }) => (
                    <tr
                      key={course.id}
                      onClick={() => setSelectedCourseId(course.id)}
                      className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                    >
                      <td className="px-4 py-2.5 font-bold text-slate-900">{course.name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{requiredEmployees.length} คน</td>
                      <td className="px-4 py-2.5">
                        {notPassedCount > 0 ? (
                          <Badge tone="bg-red-50 text-red-700">{notPassedCount} คน</Badge>
                        ) : (
                          <Badge tone="bg-emerald-50 text-emerald-700">ผ่านครบทุกคน</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-300"><ChevronRight size={16} /></td>
                    </tr>
                  ))}
                  {courseSummaries.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm text-slate-400">ยังไม่มีพนักงานคนใดต้องอบรมหลักสูตรใดเลย</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        (() => {
          const summary = courseSummaries.find((s) => s.course.id === selectedCourseId) || {
            course: courses.find((c) => c.id === selectedCourseId),
            requiredEmployees: employeesRequiringCourse(selectedCourseId),
          };
          const notPassed = summary.requiredEmployees.filter((emp) => {
            const status = getTrainingComplianceStatus(emp.id, selectedCourseId, records);
            return status === "missing" || status === "expired";
          });
          const passed = summary.requiredEmployees.filter((emp) => !notPassed.includes(emp));

          const renderEmployeeRow = (emp) => {
            const status = getTrainingComplianceStatus(emp.id, selectedCourseId, records);
            const isEditingThis = editingCell?.employeeId === emp.id && editingCell?.courseId === selectedCourseId;
            const hasRecord = records.some((r) => r.employeeId === emp.id && r.courseId === selectedCourseId);
            const lastDate = lastCompletionDate(emp.id, selectedCourseId);
            if (isEditingThis) {
              return (
                <div key={emp.id} className="bg-slate-50 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-bold text-slate-800">{emp.name}</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-0.5">วันที่อบรมผ่าน</label>
                      <input
                        type="date"
                        value={recordForm.completionDate}
                        onChange={(e) => setRecordForm({ ...recordForm, completionDate: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-0.5">วันหมดอายุ (ถ้ามี)</label>
                      <input
                        type="date"
                        value={recordForm.expiryDate}
                        onChange={(e) => setRecordForm({ ...recordForm, expiryDate: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button onClick={() => setEditingCell(null)} className="text-xs text-slate-500 underline">ยกเลิก</button>
                    {hasRecord && (
                      <button
                        onClick={() => {
                          onDeleteRecord(emp.id, selectedCourseId);
                          setEditingCell(null);
                        }}
                        className="text-xs text-red-600 underline"
                      >
                        ลบผลอบรม
                      </button>
                    )}
                    <button onClick={saveRecord} className="text-xs bg-slate-900 text-white px-2 py-1 rounded-lg">บันทึก</button>
                  </div>
                </div>
              );
            }
            return (
              <div key={emp.id} className="flex items-center justify-between gap-2 px-1 py-2 border-t border-slate-100 first:border-t-0">
                <div>
                  <p className="text-sm font-bold text-slate-900">{emp.name}</p>
                  <p className="text-xs text-slate-500">
                    {emp.position} · {emp.department}
                    {lastDate && <> · อบรมล่าสุด {formatThaiDate(lastDate)}</>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge tone={trainingStatusTone(status)}>{trainingStatusLabel[status]}</Badge>
                  <button
                    onClick={() => startEditRecord(emp.id, selectedCourseId)}
                    className="text-xs bg-slate-900 text-white px-2.5 py-1.5 rounded-lg"
                  >
                    อัปเดต
                  </button>
                </div>
              </div>
            );
          };

          return (
            <div className="space-y-4">
              <button
                onClick={() => { setSelectedCourseId(null); setEditingCell(null); }}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
              >
                <ArrowLeft size={16} /> กลับไปสรุปตามหลักสูตร
              </button>
              <h2 className="text-base font-bold text-slate-900">{summary.course?.name ?? "-"}</h2>

              <div>
                <p className="text-sm font-bold text-red-700 mb-2">ยังไม่ผ่าน ({notPassed.length} คน)</p>
                <Card className="p-3">
                  {notPassed.length === 0 ? (
                    <p className="text-sm text-slate-400 px-1">ผ่านครบทุกคนแล้ว</p>
                  ) : (
                    <div>{notPassed.map(renderEmployeeRow)}</div>
                  )}
                </Card>
              </div>

              <div>
                <p className="text-sm font-bold text-emerald-700 mb-2">ผ่านแล้ว ({passed.length} คน)</p>
                <Card className="p-3">
                  {passed.length === 0 ? (
                    <p className="text-sm text-slate-400 px-1">ยังไม่มีใครผ่าน</p>
                  ) : (
                    <div>{passed.map(renderEmployeeRow)}</div>
                  )}
                </Card>
              </div>
            </div>
          );
        })()
      )}
      </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Auth: Login / Register / Pending approvals
// ---------------------------------------------------------------

function LoginPage({ onLogin, onGoToRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return;
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setLoading(false);
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      return;
    }

    const profile = await fetchUserProfile(data.user.id);
    setLoading(false);

    if (!profile) {
      setError("ไม่พบข้อมูลผู้ใช้งานนี้ในระบบ กรุณาติดต่อผู้ดูแลระบบ");
      await supabase.auth.signOut();
      return;
    }
    if (profile.status === "pending") {
      setError("บัญชีนี้กำลังรอการอนุมัติจากผู้ดูแลระบบ");
      await supabase.auth.signOut();
      return;
    }
    if (profile.status === "rejected") {
      setError("บัญชีนี้ถูกปฏิเสธการเข้าใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
      await supabase.auth.signOut();
      return;
    }
    onLogin(profile);
  };

  return (
    <div className="min-h-[600px] flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm">
        <p className="text-lg font-bold text-slate-900 mb-1">เข้าสู่ระบบ JorPor</p>
        <p className="text-sm text-slate-500 mb-5">ระบบช่วยงาน จป.</p>
        {error && <div className="text-sm bg-red-50 text-red-700 px-3 py-2 rounded-lg mb-3">{error}</div>}
        <div className="mb-3">
          <label className="text-xs font-bold text-slate-500 block mb-1">อีเมล</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="mb-4">
          <label className="text-xs font-bold text-slate-500 block mb-1">รหัสผ่าน</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={submit}
          disabled={loading}
          className="w-full text-sm bg-slate-900 text-white px-3 py-2 rounded-lg mb-3 disabled:opacity-50"
        >
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
        <p className="text-xs text-slate-500 text-center">
          ยังไม่มีบัญชี? <button onClick={onGoToRegister} className="underline text-slate-700">สมัครใช้งาน</button>
        </p>
      </Card>
    </div>
  );
}

function RegisterPage({ onGoToLogin }) {
  const [form, setForm] = useState({ name: "", companyName: "", email: "", password: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.name.trim() || !form.companyName.trim() || !form.email.trim() || !form.password) return;
    if (form.password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    setError(null);
    setLoading(true);

    // metadata นี้จะถูกอ่านโดย trigger ฝั่งฐานข้อมูล (handle_new_auth_user) เพื่อ
    // สร้างบริษัทใหม่ + ผูกแพ็กเกจ Free + สร้างแถวผู้ใช้สถานะ pending ให้อัตโนมัติ
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.name, company_name: form.companyName },
      },
    });

    setLoading(false);
    if (signUpError) {
      if (signUpError.message === "User already registered") {
        setError("อีเมลนี้มีบัญชีอยู่แล้วในระบบ");
      } else if (signUpError.status === 429 || /rate limit/i.test(signUpError.message || "")) {
        // Supabase มีโควตาส่งอีเมลยืนยันตัวตนแบบใช้ร่วมกัน (เฉพาะช่วงทดสอบ/ยังไม่ได้ต่อ
        // SMTP ของตัวเอง) ถ้าสมัครถี่เกินไปจะติดโควตานี้ ไม่ใช่ปัญหาที่ตัวระบบ
        setError("ขณะนี้มีผู้สมัครใช้งานถี่เกินไป กรุณาลองใหม่อีกครั้งในอีกสักครู่");
      } else {
        setError("สมัครไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-[600px] flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-sm text-center">
          <p className="text-lg font-bold text-slate-900 mb-2">สมัครสำเร็จ</p>
          <p className="text-sm text-slate-600 mb-5">
            บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ จะเข้าสู่ระบบได้หลังได้รับการอนุมัติแล้ว
            (เริ่มต้นด้วยแพ็กเกจ Free) — ถ้าระบบยืนยันอีเมลไว้ อย่าลืมเช็กอีเมลเพื่อยืนยันตัวตนก่อนด้วย
          </p>
          <button onClick={onGoToLogin} className="text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-700">
            กลับไปหน้าเข้าสู่ระบบ
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[600px] flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm">
        <p className="text-lg font-bold text-slate-900 mb-1">สมัครใช้งาน</p>
        <p className="text-sm text-slate-500 mb-5">
          1 บัญชี ต่อ 1 บริษัท — ข้อมูลของแต่ละบริษัทแยกจากกันโดยสมบูรณ์ ต้องได้รับการอนุมัติจาก
          ผู้ดูแลระบบก่อนจึงจะเข้าใช้งานได้
        </p>
        {error && <div className="text-sm bg-red-50 text-red-700 px-3 py-2 rounded-lg mb-3">{error}</div>}
        <div className="mb-3">
          <label className="text-xs font-bold text-slate-500 block mb-1">ชื่อ-สกุลผู้ดูแลระบบของบริษัท (จป.)</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="mb-3">
          <label className="text-xs font-bold text-slate-500 block mb-1">ชื่อบริษัท</label>
          <input
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            placeholder="เช่น บริษัท ตัวอย่าง จำกัด"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="mb-3">
          <label className="text-xs font-bold text-slate-500 block mb-1">อีเมล</label>
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="mb-4">
          <label className="text-xs font-bold text-slate-500 block mb-1">รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={submit}
          disabled={loading}
          className="w-full text-sm bg-slate-900 text-white px-3 py-2 rounded-lg mb-3 disabled:opacity-50"
        >
          {loading ? "กำลังสมัคร..." : "สมัครใช้งาน"}
        </button>
        <p className="text-xs text-slate-500 text-center">
          มีบัญชีแล้ว? <button onClick={onGoToLogin} className="underline text-slate-700">เข้าสู่ระบบ</button>
        </p>
      </Card>
    </div>
  );
}

function UserDetail({ user, tierPermissions, onBack, onApprove, onReject, onUpdateUser, onGoToRoleManagement }) {
  const [userType, setUserType] = useState(user.userType);

  const save = () => {
    onUpdateUser(user.id, { userType });
  };

  const statusTone2 = user.status === "approved" ? "bg-emerald-50 text-emerald-700" : user.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  const statusLabel = user.status === "approved" ? "อนุมัติแล้ว" : user.status === "pending" ? "รอการอนุมัติ" : "ถูกปฏิเสธ";
  const currentTierPages = tierPermissions?.[userType] || [];

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> กลับไปรายชื่อผู้ใช้งาน
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{user.companyName}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{user.name} · {user.email}</p>
          <p className="text-xs text-slate-400 mt-1">สมัครเมื่อ {formatThaiDate(user.registeredAt)}</p>
        </div>
        <Badge tone={statusTone2}>{statusLabel}</Badge>
      </div>

      {user.status === "pending" && (
        <Card className="flex items-center justify-between">
          <p className="text-sm text-slate-700">คำขอนี้ยังไม่ได้รับการพิจารณา</p>
          <div className="flex gap-2">
            <button onClick={() => onReject(user.id)} className="text-sm px-3 py-2 rounded-lg border border-red-200 text-red-600">
              ปฏิเสธ
            </button>
            <button onClick={() => onApprove(user.id)} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white">
              อนุมัติ
            </button>
          </div>
        </Card>
      )}

      <Card>
        <p className="text-sm font-bold text-slate-900 mb-3">แพ็กเกจของบริษัทนี้</p>
        <select
          value={userType}
          onChange={(e) => setUserType(e.target.value)}
          className="w-full sm:w-1/2 border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
        >
          {userTypeOptions.map((t) => <option key={t} value={t}>{userTypeLabel[t]}</option>)}
        </select>

        <div className="bg-slate-50 rounded-lg p-3 mb-4">
          <p className="text-xs text-slate-500 mb-1.5">สิทธิ์การเข้าถึงหน้าของแพ็กเกจนี้ (กำหนดที่หน้า "จัดการประเภทผู้ใช้งาน")</p>
          {currentTierPages.length === 0 ? (
            <p className="text-sm text-slate-400">ไม่มีสิทธิ์เข้าถึงหน้าปฏิบัติงานใดๆ</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {currentTierPages.map((key) => (
                <span key={key} className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded">
                  {PAGE_OPTIONS.find((p) => p.key === key)?.label ?? key}
                </span>
              ))}
            </div>
          )}
          <button onClick={onGoToRoleManagement} className="text-xs text-slate-500 underline hover:text-slate-700 mt-2">
            ไปแก้ไขสิทธิ์ของแพ็กเกจนี้
          </button>
        </div>

        <div className="flex justify-end">
          <button onClick={save} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white">
            บันทึกแพ็กเกจ
          </button>
        </div>
      </Card>
    </div>
  );
}

function AdminUserManagementPage({ users, tierPermissions, onApprove, onReject, onUpdateUser, onGoToRoleManagement }) {
  const [selectedId, setSelectedId] = useState(null);
  const selected = users.find((u) => u.id === selectedId);

  if (selected) {
    return (
      <UserDetail
        user={selected}
        tierPermissions={tierPermissions}
        onBack={() => setSelectedId(null)}
        onApprove={onApprove}
        onReject={onReject}
        onUpdateUser={onUpdateUser}
        onGoToRoleManagement={onGoToRoleManagement}
      />
    );
  }

  const statusBadge = (status) => {
    if (status === "approved") return <Badge tone="bg-emerald-50 text-emerald-700">อนุมัติแล้ว</Badge>;
    if (status === "pending") return <Badge tone="bg-amber-50 text-amber-700">รอการอนุมัติ</Badge>;
    return <Badge tone="bg-red-50 text-red-700">ถูกปฏิเสธ</Badge>;
  };

  const pendingUsers = users.filter((u) => u.status === "pending");

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-slate-900">จัดการผู้ใช้งาน</h1>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-sm font-bold text-slate-900">คำขอที่รอการอนุมัติ</p>
          {pendingUsers.length > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{pendingUsers.length}</span>
          )}
        </div>
        {pendingUsers.length === 0 ? (
          <Card><p className="text-sm text-slate-400">ไม่มีคำขอที่รอการอนุมัติในขณะนี้</p></Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-amber-50 text-amber-700 text-left">
                    <th className="px-4 py-2.5 font-bold">บริษัท</th>
                    <th className="px-4 py-2.5 font-bold">ผู้ติดต่อ</th>
                    <th className="px-4 py-2.5 font-bold">อีเมล</th>
                    <th className="px-4 py-2.5 font-bold">วันที่สมัคร</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map((u) => (
                    <tr key={u.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5">{u.companyName}</td>
                      <td className="px-4 py-2.5 text-slate-500">{u.name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{u.email}</td>
                      <td className="px-4 py-2.5 text-slate-500">{formatThaiDate(u.registeredAt)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => onReject(u.id)} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600">
                            ปฏิเสธ
                          </button>
                          <button onClick={() => onApprove(u.id)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white">
                            อนุมัติ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <div>
        <p className="text-sm font-bold text-slate-900 mb-3">ผู้ใช้งานทั้งหมด</p>
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-left">
                <th className="px-4 py-2.5 font-bold">บริษัท</th>
                <th className="px-4 py-2.5 font-bold">ผู้ติดต่อ</th>
                <th className="px-4 py-2.5 font-bold">อีเมล</th>
                <th className="px-4 py-2.5 font-bold">วันที่สมัคร</th>
                <th className="px-4 py-2.5 font-bold">แพ็กเกจ</th>
                <th className="px-4 py-2.5 font-bold">สถานะ</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelectedId(u.id)}
                  className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-2.5">{u.companyName}</td>
                  <td className="px-4 py-2.5 text-slate-500">{u.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{u.email}</td>
                  <td className="px-4 py-2.5 text-slate-500">{formatThaiDate(u.registeredAt)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{userTypeLabel[u.userType] ?? "-"}</td>
                  <td className="px-4 py-2.5">{statusBadge(u.status)}</td>
                  <td className="px-4 py-2.5 text-slate-300"><ChevronRight size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      </div>
    </div>
  );
}

function RoleManagementPage({ tierPermissions, tierLimits, onUpdateTierPermissions, onUpdateTierLimits }) {
  const [selectedTier, setSelectedTier] = useState(null);
  const [pages, setPages] = useState([]);
  const [maxEmployees, setMaxEmployees] = useState("");

  const startEdit = (tier) => {
    setSelectedTier(tier);
    setPages([...(tierPermissions[tier] || [])]);
    setMaxEmployees(tierLimits[tier]?.maxEmployees != null ? String(tierLimits[tier].maxEmployees) : "");
  };

  const togglePage = (key) => {
    setPages(pages.includes(key) ? pages.filter((k) => k !== key) : [...pages, key]);
  };

  const save = () => {
    onUpdateTierPermissions(selectedTier, pages);
    onUpdateTierLimits(selectedTier, { maxEmployees: maxEmployees.trim() === "" ? null : Number(maxEmployees) });
    setSelectedTier(null);
  };

  if (selectedTier) {
    return (
      <div className="space-y-5">
        <button onClick={() => setSelectedTier(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> กลับไปรายการประเภทผู้ใช้งาน
        </button>
        <h1 className="text-lg font-bold text-slate-900">แก้ไขสิทธิ์: {userTypeLabel[selectedTier]}</h1>

        <Card>
          <p className="text-sm font-bold text-slate-900 mb-1">สิทธิ์การเข้าถึงแต่ละหน้า</p>
          <p className="text-xs text-slate-400 mb-3">
            บริษัทที่ใช้แพ็กเกจนี้จะเห็นเมนูตามที่เลือกไว้นี้เหมือนกันทั้งหมด
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {PAGE_OPTIONS.map((p) => (
              <label key={p.key} className="flex items-center gap-2 text-sm text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pages.includes(p.key)}
                  onChange={() => togglePage(p.key)}
                  className="rounded border-slate-300"
                />
                {p.label}
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <p className="text-sm font-bold text-slate-900 mb-1">ข้อจำกัดการบันทึกข้อมูล</p>
          <p className="text-xs text-slate-400 mb-3">เว้นว่างไว้ = ไม่จำกัดจำนวน</p>
          <label className="text-xs font-bold text-slate-500 block mb-1">จำนวนพนักงานสูงสุดที่บันทึกได้</label>
          <input
            type="number"
            min="0"
            value={maxEmployees}
            onChange={(e) => setMaxEmployees(e.target.value)}
            placeholder="ไม่จำกัด"
            className="w-full sm:w-56 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </Card>

        <div className="flex justify-end">
          <button onClick={save} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white">
            บันทึกสิทธิ์และข้อจำกัดของแพ็กเกจนี้
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-slate-900">จัดการประเภทผู้ใช้งาน</h1>
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-left">
                <th className="px-4 py-2.5 font-bold">แพ็กเกจ</th>
                <th className="px-4 py-2.5 font-bold">จำนวนหน้าที่เข้าถึงได้</th>
                <th className="px-4 py-2.5 font-bold">พนักงานสูงสุด</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {userTypeOptions.map((t) => (
                <tr key={t} className="border-t border-slate-100">
                  <td className="px-4 py-2.5">{userTypeLabel[t]}</td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {(tierPermissions[t] || []).length} / {PAGE_OPTIONS.length} หน้า
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {tierLimits[t]?.maxEmployees != null ? `${tierLimits[t].maxEmployees} คน` : "ไม่จำกัด"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => startEdit(t)} className="text-xs text-slate-500 underline hover:text-slate-700">
                      แก้ไขสิทธิ์
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
// Multi-tenant data isolation — แต่ละ user (บริษัท) มีชุดข้อมูลของตัวเองแยกกันสมบูรณ์
// ---------------------------------------------------------------

// ข้อมูลตัวอย่างของบริษัทที่สอง (วรรณา / XYZ) — ตั้งใจให้มีน้อยและต่างจากบริษัทแรกชัดเจน
// เพื่อพิสูจน์ว่าข้อมูลแยกกันจริง ไม่ปนกัน
const initialEmployeesXyz = [
  { id: 101, code: "XYZ-001", name: "กมล สุขใจ", position: "พนักงานขับรถ", department: "โลจิสติกส์", primaryLocationId: 201 },
  { id: 102, code: "XYZ-002", name: "แดง ใจงาม", position: "พนักงานทั่วไป", department: "คลังสินค้า", primaryLocationId: 201 },
];

const initialLocationsXyz = [
  {
    id: 201, name: "โกดังสินค้า XYZ", building: "อาคารเดียว",
    description: "พื้นที่จัดเก็บและกระจายสินค้าหลักของบริษัท", riskLevel: "low",
    hazards: ["mechanical"],
    riskAssessment: {
      riskLevel: "low", findings: "-", controlMeasures: "-", nextDue: "",
      updatedAt: "2026-02-15T09:00:00", updatedBy: "วรรณา ตั้งมั่น",
    },
  },
];

function createEmptyTenantData() {
  return {
    incidents: [], equipment: [], ppe: [], ppeCatalog: [], noncompliance: [],
    employees: [], locations: [], environmentalMeasurements: [],
    trainingRequirements: [], trainingRecords: [], ltiBaselineDate: null,
  };
}

// tenantStore เก็บข้อมูลปฏิบัติงานทั้งหมดแยกตาม user.id (1 user = 1 บริษัท) — บัญชีแอดมิน
// ระบบ (isAdmin) ไม่มีแถวในนี้เลย เพราะไม่ใช่ tenant ที่มีข้อมูลปฏิบัติงานของตัวเอง
const initialTenantStore = {
  1: {
    incidents: initialIncidents, equipment: initialEquipment, ppe: initialPpe, ppeCatalog: initialPpeCatalog,
    noncompliance: initialNoncompliance, employees: initialEmployees, locations: initialLocations,
    environmentalMeasurements: initialEnvironmentalMeasurements, trainingRequirements: initialTrainingRequirements,
    trainingRecords: initialTrainingRecords, ltiBaselineDate: null,
  },
  2: {
    incidents: [], equipment: [], ppe: [], ppeCatalog: [...initialPpeCatalog], noncompliance: [],
    employees: initialEmployeesXyz, locations: initialLocationsXyz, environmentalMeasurements: [],
    trainingRequirements: [], trainingRecords: [], ltiBaselineDate: null,
  },
};

// ---------------------------------------------------------------
// App shell
// ---------------------------------------------------------------

const NAV = [
  { key: "dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { key: "incidents", label: "อุบัติเหตุ", icon: AlertTriangle },
  { key: "unsafeActs", label: "การกระทำที่ไม่ปลอดภัย", icon: ShieldAlert },
  { key: "environmental", label: "ตรวจวัดสิ่งแวดล้อม", icon: Wind },
  { key: "trainingMatrix", label: "Training Matrix", icon: GraduationCap },
  { key: "checklist", label: "ตรวจสอบ", icon: ClipboardCheck },
  { type: "divider" },
  { key: "employees", label: "พนักงาน", icon: Users },
  { key: "locations", label: "สถานที่ทำงาน", icon: MapPin },
  {
    type: "group",
    label: "ทะเบียนอุปกรณ์เซฟตี้",
    icon: HardHat,
    items: [
      { key: "ppe", label: "PPE", icon: HardHat },
      { key: "equipment", label: "อุปกรณ์ความปลอดภัย", icon: Wrench },
    ],
  },
  { key: "machinery", label: "ทะเบียนเครื่องจักร", icon: Settings },
  { key: "chemicals", label: "ทะเบียนสารเคมี", icon: FlaskConical },
  { key: "govReports", label: "รายงานราชการ", icon: FileText },
];

function SidebarNav({ page, selectPage, equipmentGroupOpen, setEquipmentGroupOpen, currentUser, tierPermissions, onLogout }) {
  const allowed = tierPermissions?.[currentUser?.userType] || [];
  const canSee = (key) => allowed.includes(key);

  return (
    <div className="flex flex-col h-full">
      <p className="font-semibold text-slate-900 px-2 py-2 text-[15px]">JorPor</p>
      <nav className="space-y-1 mt-1 flex-1">
        {NAV.map((item, idx) => {
          if (item.type === "divider") {
            return <div key={`divider-${idx}`} className="my-2 border-t border-slate-200" />;
          }
          if (item.type === "group") {
            const visibleSubItems = item.items.filter((i) => canSee(i.key));
            if (visibleSubItems.length === 0) return null;
            const isActive = visibleSubItems.some((i) => i.key === page);
            const open = equipmentGroupOpen || isActive;
            const GroupIcon = item.icon;
            return (
              <div key="equipment-group">
                <button
                  onClick={() => setEquipmentGroupOpen(!equipmentGroupOpen)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left ${
                    isActive ? "text-slate-900 font-medium" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <GroupIcon size={16} className="shrink-0" />
                  <span className="flex-1 leading-snug">{item.label}</span>
                  <ChevronRight size={14} className={`text-slate-400 transition-transform shrink-0 ${open ? "rotate-90" : ""}`} />
                </button>
                {open && (
                  <div className="pl-4 space-y-1 mt-1">
                    {visibleSubItems.map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() => selectPage(key)}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left ${
                          page === key ? "bg-slate-100 text-slate-900 font-medium" : "text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <Icon size={15} className="shrink-0" />
                        <span className="leading-snug">{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          if (!canSee(item.key)) return null;
          const { key, label, icon: Icon } = item;
          return (
            <button
              key={key}
              onClick={() => selectPage(key)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left ${
                page === key ? "bg-slate-100 text-slate-900 font-medium" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="leading-snug">{label}</span>
            </button>
          );
        })}
      </nav>

      {currentUser && (
        <div className="pt-3 mt-2 border-t border-slate-200">
          <p className="text-sm text-slate-800 px-2.5 truncate">{currentUser.companyName}</p>
          <p className="text-xs text-slate-400 px-2.5 mb-2">{currentUser.name} · {userTypeLabel[currentUser.userType] ?? "-"}</p>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left text-slate-500 hover:bg-slate-50"
          >
            <LogOut size={16} className="shrink-0" />
            ออกจากระบบ
          </button>
        </div>
      )}
    </div>
  );
}

export default function JorPorPrototype() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [authView, setAuthView] = useState("login");
  const [tierPermissions, setTierPermissions] = useState(initialTierPermissions);
  const [tierLimits, setTierLimits] = useState(initialTierLimits);
  const [adminView, setAdminView] = useState("users");

  const [page, setPage] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [equipmentGroupOpen, setEquipmentGroupOpen] = useState(false);
  const [tenantStore, setTenantStore] = useState(initialTenantStore);
  const [employees, setEmployeesData] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [locationsData, setLocationsData] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  // รูปสถานที่ยังไม่รองรับ Supabase Storage (ดูโน้ตใน mapLocationRow) เก็บไว้ในหน่วยความจำ
  // เบราว์เซอร์แยกต่างหากที่นี่ ไม่ผ่านการ fetch/refetch ของ Supabase เพื่อไม่ให้ถูกเขียนทับ
  const [locationPhotos, setLocationPhotos] = useState({});
  const locations = locationsData.map((l) => ({ ...l, photoUrl: locationPhotos[l.id] ?? null }));
  const [trainingCourses, setTrainingCourses] = useState([]);
  const [trainingRequirements, setTrainingRequirementsData] = useState([]);
  const [trainingRecords, setTrainingRecordsData] = useState([]);
  const [incidents, setIncidentsData] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  const [ppeCatalog, setPpeCatalogData] = useState([]);
  const [ppe, setPpeData] = useState([]);
  const [ppeLoading, setPpeLoading] = useState(false);
  const [equipment, setEquipmentData] = useState([]);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [machinery, setMachineryData] = useState([]);
  const [machineryLoading, setMachineryLoading] = useState(false);
  const [environmentalMeasurements, setEnvironmentalMeasurementsData] = useState([]);
  const [environmentalLoading, setEnvironmentalLoading] = useState(false);
  const [noncompliance, setNoncomplianceData] = useState([]);
  const [noncomplianceLoading, setNoncomplianceLoading] = useState(false);
  const [chemicals, setChemicalsData] = useState([]);
  const [chemicalsLoading, setChemicalsLoading] = useState(false);
  const [workingHours, setWorkingHoursData] = useState([]);
  const [workingHoursLoading, setWorkingHoursLoading] = useState(false);

  // ดึงรายชื่อพนักงานจริงจาก Supabase (แทนข้อมูลจำลองในความจำแบบเดิม) — RLS ฝั่งฐานข้อมูล
  // กรองให้อัตโนมัติอยู่แล้วว่าเห็นได้เฉพาะพนักงานของบริษัทตัวเอง ไม่ต้องกรองซ้ำฝั่งนี้
  async function fetchEmployees() {
    setEmployeesLoading(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id, employee_code, full_name, position, department, primary_location_id, is_jorpor_management, is_jorpor_supervisor, is_safety_committee")
      .eq("is_active", true)
      .order("full_name");
    setEmployeesLoading(false);
    if (error) {
      console.error("fetchEmployees error:", error);
      return;
    }
    setEmployeesData((data || []).map(mapEmployeeRow));
  }

  // ดึงสถานที่ทำงานจริงจาก Supabase พร้อม hazards และผลประเมินความเสี่ยงล่าสุดของแต่ละที่
  // (รวม 3 ตารางเข้าด้วยกันในฝั่งโค้ด เพราะ Supabase JS client ไม่รองรับ "แถวล่าสุดต่อกลุ่ม"
  // ในคำสั่งเดียวโดยตรง)
  async function fetchLocations() {
    setLocationsLoading(true);
    const { data: locs, error } = await supabase
      .from("work_locations")
      .select("id, name, building, description, risk_level, created_at")
      .eq("is_active", true)
      .order("name");
    if (error) {
      console.error("fetchLocations error:", error);
      setLocationsLoading(false);
      return;
    }
    const locationIds = (locs || []).map((l) => l.id);
    let hazardsByLocation = {};
    let latestAssessmentByLocation = {};
    let ppeByLocation = {};

    if (locationIds.length > 0) {
      const { data: hazardRows } = await supabase
        .from("work_location_hazards")
        .select("location_id, hazard_type")
        .in("location_id", locationIds);
      (hazardRows || []).forEach((h) => {
        if (!hazardsByLocation[h.location_id]) hazardsByLocation[h.location_id] = [];
        hazardsByLocation[h.location_id].push(h);
      });

      const { data: ppeRows } = await supabase
        .from("location_ppe_requirements")
        .select("location_id, ppe_type")
        .in("location_id", locationIds);
      (ppeRows || []).forEach((p) => {
        if (!ppeByLocation[p.location_id]) ppeByLocation[p.location_id] = [];
        ppeByLocation[p.location_id].push(p);
      });

      const { data: assessmentRows } = await supabase
        .from("location_risk_assessments")
        .select("location_id, risk_level, findings, control_measures, next_assessment_due, assessment_date")
        .in("location_id", locationIds)
        .order("assessment_date", { ascending: false });
      // เรียงจากใหม่ไปเก่าแล้ว ดังนั้นแถวแรกที่เจอของแต่ละ location_id คือรอบล่าสุด
      (assessmentRows || []).forEach((a) => {
        if (!latestAssessmentByLocation[a.location_id]) latestAssessmentByLocation[a.location_id] = a;
      });
    }

    setLocationsData(
      (locs || []).map((l) =>
        mapLocationRow(l, hazardsByLocation[l.id], latestAssessmentByLocation[l.id], currentUser?.name, ppeByLocation[l.id])
      )
    );
    setLocationsLoading(false);
  }

  // คลังหลักสูตร: ดึงทั้งหลักสูตรกลาง (organization_id เป็น NULL) และหลักสูตรที่บริษัทตัวเอง
  // สร้างเพิ่มเอง (ถ้ามี) — RLS อนุญาตให้เห็นทั้งสองแบบอยู่แล้ว ไม่ต้องกรองซ้ำ
  async function fetchTrainingCourses() {
    const { data, error } = await supabase
      .from("training_courses")
      .select("id, name, category, validity_period_days")
      .order("name");
    if (error) {
      console.error("fetchTrainingCourses error:", error);
      return;
    }
    setTrainingCourses((data || []).map(mapCourseRow));
  }

  async function fetchTrainingRequirements() {
    const { data, error } = await supabase
      .from("training_requirements")
      .select("id, position, hazard_type, course_id");
    if (error) {
      console.error("fetchTrainingRequirements error:", error);
      return;
    }
    setTrainingRequirementsData((data || []).map(mapRequirementRow));
  }

  async function fetchTrainingRecords() {
    const { data, error } = await supabase
      .from("training_records")
      .select("id, employee_id, course_id, completion_date, expiry_date, certificate_number, training_provider");
    if (error) {
      console.error("fetchTrainingRecords error:", error);
      return;
    }
    setTrainingRecordsData((data || []).map(mapTrainingRecordRow));
  }

  // ดึงอุบัติเหตุจริงจาก Supabase พร้อมพนักงานที่บาดเจ็บ (incident_injured_employees) และ
  // ความคืบหน้า (incident_updates) ของแต่ละเคส — รวม 3 ตารางฝั่งโค้ดเหมือนแนวทางเดียวกับ
  // fetchLocations เพราะ Supabase JS client ดึงเป็นโครงสร้างซ้อนหลายชั้นในคำสั่งเดียวไม่ได้ง่ายๆ
  async function fetchIncidents() {
    setIncidentsLoading(true);
    const { data: incidentRows, error } = await supabase
      .from("incidents")
      .select("id, location, injury_type, severity, incident_date, incident_time, department, status, description, first_aid_given, probable_cause, reporter_name, reporter_phone")
      .order("incident_date", { ascending: false });
    if (error) {
      console.error("fetchIncidents error:", error);
      alert("โหลดข้อมูลอุบัติเหตุไม่สำเร็จ: " + error.message + " (ตรวจสอบว่ารัน SQL เพิ่มคอลัมน์ล่าสุดใน Supabase ครบแล้วหรือยัง)");
      setIncidentsLoading(false);
      return;
    }
    const incidentIds = (incidentRows || []).map((r) => r.id);
    let injuredByIncident = {};
    let updatesByIncident = {};
    let userNameById = {};

    if (incidentIds.length > 0) {
      const { data: injuredRows, error: injuredErr } = await supabase
        .from("incident_injured_employees")
        .select("id, incident_id, employee_id, lost_workdays, injury_description, body_part")
        .in("incident_id", incidentIds);
      if (injuredErr) console.error("fetch incident_injured_employees error:", injuredErr);
      (injuredRows || []).forEach((e) => {
        if (!injuredByIncident[e.incident_id]) injuredByIncident[e.incident_id] = [];
        injuredByIncident[e.incident_id].push(e);
      });

      const { data: updateRows, error: updatesErr } = await supabase
        .from("incident_updates")
        .select("id, incident_id, updated_by, note, new_status, created_at")
        .in("incident_id", incidentIds)
        .order("created_at", { ascending: true });
      if (updatesErr) console.error("fetch incident_updates error:", updatesErr);
      (updateRows || []).forEach((u) => {
        if (!updatesByIncident[u.incident_id]) updatesByIncident[u.incident_id] = [];
        updatesByIncident[u.incident_id].push(u);
      });

      const updaterIds = [...new Set((updateRows || []).map((u) => u.updated_by).filter(Boolean))];
      if (updaterIds.length > 0) {
        const { data: userRows } = await supabase.from("users").select("id, full_name").in("id", updaterIds);
        (userRows || []).forEach((u) => { userNameById[u.id] = u.full_name; });
      }
    }

    setIncidentsData(
      (incidentRows || []).map((r) =>
        mapIncidentRow(r, injuredByIncident[r.id], updatesByIncident[r.id], userNameById)
      )
    );
    setIncidentsLoading(false);
  }

  const addIncident = async (inc) => {
    const { data, error } = await supabase
      .from("incidents")
      .insert({
        organization_id: currentUser.organizationId,
        reported_by: currentUser.id,
        location: inc.location,
        injury_type: inc.type,
        severity: severityUiToDb[inc.severity] || "minor",
        incident_date: inc.incidentDate,
        incident_time: inc.incidentTime || null,
        department: inc.department === "-" ? null : inc.department,
        status: "reported",
        description: inc.description,
        first_aid_given: inc.firstAidGiven === "-" ? null : inc.firstAidGiven,
        probable_cause: inc.probableCause === "-" ? null : inc.probableCause,
        reporter_name: inc.reporterName === "-" ? null : inc.reporterName,
        reporter_phone: inc.reporterPhone === "-" ? null : inc.reporterPhone,
      })
      .select()
      .single();
    if (error) {
      alert("บันทึกอุบัติเหตุไม่สำเร็จ: " + error.message);
      return;
    }

    let injuredRows = [];
    if (inc.injuredEmployees?.length > 0) {
      const { data: insertedInjured, error: injuredErr } = await supabase
        .from("incident_injured_employees")
        .insert(
          inc.injuredEmployees.map((e) => ({
            incident_id: data.id,
            employee_id: e.employeeId,
            lost_workdays: e.lostWorkdays,
            injury_description: e.injuryType === "-" ? null : e.injuryType,
            body_part: e.bodyPart === "-" ? null : e.bodyPart,
          }))
        )
        .select();
      if (injuredErr) {
        alert("บันทึกอุบัติเหตุสำเร็จ แต่บันทึกพนักงานบาดเจ็บไม่สำเร็จ: " + injuredErr.message + " — เพิ่มใหม่ได้ที่หน้ารายละเอียด");
      } else {
        injuredRows = insertedInjured || [];
      }
    }

    setIncidentsData([mapIncidentRow(data, injuredRows, []), ...incidents]);
  };

  const updateIncident = async (incidentId, fields) => {
    const payload = {};
    if (fields.location !== undefined) payload.location = fields.location;
    if (fields.severity !== undefined) payload.severity = severityUiToDb[fields.severity] || fields.severity;
    if (fields.description !== undefined) payload.description = fields.description;
    if (fields.status !== undefined) payload.status = incidentStatusUiToDb[fields.status] || fields.status;
    if (fields.incidentTime !== undefined) payload.incident_time = fields.incidentTime || null;
    if (fields.department !== undefined) payload.department = fields.department === "-" ? null : fields.department;
    if (fields.firstAidGiven !== undefined) payload.first_aid_given = fields.firstAidGiven === "-" ? null : fields.firstAidGiven;
    if (fields.probableCause !== undefined) payload.probable_cause = fields.probableCause === "-" ? null : fields.probableCause;
    if (fields.reporterName !== undefined) payload.reporter_name = fields.reporterName === "-" ? null : fields.reporterName;
    if (fields.reporterPhone !== undefined) payload.reporter_phone = fields.reporterPhone === "-" ? null : fields.reporterPhone;
    const { error } = await supabase.from("incidents").update(payload).eq("id", incidentId);
    if (error) {
      alert("บันทึกการแก้ไขไม่สำเร็จ: " + error.message);
      return;
    }
    setIncidentsData(incidents.map((inc) => (inc.id === incidentId ? { ...inc, ...fields } : inc)));
  };

  const deleteIncident = async (incidentId) => {
    const { error } = await supabase.from("incidents").delete().eq("id", incidentId);
    if (error) {
      alert("ลบอุบัติเหตุไม่สำเร็จ: " + error.message);
      return;
    }
    setIncidentsData(incidents.filter((inc) => inc.id !== incidentId));
  };

  // บันทึกความคืบหน้า 1 รายการ (incident_updates) และถ้ามีการเปลี่ยนสถานะพ่วงมาด้วย
  // ให้อัปเดต incidents.status ให้ตรงกันทันที (เหมือนพฤติกรรมเดิมของ mock data)
  const addIncidentProgress = async (incidentId, entry) => {
    const newStatusDb = entry.newStatus ? incidentStatusUiToDb[entry.newStatus] : null;
    const { data, error } = await supabase
      .from("incident_updates")
      .insert({
        organization_id: currentUser.organizationId,
        incident_id: incidentId,
        updated_by: currentUser.id,
        note: entry.note,
        new_status: newStatusDb,
      })
      .select()
      .single();
    if (error) {
      alert("บันทึกความคืบหน้าไม่สำเร็จ: " + error.message);
      return;
    }
    if (newStatusDb) {
      await supabase.from("incidents").update({ status: newStatusDb }).eq("id", incidentId);
    }
    setIncidentsData(
      incidents.map((inc) =>
        inc.id === incidentId
          ? {
              ...inc,
              status: entry.newStatus || inc.status,
              updates: [...inc.updates, { rowId: data.id, date: data.created_at.slice(0, 10), by: currentUser.name, note: data.note, newStatus: entry.newStatus || null }],
            }
          : inc
      )
    );
  };

  // เพิ่ม/แก้ไข/ลบพนักงานที่ได้รับบาดเจ็บของอุบัติเหตุหนึ่งเคส (incident_injured_employees)
  const addInjuredEmployee = async (incidentId, entry) => {
    const { data, error } = await supabase
      .from("incident_injured_employees")
      .insert({
        incident_id: incidentId,
        employee_id: entry.employeeId,
        lost_workdays: entry.lostWorkdays,
        injury_description: entry.injuryType,
        body_part: entry.bodyPart === "-" ? null : entry.bodyPart,
      })
      .select()
      .single();
    if (error) {
      alert("เพิ่มพนักงานบาดเจ็บไม่สำเร็จ: " + error.message);
      return;
    }
    setIncidentsData(
      incidents.map((inc) =>
        inc.id === incidentId
          ? {
              ...inc,
              injuredEmployees: [
                ...inc.injuredEmployees,
                { rowId: data.id, employeeId: data.employee_id, lostWorkdays: data.lost_workdays, injuryType: data.injury_description || "-", bodyPart: data.body_part || "-" },
              ],
            }
          : inc
      )
    );
  };

  const updateInjuredEmployee = async (incidentId, rowId, field, value) => {
    const payload =
      field === "lostWorkdays" ? { lost_workdays: value } :
      field === "bodyPart" ? { body_part: value } :
      { injury_description: value };
    const { error } = await supabase.from("incident_injured_employees").update(payload).eq("id", rowId);
    if (error) {
      alert("บันทึกไม่สำเร็จ: " + error.message);
      return;
    }
    setIncidentsData(
      incidents.map((inc) =>
        inc.id === incidentId
          ? { ...inc, injuredEmployees: inc.injuredEmployees.map((e) => (e.rowId === rowId ? { ...e, [field]: value } : e)) }
          : inc
      )
    );
  };

  const removeInjuredEmployee = async (incidentId, rowId) => {
    const { error } = await supabase.from("incident_injured_employees").delete().eq("id", rowId);
    if (error) {
      alert("ลบไม่สำเร็จ: " + error.message);
      return;
    }
    setIncidentsData(
      incidents.map((inc) =>
        inc.id === incidentId
          ? { ...inc, injuredEmployees: inc.injuredEmployees.filter((e) => e.rowId !== rowId) }
          : inc
      )
    );
  };

  // ลบบันทึกความคืบหน้า 1 รายการ (ไม่ปรับ incidents.status กลับคืน เพราะไม่ทราบว่าค่าก่อนหน้า
  // ควรเป็นอะไร — จป. ต้องแก้สถานะเองที่การ์ด "รายละเอียดและสถานะ" ถ้าต้องการ)
  const removeIncidentProgress = async (incidentId, rowId) => {
    const { error } = await supabase.from("incident_updates").delete().eq("id", rowId);
    if (error) {
      alert("ลบไม่สำเร็จ: " + error.message);
      return;
    }
    setIncidentsData(
      incidents.map((inc) =>
        inc.id === incidentId ? { ...inc, updates: inc.updates.filter((u) => u.rowId !== rowId) } : inc
      )
    );
  };

  // ดึงประเภท/รุ่นอุปกรณ์ PPE — คืนค่า rows ดิบกลับไปด้วย (ไม่ใช่แค่ตั้ง state) เพราะ
  // fetchPpeIssuance ต้องใช้ rows ดิบชุดเดียวกันมา join หาชื่อ/รุ่น/มาตรฐานทันทีโดยไม่ต้อง
  // รอ state อัปเดตก่อน (setState เป็น async ถ้ารออ่านจาก state จะมี race condition)
  async function fetchPpeCatalog() {
    const { data, error } = await supabase
      .from("ppe_catalog")
      .select("id, name, model, standard_ref, lifespan_days")
      .order("name");
    if (error) {
      console.error("fetchPpeCatalog error:", error);
      return [];
    }
    setPpeCatalogData((data || []).map(mapPpeCatalogRow));
    return data || [];
  }

  async function fetchPpeIssuance(catalogRows) {
    const { data, error } = await supabase
      .from("ppe_issuance")
      .select("id, ppe_catalog_id, employee_id, quantity, issuance_reason, issued_date, expiry_date")
      .order("issued_date", { ascending: false });
    if (error) {
      console.error("fetchPpeIssuance error:", error);
      return;
    }
    const catalogById = {};
    (catalogRows || []).forEach((c) => { catalogById[c.id] = c; });
    setPpeData((data || []).map((r) => mapPpeIssuanceRow(r, catalogById)));
  }

  async function fetchPpe() {
    setPpeLoading(true);
    const catalogRows = await fetchPpeCatalog();
    await fetchPpeIssuance(catalogRows);
    setPpeLoading(false);
  }

  const addPpeCatalogItem = async (item) => {
    const { data, error } = await supabase
      .from("ppe_catalog")
      .insert({
        organization_id: currentUser.organizationId,
        name: item.name,
        model: item.model === "-" ? null : item.model,
        standard_ref: item.standard === "-" ? null : item.standard,
        lifespan_days: item.lifespanDays,
      })
      .select()
      .single();
    if (error) {
      alert("เพิ่มประเภทอุปกรณ์ไม่สำเร็จ: " + error.message);
      return;
    }
    setPpeCatalogData([...ppeCatalog, mapPpeCatalogRow(data)]);
  };

  const updatePpeCatalogItem = async (id, fields) => {
    const payload = {};
    if (fields.model !== undefined) payload.model = fields.model === "-" ? null : fields.model;
    if (fields.standard !== undefined) payload.standard_ref = fields.standard === "-" ? null : fields.standard;
    if (fields.lifespanDays !== undefined) payload.lifespan_days = fields.lifespanDays;
    const { error } = await supabase.from("ppe_catalog").update(payload).eq("id", id);
    if (error) {
      alert("บันทึกไม่สำเร็จ: " + error.message);
      return;
    }
    setPpeCatalogData(ppeCatalog.map((c) => (c.id === id ? { ...c, ...fields } : c)));
  };

  const deletePpeCatalogItem = async (id) => {
    const { error } = await supabase.from("ppe_catalog").delete().eq("id", id);
    if (error) {
      // ลบไม่ได้ถ้ามีประวัติการเบิก (ppe_issuance) อ้างอิงประเภทนี้อยู่ (foreign key constraint)
      alert("ลบไม่สำเร็จ: มีประวัติการเบิกที่ใช้ประเภทอุปกรณ์นี้อยู่แล้ว ลบประวัติการเบิกก่อนจึงจะลบประเภทนี้ได้ (" + error.message + ")");
      return;
    }
    setPpeCatalogData(ppeCatalog.filter((c) => c.id !== id));
  };

  const addPpeIssuance = async (record) => {
    const { data, error } = await supabase
      .from("ppe_issuance")
      .insert({
        organization_id: currentUser.organizationId,
        ppe_catalog_id: record.catalogId,
        employee_id: record.employeeId,
        quantity: record.quantity,
        issuance_reason: record.reason,
        issued_by: currentUser.id,
        issued_date: record.issuedDate,
        expiry_date: record.expiry,
        status: "active",
      })
      .select()
      .single();
    if (error) {
      alert("บันทึกการเบิกไม่สำเร็จ: " + error.message);
      return;
    }
    const catalogById = {};
    ppeCatalog.forEach((c) => { catalogById[c.id] = { name: c.name, model: c.model, standard_ref: c.standard }; });
    setPpeData([mapPpeIssuanceRow(data, catalogById), ...ppe]);
  };

  const deletePpeIssuance = async (id) => {
    const { error } = await supabase.from("ppe_issuance").delete().eq("id", id);
    if (error) {
      alert("ลบไม่สำเร็จ: " + error.message);
      return;
    }
    setPpeData(ppe.filter((p) => p.id !== id));
  };

  useEffect(() => {
    if (currentUser && !currentUser.isAdmin) {
      fetchEmployees();
      fetchLocations();
      fetchTrainingCourses();
      fetchTrainingRequirements();
      fetchTrainingRecords();
      fetchIncidents();
      fetchPpe();
      fetchEquipment();
      fetchMachinery();
      fetchEnvironmentalMeasurements();
      fetchNoncompliance();
      fetchChemicals();
      fetchWorkingHours();
    }
  }, [currentUser?.id]);


  // ตรวจสอบ session เดิมตอนเปิดแอป (ทำให้รีเฟรชหน้าแล้วไม่ต้อง login ใหม่ทุกครั้ง)
  // และคอยฟัง event ออกจากระบบจากที่อื่น (เช่น เปิดหลายแท็บ) — ต้องอยู่ก่อน early
  // return ใดๆ เพราะ hook ต้องถูกเรียกจำนวนเท่ากันทุกครั้งที่ render
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id);
        if (profile && profile.status === "approved") {
          setCurrentUser(profile);
        }
      }
      setSessionChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setCurrentUser(null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // ดึงค่าสิทธิ์การเข้าถึงหน้า/ข้อจำกัดของแต่ละแพ็กเกจจาก subscription_plans
  // จริงทุกครั้งที่มีคน login (ทั้งผู้ใช้ทั่วไปและแอดมิน) เพราะทั้งเมนูฝั่งผู้ใช้ทั่วไป
  // และหน้าจัดการประเภทของแอดมินต้องใช้ค่าชุดเดียวกันนี้
  useEffect(() => {
    if (!currentUser) return;
    fetchTierConfig();
  }, [currentUser?.id]);

  async function fetchTierConfig() {
    const { data, error } = await supabase.from("subscription_plans").select("name, max_employees, features");
    if (error || !data) {
      console.error("fetchTierConfig error:", error);
      return;
    }
    const perms = {};
    const limits = {};
    data.forEach((p) => {
      const key = p.name.toLowerCase();
      perms[key] = p.features?.pages === "all" ? ALL_PAGE_KEYS : (p.features?.pages || []);
      limits[key] = { maxEmployees: p.max_employees };
    });
    setTierPermissions(perms);
    setTierLimits(limits);
  }

  // ดึงรายชื่อผู้ใช้งานทั้งหมด (ทุกบริษัท) ใช้เฉพาะฝั่งแอดมินสำหรับหน้าจัดการ/อนุมัติ
  // — RLS ฝั่งฐานข้อมูลอนุญาตให้ super_admin เท่านั้นที่ดึงได้ครบทุกคน
  async function fetchAllUsers() {
    const { data, error } = await supabase
      .from("users")
      .select(USER_SELECT_QUERY)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("fetchAllUsers error:", error);
      return;
    }
    setUsers((data || []).map(mapUserRow));
  }

  useEffect(() => {
    if (currentUser?.isAdmin) fetchAllUsers();
  }, [currentUser?.isAdmin]);

  const handleLogin = (profile) => {
    setCurrentUser(profile);
    if (!profile.isAdmin) {
      setPage(tierPermissions[profile.userType]?.[0] || "dashboard");
    }
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setPage("dashboard");
  };
  const approveUser = async (id) => {
    await supabase.from("users").update({ approval_status: "approved" }).eq("id", id);
    fetchAllUsers();
  };
  const rejectUser = async (id) => {
    await supabase.from("users").update({ approval_status: "rejected" }).eq("id", id);
    fetchAllUsers();
  };
  // ใช้แก้ "แพ็กเกจ" ของบริษัทนั้น (userType) เท่านั้น — ต้องไปอัปเดตที่ subscriptions.plan_id
  // ไม่ใช่แก้ตรงตาราง users เพราะแพ็กเกจผูกกับ organization ไม่ใช่ผูกกับ user โดยตรง
  const updateUser = async (id, fields) => {
    if (!fields.userType) return;
    const { data: userRow } = await supabase.from("users").select("organization_id").eq("id", id).single();
    const { data: planRow } = await supabase
      .from("subscription_plans")
      .select("id")
      .ilike("name", fields.userType)
      .single();
    if (!userRow?.organization_id || !planRow?.id) return;
    await supabase.from("subscriptions").update({ plan_id: planRow.id }).eq("organization_id", userRow.organization_id);
    fetchAllUsers();
  };
  const updateTierPermissions = async (tier, pages) => {
    await supabase
      .from("subscription_plans")
      .update({ features: { pages } })
      .ilike("name", tier);
    fetchTierConfig();
  };
  const updateTierLimits = async (tier, limits) => {
    await supabase
      .from("subscription_plans")
      .update({ max_employees: limits.maxEmployees })
      .ilike("name", tier);
    fetchTierConfig();
  };

  if (!sessionChecked) {
    return (
      <div className="min-h-[600px] flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">กำลังโหลด...</p>
      </div>
    );
  }

  if (!currentUser) {
    return authView === "login" ? (
      <LoginPage onLogin={handleLogin} onGoToRegister={() => setAuthView("register")} />
    ) : (
      <RegisterPage onGoToLogin={() => setAuthView("login")} />
    );
  }

  if (currentUser.isAdmin) {
    return (
      <div className="min-h-[600px] bg-white font-sans">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200">
          <p className="font-semibold text-slate-900 text-[15px]">JorPor · ผู้ดูแลระบบ</p>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{currentUser.name}</span>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
              <LogOut size={16} /> ออกจากระบบ
            </button>
          </div>
        </div>
        <div className="px-4 sm:px-6 pt-4 flex gap-1 border-b border-slate-200">
          <button
            onClick={() => setAdminView("users")}
            className={`flex items-center gap-1.5 text-sm px-3 py-2 border-b-2 -mb-px ${adminView === "users" ? "border-slate-900 text-slate-900 font-medium" : "border-transparent text-slate-500"}`}
          >
            จัดการผู้ใช้งาน
            {users.filter((u) => u.status === "pending").length > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                {users.filter((u) => u.status === "pending").length}
              </span>
            )}
          </button>
          <button
            onClick={() => setAdminView("roles")}
            className={`text-sm px-3 py-2 border-b-2 -mb-px ${adminView === "roles" ? "border-slate-900 text-slate-900 font-medium" : "border-transparent text-slate-500"}`}
          >
            จัดการประเภทผู้ใช้งาน
          </button>
        </div>
        <div className="p-4 sm:p-6">
          {adminView === "users" ? (
            <AdminUserManagementPage
              users={users}
              tierPermissions={tierPermissions}
              onApprove={approveUser}
              onReject={rejectUser}
              onUpdateUser={updateUser}
              onGoToRoleManagement={() => setAdminView("roles")}
            />
          ) : (
            <RoleManagementPage
              tierPermissions={tierPermissions}
              tierLimits={tierLimits}
              onUpdateTierPermissions={updateTierPermissions}
              onUpdateTierLimits={updateTierLimits}
            />
          )}
        </div>
      </div>
    );
  }

  // ข้อมูลปฏิบัติงานทั้งหมดแยกตาม currentUser.id (1 user = 1 บริษัท) — ไม่ปนกับบริษัทอื่นเลย
  const tenant = tenantStore[currentUser.id] || createEmptyTenantData();
  const updateTenant = (patch) => setTenantStore({ ...tenantStore, [currentUser.id]: { ...tenant, ...patch } });

  const ltiBaselineDate = currentUser.ltiBaselineDate;
  const setLtiBaselineDate = async (val) => {
    const { error } = await supabase
      .from("organizations")
      .update({ lti_baseline_date: val })
      .eq("id", currentUser.organizationId);
    if (error) {
      alert("บันทึกวันฐาน LTI ไม่สำเร็จ: " + error.message);
      return;
    }
    setCurrentUser({ ...currentUser, ltiBaselineDate: val });
  };

  // ข้อจำกัดจำนวนพนักงานตามประเภทผู้ใช้งาน (เช่น Free บันทึกได้ไม่เกิน 5 คน)
  const employeeLimit = tierLimits[currentUser.userType]?.maxEmployees ?? null;

  async function fetchNoncompliance() {
    setNoncomplianceLoading(true);
    const { data, error } = await supabase
      .from("ppe_noncompliance_records")
      .select("id, employee_id, ppe_name, location, observed_at, action_taken, notes")
      .order("observed_at", { ascending: false });
    if (error) {
      console.error("fetchNoncompliance error:", error);
      setNoncomplianceLoading(false);
      return;
    }
    setNoncomplianceData((data || []).map(mapNoncomplianceRow));
    setNoncomplianceLoading(false);
  }

  const addNoncompliance = async (record) => {
    const { data, error } = await supabase
      .from("ppe_noncompliance_records")
      .insert({
        organization_id: currentUser.organizationId,
        employee_id: record.employeeId,
        ppe_name: record.ppeName,
        observed_by: currentUser.id,
        location: record.location,
        observed_at: record.date,
        action_taken: noncomplianceActionUiToDb[record.action] || "other",
        notes: record.notes === "-" ? null : record.notes,
      })
      .select()
      .single();
    if (error) {
      alert("บันทึกไม่สำเร็จ: " + error.message);
      return;
    }
    setNoncomplianceData([mapNoncomplianceRow(data), ...noncompliance]);
  };

  const deleteNoncompliance = async (id) => {
    const { error } = await supabase.from("ppe_noncompliance_records").delete().eq("id", id);
    if (error) {
      alert("ลบไม่สำเร็จ: " + error.message);
      return;
    }
    setNoncomplianceData(noncompliance.filter((r) => r.id !== id));
  };

  async function fetchChemicals() {
    setChemicalsLoading(true);
    const { data, error } = await supabase
      .from("chemicals")
      .select("id, name, cas_number, quantity, unit, storage_location, hazard_type, ppe_required, sds_status, recorded_date")
      .order("recorded_date", { ascending: false });
    if (error) {
      console.error("fetchChemicals error:", error);
      alert("โหลดทะเบียนสารเคมีไม่สำเร็จ: " + error.message + " (ตรวจสอบว่ารัน SQL สร้างตาราง chemicals แล้วหรือยัง)");
      setChemicalsLoading(false);
      return;
    }
    setChemicalsData((data || []).map(mapChemicalRow));
    setChemicalsLoading(false);
  }

  const addChemical = async (form) => {
    const { data, error } = await supabase
      .from("chemicals")
      .insert({
        organization_id: currentUser.organizationId,
        name: form.name,
        cas_number: form.casNumber || null,
        quantity: form.quantity === "" ? null : Number(form.quantity),
        unit: form.unit || null,
        storage_location: form.storageLocation || null,
        hazard_type: form.hazardType || null,
        ppe_required: form.ppeRequired,
        sds_status: form.sdsStatus,
        recorded_by: currentUser.id,
        recorded_date: form.recordedDate,
      })
      .select()
      .single();
    if (error) {
      alert("บันทึกสารเคมีไม่สำเร็จ: " + error.message);
      return;
    }
    setChemicalsData([mapChemicalRow(data), ...chemicals]);
  };

  const deleteChemical = async (id) => {
    const { error } = await supabase.from("chemicals").delete().eq("id", id);
    if (error) {
      alert("ลบไม่สำเร็จ: " + error.message);
      return;
    }
    setChemicalsData(chemicals.filter((c) => c.id !== id));
  };

  // อัปเดตข้อมูลองค์กร/คปอ. (ใช้ตาราง organizations ที่มีอยู่แล้ว + คอลัมน์ใหม่ที่เพิ่งเพิ่ม)
  const updateOrgProfile = async (fields) => {
    const payload = {};
    if (fields.name !== undefined) payload.name = fields.name || null;
    if (fields.taxId !== undefined) payload.tax_id = fields.taxId || null;
    if (fields.industryType !== undefined) payload.industry_type = fields.industryType || null;
    if (fields.accountTier !== undefined) payload.account_tier = fields.accountTier || null;
    if (fields.address !== undefined) payload.address = fields.address || null;
    if (fields.employeeCount !== undefined) payload.employee_count = fields.employeeCount === "" ? null : Number(fields.employeeCount);
    if (fields.contactEmail !== undefined) payload.contact_email = fields.contactEmail || null;
    if (fields.contactPhone !== undefined) payload.contact_phone = fields.contactPhone || null;
    if (fields.jorporProfessionalName !== undefined) payload.jorpor_professional_name = fields.jorporProfessionalName || null;
    if (fields.jorporTechnicalName !== undefined) payload.jorpor_technical_name = fields.jorporTechnicalName || null;
    if (fields.committeeEmployerNames !== undefined) payload.committee_employer_names = fields.committeeEmployerNames || null;
    if (fields.committeeEmployeeNames !== undefined) payload.committee_employee_names = fields.committeeEmployeeNames || null;
    if (fields.committeeAppointedDate !== undefined) payload.committee_appointed_date = fields.committeeAppointedDate || null;
    if (fields.committeeTermEndDate !== undefined) payload.committee_term_end_date = fields.committeeTermEndDate || null;
    const { error } = await supabase.from("organizations").update(payload).eq("id", currentUser.organizationId);
    if (error) {
      alert("บันทึกข้อมูลองค์กรไม่สำเร็จ: " + error.message);
      return;
    }
    setCurrentUser({ ...currentUser, orgProfile: { ...currentUser.orgProfile, ...fields } });
  };

  async function fetchWorkingHours() {
    setWorkingHoursLoading(true);
    const { data, error } = await supabase
      .from("monthly_working_hours")
      .select("id, month_date, total_working_hours, average_employee_count, notes")
      .order("month_date", { ascending: false });
    if (error) {
      console.error("fetchWorkingHours error:", error);
      setWorkingHoursLoading(false);
      return;
    }
    setWorkingHoursData(
      (data || []).map((r) => ({
        id: r.id,
        monthDate: r.month_date,
        totalHours: r.total_working_hours,
        avgEmployeeCount: r.average_employee_count,
        notes: r.notes || "",
      }))
    );
    setWorkingHoursLoading(false);
  }

  // บันทึก/แก้ไขข้อมูลของเดือนใดเดือนหนึ่ง — ใช้ upsert โดยยึด (organization_id, month_date) เป็นคีย์
  // เพื่อให้กรอกซ้ำเดือนเดิมแล้วกลายเป็นการแก้ไขแทนที่จะสร้างแถวซ้ำ
  const upsertWorkingHours = async (monthDate, fields) => {
    const { data, error } = await supabase
      .from("monthly_working_hours")
      .upsert(
        {
          organization_id: currentUser.organizationId,
          month_date: monthDate,
          total_working_hours: fields.totalHours === "" ? null : Number(fields.totalHours),
          average_employee_count: fields.avgEmployeeCount === "" ? null : Number(fields.avgEmployeeCount),
          notes: fields.notes || null,
        },
        { onConflict: "organization_id,month_date" }
      )
      .select()
      .single();
    if (error) {
      alert("บันทึกชั่วโมงทำงานไม่สำเร็จ: " + error.message);
      return;
    }
    const mapped = {
      id: data.id, monthDate: data.month_date, totalHours: data.total_working_hours,
      avgEmployeeCount: data.average_employee_count, notes: data.notes || "",
    };
    const existingIdx = workingHours.findIndex((w) => w.monthDate === monthDate);
    if (existingIdx >= 0) {
      setWorkingHoursData(workingHours.map((w) => (w.monthDate === monthDate ? mapped : w)));
    } else {
      setWorkingHoursData([mapped, ...workingHours].sort((a, b) => (a.monthDate < b.monthDate ? 1 : -1)));
    }
  };

  const deleteWorkingHours = async (id) => {
    const { error } = await supabase.from("monthly_working_hours").delete().eq("id", id);
    if (error) {
      alert("ลบไม่สำเร็จ: " + error.message);
      return;
    }
    setWorkingHoursData(workingHours.filter((w) => w.id !== id));
  };

  const addEmployee = async (emp) => {
    const { error } = await supabase.from("employees").insert(toEmployeeRow(emp, currentUser.organizationId));
    if (error) {
      console.error("addEmployee error:", error);
      alert("บันทึกพนักงานไม่สำเร็จ: " + error.message);
      return;
    }
    fetchEmployees();
  };
  const addManyEmployees = async (newEmps) => {
    const rows = newEmps.map((e) => toEmployeeRow(e, currentUser.organizationId));
    const { error } = await supabase.from("employees").insert(rows);
    if (error) {
      console.error("addManyEmployees error:", error);
      alert("นำเข้าพนักงานไม่สำเร็จ: " + error.message);
      return;
    }
    fetchEmployees();
  };
  const deleteEmployee = async (empId) => {
    // soft-delete ตามที่ออกแบบไว้ใน schema (ดูโน้ตข้อ 23) — ไม่ลบแถวจริง เพราะพนักงานอาจมี
    // ประวัติ PPE/อุบัติเหตุ/อบรมผูกอยู่ที่ต้องเก็บไว้ตรวจสอบย้อนหลังตามกฎหมายแรงงาน
    const { error } = await supabase.from("employees").update({ is_active: false }).eq("id", empId);
    if (error) {
      console.error("deleteEmployee error:", error);
      alert("ลบพนักงานไม่สำเร็จ: " + error.message);
      return;
    }
    fetchEmployees();
  };
  const updateEmployee = async (empId, fields) => {
    const current = employees.find((e) => e.id === empId);
    const merged = { ...current, ...fields };
    const { error } = await supabase.from("employees").update(toEmployeeRow(merged, currentUser.organizationId)).eq("id", empId);
    if (error) {
      console.error("updateEmployee error:", error);
      alert("แก้ไขพนักงานไม่สำเร็จ: " + error.message);
      return;
    }
    fetchEmployees();
  };
  const addLocation = async (loc) => {
    const { data: newLoc, error } = await supabase
      .from("work_locations")
      .insert({
        organization_id: currentUser.organizationId,
        name: loc.name,
        building: loc.building === "-" ? null : loc.building,
        description: loc.description === "-" ? null : loc.description,
        risk_level: loc.riskLevel,
      })
      .select()
      .single();
    if (error) {
      console.error("addLocation error:", error);
      alert("บันทึกสถานที่ไม่สำเร็จ: " + error.message);
      return;
    }
    if (loc.hazards?.length) {
      const { error: hazErr } = await supabase.from("work_location_hazards").insert(
        loc.hazards.map((h) => ({ location_id: newLoc.id, hazard_type: h }))
      );
      if (hazErr) alert("บันทึกรูปแบบความเสี่ยงไม่สำเร็จ: " + hazErr.message);
    }
    if (loc.ppeRequired?.length) {
      const { error: ppeErr } = await supabase.from("location_ppe_requirements").insert(
        loc.ppeRequired.map((p) => ({ location_id: newLoc.id, ppe_type: p }))
      );
      if (ppeErr) alert("บันทึกประเภท PPE ที่ต้องใส่ไม่สำเร็จ: " + ppeErr.message);
    }
    if (loc.riskAssessment) {
      await supabase.from("location_risk_assessments").insert({
        organization_id: currentUser.organizationId,
        location_id: newLoc.id,
        assessed_by: currentUser.id,
        risk_level: loc.riskAssessment.riskLevel,
        findings: loc.riskAssessment.findings === "-" ? null : loc.riskAssessment.findings,
        control_measures: loc.riskAssessment.controlMeasures === "-" ? null : loc.riskAssessment.controlMeasures,
        next_assessment_due: loc.riskAssessment.nextDue || null,
      });
    }
    fetchLocations();
  };
  async function fetchEnvironmentalMeasurements() {
    setEnvironmentalLoading(true);
    const { data, error } = await supabase
      .from("environmental_measurements")
      .select("id, location_id, measurement_type, measured_value, unit, standard_limit, point_label, result, measured_at, next_measurement_due, notes, correction_status")
      .order("measured_at", { ascending: false });
    if (error) {
      console.error("fetchEnvironmentalMeasurements error:", error);
      setEnvironmentalLoading(false);
      return;
    }
    setEnvironmentalMeasurementsData(mapMeasurementRowsToRounds(data));
    setEnvironmentalLoading(false);
  }

  // บันทึกผลตรวจวัด 1 รอบ = insert หลายแถวพร้อมกัน (1 แถวต่อ 1 จุดย่อย) โดยทุกแถวใช้
  // location_id/measurement_type/measured_at ชุดเดียวกัน เพื่อให้ตอนอ่านกลับมา group เป็นรอบเดียวได้
  const addEnvironmentalMeasurement = async (record) => {
    const rows = record.points.map((p) => ({
      organization_id: currentUser.organizationId,
      location_id: record.locationId,
      measurement_type: record.measurementType,
      measured_value: p.value,
      unit: record.unit,
      standard_limit: record.standardLimit,
      point_label: p.label,
      result: p.result,
      measured_by: currentUser.id,
      measured_at: record.measuredAt,
      next_measurement_due: record.nextDue,
      notes: record.notes === "-" ? null : record.notes,
      correction_status: "none",
    }));
    const { data, error } = await supabase.from("environmental_measurements").insert(rows).select();
    if (error) {
      alert("บันทึกผลตรวจวัดไม่สำเร็จ: " + error.message);
      return;
    }
    setEnvironmentalMeasurementsData([...mapMeasurementRowsToRounds(data), ...environmentalMeasurements]);
  };

  // fields.points มีค่า = แก้ไขทั้งรอบ (ลบแถวเดิมทั้งหมดของรอบนี้แล้ว insert ใหม่ เพราะจำนวน
  // จุดย่อยอาจเปลี่ยนไป ง่ายกว่าการพยายาม diff จุดย่อยทีละจุด)
  // fields.points ไม่มีค่า = แก้แค่ฟิลด์เดียว (เช่น correctionStatus จากปุ่มเปลี่ยนสถานะด่วน) → update ทุกแถวของรอบนี้
  const updateEnvironmentalMeasurement = async (id, fields) => {
    const round = environmentalMeasurements.find((r) => r.id === id);
    if (!round) return;

    if (fields.points) {
      const { error: delErr } = await supabase.from("environmental_measurements").delete().in("id", round.rowIds);
      if (delErr) {
        alert("บันทึกการแก้ไขไม่สำเร็จ: " + delErr.message);
        return;
      }
      const rows = fields.points.map((p) => ({
        organization_id: currentUser.organizationId,
        location_id: round.locationId,
        measurement_type: fields.measurementType,
        measured_value: p.value,
        unit: fields.unit,
        standard_limit: fields.standardLimit,
        point_label: p.label,
        result: p.result,
        measured_by: currentUser.id,
        measured_at: fields.measuredAt,
        next_measurement_due: fields.nextDue,
        notes: fields.notes === "-" ? null : fields.notes,
        correction_status: round.correctionStatus || "none",
      }));
      const { data, error } = await supabase.from("environmental_measurements").insert(rows).select();
      if (error) {
        alert("บันทึกการแก้ไขไม่สำเร็จ: " + error.message);
        return;
      }
      const [newRound] = mapMeasurementRowsToRounds(data);
      setEnvironmentalMeasurementsData(environmentalMeasurements.map((r) => (r.id === id ? newRound : r)));
    } else {
      const payload = {};
      if (fields.correctionStatus !== undefined) payload.correction_status = fields.correctionStatus;
      const { error } = await supabase.from("environmental_measurements").update(payload).in("id", round.rowIds);
      if (error) {
        alert("บันทึกไม่สำเร็จ: " + error.message);
        return;
      }
      setEnvironmentalMeasurementsData(environmentalMeasurements.map((r) => (r.id === id ? { ...r, ...fields } : r)));
    }
  };

  const deleteEnvironmentalMeasurement = async (id) => {
    const round = environmentalMeasurements.find((r) => r.id === id);
    if (!round) return;
    const { error } = await supabase.from("environmental_measurements").delete().in("id", round.rowIds);
    if (error) {
      alert("ลบไม่สำเร็จ: " + error.message);
      return;
    }
    setEnvironmentalMeasurementsData(environmentalMeasurements.filter((r) => r.id !== id));
  };

  const addTrainingRequirement = async (r) => {
    const { error } = await supabase.from("training_requirements").insert({
      organization_id: currentUser.organizationId,
      position: r.position || null,
      hazard_type: r.hazardType || null,
      course_id: r.courseId,
    });
    if (error) {
      console.error("addTrainingRequirement error:", error);
      alert("บันทึกไม่สำเร็จ: " + error.message);
      return;
    }
    fetchTrainingRequirements();
  };
  const removeTrainingRequirement = async (id) => {
    const { error } = await supabase.from("training_requirements").delete().eq("id", id);
    if (error) {
      console.error("removeTrainingRequirement error:", error);
      alert("ลบไม่สำเร็จ: " + error.message);
      return;
    }
    fetchTrainingRequirements();
  };
  // บันทึกผลอบรมของพนักงานคนหนึ่งต่อหลักสูตรหนึ่ง — ถ้ามีบันทึกเดิมอยู่แล้วจะแก้ไขทับ (upsert)
  // ไม่ใช่เพิ่มซ้ำเรื่อยๆ ทำให้ "แก้ไขว่าผ่านอบรมแล้วหรือยัง" ทำได้จากจุดเดียวเสมอ
  const upsertTrainingRecord = async (employeeId, courseId, fields) => {
    const existing = trainingRecords.find((r) => r.employeeId === employeeId && r.courseId === courseId);
    const payload = {
      organization_id: currentUser.organizationId,
      employee_id: employeeId,
      course_id: courseId,
      completion_date: fields.completionDate,
      expiry_date: fields.expiryDate || null,
    };
    const { error } = existing
      ? await supabase.from("training_records").update(payload).eq("id", existing.id)
      : await supabase.from("training_records").insert(payload);
    if (error) {
      console.error("upsertTrainingRecord error:", error);
      alert("บันทึกผลอบรมไม่สำเร็จ: " + error.message);
      return;
    }
    fetchTrainingRecords();
  };
  const deleteTrainingRecord = async (employeeId, courseId) => {
    const existing = trainingRecords.find((r) => r.employeeId === employeeId && r.courseId === courseId);
    if (!existing) return;
    const { error } = await supabase.from("training_records").delete().eq("id", existing.id);
    if (error) {
      console.error("deleteTrainingRecord error:", error);
      alert("ลบผลอบรมไม่สำเร็จ: " + error.message);
      return;
    }
    fetchTrainingRecords();
  };
  const updateLocation = async (id, fields) => {
    // เคสรูปภาพอย่างเดียว — เก็บไว้ในหน่วยความจำเท่านั้น ยังไม่รองรับ Supabase Storage
    // (ดูโน้ตใน mapLocationRow) ไม่ต้องยิง Supabase หรือ refetch เลยเพื่อไม่ให้ค่าที่เพิ่งตั้ง
    // ถูกเขียนทับกลับเป็น null ทันที
    if (fields.photoUrl !== undefined && Object.keys(fields).length === 1) {
      setLocationPhotos((prev) => ({ ...prev, [id]: fields.photoUrl }));
      return;
    }

    const basicUpdate = {};
    if (fields.name !== undefined) basicUpdate.name = fields.name;
    if (fields.building !== undefined) basicUpdate.building = fields.building === "-" ? null : fields.building;
    if (fields.description !== undefined) basicUpdate.description = fields.description === "-" ? null : fields.description;
    if (fields.riskLevel !== undefined) basicUpdate.risk_level = fields.riskLevel;
    if (Object.keys(basicUpdate).length > 0) {
      await supabase.from("work_locations").update(basicUpdate).eq("id", id);
    }

    // แทนที่รายการความเสี่ยงทั้งหมดใหม่ทุกครั้งที่แก้ไข (ลบของเดิมแล้วใส่ใหม่ ง่ายกว่าไล่ diff
    // ทีละรายการ และจำนวนความเสี่ยงต่อสถานที่มีไม่เยอะจนเป็นปัญหาประสิทธิภาพ)
    if (fields.hazards !== undefined) {
      const { error: delHazErr } = await supabase.from("work_location_hazards").delete().eq("location_id", id);
      if (delHazErr) console.error("delete work_location_hazards error:", delHazErr);
      if (fields.hazards.length > 0) {
        const { error: insHazErr } = await supabase.from("work_location_hazards").insert(
          fields.hazards.map((h) => ({ location_id: id, hazard_type: h }))
        );
        if (insHazErr) {
          alert("บันทึกรูปแบบความเสี่ยงไม่สำเร็จ: " + insHazErr.message);
        }
      }
    }

    if (fields.ppeRequired !== undefined) {
      const { error: delPpeErr } = await supabase.from("location_ppe_requirements").delete().eq("location_id", id);
      if (delPpeErr) console.error("delete location_ppe_requirements error:", delPpeErr);
      if (fields.ppeRequired.length > 0) {
        const { error: insPpeErr } = await supabase.from("location_ppe_requirements").insert(
          fields.ppeRequired.map((p) => ({ location_id: id, ppe_type: p }))
        );
        if (insPpeErr) {
          alert("บันทึกประเภท PPE ที่ต้องใส่ไม่สำเร็จ: " + insPpeErr.message);
        }
      }
    }

    // บันทึกผลประเมินความเสี่ยงเป็น "ประวัติรอบใหม่" เสมอ ไม่ทับของเดิม ตามที่ออกแบบไว้ใน
    // schema (location_risk_assessments เป็นตารางประวัติ) พร้อมอัปเดต risk_level ล่าสุด
    // ไว้ที่ work_locations ด้วย (denormalized ตามที่ออกแบบไว้)
    if (fields.riskAssessment) {
      await supabase.from("location_risk_assessments").insert({
        organization_id: currentUser.organizationId,
        location_id: id,
        assessed_by: currentUser.id,
        risk_level: fields.riskAssessment.riskLevel,
        findings: fields.riskAssessment.findings === "-" ? null : fields.riskAssessment.findings,
        control_measures: fields.riskAssessment.controlMeasures === "-" ? null : fields.riskAssessment.controlMeasures,
        next_assessment_due: fields.riskAssessment.nextDue || null,
      });
      await supabase.from("work_locations").update({ risk_level: fields.riskAssessment.riskLevel }).eq("id", id);
    }

    fetchLocations();
  };
  const deleteLocation = async (id) => {
    const { error } = await supabase.from("work_locations").update({ is_active: false }).eq("id", id);
    if (error) {
      console.error("deleteLocation error:", error);
      alert("ลบสถานที่ไม่สำเร็จ: " + error.message);
      return;
    }
    fetchLocations();
  };
  // ดึงอุปกรณ์ความปลอดภัยพร้อมประวัติการตรวจของแต่ละชิ้น (คนละตารางเหมือน incidents/updates
  // จึง join ฝั่งโค้ดด้วยแพทเทิร์นเดียวกัน)
  async function fetchEquipment() {
    setEquipmentLoading(true);
    const { data: equipmentRows, error } = await supabase
      .from("safety_equipment_units")
      .select("id, category, asset_code, name, brand, model, location, inspection_frequency, last_inspection_date, next_inspection_due, pending_reinspection_due, status")
      .eq("is_active", true)
      .order("location");
    if (error) {
      console.error("fetchEquipment error:", error);
      setEquipmentLoading(false);
      return;
    }
    const equipmentIds = (equipmentRows || []).map((r) => r.id);
    let historyByEquipment = {};
    if (equipmentIds.length > 0) {
      const { data: inspectionRows } = await supabase
        .from("equipment_inspection_records")
        .select("id, equipment_unit_id, inspected_by, inspection_date, result, findings, action_taken, corrective_deadline, is_follow_up")
        .in("equipment_unit_id", equipmentIds)
        .order("inspection_date", { ascending: false });
      const inspectorIds = [...new Set((inspectionRows || []).map((r) => r.inspected_by).filter(Boolean))];
      let inspectorNameById = {};
      if (inspectorIds.length > 0) {
        const { data: userRows } = await supabase.from("users").select("id, full_name").in("id", inspectorIds);
        (userRows || []).forEach((u) => { inspectorNameById[u.id] = u.full_name; });
      }
      (inspectionRows || []).forEach((r) => {
        if (!historyByEquipment[r.equipment_unit_id]) historyByEquipment[r.equipment_unit_id] = [];
        historyByEquipment[r.equipment_unit_id].push(mapInspectionRow(r, inspectorNameById));
      });
    }
    setEquipmentData(
      (equipmentRows || []).map((r) => ({ ...mapEquipmentRow(r), history: historyByEquipment[r.id] || [] }))
    );
    setEquipmentLoading(false);
  }

  const addEquipment = async (unit) => {
    const { data, error } = await supabase
      .from("safety_equipment_units")
      .insert({
        organization_id: currentUser.organizationId,
        category: equipmentCategoryUiToDb[unit.name] || "other",
        asset_code: unit.code,
        name: unit.name,
        brand: unit.brand === "-" ? null : unit.brand,
        location: unit.location,
        inspection_frequency: inspectionFrequencyUiToDb[unit.frequency] || "custom",
        status: "normal",
      })
      .select()
      .single();
    if (error) {
      alert("เพิ่มอุปกรณ์ไม่สำเร็จ: " + error.message);
      return;
    }
    setEquipmentData([...equipment, { ...mapEquipmentRow(data), history: [] }]);
  };

  const deleteEquipmentUnit = async (id) => {
    const { error } = await supabase.from("safety_equipment_units").delete().eq("id", id);
    if (error) {
      alert("ลบอุปกรณ์ไม่สำเร็จ: " + error.message);
      return;
    }
    setEquipmentData(equipment.filter((eq) => eq.id !== id));
  };

  // บันทึกผลตรวจสภาพ 1 รายการ แล้วอัปเดตอุปกรณ์: วันตรวจล่าสุด, กำหนดตรวจครั้งถัดไป
  // (คำนวณจากรอบตรวจของอุปกรณ์ชิ้นนี้), สถานะ, และกำหนดตรวจซ้ำนอกรอบ (ถ้าผลตรวจไม่ผ่าน)
  const addInspection = async (equipmentId, record) => {
    const eq = equipment.find((e) => e.id === equipmentId);
    const { data, error } = await supabase
      .from("equipment_inspection_records")
      .insert({
        organization_id: currentUser.organizationId,
        equipment_unit_id: equipmentId,
        inspected_by: currentUser.id,
        inspection_date: record.date,
        result: inspectionResultUiToDb[record.result] || "pass",
        findings: record.findings,
        action_taken: record.action,
        corrective_deadline: record.correctiveDeadline,
        is_follow_up: record.isFollowUp,
      })
      .select()
      .single();
    if (error) {
      alert("บันทึกผลตรวจไม่สำเร็จ: " + error.message);
      return;
    }
    const failed = record.result === "ไม่ผ่าน";
    const dbFreqKey = eq ? inspectionFrequencyUiToDb[eq.frequency] : null;
    const nextDue = addDaysIso(record.date, inspectionFrequencyDays[dbFreqKey] ?? 30);
    const newStatus = failed ? "pending_reinspection" : "normal";
    await supabase
      .from("safety_equipment_units")
      .update({
        last_inspection_date: record.date,
        next_inspection_due: nextDue,
        status: newStatus,
        pending_reinspection_due: failed ? record.correctiveDeadline : null,
      })
      .eq("id", equipmentId);

    const inspectorNameById = { [currentUser.id]: currentUser.name };
    setEquipmentData(
      equipment.map((e) =>
        e.id === equipmentId
          ? {
              ...e,
              history: [mapInspectionRow(data, inspectorNameById), ...e.history],
              lastDate: record.date,
              nextDate: nextDue,
              status: failed ? "รอตรวจซ้ำ" : "ปกติ",
              pendingReinspectionDue: failed ? record.correctiveDeadline : null,
            }
          : e
      )
    );
  };

  const deleteInspection = async (equipmentId, rowId) => {
    const { error } = await supabase.from("equipment_inspection_records").delete().eq("id", rowId);
    if (error) {
      alert("ลบผลตรวจไม่สำเร็จ: " + error.message);
      return;
    }
    const eq = equipment.find((e) => e.id === equipmentId);
    const newHistory = (eq?.history || []).filter((h) => h.rowId !== rowId);
    const latest = newHistory[0];
    const dbFreqKey = eq ? inspectionFrequencyUiToDb[eq.frequency] : null;
    const latestFailed = latest?.result === "ไม่ผ่าน";
    const newLastDate = latest ? latest.date : null;
    const newNextDue = latest ? addDaysIso(latest.date, inspectionFrequencyDays[dbFreqKey] ?? 30) : null;
    await supabase
      .from("safety_equipment_units")
      .update({
        last_inspection_date: newLastDate,
        next_inspection_due: newNextDue,
        status: latest ? (latestFailed ? "pending_reinspection" : "normal") : "normal",
        pending_reinspection_due: latest && latestFailed ? latest.correctiveDeadline : null,
      })
      .eq("id", equipmentId);
    setEquipmentData(
      equipment.map((e) =>
        e.id === equipmentId
          ? {
              ...e,
              history: newHistory,
              lastDate: newLastDate || "-",
              nextDate: newNextDue || "-",
              status: latest ? (latestFailed ? "รอตรวจซ้ำ" : "ปกติ") : "ปกติ",
              pendingReinspectionDue: latest && latestFailed ? latest.correctiveDeadline : null,
            }
          : e
      )
    );
  };

  async function fetchMachinery() {
    setMachineryLoading(true);
    const { data: machineryRows, error } = await supabase
      .from("machinery")
      .select("id, category, asset_code, location, inspection_frequency_months, last_inspection_date, next_inspection_due, status")
      .eq("is_active", true)
      .order("location");
    if (error) {
      console.error("fetchMachinery error:", error);
      setMachineryLoading(false);
      return;
    }
    const machineryIds = (machineryRows || []).map((r) => r.id);
    let historyByMachinery = {};
    if (machineryIds.length > 0) {
      const { data: inspectionRows } = await supabase
        .from("machinery_inspection_records")
        .select("id, machinery_id, inspected_at, engineer_name, engineer_license_number, certificate_number, result, findings, corrective_deadline")
        .in("machinery_id", machineryIds)
        .order("inspected_at", { ascending: false });
      (inspectionRows || []).forEach((r) => {
        if (!historyByMachinery[r.machinery_id]) historyByMachinery[r.machinery_id] = [];
        historyByMachinery[r.machinery_id].push(mapMachineryInspectionRow(r));
      });
    }
    setMachineryData(
      (machineryRows || []).map((r) => ({ ...mapMachineryRow(r), history: historyByMachinery[r.id] || [] }))
    );
    setMachineryLoading(false);
  }

  const addMachinery = async (form) => {
    const { data, error } = await supabase
      .from("machinery")
      .insert({
        organization_id: currentUser.organizationId,
        category: machineryCategoryUiToDb[form.name] || "other",
        asset_code: form.code,
        name: form.name,
        location: form.location,
        inspection_frequency_months: Number(form.frequencyMonths) || 12,
        status: "normal",
      })
      .select()
      .single();
    if (error) {
      alert("เพิ่มเครื่องจักรไม่สำเร็จ: " + error.message);
      return;
    }
    setMachineryData([...machinery, { ...mapMachineryRow(data), history: [] }]);
  };

  const deleteMachineryUnit = async (id) => {
    const { error } = await supabase.from("machinery").delete().eq("id", id);
    if (error) {
      alert("ลบเครื่องจักรไม่สำเร็จ: " + error.message);
      return;
    }
    setMachineryData(machinery.filter((m) => m.id !== id));
  };

  const addMachineryInspection = async (machineryId, record) => {
    const m = machinery.find((x) => x.id === machineryId);
    const { data, error } = await supabase
      .from("machinery_inspection_records")
      .insert({
        organization_id: currentUser.organizationId,
        machinery_id: machineryId,
        inspected_at: record.date,
        engineer_name: record.engineerName === "-" ? null : record.engineerName,
        engineer_license_number: record.engineerLicenseNumber === "-" ? null : record.engineerLicenseNumber,
        certificate_number: record.certificateNumber === "-" ? null : record.certificateNumber,
        result: machineryResultUiToDb[record.result] || "pass",
        findings: record.findings === "-" ? null : record.findings,
        corrective_deadline: record.correctiveDeadline,
      })
      .select()
      .single();
    if (error) {
      alert("บันทึกผลตรวจไม่สำเร็จ: " + error.message);
      return;
    }
    const failed = record.result === "ไม่ผ่าน";
    const nextDue = addMonthsIso(record.date, m?.frequencyMonths || 12);
    const newStatus = failed ? "pending_reinspection" : "normal";
    await supabase
      .from("machinery")
      .update({ last_inspection_date: record.date, next_inspection_due: nextDue, status: newStatus })
      .eq("id", machineryId);
    setMachineryData(
      machinery.map((x) =>
        x.id === machineryId
          ? { ...x, history: [mapMachineryInspectionRow(data), ...x.history], lastDate: record.date, nextDate: nextDue, status: failed ? "รอตรวจซ้ำ" : "ปกติ" }
          : x
      )
    );
  };

  const deleteMachineryInspection = async (machineryId, rowId) => {
    const { error } = await supabase.from("machinery_inspection_records").delete().eq("id", rowId);
    if (error) {
      alert("ลบผลตรวจไม่สำเร็จ: " + error.message);
      return;
    }
    const m = machinery.find((x) => x.id === machineryId);
    const newHistory = (m?.history || []).filter((h) => h.rowId !== rowId);
    const latest = newHistory[0];
    const latestFailed = latest?.result === "ไม่ผ่าน";
    const newLastDate = latest ? latest.date : null;
    const newNextDue = latest ? addMonthsIso(latest.date, m?.frequencyMonths || 12) : null;
    await supabase
      .from("machinery")
      .update({
        last_inspection_date: newLastDate,
        next_inspection_due: newNextDue,
        status: latest ? (latestFailed ? "pending_reinspection" : "normal") : "normal",
      })
      .eq("id", machineryId);
    setMachineryData(
      machinery.map((x) =>
        x.id === machineryId
          ? { ...x, history: newHistory, lastDate: newLastDate || "-", nextDate: newNextDue || "-", status: latest ? (latestFailed ? "รอตรวจซ้ำ" : "ปกติ") : "ปกติ" }
          : x
      )
    );
  };

  const selectPage = (key) => {
    setPage(key);
    setMobileMenuOpen(false); // ปิดเมนูอัตโนมัติหลังเลือกเมนูบนมือถือ
  };

  return (
    <div className="min-h-[600px] bg-white font-sans sm:flex sm:items-start">
      {/* แถบบนสุดสำหรับมือถือ — มีปุ่มเปิดเมนู */}
      <div className="sm:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <p className="font-semibold text-slate-900 text-[15px]">JorPor</p>
        <button
          onClick={() => setMobileMenuOpen(true)}
          aria-label="เปิดเมนู"
          className="p-1.5 text-slate-600"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* ฉากหลังทึบแสงเมื่อเปิดเมนูบนมือถือ กดเพื่อปิด */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="sm:hidden fixed inset-0 bg-black/30 z-30"
        />
      )}

      {/* เมนูมือถือ: fixed drawer เลื่อนเข้า-ออก แสดงเฉพาะจอเล็กกว่า sm */}
      <div
        className={`sm:hidden fixed inset-y-0 left-0 z-40 w-56 bg-white border-r border-slate-200 p-3
          transform transition-transform duration-200
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <SidebarNav
          page={page}
          selectPage={selectPage}
          equipmentGroupOpen={equipmentGroupOpen}
          setEquipmentGroupOpen={setEquipmentGroupOpen}
          currentUser={currentUser}
          tierPermissions={tierPermissions}
          onLogout={handleLogout}
        />
      </div>

      {/* เมนู desktop: แสดงตลอดเวลา อยู่ในโครง grid ปกติ ไม่ใช้ fixed/translate เลย */}
      <div className="hidden sm:flex sm:flex-col sm:w-[224px] sm:shrink-0 sm:h-screen sm:sticky sm:top-0 sm:overflow-y-auto border-r border-slate-200 p-3 bg-white">
        <SidebarNav
          page={page}
          selectPage={selectPage}
          equipmentGroupOpen={equipmentGroupOpen}
          setEquipmentGroupOpen={setEquipmentGroupOpen}
          currentUser={currentUser}
          tierPermissions={tierPermissions}
          onLogout={handleLogout}
        />
      </div>

      <div className="p-4 sm:p-6 sm:flex-1 overflow-auto min-w-0 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
        {page === "dashboard" && (
          <Dashboard
            incidents={incidents}
            ppe={ppe}
            equipment={equipment}
            locations={locations}
            noncompliance={noncompliance}
            environmentalMeasurements={environmentalMeasurements}
            employees={employees}
            trainingRequirements={trainingRequirements}
            trainingRecords={trainingRecords}
            trainingCourses={trainingCourses}
            ltiBaselineDate={ltiBaselineDate}
            onSetLtiBaselineDate={setLtiBaselineDate}
            currentUser={currentUser}
          />
        )}
        {page === "incidents" && (
          <IncidentsPage
            incidents={incidents}
            onAdd={addIncident}
            onUpdate={updateIncident}
            onAddProgress={addIncidentProgress}
            onRemoveProgress={removeIncidentProgress}
            onDeleteIncident={deleteIncident}
            onAddInjured={addInjuredEmployee}
            onUpdateInjured={updateInjuredEmployee}
            onRemoveInjured={removeInjuredEmployee}
            locations={locations}
            employees={employees}
          />
        )}
        {page === "ppe" && (
          <PpePage
            employees={employees}
            ppe={ppe}
            catalog={ppeCatalog}
            onAddIssuance={addPpeIssuance}
            onDeleteIssuance={deletePpeIssuance}
            onAddCatalogItem={addPpeCatalogItem}
            onUpdateCatalogItem={updatePpeCatalogItem}
            onDeleteCatalogItem={deletePpeCatalogItem}
          />
        )}
        {page === "unsafeActs" && (
          <UnsafeActsPage employees={employees} locations={locations} records={noncompliance} onAdd={addNoncompliance} onDelete={deleteNoncompliance} />
        )}
        {page === "chemicals" && (
          <ChemicalsPage chemicals={chemicals} currentUserName={currentUser.name} onAdd={addChemical} onDelete={deleteChemical} />
        )}
        {page === "govReports" && (
          <GovReportsPage
            orgProfile={currentUser.orgProfile}
            onUpdateOrgProfile={updateOrgProfile}
            workingHours={workingHours}
            onUpsertWorkingHours={upsertWorkingHours}
            onDeleteWorkingHours={deleteWorkingHours}
            incidents={incidents}
            employees={employees}
            chemicals={chemicals}
            equipment={equipment}
            machinery={machinery}
            environmentalMeasurements={environmentalMeasurements}
            trainingRecords={trainingRecords}
            trainingCourses={trainingCourses}
            locations={locations}
          />
        )}
        {page === "equipment" && (
          <EquipmentPage
            equipment={equipment}
            onAddInspection={addInspection}
            onAddEquipment={addEquipment}
            onDeleteInspection={deleteInspection}
            onDeleteEquipment={deleteEquipmentUnit}
          />
        )}
        {page === "machinery" && (
          <MachineryPage
            machinery={machinery}
            onAddInspection={addMachineryInspection}
            onAddMachinery={addMachinery}
            onDeleteInspection={deleteMachineryInspection}
            onDeleteMachinery={deleteMachineryUnit}
          />
        )}
        {page === "locations" && (
          <LocationsPage
            locations={locations}
            incidents={incidents}
            measurements={environmentalMeasurements}
            onAdd={addLocation}
            onUpdate={updateLocation}
            onDelete={deleteLocation}
            onAddMeasurement={addEnvironmentalMeasurement}
            onUpdateMeasurement={updateEnvironmentalMeasurement}
            onDeleteMeasurement={deleteEnvironmentalMeasurement}
          />
        )}
        {page === "employees" && (
          <EmployeesPage
            employees={employees}
            locations={locations}
            ppe={ppe}
            noncompliance={noncompliance}
            incidents={incidents}
            trainingRecords={trainingRecords}
            trainingCourses={trainingCourses}
            employeeLimit={employeeLimit}
            onAdd={addEmployee}
            onAddMany={addManyEmployees}
            onDelete={deleteEmployee}
            onUpdate={updateEmployee}
          />
        )}
        {page === "environmental" && (
          <EnvironmentalMonitoringPage
            locations={locations}
            measurements={environmentalMeasurements}
            onAdd={addEnvironmentalMeasurement}
            onUpdateMeasurement={updateEnvironmentalMeasurement}
            onDeleteMeasurement={deleteEnvironmentalMeasurement}
          />
        )}
        {page === "trainingMatrix" && (
          <TrainingMatrixPage
            employees={employees}
            locations={locations}
            courses={trainingCourses}
            requirements={trainingRequirements}
            records={trainingRecords}
            onAddRequirement={addTrainingRequirement}
            onRemoveRequirement={removeTrainingRequirement}
            onUpsertRecord={upsertTrainingRecord}
            onDeleteRecord={deleteTrainingRecord}
          />
        )}
        {page === "checklist" && <ChecklistPage />}
      </div>
    </div>
  );
}
