import { useState } from "react";
import {
  LayoutDashboard, AlertTriangle, HardHat, Wrench, ClipboardCheck,
  Plus, X, Camera, ArrowLeft, ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------
// Mock data — สถานะทั้งหมดอยู่ใน memory เท่านั้น ไม่มีการเชื่อม backend
// ---------------------------------------------------------------

const initialIncidents = [
  { id: 1, location: "คลังสินค้า A", type: "หกล้ม", severity: "ปานกลาง", date: "21 ก.ค. 2569", status: "กำลังตรวจสอบ" },
  { id: 2, location: "ไลน์ผลิต 2", type: "ของหล่นทับ", severity: "เล็กน้อย", date: "18 ก.ค. 2569", status: "ปิดเคส" },
];

const employees = [
  { id: 1, name: "สมศักดิ์ ใจดี", position: "ช่างเทคนิค" },
  { id: 2, name: "วิภา สายใจ", position: "ผู้ควบคุมเครื่องจักร" },
  { id: 3, name: "ประยุทธ มั่นคง", position: "พนักงานคลังสินค้า" },
];

const reasonLabel = {
  initial_issue: "เบิกครั้งแรก",
  lost: "ของหาย",
  damaged: "ชำรุด",
  scheduled_replacement: "เปลี่ยนตามรอบ",
};

const initialPpe = [
  { id: 1, employeeId: 1, name: "หมวกนิรภัย", standard: "มอก. 368-2562", issuedDate: "28 ม.ค. 2569", expiry: "28 ก.ค. 2569", daysLeft: 5, quantity: 1, reason: "initial_issue" },
  { id: 2, employeeId: 1, name: "ถุงมือกันบาด", standard: "EN 388:2018", issuedDate: "6 ก.พ. 2569", expiry: "6 ส.ค. 2569", daysLeft: 14, quantity: 2, reason: "scheduled_replacement" },
  { id: 3, employeeId: 2, name: "ถุงมือกันบาด", standard: "EN 388:2018", issuedDate: "1 ก.ค. 2569", expiry: "1 ม.ค. 2570", daysLeft: 162, quantity: 1, reason: "lost" },
  { id: 4, employeeId: 2, name: "หมวกนิรภัย", standard: "มอก. 368-2562", issuedDate: "3 มี.ค. 2569", expiry: "3 ก.ย. 2569", daysLeft: 41, quantity: 1, reason: "initial_issue" },
  { id: 5, employeeId: 3, name: "รองเท้านิรภัย", standard: "มอก. 523-2564", issuedDate: "2 พ.ค. 2569", expiry: "2 พ.ย. 2569", daysLeft: 103, quantity: 1, reason: "initial_issue" },
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

// ---------------------------------------------------------------
// Shared UI bits
// ---------------------------------------------------------------

const statusTone = (status) => {
  if (["เกินกำหนด", "ชำรุด", "ไม่ผ่าน", "รอตรวจซ้ำ"].includes(status)) return "bg-red-50 text-red-700";
  if (["ใกล้ครบกำหนด", "กำลังตรวจสอบ", "ผ่านแบบมีข้อสังเกต"].includes(status)) return "bg-amber-50 text-amber-700";
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

function Dashboard({ incidents, ppe, equipment }) {
  const equipmentAttention = equipment.filter((e) => e.status !== "ปกติ").length;
  const ppeSoon = ppe.filter((p) => p.daysLeft <= 30).length;

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
        <MetricCard label="วันไม่มีอุบัติเหตุ" value={18} tone="text-emerald-600" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm font-medium text-slate-900 mb-3">อุบัติเหตุล่าสุด</p>
          <div className="space-y-3">
            {incidents.slice(0, 3).map((inc) => (
              <div key={inc.id} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm text-slate-800">{inc.location} · {inc.type}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{inc.date}</p>
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

function IncidentsPage({ incidents, onAdd }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ location: "", type: "หกล้ม", severity: "ปานกลาง", description: "" });

  const submit = () => {
    if (!form.location.trim()) return;
    onAdd({
      id: Date.now(),
      location: form.location,
      type: form.type,
      severity: form.severity,
      date: "วันนี้",
      status: "รายงานแล้ว",
    });
    setForm({ location: "", type: "หกล้ม", severity: "ปานกลาง", description: "" });
    setShowForm(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">ทะเบียนอุบัติเหตุ</h1>
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
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="เช่น คลังสินค้า A ชั้น 2"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
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
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-2.5 font-medium">สถานที่</th>
              <th className="px-4 py-2.5 font-medium">ลักษณะ</th>
              <th className="px-4 py-2.5 font-medium">ความรุนแรง</th>
              <th className="px-4 py-2.5 font-medium">วันที่</th>
              <th className="px-4 py-2.5 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((inc) => (
              <tr key={inc.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5">{inc.location}</td>
                <td className="px-4 py-2.5">{inc.type}</td>
                <td className="px-4 py-2.5 text-slate-500">{inc.severity}</td>
                <td className="px-4 py-2.5 text-slate-500">{inc.date}</td>
                <td className="px-4 py-2.5"><Badge tone={statusTone(inc.status)}>{inc.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
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

function PpeByEmployeeView({ employees, ppe }) {
  const [openId, setOpenId] = useState(employees[0]?.id ?? null);

  return (
    <div className="space-y-3">
      {employees.map((emp) => {
        const items = ppe.filter((p) => p.employeeId === emp.id);
        const isOpen = openId === emp.id;
        const worstDays = items.length ? Math.min(...items.map((i) => i.daysLeft)) : null;
        return (
          <Card key={emp.id} className="p-0 overflow-hidden">
            <button
              onClick={() => setOpenId(isOpen ? null : emp.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">{emp.name}</p>
                <p className="text-xs text-slate-500">{emp.position} · ถือครอง {items.length} รายการ</p>
              </div>
              <div className="flex items-center gap-3">
                {worstDays !== null && (
                  <Badge tone={statusTone(ppeStatusOf(worstDays))}>{ppeStatusOf(worstDays)}</Badge>
                )}
                <ChevronRight size={16} className={`text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </div>
            </button>
            {isOpen && (
              <table className="w-full text-sm border-t border-slate-100">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left">
                    <th className="px-4 py-2 font-medium">อุปกรณ์</th>
                    <th className="px-4 py-2 font-medium">มาตรฐาน</th>
                    <th className="px-4 py-2 font-medium">จำนวน</th>
                    <th className="px-4 py-2 font-medium">เหตุผลเบิก</th>
                    <th className="px-4 py-2 font-medium">วันหมดอายุ</th>
                    <th className="px-4 py-2 font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">{p.name}</td>
                      <td className="px-4 py-2 text-slate-500">{p.standard}</td>
                      <td className="px-4 py-2 text-slate-500">{p.quantity}</td>
                      <td className="px-4 py-2 text-slate-500">{reasonLabel[p.reason]}</td>
                      <td className="px-4 py-2 text-slate-500">{p.expiry}</td>
                      <td className="px-4 py-2"><Badge tone={statusTone(ppeStatusOf(p.daysLeft))}>เหลือ {p.daysLeft} วัน</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function PpeByItemView({ employees, ppe }) {
  const nameOf = (id) => employees.find((e) => e.id === id)?.name ?? "-";
  return (
    <Card className="p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-left">
            <th className="px-4 py-2.5 font-medium">อุปกรณ์</th>
            <th className="px-4 py-2.5 font-medium">พนักงาน</th>
            <th className="px-4 py-2.5 font-medium">มาตรฐาน</th>
            <th className="px-4 py-2.5 font-medium">จำนวน</th>
            <th className="px-4 py-2.5 font-medium">เหตุผลเบิก</th>
            <th className="px-4 py-2.5 font-medium">วันหมดอายุ</th>
            <th className="px-4 py-2.5 font-medium">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {ppe.map((p) => (
            <tr key={p.id} className="border-t border-slate-100">
              <td className="px-4 py-2.5">{p.name}</td>
              <td className="px-4 py-2.5">{nameOf(p.employeeId)}</td>
              <td className="px-4 py-2.5 text-slate-500">{p.standard}</td>
              <td className="px-4 py-2.5 text-slate-500">{p.quantity}</td>
              <td className="px-4 py-2.5 text-slate-500">{reasonLabel[p.reason]}</td>
              <td className="px-4 py-2.5 text-slate-500">{p.expiry}</td>
              <td className="px-4 py-2.5"><Badge tone={statusTone(ppeStatusOf(p.daysLeft))}>เหลือ {p.daysLeft} วัน</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
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
      </Card>
    </div>
  );
}

function PpePage({ employees, ppe, noncompliance, onAddNoncompliance }) {
  const [tab, setTab] = useState("employee");
  const tabs = [
    { key: "employee", label: "ตามพนักงาน" },
    { key: "item", label: "ตามอุปกรณ์" },
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

      {tab === "employee" && <PpeByEmployeeView employees={employees} ppe={ppe} />}
      {tab === "item" && <PpeByItemView employees={employees} ppe={ppe} />}
      {tab === "noncompliance" && (
        <NoncomplianceView employees={employees} records={noncompliance} onAdd={onAddNoncompliance} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Safety equipment registry + inspection history
// ---------------------------------------------------------------

function EquipmentPage({ equipment, onAddInspection }) {
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ result: "ผ่าน", findings: "", action: "", correctiveDeadline: "" });

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
        <button className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-800">
          <Plus size={16} /> เพิ่มอุปกรณ์
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="อุปกรณ์ทั้งหมด" value={equipment.length} />
        <MetricCard label="รอตรวจซ้ำ" value={equipment.filter((e) => e.status === "รอตรวจซ้ำ").length} tone="text-red-600" />
        <MetricCard label="ใกล้ครบกำหนด" value={equipment.filter((e) => e.status === "ใกล้ครบกำหนด").length} tone="text-amber-600" />
        <MetricCard label="ปกติ" value={equipment.filter((e) => e.status === "ปกติ").length} tone="text-emerald-600" />
      </div>

      <Card className="p-0 overflow-hidden">
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
// App shell
// ---------------------------------------------------------------

const NAV = [
  { key: "dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { key: "incidents", label: "อุบัติเหตุ", icon: AlertTriangle },
  { key: "ppe", label: "PPE", icon: HardHat },
  { key: "equipment", label: "อุปกรณ์ความปลอดภัย", icon: Wrench },
  { key: "checklist", label: "ตรวจสอบ", icon: ClipboardCheck },
];

export default function JorPorPrototype() {
  const [page, setPage] = useState("dashboard");
  const [incidents, setIncidents] = useState(initialIncidents);
  const [equipment, setEquipment] = useState(initialEquipment);
  const [ppe] = useState(initialPpe);
  const [noncompliance, setNoncompliance] = useState(initialNoncompliance);

  const addIncident = (inc) => setIncidents([inc, ...incidents]);
  const addNoncompliance = (record) => setNoncompliance([record, ...noncompliance]);

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

  return (
    <div className="min-h-[600px] bg-white grid grid-cols-[180px_1fr] font-sans">
      <div className="border-r border-slate-200 p-3">
        <p className="font-semibold text-slate-900 px-2 py-2 text-[15px]">JorPor</p>
        <nav className="space-y-1 mt-1">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setPage(key)}
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

      <div className="p-6 overflow-auto">
        {page === "dashboard" && <Dashboard incidents={incidents} ppe={ppe} equipment={equipment} />}
        {page === "incidents" && <IncidentsPage incidents={incidents} onAdd={addIncident} />}
        {page === "ppe" && (
          <PpePage employees={employees} ppe={ppe} noncompliance={noncompliance} onAddNoncompliance={addNoncompliance} />
        )}
        {page === "equipment" && <EquipmentPage equipment={equipment} onAddInspection={addInspection} />}
        {page === "checklist" && <ChecklistPage />}
      </div>
    </div>
  );
}
