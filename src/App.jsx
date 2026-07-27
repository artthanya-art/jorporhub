import { useState, useRef, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";
import {
  LayoutDashboard, AlertTriangle, HardHat, Wrench, ClipboardCheck,
  Plus, X, Camera, ArrowLeft, ChevronRight, Menu, Users, MapPin, ShieldAlert,
  Wind, GraduationCap, LogOut,
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
    id, name,
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
  };
}

// รวมข้อมูล 3 ตาราง (work_locations + work_location_hazards + location_risk_assessments
// รอบล่าสุด) ให้เป็น object เดียวที่หน้าจอใช้งานอยู่แล้ว — assessorName ใช้ currentUser.name
// ตรงๆ แทนการ join ไปตาราง users เพราะตอนนี้ 1 บริษัท = 1 ผู้ใช้เท่านั้น
function mapLocationRow(loc, hazardRows, latestAssessment, assessorName) {
  return {
    id: loc.id,
    name: loc.name,
    building: loc.building || "-",
    description: loc.description || "-",
    riskLevel: loc.risk_level,
    hazards: (hazardRows || []).map((h) => h.hazard_type),
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
  silver: ["dashboard", "incidents", "ppe", "equipment", "employees", "locations", "checklist"],
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
function getRequiredCourseIds(employee, locations, requirements) {
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
  employees, trainingRequirements, trainingRecords, ltiBaselineDate, onSetLtiBaselineDate, currentUser,
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
    getRequiredCourseIds(emp, locations, trainingRequirements).forEach((cid) => {
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
        <h1 className="text-lg font-semibold">สวัสดี {currentUser?.name ?? ""}</h1>
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
        <label className="text-xs text-slate-500">
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
          <p className="text-sm font-semibold text-slate-900 mb-3">อุบัติเหตุล่าสุด</p>
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
          <p className="text-sm font-semibold text-slate-900 mb-3">อุปกรณ์ที่ต้องเฝ้าระวัง</p>
          <div className="space-y-3">
            {equipment.filter((e) => e.status !== "ปกติ").map((eq) => (
              <div key={eq.id} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm text-slate-800">{eq.name} · {eq.code}</p>
                  <p className="text-xs text-slate-400 mt-0.5">ครบกำหนด {eq.nextDate}</p>
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
          <p className="text-sm font-semibold text-slate-900 mb-3">สถานที่ที่ต้องเฝ้าระวัง</p>
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
          <p className="text-sm font-semibold text-slate-900 mb-3">การกระทำที่ไม่ปลอดภัยล่าสุด</p>
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
        <p className="text-sm font-semibold text-slate-900 mb-3">หลักสูตรที่ยังไม่ผ่านตาม Training Matrix</p>
        <Card className="p-0 overflow-hidden">
          {trainingGaps.length === 0 ? (
            <p className="text-sm text-slate-400 p-4">พนักงานทุกคนผ่านหลักสูตรที่กำหนดครบแล้ว</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left">
                    <th className="px-4 py-2.5 font-medium">พนักงาน</th>
                    <th className="px-4 py-2.5 font-medium">หลักสูตร</th>
                    <th className="px-4 py-2.5 font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {trainingGaps.slice(0, 5).map((g, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-4 py-2.5">{g.employee.name}</td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {initialTrainingCourses.find((c) => c.id === g.courseId)?.name ?? "-"}
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
        <p className="text-sm font-semibold text-slate-900 mb-3">ผลการตรวจวัดสิ่งแวดล้อมที่ไม่ผ่าน</p>
        <Card className="p-0 overflow-hidden">
          {envFailingMeasurements.length === 0 ? (
            <p className="text-sm text-slate-400 p-4">ยังไม่มีผลตรวจวัดที่ไม่ผ่านมาตรฐาน</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left">
                    <th className="px-4 py-2.5 font-medium">สถานที่</th>
                    <th className="px-4 py-2.5 font-medium">ประเภทการตรวจวัด</th>
                    <th className="px-4 py-2.5 font-medium">จุดที่ไม่ผ่าน</th>
                    <th className="px-4 py-2.5 font-medium">วันที่วัด</th>
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

function IncidentsPage({ incidents, onAdd, onUpdate, onAddProgress, onDeleteIncident, locations, employees }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [locationMode, setLocationMode] = useState("select"); // "select" | "custom"
  const [form, setForm] = useState({
    location: "", type: "หกล้ม", severity: "ปานกลาง", description: "",
    incidentDate: todayIso(),
  });

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
      status: "รายงานแล้ว",
      injuredEmployees: [],
      description: form.description || "-",
      updates: [],
    });
    setForm({ location: "", type: "หกล้ม", severity: "ปานกลาง", description: "", incidentDate: todayIso() });
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
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">ทะเบียนอุบัติเหตุ</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <label className="text-sm text-slate-500">วันเกิดเหตุล่าสุด:</label>
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
            <p className="text-sm font-semibold text-slate-900">รายงานอุบัติเหตุใหม่</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">สถานที่</label>
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
              <label className="text-xs text-slate-500 block mb-1">ลักษณะการบาดเจ็บ</label>
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
          <div className="mb-3">
            <label className="text-xs text-slate-500 block mb-1">
              วันที่เกิดเหตุ <span className="text-slate-400">(ค่าเริ่มต้นคือวันนี้ แก้ไขได้กรณีรายงานย้อนหลัง)</span>
            </label>
            <input
              type="date"
              value={form.incidentDate}
              onChange={(e) => setForm({ ...form, incidentDate: e.target.value })}
              className="w-full sm:w-56 border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="mb-3">
            <label className="text-xs text-slate-500 block mb-1">ระดับความรุนแรง</label>
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
            <p className="text-xs text-slate-400 mt-1">
              เพิ่มพนักงานที่ได้รับบาดเจ็บและจำนวนวันหยุดงานได้ที่หน้ารายละเอียดหลังบันทึกรายงานนี้
            </p>
          </div>
          <div className="mb-4">
            <label className="text-xs text-slate-500 block mb-1">รายละเอียดเหตุการณ์</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="อธิบายสิ่งที่เกิดขึ้นตามลำดับเวลา"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
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
              <th className="px-4 py-2.5 font-medium">สถานที่</th>
              <th className="px-4 py-2.5 font-medium">ลักษณะ</th>
              <th className="px-4 py-2.5 font-medium">ความรุนแรง</th>
              <th className="px-4 py-2.5 font-medium">วันที่</th>
              <th className="px-4 py-2.5 font-medium">หยุดงาน</th>
              <th className="px-4 py-2.5 font-medium">สถานะ</th>
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

function IncidentDetail({ incident, employees, onBack, onUpdate, onAddProgress }) {
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({
    location: incident.location,
    severity: incident.severity,
    description: incident.description,
    status: incident.status,
  });
  const [progressNote, setProgressNote] = useState("");
  const [progressStatus, setProgressStatus] = useState("");
  const [newInjured, setNewInjured] = useState({ employeeId: "", lostWorkdays: "0", injuryType: "" });

  const nameOf = (id) => employees.find((e) => e.id === id)?.name ?? "-";

  const saveEdit = () => {
    onUpdate(incident.id, {
      location: edit.location,
      severity: edit.severity,
      description: edit.description,
      status: edit.status,
    });
    setEditing(false);
  };

  const submitProgress = () => {
    if (!progressNote.trim()) return;
    onAddProgress(incident.id, {
      date: todayIso(),
      by: "ผู้ใช้งานปัจจุบัน",
      note: progressNote,
      newStatus: progressStatus || null,
    });
    setProgressNote("");
    setProgressStatus("");
  };

  const addInjuredEmployee = () => {
    if (!newInjured.employeeId) return;
    onUpdate(incident.id, {
      injuredEmployees: [
        ...incident.injuredEmployees,
        {
          employeeId: Number(newInjured.employeeId),
          lostWorkdays: Number(newInjured.lostWorkdays) || 0,
          injuryType: newInjured.injuryType || "-",
        },
      ],
    });
    setNewInjured({ employeeId: "", lostWorkdays: "0", injuryType: "" });
  };

  const updateInjuredField = (idx, field, value) => {
    const updated = incident.injuredEmployees.map((e, i) =>
      i === idx ? { ...e, [field]: field === "lostWorkdays" ? Number(value) || 0 : value } : e
    );
    onUpdate(incident.id, { injuredEmployees: updated });
  };

  const removeInjuredEmployee = (idx) => {
    onUpdate(incident.id, { injuredEmployees: incident.injuredEmployees.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> กลับไปทะเบียนอุบัติเหตุ
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{incident.location} · {incident.type}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {formatThaiDate(incident.incidentDate)} · ความรุนแรง {incident.severity}
          </p>
        </div>
        <Badge tone={statusTone(incident.status)}>{incident.status}</Badge>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900 mb-3">พนักงานที่ได้รับบาดเจ็บ</p>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-left">
                <th className="px-4 py-2.5 font-medium">พนักงาน</th>
                <th className="px-4 py-2.5 font-medium">ลักษณะการบาดเจ็บ</th>
                <th className="px-4 py-2.5 font-medium">จำนวนวันหยุดงาน</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {incident.injuredEmployees.map((e, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="px-4 py-2.5">{nameOf(e.employeeId)}</td>
                  <td className="px-4 py-2.5">
                    <input
                      value={e.injuryType || ""}
                      onChange={(ev) => updateInjuredField(idx, "injuryType", ev.target.value)}
                      placeholder="เช่น มือบาดจากใบมีด"
                      className="w-full min-w-[10rem] border border-slate-300 rounded-lg px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      min="0"
                      value={e.lostWorkdays}
                      onChange={(ev) => updateInjuredField(idx, "lostWorkdays", ev.target.value)}
                      className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-sm"
                    />
                    <span className="text-slate-500 ml-1.5">วัน</span>
                    {e.lostWorkdays > 0 && <span className="text-xs text-red-600 ml-2">(LTI)</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => removeInjuredEmployee(idx)} className="text-xs text-slate-400 underline hover:text-red-600">
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
              {incident.injuredEmployees.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm text-slate-400">ไม่มีพนักงานได้รับบาดเจ็บที่บันทึกไว้</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50">
            <select
              value={newInjured.employeeId}
              onChange={(e) => setNewInjured({ ...newInjured, employeeId: e.target.value })}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="">เลือกพนักงาน...</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <input
              value={newInjured.injuryType}
              onChange={(e) => setNewInjured({ ...newInjured, injuryType: e.target.value })}
              placeholder="ลักษณะการบาดเจ็บ"
              className="flex-1 min-w-[9rem] border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
            />
            <input
              type="number"
              min="0"
              value={newInjured.lostWorkdays}
              onChange={(e) => setNewInjured({ ...newInjured, lostWorkdays: e.target.value })}
              className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
              placeholder="วัน"
            />
            <button onClick={addInjuredEmployee} className="flex items-center gap-1 text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg">
              <Plus size={14} /> เพิ่มพนักงาน
            </button>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-900">รายละเอียดและสถานะ</p>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-xs text-slate-500 underline hover:text-slate-700">
              แก้ไข
            </button>
          )}
        </div>

        {!editing ? (
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{incident.description}</p>
        ) : (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">สถานที่</label>
                <input
                  value={edit.location}
                  onChange={(e) => setEdit({ ...edit, location: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">สถานะ</label>
                <select
                  value={edit.status}
                  onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  {incidentStatusOptions.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">ระดับความรุนแรง</label>
              <select
                value={edit.severity}
                onChange={(e) => setEdit({ ...edit, severity: e.target.value })}
                className="w-full sm:w-1/2 border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                {["เกือบเกิดเหตุ", "เล็กน้อย", "ปานกลาง", "รุนแรง"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">รายละเอียดเหตุการณ์</label>
              <textarea
                rows={3}
                value={edit.description}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
              />
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
        <p className="text-sm font-semibold text-slate-900 mb-3">ความคืบหน้า</p>
        <Card className="mb-4">
          <label className="text-xs text-slate-500 block mb-1">บันทึกความคืบหน้าใหม่</label>
          <textarea
            rows={2}
            value={progressNote}
            onChange={(e) => setProgressNote(e.target.value)}
            placeholder="เช่น ติดตั้งการ์ดป้องกันเพิ่มเติมแล้ว รอทดสอบใช้งานจริง"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none mb-3"
          />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">เปลี่ยนสถานะไปด้วย (ไม่บังคับ):</label>
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
          {[...incident.updates].reverse().map((u, i) => {
            const originalIndex = incident.updates.length - 1 - i;
            return (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center pt-1.5">
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                  {i < incident.updates.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
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
                      onConfirm={() =>
                        onUpdate(incident.id, { updates: incident.updates.filter((_, idx) => idx !== originalIndex) })
                      }
                    />
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{u.note}</p>
                </div>
              </div>
            );
          })}
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
                <p className="text-sm font-semibold text-slate-900">{g.name}</p>
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

function NoncomplianceView({ employees, records, onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employeeId: employees[0]?.id, ppeName: "", location: "", date: todayIso(), action: "เตือนวาจา", notes: "" });
  const nameOf = (id) => employees.find((e) => e.id === id)?.name ?? "-";

  const submit = () => {
    if (!form.ppeName.trim() || !form.location.trim()) return;
    onAdd({ id: Date.now(), ...form });
    setForm({ employeeId: employees[0]?.id, ppeName: "", location: "", date: todayIso(), action: "เตือนวาจา", notes: "" });
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
            <p className="text-sm font-semibold text-slate-900">บันทึกพบพนักงานไม่สวมใส่ PPE</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">พนักงาน</label>
              <select
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: Number(e.target.value) })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">อุปกรณ์ที่ไม่ได้สวมใส่</label>
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
              <label className="text-xs text-slate-500 block mb-1">สถานที่พบเหตุ</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="เช่น ไลน์ผลิต 2"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">การดำเนินการ</label>
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
              <label className="text-xs text-slate-500 block mb-1">วันที่พบ</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs text-slate-500 block mb-1">หมายเหตุ</label>
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
              <th className="px-4 py-2.5 font-medium">พนักงาน</th>
              <th className="px-4 py-2.5 font-medium">อุปกรณ์ที่ไม่ได้สวมใส่</th>
              <th className="px-4 py-2.5 font-medium">สถานที่</th>
              <th className="px-4 py-2.5 font-medium">วันที่พบ</th>
              <th className="px-4 py-2.5 font-medium">การดำเนินการ</th>
              <th className="px-4 py-2.5 font-medium">สะสม</th>
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

  const selectedCatalogItem = catalog.find((c) => c.id === Number(form.catalogId));
  const computedExpiry = selectedCatalogItem
    ? addDaysIso(form.receivedDate, selectedCatalogItem.lifespanDays)
    : null;

  const nameOf = (id) => employees.find((e) => e.id === id)?.name ?? "-";

  const submit = () => {
    if (!form.employeeId || !selectedCatalogItem || !form.receivedDate) return;
    onAddIssuance({
      id: Date.now(),
      employeeId: Number(form.employeeId),
      catalogId: selectedCatalogItem.id,
      name: selectedCatalogItem.name,
      model: selectedCatalogItem.model || "-",
      standard: selectedCatalogItem.standard,
      issuedDate: form.receivedDate,
      expiry: computedExpiry,
      quantity: Number(form.quantity) || 1,
      reason: form.reason,
    });
    setJustAdded({ employeeName: employees.find((e) => e.id === Number(form.employeeId))?.name, name: selectedCatalogItem.name, expiry: computedExpiry });
    setForm({ ...form, quantity: "1", receivedDate: todayIso(), reason: "initial_issue" });
  };

  const sortedPpe = [...ppe].sort((a, b) => (a.issuedDate < b.issuedDate ? 1 : -1));

  return (
    <div className="space-y-5">
      <Card className="max-w-2xl">
        <p className="text-sm font-semibold text-slate-900 mb-4">บันทึกการเบิก PPE</p>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">พนักงานผู้รับมอบ</label>
            <select
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">ประเภท/รุ่นอุปกรณ์</label>
            <select
              value={form.catalogId}
              onChange={(e) => setForm({ ...form, catalogId: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              {catalog.map((c) => <option key={c.id} value={c.id}>{c.name}{c.model && c.model !== "-" ? ` (${c.model})` : ""}</option>)}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">จำนวน</label>
            <input
              type="number" min="1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">วันที่รับ</label>
            <input
              type="date"
              value={form.receivedDate}
              onChange={(e) => setForm({ ...form, receivedDate: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">เหตุผลการเบิก</label>
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
          <button onClick={submit} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white">
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
        <p className="text-sm font-semibold text-slate-900 mb-3">ประวัติการเบิก PPE</p>
        {sortedPpe.length === 0 ? (
          <Card><p className="text-sm text-slate-400">ยังไม่มีประวัติการเบิก PPE</p></Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left">
                    <th className="px-4 py-2.5 font-medium">พนักงาน</th>
                    <th className="px-4 py-2.5 font-medium">อุปกรณ์</th>
                    <th className="px-4 py-2.5 font-medium">มาตรฐาน</th>
                    <th className="px-4 py-2.5 font-medium">จำนวน</th>
                    <th className="px-4 py-2.5 font-medium">เหตุผลเบิก</th>
                    <th className="px-4 py-2.5 font-medium">วันที่รับ</th>
                    <th className="px-4 py-2.5 font-medium">วันหมดอายุ</th>
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
  const [catalogForm, setCatalogForm] = useState({ name: "", model: "", standard: "", lifespanDays: "180" });
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
    setCatalogForm({ name: "", model: "", standard: "", lifespanDays: "180" });
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
        <p className="text-sm font-semibold text-slate-900">ประเภท/รุ่นอุปกรณ์ในระบบ</p>
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
              <label className="text-xs text-slate-500 block mb-1">ชื่อประเภทอุปกรณ์</label>
              <input
                value={catalogForm.name}
                onChange={(e) => setCatalogForm({ ...catalogForm, name: e.target.value })}
                placeholder="เช่น ที่อุดหูลดเสียง"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">ชื่อรุ่น</label>
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
              <label className="text-xs text-slate-500 block mb-1">มาตรฐานอ้างอิง</label>
              <input
                value={catalogForm.standard}
                onChange={(e) => setCatalogForm({ ...catalogForm, standard: e.target.value })}
                placeholder="เช่น EN 352-2"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">อายุการใช้งาน (วัน)</label>
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
      <h1 className="text-lg font-semibold text-slate-900">ทะเบียน PPE</h1>

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

function UnsafeActsPage({ employees, records, onAdd, onDelete }) {
  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-slate-900">บันทึกการกระทำที่ไม่ปลอดภัย</h1>
      <NoncomplianceView employees={employees} records={records} onAdd={onAdd} onDelete={onDelete} />
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
        date: "วันนี้",
        inspector: "ผู้ใช้งานปัจจุบัน",
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
            <h1 className="text-lg font-semibold text-slate-900">{selected.code}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{selected.location} · {selected.brand}</p>
          </div>
          <Badge tone={statusTone(selected.status)}>{selected.status}</Badge>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="รอบตรวจ" value={selected.frequency} />
          <MetricCard label="ตรวจล่าสุด" value={selected.lastDate} />
          <MetricCard label="กำหนดครั้งถัดไป" value={selected.nextDate} />
        </div>

        {selected.pendingReinspectionDue && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">
              ต้องตรวจซ้ำภายในวันที่ <span className="font-medium">{selected.pendingReinspectionDue}</span>
              {" "}— เป็นการตรวจพิเศษนอกรอบเพื่อยืนยันว่าแก้ไขจากผลตรวจครั้งก่อนเสร็จแล้ว
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">ประวัติการตรวจสภาพ</p>
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
              <p className="text-sm font-semibold text-slate-900">
                {isFollowUpNow ? "บันทึกผลตรวจซ้ำนอกรอบ" : "บันทึกผลตรวจใหม่"}
              </p>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="mb-3">
              <label className="text-xs text-slate-500 block mb-1">ผลตรวจ</label>
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
              <label className="text-xs text-slate-500 block mb-1">สิ่งที่พบ</label>
              <textarea
                rows={2}
                value={form.findings}
                onChange={(e) => setForm({ ...form, findings: e.target.value })}
                placeholder="เช่น แรงดันอากาศต่ำกว่าเกณฑ์"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>
            <div className="mb-3">
              <label className="text-xs text-slate-500 block mb-1">การซ่อม / เปลี่ยนอะไหล่</label>
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
                <label className="text-xs text-slate-500 block mb-1">
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
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center pt-1.5">
                <div className={`w-2 h-2 rounded-full ${h.result === "ไม่ผ่าน" ? "bg-red-500" : h.result === "ผ่านแบบมีข้อสังเกต" ? "bg-amber-500" : "bg-emerald-500"}`} />
                {i < selected.history.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
              </div>
              <div className="pb-4 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-800">
                    {h.date} · {h.inspector}
                    {h.isFollowUp && (
                      <span className="ml-2 text-xs font-normal bg-blue-50 text-blue-700 px-2 py-0.5 rounded">ตรวจพิเศษนอกรอบ</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(h.result)}>{h.result}</Badge>
                    <ConfirmDeleteButton onConfirm={() => onDeleteInspection(selected.id, i)} />
                  </div>
                </div>
                <p className="text-sm text-slate-500 mt-1.5">พบ: {h.findings}</p>
                <p className="text-sm text-slate-700 mt-1">ดำเนินการ: {h.action}</p>
                {h.correctiveDeadline && (
                  <p className="text-sm text-red-600 mt-1">กำหนดแก้ไขภายในวันที่ {h.correctiveDeadline}</p>
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
        <h1 className="text-lg font-semibold text-slate-900">อุปกรณ์ความปลอดภัย</h1>
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
            <p className="text-sm font-semibold text-slate-900">เพิ่มอุปกรณ์ใหม่</p>
            <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">ประเภทอุปกรณ์</label>
              <select
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                {equipmentTypeOptions.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">รหัสอุปกรณ์</label>
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
              <label className="text-xs text-slate-500 block mb-1">ตำแหน่งติดตั้ง</label>
              <input
                value={addForm.location}
                onChange={(e) => setAddForm({ ...addForm, location: e.target.value })}
                placeholder="เช่น อาคาร C ชั้น 2"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">ยี่ห้อ / รุ่น</label>
              <input
                value={addForm.brand}
                onChange={(e) => setAddForm({ ...addForm, brand: e.target.value })}
                placeholder="เช่น Scott Safety AV-3000"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs text-slate-500 block mb-1">รอบตรวจ</label>
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
              <th className="px-4 py-2.5 font-medium">อุปกรณ์ / รหัส</th>
              <th className="px-4 py-2.5 font-medium">ตำแหน่งติดตั้ง</th>
              <th className="px-4 py-2.5 font-medium">รอบตรวจ</th>
              <th className="px-4 py-2.5 font-medium">กำหนดถัดไป</th>
              <th className="px-4 py-2.5 font-medium">สถานะ</th>
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
                    <span className="text-red-600">ตรวจซ้ำ {eq.pendingReinspectionDue}</span>
                  ) : (
                    eq.nextDate
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
// Checklist
// ---------------------------------------------------------------

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
      <h1 className="text-lg font-semibold text-slate-900">แบบตรวจสภาพหน้างานก่อนเริ่มงานเสี่ยงสูง</h1>

      <Card className="max-w-xl">
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">ชื่อโครงการ / งาน</label>
            <input
              value={header.projectName}
              disabled={headerLocked}
              onChange={(e) => setHeader({ ...header, projectName: e.target.value })}
              placeholder="เช่น ซ่อมบำรุงหลังคาโกดัง B"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">ตำแหน่งสถานที่</label>
            <input
              value={header.location}
              disabled={headerLocked}
              onChange={(e) => setHeader({ ...header, location: e.target.value })}
              placeholder="เช่น หลังคาโกดัง B ชั้น 3"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">ประเภทงานเสี่ยงสูง</label>
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
            <label className="text-xs text-slate-500 block mb-1">วันที่จะเข้าทำงาน</label>
            <input
              type="date"
              value={header.scheduledDate}
              disabled={headerLocked}
              onChange={(e) => setHeader({ ...header, scheduledDate: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">เวลาเริ่มงาน</label>
            <input
              type="time"
              value={header.scheduledStart}
              disabled={headerLocked}
              onChange={(e) => setHeader({ ...header, scheduledStart: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">เวลาสิ้นสุดงาน (โดยประมาณ)</label>
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

            <label className="text-xs text-slate-500 block mb-1">หมายเหตุ / ข้อบกพร่องที่พบ</label>
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
                <label className="text-xs text-slate-500 block mb-1">
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
              <p className="font-semibold text-slate-900 mb-1">สรุปสำหรับพิมพ์ประกอบใบอนุญาตเข้าทำงาน</p>
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
        <h1 className="text-lg font-semibold text-slate-900">{employee.name} <span className="text-slate-400 font-normal text-base">· {employee.code || "-"}</span></h1>
        <p className="text-sm text-slate-500 mt-0.5">{employee.position} · {employee.department}</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900 mb-3">ประวัติรับมอบ PPE</p>
        {employeePpe.length === 0 ? (
          <Card><p className="text-sm text-slate-400">ยังไม่มีประวัติรับมอบ PPE</p></Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left">
                    <th className="px-4 py-2.5 font-medium">อุปกรณ์</th>
                    <th className="px-4 py-2.5 font-medium">มาตรฐาน</th>
                    <th className="px-4 py-2.5 font-medium">จำนวน</th>
                    <th className="px-4 py-2.5 font-medium">เหตุผลเบิก</th>
                    <th className="px-4 py-2.5 font-medium">วันที่รับ</th>
                    <th className="px-4 py-2.5 font-medium">วันหมดอายุ</th>
                    <th className="px-4 py-2.5 font-medium">สถานะ</th>
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
        <p className="text-sm font-semibold text-slate-900 mb-3">ประวัติการอบรม</p>
        {employeeTrainings.length === 0 ? (
          <Card><p className="text-sm text-slate-400">ยังไม่มีประวัติการอบรม</p></Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left">
                    <th className="px-4 py-2.5 font-medium">หลักสูตร</th>
                    <th className="px-4 py-2.5 font-medium">วันที่อบรมผ่าน</th>
                    <th className="px-4 py-2.5 font-medium">วันหมดอายุ</th>
                    <th className="px-4 py-2.5 font-medium">สถานะ</th>
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
        <p className="text-sm font-semibold text-slate-900 mb-3">ประวัติไม่ปฏิบัติตาม</p>
        {employeeNoncompliance.length === 0 ? (
          <Card><p className="text-sm text-slate-400">ยังไม่มีประวัติไม่ปฏิบัติตาม</p></Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left">
                    <th className="px-4 py-2.5 font-medium">อุปกรณ์ที่ไม่ได้สวมใส่</th>
                    <th className="px-4 py-2.5 font-medium">สถานที่</th>
                    <th className="px-4 py-2.5 font-medium">วันที่พบ</th>
                    <th className="px-4 py-2.5 font-medium">การดำเนินการ</th>
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
        <p className="text-sm font-semibold text-slate-900 mb-3">ประวัติอุบัติเหตุ</p>
        {employeeIncidents.length === 0 ? (
          <Card><p className="text-sm text-slate-400">ยังไม่มีประวัติอุบัติเหตุ</p></Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left">
                    <th className="px-4 py-2.5 font-medium">วันที่</th>
                    <th className="px-4 py-2.5 font-medium">สถานที่</th>
                    <th className="px-4 py-2.5 font-medium">ลักษณะการบาดเจ็บ</th>
                    <th className="px-4 py-2.5 font-medium">หยุดงาน</th>
                    <th className="px-4 py-2.5 font-medium">สถานะเคส</th>
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
  const [form, setForm] = useState({ code: "", name: "", position: "", department: "", primaryLocationId: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ code: "", name: "", position: "", department: "", primaryLocationId: "" });
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
    });
    setForm({ code: "", name: "", position: "", department: "", primaryLocationId: "" });
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
        <h1 className="text-lg font-semibold text-slate-900">ทะเบียนพนักงาน</h1>
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
            <p className="text-sm font-semibold text-slate-900">เพิ่มพนักงานใหม่</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <div className="grid sm:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">รหัสพนักงาน</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="เช่น EMP-004"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">ชื่อ-สกุล</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น สมหญิง รักงาน"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">ตำแหน่ง</label>
              <input
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                placeholder="เช่น ช่างเทคนิค"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">แผนก / หน่วยงาน</label>
              <input
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="เช่น ไลน์ผลิต 1"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">สถานที่ประจำ</label>
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
              <th className="px-4 py-2.5 font-medium">รหัสพนักงาน</th>
              <th className="px-4 py-2.5 font-medium">ชื่อ-สกุล</th>
              <th className="px-4 py-2.5 font-medium">ตำแหน่ง</th>
              <th className="px-4 py-2.5 font-medium">แผนก</th>
              <th className="px-4 py-2.5 font-medium">สถานที่ประจำ</th>
              <th className="px-4 py-2.5 font-medium">PPE ที่ถือครอง</th>
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
                    <td className="px-4 py-2 text-slate-400">-</td>
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
        <p className="text-sm font-semibold text-slate-900">{isEditMode ? "แก้ไขผลตรวจวัด" : "บันทึกผลตรวจวัดใหม่"}</p>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X size={18} />
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">ประเภทการตรวจวัด</label>
          <select
            value={shared.measurementType}
            onChange={(e) => setShared({ ...shared, measurementType: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            {measurementTypeOptions.map((t) => <option key={t} value={t}>{measurementTypeLabel[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">หน่วย</label>
          <input
            value={shared.unit}
            onChange={(e) => setShared({ ...shared, unit: e.target.value })}
            placeholder="เช่น dB(A), ppm, lux"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">ค่ามาตรฐาน (ถ้ามี)</label>
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
          <label className="text-xs text-slate-500 block mb-1">วันที่ตรวจวัด</label>
          <input
            type="date"
            value={shared.measuredAt}
            onChange={(e) => setShared({ ...shared, measuredAt: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">กำหนดตรวจรอบถัดไป</label>
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
          <label className="text-xs text-slate-500">จุดย่อยที่เข้าไปตรวจวัด</label>
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
        <label className="text-xs text-slate-500 block mb-1">แผนผังตำแหน่งจุดย่อย (ถ้ามี)</label>
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
        <label className="text-xs text-slate-500 block mb-1">หมายเหตุ</label>
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
          {showLocationName && <p className="text-sm font-semibold text-slate-900">{locationName}</p>}
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
          <label className="text-xs text-slate-500">สถานะการแก้ไขปัจจุบัน:</label>
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
    });
    setEditingAssessment(true);
  };

  const toggleFormHazard = (h) => {
    setForm({
      ...form,
      hazards: form.hazards.includes(h) ? form.hazards.filter((x) => x !== h) : [...form.hazards, h],
    });
  };

  const saveEdit = () => {
    if (!form.nextDue) return;
    onUpdate(location.id, {
      hazards: form.hazards,
      riskLevel: form.riskLevel,
      riskAssessment: {
        riskLevel: form.riskLevel,
        findings: form.findings || "-",
        controlMeasures: form.controlMeasures || "-",
        nextDue: form.nextDue,
        updatedAt: new Date().toISOString(),
        updatedBy: "ผู้ใช้งานปัจจุบัน",
      },
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
          <h1 className="text-lg font-semibold text-slate-900">{location.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{location.building} · {location.description}</p>
          <p className="text-xs text-slate-400 mt-1">
            แก้ไขล่าสุด: {formatThaiDateTime(location.riskAssessment.updatedAt)} โดย {location.riskAssessment.updatedBy}
          </p>
        </div>
        <Badge tone={riskLevelTone(location.riskLevel)}>ความเสี่ยง {riskLevelLabel[location.riskLevel]}</Badge>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900 mb-3">ภาพสถานที่</p>
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
          <p className="text-sm font-semibold text-slate-900">การประเมินความเสี่ยง</p>
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
                <p className="text-xs text-slate-500 mb-1.5">รูปแบบความเสี่ยงที่เกี่ยวข้อง</p>
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
                <label className="text-xs text-slate-500 block mb-1">รูปแบบความเสี่ยงที่เกี่ยวข้อง</label>
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
                <label className="text-xs text-slate-500 block mb-1">ระดับความเสี่ยง</label>
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
                <label className="text-xs text-slate-500 block mb-1">สิ่งที่พบ</label>
                <textarea
                  rows={2}
                  value={form.findings}
                  onChange={(e) => setForm({ ...form, findings: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">มาตรการควบคุมความเสี่ยง</label>
                <textarea
                  rows={2}
                  value={form.controlMeasures}
                  onChange={(e) => setForm({ ...form, controlMeasures: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">กำหนดประเมินรอบถัดไป</label>
                <input
                  type="date"
                  value={form.nextDue}
                  onChange={(e) => setForm({ ...form, nextDue: e.target.value })}
                  className="w-full sm:w-56 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
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
        <p className="text-sm font-semibold text-slate-900 mb-3">
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
                  <th className="px-4 py-2.5 font-medium">วันที่</th>
                  <th className="px-4 py-2.5 font-medium">ลักษณะ</th>
                  <th className="px-4 py-2.5 font-medium">ความรุนแรง</th>
                  <th className="px-4 py-2.5 font-medium">หยุดงาน</th>
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
          <p className="text-sm font-semibold text-slate-900">ผลการตรวจวัดสิ่งแวดล้อม</p>
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
  const [form, setForm] = useState({ name: "", building: "", description: "", riskLevel: "low", hazards: [] });

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

  const submit = () => {
    if (!form.name.trim()) return;
    onAdd({
      id: Date.now(),
      name: form.name,
      building: form.building || "-",
      description: form.description || "-",
      riskLevel: form.riskLevel,
      hazards: form.hazards,
      riskAssessment: {
        riskLevel: form.riskLevel, findings: "-", controlMeasures: "-", nextDue: "",
        updatedAt: new Date().toISOString(), updatedBy: "ผู้ใช้งานปัจจุบัน",
      },
    });
    setForm({ name: "", building: "", description: "", riskLevel: "low", hazards: [] });
    setShowForm(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">ทะเบียนสถานที่ทำงาน</h1>
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
            <p className="text-sm font-semibold text-slate-900">เพิ่มสถานที่ทำงานใหม่</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">ชื่อสถานที่</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น คลังสินค้า B ชั้น 1"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">อาคาร/โซน</label>
              <input
                value={form.building}
                onChange={(e) => setForm({ ...form, building: e.target.value })}
                placeholder="เช่น อาคาร B"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs text-slate-500 block mb-1">คำอธิบาย</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="อธิบายลักษณะงาน/พื้นที่โดยย่อ"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
          <div className="mb-3">
            <label className="text-xs text-slate-500 block mb-1">ระดับความเสี่ยงเริ่มต้น</label>
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
            <label className="text-xs text-slate-500 block mb-1">รูปแบบความเสี่ยงที่เกี่ยวข้อง</label>
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
              <th className="px-4 py-2.5 font-medium">ชื่อสถานที่</th>
              <th className="px-4 py-2.5 font-medium">อาคาร/โซน</th>
              <th className="px-4 py-2.5 font-medium">รูปแบบความเสี่ยง</th>
              <th className="px-4 py-2.5 font-medium">ระดับความเสี่ยง</th>
              <th className="px-4 py-2.5 font-medium">ผลตรวจวัดสิ่งแวดล้อม</th>
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
        <h1 className="text-lg font-semibold text-slate-900">บันทึกผลการตรวจวัดสิ่งแวดล้อม</h1>
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
            <label className="text-xs text-slate-500 block mb-1">สถานที่</label>
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
              <p className="text-sm font-semibold text-slate-900 mb-3">หมวด: {measurementTypeLabel[type]}</p>
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
  const positions = [...new Set(employees.map((e) => e.position))];

  const submit = () => {
    if (!form.position && !form.hazardType) return; // ต้องมีอย่างน้อย 1 อย่าง
    onAddRequirement({
      id: Date.now(),
      position: form.position || null,
      hazardType: form.hazardType || null,
      courseId: Number(form.courseId),
    });
    setForm({ position: "", hazardType: "", courseId: courses[0]?.id ?? "" });
    setShowForm(false);
  };

  const courseName = (id) => courses.find((c) => c.id === id)?.name ?? "-";

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
      <h1 className="text-lg font-semibold text-slate-900">Training Matrix</h1>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-900">ตารางกำหนดหลักสูตรตามตำแหน่ง/ความเสี่ยง</p>
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
              <p className="text-sm font-semibold text-slate-900">เพิ่ม requirement ใหม่</p>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">ระบุตำแหน่งงาน และ/หรือ ความเสี่ยง อย่างน้อย 1 อย่าง</p>
            <div className="grid sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-xs text-slate-500 block mb-1">ตำแหน่งงาน (ไม่บังคับ)</label>
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
                <label className="text-xs text-slate-500 block mb-1">ความเสี่ยง (ไม่บังคับ)</label>
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
                <label className="text-xs text-slate-500 block mb-1">หลักสูตรที่ต้องอบรม</label>
                <select
                  value={form.courseId}
                  onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
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
                  <th className="px-4 py-2.5 font-medium">ตำแหน่งงาน</th>
                  <th className="px-4 py-2.5 font-medium">ความเสี่ยง</th>
                  <th className="px-4 py-2.5 font-medium">หลักสูตรที่ต้องอบรม</th>
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

      <div>
        <p className="text-sm font-semibold text-slate-900 mb-3">สถานะการอบรมของพนักงาน</p>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-left">
                  <th className="px-4 py-2.5 font-medium">พนักงาน</th>
                  <th className="px-4 py-2.5 font-medium">ตำแหน่ง</th>
                  <th className="px-4 py-2.5 font-medium">สถานที่ประจำ</th>
                  <th className="px-4 py-2.5 font-medium">หลักสูตรที่ต้องอบรม</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const requiredIds = getRequiredCourseIds(emp, locations, requirements);
                  const locationName = locations.find((l) => l.id === emp.primaryLocationId)?.name ?? "-";
                  return (
                    <tr key={emp.id} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-2.5">{emp.name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{emp.position}</td>
                      <td className="px-4 py-2.5 text-slate-500">{locationName}</td>
                      <td className="px-4 py-2.5">
                        {requiredIds.length === 0 ? (
                          <span className="text-slate-400">ไม่มีหลักสูตรบังคับ</span>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {requiredIds.map((cid) => {
                              const status = getTrainingComplianceStatus(emp.id, cid, records);
                              const isEditingThis = editingCell?.employeeId === emp.id && editingCell?.courseId === cid;
                              const hasRecord = records.some((r) => r.employeeId === emp.id && r.courseId === cid);
                              if (isEditingThis) {
                                return (
                                  <div key={cid} className="bg-slate-50 rounded-lg p-2.5 space-y-2 max-w-xs">
                                    <p className="text-xs font-medium text-slate-700">{courseName(cid)}</p>
                                    <div>
                                      <label className="text-xs text-slate-500 block mb-0.5">วันที่อบรมผ่าน</label>
                                      <input
                                        type="date"
                                        value={recordForm.completionDate}
                                        onChange={(e) => setRecordForm({ ...recordForm, completionDate: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-500 block mb-0.5">วันหมดอายุ (ถ้ามี)</label>
                                      <input
                                        type="date"
                                        value={recordForm.expiryDate}
                                        onChange={(e) => setRecordForm({ ...recordForm, expiryDate: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs"
                                      />
                                    </div>
                                    <div className="flex justify-end gap-2 pt-1">
                                      <button onClick={() => setEditingCell(null)} className="text-xs text-slate-500 underline">ยกเลิก</button>
                                      {hasRecord && (
                                        <button
                                          onClick={() => {
                                            onDeleteRecord(emp.id, cid);
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
                                <button
                                  key={cid}
                                  onClick={() => startEditRecord(emp.id, cid)}
                                  className="flex items-center gap-2 text-left hover:bg-slate-50 rounded px-1 -mx-1 py-0.5"
                                >
                                  <span>{courseName(cid)}</span>
                                  <Badge tone={trainingStatusTone(status)}>{trainingStatusLabel[status]}</Badge>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
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
        <p className="text-lg font-semibold text-slate-900 mb-1">เข้าสู่ระบบ JorPor</p>
        <p className="text-sm text-slate-500 mb-5">ระบบช่วยงาน จป.</p>
        {error && <div className="text-sm bg-red-50 text-red-700 px-3 py-2 rounded-lg mb-3">{error}</div>}
        <div className="mb-3">
          <label className="text-xs text-slate-500 block mb-1">อีเมล</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="mb-4">
          <label className="text-xs text-slate-500 block mb-1">รหัสผ่าน</label>
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
          <p className="text-lg font-semibold text-slate-900 mb-2">สมัครสำเร็จ</p>
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
        <p className="text-lg font-semibold text-slate-900 mb-1">สมัครใช้งาน</p>
        <p className="text-sm text-slate-500 mb-5">
          1 บัญชี ต่อ 1 บริษัท — ข้อมูลของแต่ละบริษัทแยกจากกันโดยสมบูรณ์ ต้องได้รับการอนุมัติจาก
          ผู้ดูแลระบบก่อนจึงจะเข้าใช้งานได้
        </p>
        {error && <div className="text-sm bg-red-50 text-red-700 px-3 py-2 rounded-lg mb-3">{error}</div>}
        <div className="mb-3">
          <label className="text-xs text-slate-500 block mb-1">ชื่อ-สกุลผู้ดูแลระบบของบริษัท (จป.)</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="mb-3">
          <label className="text-xs text-slate-500 block mb-1">ชื่อบริษัท</label>
          <input
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            placeholder="เช่น บริษัท ตัวอย่าง จำกัด"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="mb-3">
          <label className="text-xs text-slate-500 block mb-1">อีเมล</label>
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="mb-4">
          <label className="text-xs text-slate-500 block mb-1">รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</label>
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
          <h1 className="text-lg font-semibold text-slate-900">{user.companyName}</h1>
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
        <p className="text-sm font-semibold text-slate-900 mb-3">แพ็กเกจของบริษัทนี้</p>
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
      <h1 className="text-lg font-semibold text-slate-900">จัดการผู้ใช้งาน</h1>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-sm font-semibold text-slate-900">คำขอที่รอการอนุมัติ</p>
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
                    <th className="px-4 py-2.5 font-medium">บริษัท</th>
                    <th className="px-4 py-2.5 font-medium">ผู้ติดต่อ</th>
                    <th className="px-4 py-2.5 font-medium">อีเมล</th>
                    <th className="px-4 py-2.5 font-medium">วันที่สมัคร</th>
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
        <p className="text-sm font-semibold text-slate-900 mb-3">ผู้ใช้งานทั้งหมด</p>
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-left">
                <th className="px-4 py-2.5 font-medium">บริษัท</th>
                <th className="px-4 py-2.5 font-medium">ผู้ติดต่อ</th>
                <th className="px-4 py-2.5 font-medium">อีเมล</th>
                <th className="px-4 py-2.5 font-medium">วันที่สมัคร</th>
                <th className="px-4 py-2.5 font-medium">แพ็กเกจ</th>
                <th className="px-4 py-2.5 font-medium">สถานะ</th>
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
        <h1 className="text-lg font-semibold text-slate-900">แก้ไขสิทธิ์: {userTypeLabel[selectedTier]}</h1>

        <Card>
          <p className="text-sm font-semibold text-slate-900 mb-1">สิทธิ์การเข้าถึงแต่ละหน้า</p>
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
          <p className="text-sm font-semibold text-slate-900 mb-1">ข้อจำกัดการบันทึกข้อมูล</p>
          <p className="text-xs text-slate-400 mb-3">เว้นว่างไว้ = ไม่จำกัดจำนวน</p>
          <label className="text-xs text-slate-500 block mb-1">จำนวนพนักงานสูงสุดที่บันทึกได้</label>
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
      <h1 className="text-lg font-semibold text-slate-900">จัดการประเภทผู้ใช้งาน</h1>
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-left">
                <th className="px-4 py-2.5 font-medium">แพ็กเกจ</th>
                <th className="px-4 py-2.5 font-medium">จำนวนหน้าที่เข้าถึงได้</th>
                <th className="px-4 py-2.5 font-medium">พนักงานสูงสุด</th>
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
  const trainingCourses = initialTrainingCourses; // คลังหลักสูตรกลาง ใช้ร่วมกันทุกบริษัท

  // ดึงรายชื่อพนักงานจริงจาก Supabase (แทนข้อมูลจำลองในความจำแบบเดิม) — RLS ฝั่งฐานข้อมูล
  // กรองให้อัตโนมัติอยู่แล้วว่าเห็นได้เฉพาะพนักงานของบริษัทตัวเอง ไม่ต้องกรองซ้ำฝั่งนี้
  async function fetchEmployees() {
    setEmployeesLoading(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id, employee_code, full_name, position, department, primary_location_id")
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

    if (locationIds.length > 0) {
      const { data: hazardRows } = await supabase
        .from("work_location_hazards")
        .select("location_id, hazard_type")
        .in("location_id", locationIds);
      (hazardRows || []).forEach((h) => {
        if (!hazardsByLocation[h.location_id]) hazardsByLocation[h.location_id] = [];
        hazardsByLocation[h.location_id].push(h);
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
        mapLocationRow(l, hazardsByLocation[l.id], latestAssessmentByLocation[l.id], currentUser?.name)
      )
    );
    setLocationsLoading(false);
  }

  useEffect(() => {
    if (currentUser && !currentUser.isAdmin) {
      fetchEmployees();
      fetchLocations();
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

  const incidents = tenant.incidents;
  const setIncidents = (val) => updateTenant({ incidents: val });
  const equipment = tenant.equipment;
  const setEquipment = (val) => updateTenant({ equipment: val });
  const ppe = tenant.ppe;
  const setPpe = (val) => updateTenant({ ppe: val });
  const ppeCatalog = tenant.ppeCatalog;
  const setPpeCatalog = (val) => updateTenant({ ppeCatalog: val });
  const noncompliance = tenant.noncompliance;
  const setNoncompliance = (val) => updateTenant({ noncompliance: val });
  const environmentalMeasurements = tenant.environmentalMeasurements;
  const setEnvironmentalMeasurements = (val) => updateTenant({ environmentalMeasurements: val });
  const trainingRequirements = tenant.trainingRequirements;
  const setTrainingRequirements = (val) => updateTenant({ trainingRequirements: val });
  const trainingRecords = tenant.trainingRecords;
  const setTrainingRecords = (val) => updateTenant({ trainingRecords: val });
  const ltiBaselineDate = tenant.ltiBaselineDate;
  const setLtiBaselineDate = (val) => updateTenant({ ltiBaselineDate: val });

  // ข้อจำกัดจำนวนพนักงานตามประเภทผู้ใช้งาน (เช่น Free บันทึกได้ไม่เกิน 5 คน)
  const employeeLimit = tierLimits[currentUser.userType]?.maxEmployees ?? null;

  const addIncident = (inc) => setIncidents([inc, ...incidents]);
  const updateIncident = (incidentId, fields) =>
    setIncidents(incidents.map((inc) => (inc.id === incidentId ? { ...inc, ...fields } : inc)));
  const deleteIncident = (incidentId) => setIncidents(incidents.filter((inc) => inc.id !== incidentId));
  const addIncidentProgress = (incidentId, entry) =>
    setIncidents(
      incidents.map((inc) =>
        inc.id === incidentId
          ? { ...inc, updates: [...inc.updates, entry], status: entry.newStatus || inc.status }
          : inc
      )
    );
  const addNoncompliance = (record) => setNoncompliance([record, ...noncompliance]);
  const deleteNoncompliance = (id) => setNoncompliance(noncompliance.filter((r) => r.id !== id));
  const addPpeIssuance = (record) => setPpe([...ppe, record]);
  const deletePpeIssuance = (id) => setPpe(ppe.filter((p) => p.id !== id));
  const addPpeCatalogItem = (item) => setPpeCatalog([...ppeCatalog, item]);
  const updatePpeCatalogItem = (id, fields) =>
    setPpeCatalog(ppeCatalog.map((c) => (c.id === id ? { ...c, ...fields } : c)));
  const deletePpeCatalogItem = (id) => setPpeCatalog(ppeCatalog.filter((c) => c.id !== id));
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
      await supabase.from("work_location_hazards").insert(
        loc.hazards.map((h) => ({ location_id: newLoc.id, hazard_type: h }))
      );
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
  const addEnvironmentalMeasurement = (m) => setEnvironmentalMeasurements([...environmentalMeasurements, m]);
  const updateEnvironmentalMeasurement = (id, fields) =>
    setEnvironmentalMeasurements(environmentalMeasurements.map((m) => (m.id === id ? { ...m, ...fields } : m)));
  const deleteEnvironmentalMeasurement = (id) =>
    setEnvironmentalMeasurements(environmentalMeasurements.filter((m) => m.id !== id));
  const addTrainingRequirement = (r) => setTrainingRequirements([...trainingRequirements, r]);
  const removeTrainingRequirement = (id) => setTrainingRequirements(trainingRequirements.filter((r) => r.id !== id));
  // บันทึกผลอบรมของพนักงานคนหนึ่งต่อหลักสูตรหนึ่ง — ถ้ามีบันทึกเดิมอยู่แล้วจะแก้ไขทับ (upsert)
  // ไม่ใช่เพิ่มซ้ำเรื่อยๆ ทำให้ "แก้ไขว่าผ่านอบรมแล้วหรือยัง" ทำได้จากจุดเดียวเสมอ
  const upsertTrainingRecord = (employeeId, courseId, fields) => {
    const existing = trainingRecords.find((r) => r.employeeId === employeeId && r.courseId === courseId);
    if (existing) {
      setTrainingRecords(trainingRecords.map((r) => (r.id === existing.id ? { ...r, ...fields } : r)));
    } else {
      setTrainingRecords([...trainingRecords, { id: Date.now(), employeeId, courseId, ...fields }]);
    }
  };
  const deleteTrainingRecord = (employeeId, courseId) =>
    setTrainingRecords(trainingRecords.filter((r) => !(r.employeeId === employeeId && r.courseId === courseId)));
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
      await supabase.from("work_location_hazards").delete().eq("location_id", id);
      if (fields.hazards.length > 0) {
        await supabase.from("work_location_hazards").insert(
          fields.hazards.map((h) => ({ location_id: id, hazard_type: h }))
        );
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
  const addEquipment = (unit) => setEquipment([...equipment, unit]);
  const deleteEquipmentUnit = (id) => setEquipment(equipment.filter((eq) => eq.id !== id));

  const addInspection = (equipmentId, record) => {
    setEquipment(
      equipment.map((eq) =>
        eq.id === equipmentId
          ? {
              ...eq,
              history: [record, ...eq.history],
              lastDate: record.date,
              status: record.result === "ไม่ผ่าน" ? "รอตรวจซ้ำ" : "ปกติ",
              pendingReinspectionDue: record.result === "ไม่ผ่าน" ? record.correctiveDeadline : null,
            }
          : eq
      )
    );
  };

  const deleteInspection = (equipmentId, index) => {
    setEquipment(
      equipment.map((eq) => {
        if (eq.id !== equipmentId) return eq;
        const newHistory = eq.history.filter((_, i) => i !== index);
        const latest = newHistory[0];
        return {
          ...eq,
          history: newHistory,
          lastDate: latest ? latest.date : eq.lastDate,
          status: latest ? (latest.result === "ไม่ผ่าน" ? "รอตรวจซ้ำ" : "ปกติ") : "ปกติ",
          pendingReinspectionDue: latest && latest.result === "ไม่ผ่าน" ? latest.correctiveDeadline : null,
        };
      })
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
            onDeleteIncident={deleteIncident}
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
          <UnsafeActsPage employees={employees} records={noncompliance} onAdd={addNoncompliance} onDelete={deleteNoncompliance} />
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
