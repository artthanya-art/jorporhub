import { useState } from "react";
import {
  LayoutDashboard, AlertTriangle, HardHat, Wrench, ClipboardCheck,
  Plus, X, Camera, ArrowLeft, ChevronRight, Menu, Users, MapPin,
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

const initialEmployees = [
  { id: 1, name: "สมศักดิ์ ใจดี", position: "ช่างเทคนิค", department: "ซ่อมบำรุง" },
  { id: 2, name: "วิภา สายใจ", position: "ผู้ควบคุมเครื่องจักร", department: "ไลน์ผลิต 2" },
  { id: 3, name: "ประยุทธ มั่นคง", position: "พนักงานคลังสินค้า", department: "คลังสินค้า" },
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
  { id: 1, name: "หมวกนิรภัย", standard: "มอก. 368-2562", lifespanDays: 180 },
  { id: 2, name: "ถุงมือกันบาด", standard: "EN 388:2018", lifespanDays: 180 },
  { id: 3, name: "รองเท้านิรภัย", standard: "มอก. 523-2564", lifespanDays: 365 },
  { id: 4, name: "แว่นตานิรภัย", standard: "ANSI Z87.1-2025", lifespanDays: 365 },
];

const initialPpe = [
  { id: 1, employeeId: 1, catalogId: 1, name: "หมวกนิรภัย", standard: "มอก. 368-2562", issuedDate: "2026-01-28", expiry: "2026-07-28", quantity: 1, reason: "initial_issue" },
  { id: 2, employeeId: 1, catalogId: 2, name: "ถุงมือกันบาด", standard: "EN 388:2018", issuedDate: "2026-02-06", expiry: "2026-08-06", quantity: 2, reason: "scheduled_replacement" },
  { id: 3, employeeId: 2, catalogId: 2, name: "ถุงมือกันบาด", standard: "EN 388:2018", issuedDate: "2026-07-01", expiry: "2027-01-01", quantity: 1, reason: "lost" },
  { id: 4, employeeId: 2, catalogId: 1, name: "หมวกนิรภัย", standard: "มอก. 368-2562", issuedDate: "2026-03-03", expiry: "2026-09-03", quantity: 1, reason: "initial_issue" },
  { id: 5, employeeId: 3, catalogId: 3, name: "รองเท้านิรภัย", standard: "มอก. 523-2564", issuedDate: "2026-05-02", expiry: "2026-11-02", quantity: 1, reason: "initial_issue" },
];

const initialNoncompliance = [
  { id: 1, employeeId: 2, ppeName: "หมวกนิรภัย", location: "ไลน์ผลิต 2", date: "19 ก.ค. 2569", action: "เตือนวาจา", notes: "ไม่ได้สวมหมวกขณะเดินผ่านพื้นที่เครื่องจักร" },
  { id: 2, employeeId: 2, ppeName: "ถุงมือกันบาด", location: "ไลน์ผลิต 2", date: "2 มิ.ย. 2569", action: "เตือนวาจา", notes: "ถอดถุงมือขณะหยิบชิ้นงานที่มีคม" },
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

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------

function Dashboard({ incidents, ppe, equipment, ltiBaselineDate, onSetLtiBaselineDate }) {
  const equipmentAttention = equipment.filter((e) => e.status !== "ปกติ").length;
  const ppeSoon = ppe.filter((p) => daysUntil(p.expiry) <= 30).length;

  // "วันไม่มีอุบัติเหตุ" นับตามหลัก Lost Time Injury (LTI): หาอุบัติเหตุล่าสุดที่ทำให้ต้อง
  // หยุดงานจริง (lostWorkdays > 0) แล้วนับวันจากวันนั้นถึงวันนี้ — เกือบเกิดเหตุหรือบาดเจ็บ
  // เล็กน้อยที่ไม่ต้องหยุดงานจะไม่ทำให้ตัวเลขนี้รีเซ็ต
  // ltiBaselineDate คือวันฐานที่กรอกเองตอนเริ่มใช้ระบบ (อ้างอิงจากบันทึกเอกสารเดิมก่อนหน้า)
  // ระบบจะเทียบกับอุบัติเหตุจริงที่บันทึกในระบบ แล้วใช้อันที่ "ล่าสุดกว่า" เสมอ — พอมีอุบัติเหตุ
  // จริงเกิดขึ้นใหม่ วันฐานเดิมจะถูกแทนที่โดยอัตโนมัติโดยไม่ต้องลบเอง
  const ltiIncidents = incidents.filter(incidentHasLTI);
  const candidateDays = ltiIncidents.map((i) => daysBetween(i.incidentDate));
  if (ltiBaselineDate) candidateDays.push(daysBetween(ltiBaselineDate));
  const daysSinceLastLti = candidateDays.length ? Math.min(...candidateDays) : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">สวัสดี คุณสมชาย</h1>
        <p className="text-sm text-slate-500 mt-0.5">บริษัท ABC จำกัด · อัปเดตล่าสุดวันนี้</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="อุบัติเหตุ 30 วัน" value={incidents.length} />
        <MetricCard label="PPE ใกล้หมดอายุ" value={ppeSoon} tone="text-amber-600" />
        <MetricCard label="อุปกรณ์ต้องเฝ้าระวัง" value={equipmentAttention} tone="text-red-600" />
        <MetricCard label="วันไม่มีอุบัติเหตุ (LTI)" value={daysSinceLastLti ?? "-"} tone="text-emerald-600" />
      </div>

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
          <p className="text-sm font-medium text-slate-900 mb-3">อุบัติเหตุล่าสุด</p>
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
          </div>
        </Card>

        <Card>
          <p className="text-sm font-medium text-slate-900 mb-3">อุปกรณ์ที่ต้องเฝ้าระวัง</p>
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
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------

function IncidentsPage({ incidents, onAdd, onUpdate, onAddProgress, locations, employees }) {
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

  // ค่านี้ผู้ใช้แก้ไขเองได้ กรณีอยากให้นับ "วันเกิดเหตุล่าสุด" จากวันที่กำหนดแทนค่าที่คำนวณอัตโนมัติ
  const [latestDateOverride, setLatestDateOverride] = useState(null);
  const displayedLatestDate = latestDateOverride ?? autoLatestIncidentDate;

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
            <input
              type="date"
              value={displayedLatestDate ?? ""}
              onChange={(e) => setLatestDateOverride(e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-1 text-sm text-slate-700"
            />
            {latestDateOverride && (
              <button
                onClick={() => setLatestDateOverride(null)}
                className="text-xs text-slate-400 underline hover:text-slate-600"
              >
                ใช้ค่าอัตโนมัติ
              </button>
            )}
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
            <p className="text-sm font-medium text-slate-900">รายงานอุบัติเหตุใหม่</p>
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
        <p className="text-sm font-medium text-slate-900 mb-3">พนักงานที่ได้รับบาดเจ็บ</p>
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
          <p className="text-sm font-medium text-slate-900">รายละเอียดและสถานะ</p>
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
        <p className="text-sm font-medium text-slate-900 mb-3">ความคืบหน้า</p>
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
          {[...incident.updates].reverse().map((u, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center pt-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-400" />
                {i < incident.updates.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
              </div>
              <div className="pb-4 flex-1">
                <p className="text-sm font-medium text-slate-800">
                  {formatThaiDate(u.date)} · {u.by}
                  {u.newStatus && (
                    <span className="ml-2 text-xs font-normal bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                      เปลี่ยนสถานะเป็น {u.newStatus}
                    </span>
                  )}
                </p>
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
                <p className="text-sm font-medium text-slate-900">{g.name}</p>
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

function NoncomplianceView({ employees, records, onAdd }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employeeId: employees[0]?.id, ppeName: "", location: "", action: "เตือนวาจา", notes: "" });
  const nameOf = (id) => employees.find((e) => e.id === id)?.name ?? "-";

  const submit = () => {
    if (!form.ppeName.trim() || !form.location.trim()) return;
    onAdd({ id: Date.now(), ...form, date: "วันนี้" });
    setForm({ employeeId: employees[0]?.id, ppeName: "", location: "", action: "เตือนวาจา", notes: "" });
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
            <p className="text-sm font-medium text-slate-900">บันทึกพบพนักงานไม่สวมใส่ PPE</p>
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
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5">{nameOf(r.employeeId)}</td>
                <td className="px-4 py-2.5">{r.ppeName}</td>
                <td className="px-4 py-2.5 text-slate-500">{r.location}</td>
                <td className="px-4 py-2.5 text-slate-500">{r.date}</td>
                <td className="px-4 py-2.5"><Badge tone={r.action === "ให้หยุดงาน" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}>{r.action}</Badge></td>
                <td className="px-4 py-2.5 text-slate-500">{countByEmployee(r.employeeId)} ครั้ง</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}

function PpeIssuanceView({ employees, catalog, onAddIssuance }) {
  const [form, setForm] = useState({
    employeeId: employees[0]?.id ?? "", catalogId: catalog[0]?.id ?? "",
    quantity: "1", receivedDate: todayIso(), reason: "initial_issue",
  });
  const [justAdded, setJustAdded] = useState(null);

  const selectedCatalogItem = catalog.find((c) => c.id === Number(form.catalogId));
  const computedExpiry = selectedCatalogItem
    ? addDaysIso(form.receivedDate, selectedCatalogItem.lifespanDays)
    : null;

  const submit = () => {
    if (!form.employeeId || !selectedCatalogItem || !form.receivedDate) return;
    onAddIssuance({
      id: Date.now(),
      employeeId: Number(form.employeeId),
      catalogId: selectedCatalogItem.id,
      name: selectedCatalogItem.name,
      standard: selectedCatalogItem.standard,
      issuedDate: form.receivedDate,
      expiry: computedExpiry,
      quantity: Number(form.quantity) || 1,
      reason: form.reason,
    });
    setJustAdded({ employeeName: employees.find((e) => e.id === Number(form.employeeId))?.name, name: selectedCatalogItem.name, expiry: computedExpiry });
    setForm({ ...form, quantity: "1", receivedDate: todayIso(), reason: "initial_issue" });
  };

  return (
    <Card className="max-w-2xl">
      <p className="text-sm font-medium text-slate-900 mb-4">บันทึกการรับมอบ PPE</p>

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
            {catalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
          บันทึกการรับมอบ
        </button>
      </div>

      {justAdded && (
        <p className="text-xs text-emerald-700 mt-3">
          บันทึกแล้ว: {justAdded.employeeName} ได้รับ {justAdded.name} · กำหนดแจกครั้งถัดไป {formatThaiDate(justAdded.expiry)}
        </p>
      )}
    </Card>
  );
}

function PpeCatalogView({ catalog, onAddCatalogItem, onUpdateCatalogItem }) {
  const [showCatalogForm, setShowCatalogForm] = useState(false);
  const [catalogForm, setCatalogForm] = useState({ name: "", standard: "", lifespanDays: "180" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ standard: "", lifespanDays: "" });

  const submitCatalog = () => {
    if (!catalogForm.name.trim()) return;
    onAddCatalogItem({
      id: Date.now(),
      name: catalogForm.name,
      standard: catalogForm.standard || "-",
      lifespanDays: Number(catalogForm.lifespanDays) || 180,
    });
    setCatalogForm({ name: "", standard: "", lifespanDays: "180" });
    setShowCatalogForm(false);
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditForm({ standard: c.standard, lifespanDays: String(c.lifespanDays) });
  };

  const saveEdit = (id) => {
    onUpdateCatalogItem(id, {
      standard: editForm.standard || "-",
      lifespanDays: Number(editForm.lifespanDays) || 1,
    });
    setEditingId(null);
  };

  return (
    <Card className="max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-900">ประเภท/รุ่นอุปกรณ์ในระบบ</p>
        <button
          onClick={() => setShowCatalogForm(true)}
          className="flex items-center gap-1.5 text-xs text-slate-600 underline hover:text-slate-900"
        >
          <Plus size={14} /> เพิ่มประเภทใหม่
        </button>
      </div>

      {showCatalogForm && (
        <div className="border border-slate-200 rounded-lg p-3 mb-3 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
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
            <th className="py-1.5 font-medium">มาตรฐาน</th>
            <th className="py-1.5 font-medium">อายุการใช้งาน</th>
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
                  </>
                ) : (
                  <>
                    <td className="py-1.5 text-slate-500">{c.standard}</td>
                    <td className="py-1.5 text-slate-500">{c.lifespanDays} วัน</td>
                    <td className="py-1.5">
                      <button onClick={() => startEdit(c)} className="text-xs text-slate-500 underline hover:text-slate-800">
                        แก้ไข
                      </button>
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

function PpePage({ employees, ppe, noncompliance, catalog, onAddNoncompliance, onAddIssuance, onAddCatalogItem, onUpdateCatalogItem }) {
  const [tab, setTab] = useState("item");
  const tabs = [
    { key: "item", label: "รายงานสถานะ PPE" },
    { key: "issuance", label: "บันทึกการรับมอบ" },
    { key: "noncompliance", label: "ไม่ปฏิบัติตาม" },
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
      {tab === "issuance" && <PpeIssuanceView employees={employees} catalog={catalog} onAddIssuance={onAddIssuance} />}
      {tab === "noncompliance" && (
        <NoncomplianceView employees={employees} records={noncompliance} onAdd={onAddNoncompliance} />
      )}

      <PpeCatalogView catalog={catalog} onAddCatalogItem={onAddCatalogItem} onUpdateCatalogItem={onUpdateCatalogItem} />
    </div>
  );
}

// ---------------------------------------------------------------
// Safety equipment registry + inspection history
// ---------------------------------------------------------------

function EquipmentPage({ equipment, onAddInspection, onAddEquipment }) {
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
          <p className="text-sm font-medium text-slate-900">ประวัติการตรวจสภาพ</p>
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
              <p className="text-sm font-medium text-slate-900">
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
                  <Badge tone={statusTone(h.result)}>{h.result}</Badge>
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
            <p className="text-sm font-medium text-slate-900">เพิ่มอุปกรณ์ใหม่</p>
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
              <p className="font-medium text-slate-900 mb-1">สรุปสำหรับพิมพ์ประกอบใบอนุญาตเข้าทำงาน</p>
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

function EmployeeDetail({ employee, ppe, noncompliance, incidents, onBack }) {
  const employeePpe = ppe.filter((p) => p.employeeId === employee.id);
  const employeeNoncompliance = noncompliance.filter((r) => r.employeeId === employee.id);
  const employeeIncidents = incidents
    .filter((inc) => inc.injuredEmployees.some((e) => e.employeeId === employee.id))
    .map((inc) => ({ ...inc, myInjury: inc.injuredEmployees.find((e) => e.employeeId === employee.id) }))
    .sort((a, b) => (a.incidentDate < b.incidentDate ? 1 : -1));

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> กลับไปทะเบียนพนักงาน
      </button>

      <div>
        <h1 className="text-lg font-semibold text-slate-900">{employee.name}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{employee.position} · {employee.department}</p>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-900 mb-3">ประวัติรับมอบ PPE</p>
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
        <p className="text-sm font-medium text-slate-900 mb-3">ประวัติไม่ปฏิบัติตาม</p>
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
                      <td className="px-4 py-2.5 text-slate-500">{r.date}</td>
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
        <p className="text-sm font-medium text-slate-900 mb-3">ประวัติอุบัติเหตุ</p>
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

function EmployeesPage({ employees, ppe, noncompliance, incidents, onAdd }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({ name: "", position: "", department: "" });

  const submit = () => {
    if (!form.name.trim()) return;
    onAdd({ id: Date.now(), name: form.name, position: form.position || "-", department: form.department || "-" });
    setForm({ name: "", position: "", department: "" });
    setShowForm(false);
  };

  const selected = employees.find((e) => e.id === selectedId);
  if (selected) {
    return (
      <EmployeeDetail
        employee={selected}
        ppe={ppe}
        noncompliance={noncompliance}
        incidents={incidents}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">ทะเบียนพนักงาน</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-800"
        >
          <Plus size={16} /> เพิ่มพนักงาน
        </button>
      </div>

      {showForm && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-slate-900">เพิ่มพนักงานใหม่</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
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
              <th className="px-4 py-2.5 font-medium">ชื่อ-สกุล</th>
              <th className="px-4 py-2.5 font-medium">ตำแหน่ง</th>
              <th className="px-4 py-2.5 font-medium">แผนก</th>
              <th className="px-4 py-2.5 font-medium">PPE ที่ถือครอง</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr
                key={emp.id}
                onClick={() => setSelectedId(emp.id)}
                className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
              >
                <td className="px-4 py-2.5">{emp.name}</td>
                <td className="px-4 py-2.5 text-slate-500">{emp.position}</td>
                <td className="px-4 py-2.5 text-slate-500">{emp.department}</td>
                <td className="px-4 py-2.5 text-slate-500">{ppe.filter((p) => p.employeeId === emp.id).length} รายการ</td>
                <td className="px-4 py-2.5 text-slate-300"><ChevronRight size={16} /></td>
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
// Work locations registry
// ---------------------------------------------------------------

const hazardOptions = Object.keys(hazardTypeLabel);
const riskLevelOptions = ["low", "medium", "high", "critical"];

function LocationDetail({ location, incidents, onBack, onUpdate }) {
  const [editingAssessment, setEditingAssessment] = useState(false);
  const [form, setForm] = useState({
    riskLevel: location.riskAssessment.riskLevel,
    findings: location.riskAssessment.findings,
    controlMeasures: location.riskAssessment.controlMeasures,
    nextDue: location.riskAssessment.nextDue,
    hazards: location.hazards,
  });

  // ดึงจากข้อมูลจริงในหน้าอุบัติเหตุ (ไม่ใช่ข้อมูลแยกต่างหาก) — กรองด้วยชื่อสถานที่ตรงกัน
  const locationIncidents = incidents
    .filter((i) => i.location === location.name)
    .sort((a, b) => (a.incidentDate < b.incidentDate ? 1 : -1));

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
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-900">การประเมินความเสี่ยง</p>
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
        <p className="text-sm font-medium text-slate-900 mb-3">
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
    </div>
  );
}

function LocationsPage({ locations, incidents, onAdd, onUpdate }) {
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", building: "", description: "", riskLevel: "low", hazards: [] });

  const selected = locations.find((l) => l.id === selectedId);
  if (selected) {
    return (
      <LocationDetail
        location={selected}
        incidents={incidents}
        onBack={() => setSelectedId(null)}
        onUpdate={onUpdate}
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
            <p className="text-sm font-medium text-slate-900">เพิ่มสถานที่ทำงานใหม่</p>
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
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {locations.map((l) => (
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
                <td className="px-4 py-2.5 text-slate-300"><ChevronRight size={16} /></td>
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
// App shell
// ---------------------------------------------------------------

const NAV = [
  { key: "dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { key: "incidents", label: "อุบัติเหตุ", icon: AlertTriangle },
  { key: "ppe", label: "PPE", icon: HardHat },
  { key: "equipment", label: "อุปกรณ์ความปลอดภัย", icon: Wrench },
  { key: "locations", label: "สถานที่ทำงาน", icon: MapPin },
  { key: "employees", label: "พนักงาน", icon: Users },
  { key: "checklist", label: "ตรวจสอบ", icon: ClipboardCheck },
];

export default function JorPorPrototype() {
  const [page, setPage] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [incidents, setIncidents] = useState(initialIncidents);
  const [ltiBaselineDate, setLtiBaselineDate] = useState(null);
  const [equipment, setEquipment] = useState(initialEquipment);
  const [ppe, setPpe] = useState(initialPpe);
  const [ppeCatalog, setPpeCatalog] = useState(initialPpeCatalog);
  const [noncompliance, setNoncompliance] = useState(initialNoncompliance);
  const [employees, setEmployees] = useState(initialEmployees);
  const [locations, setLocations] = useState(initialLocations);

  const addIncident = (inc) => setIncidents([inc, ...incidents]);
  const updateIncident = (incidentId, fields) =>
    setIncidents(incidents.map((inc) => (inc.id === incidentId ? { ...inc, ...fields } : inc)));
  const addIncidentProgress = (incidentId, entry) =>
    setIncidents(
      incidents.map((inc) =>
        inc.id === incidentId
          ? { ...inc, updates: [...inc.updates, entry], status: entry.newStatus || inc.status }
          : inc
      )
    );
  const addNoncompliance = (record) => setNoncompliance([record, ...noncompliance]);
  const addPpeIssuance = (record) => setPpe([...ppe, record]);
  const addPpeCatalogItem = (item) => setPpeCatalog([...ppeCatalog, item]);
  const updatePpeCatalogItem = (id, fields) =>
    setPpeCatalog(ppeCatalog.map((c) => (c.id === id ? { ...c, ...fields } : c)));
  const addEmployee = (emp) => setEmployees([...employees, emp]);
  const addLocation = (loc) => setLocations([...locations, loc]);
  const updateLocation = (id, fields) => setLocations(locations.map((l) => (l.id === id ? { ...l, ...fields } : l)));
  const addEquipment = (unit) => setEquipment([...equipment, unit]);

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

  const selectPage = (key) => {
    setPage(key);
    setMobileMenuOpen(false); // ปิดเมนูอัตโนมัติหลังเลือกเมนูบนมือถือ
  };

  return (
    <div className="min-h-[600px] bg-white font-sans sm:grid sm:grid-cols-[180px_1fr]">
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

      {/* เมนูด้านซ้าย: บนมือถือเป็น drawer เลื่อนเข้า-ออก / บนจอใหญ่แสดงตลอดเวลา */}
      <div
        className={`border-r border-slate-200 p-3 bg-white
          fixed inset-y-0 left-0 z-40 w-56 transform transition-transform duration-200
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
          sm:static sm:translate-x-0 sm:z-auto sm:w-auto`}
      >
        <p className="font-semibold text-slate-900 px-2 py-2 text-[15px]">JorPor</p>
        <nav className="space-y-1 mt-1">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => selectPage(key)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left ${
                page === key ? "bg-slate-100 text-slate-900 font-medium" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-4 sm:p-6 overflow-auto min-w-0">
        {page === "dashboard" && (
          <Dashboard
            incidents={incidents}
            ppe={ppe}
            equipment={equipment}
            ltiBaselineDate={ltiBaselineDate}
            onSetLtiBaselineDate={setLtiBaselineDate}
          />
        )}
        {page === "incidents" && (
          <IncidentsPage
            incidents={incidents}
            onAdd={addIncident}
            onUpdate={updateIncident}
            onAddProgress={addIncidentProgress}
            locations={locations}
            employees={employees}
          />
        )}
        {page === "ppe" && (
          <PpePage
            employees={employees}
            ppe={ppe}
            noncompliance={noncompliance}
            catalog={ppeCatalog}
            onAddNoncompliance={addNoncompliance}
            onAddIssuance={addPpeIssuance}
            onAddCatalogItem={addPpeCatalogItem}
            onUpdateCatalogItem={updatePpeCatalogItem}
          />
        )}
        {page === "equipment" && (
          <EquipmentPage equipment={equipment} onAddInspection={addInspection} onAddEquipment={addEquipment} />
        )}
        {page === "locations" && (
          <LocationsPage
            locations={locations}
            incidents={incidents}
            onAdd={addLocation}
            onUpdate={updateLocation}
          />
        )}
        {page === "employees" && (
          <EmployeesPage employees={employees} ppe={ppe} noncompliance={noncompliance} incidents={incidents} onAdd={addEmployee} />
        )}
        {page === "checklist" && <ChecklistPage />}
      </div>
    </div>
  );
}
