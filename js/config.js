/**
 * ============================================================================
 * ทะเบียนคุมพัสดุ V2 — Configuration File (config.js)
 * ============================================================================
 * สามารถแก้ไข URL ของ Google Apps Script Web App ได้ที่นี่
 * ห้ามฝัง Spreadsheet ID หรือ API Key ลงในไฟล์นี้
 * ============================================================================
 */

const CONFIG = {
  // ใส่ Web App URL ที่ได้จาก Deploy Google Apps Script
  // ตัวอย่าง: "https://script.google.com/macros/s/AKfycby.../exec"
  API_URL: "",

  // ข้อมูลหน่วยงาน
  AGENCY_NAME: "ศูนย์ข้อมูลเกษตรแห่งชาติ",
  PARENT_AGENCY: "สำนักงานเศรษฐกิจการเกษตร",
  APP_TITLE: "ทะเบียนคุมพัสดุ V2",

  // ประเภทเอกสาร
  DOCUMENT_TYPES: {
    contract: { id: "contract", label: "สัญญา", icon: "📜", prefix: "CTR" },
    po: { id: "po", label: "ใบสั่งซื้อ/จ้าง/เช่า", icon: "🛒", prefix: "PO" },
    agreement: { id: "agreement", label: "ข้อตกลง", icon: "🤝", prefix: "AGR" }
  },

  // สีและสไตล์ของแต่ละสถานะ (อิงตามแนวทางราชการและ UX ที่กำหนด)
  STATUS_COLORS: {
    "ดำเนินการ": { label: "ดำเนินการ", class: "status-blue", dot: "#38bdf8", bg: "#1e3a5f", fg: "#38bdf8" },
    "ดำเนินการตามสัญญา": { label: "ดำเนินการตามสัญญา", class: "status-blue", dot: "#38bdf8", bg: "#1e3a5f", fg: "#38bdf8" },
    "รอส่งมอบ": { label: "รอส่งมอบ", class: "status-blue", dot: "#38bdf8", bg: "#1e3a5f", fg: "#38bdf8" },
    "อยู่ระหว่างดำเนินการตามใบสั่งจ้าง": { label: "อยู่ระหว่างดำเนินการตามใบสั่งจ้าง", class: "status-blue", dot: "#38bdf8", bg: "#1e3a5f", fg: "#38bdf8" },
    "ส่งมอบแล้ว": { label: "ส่งมอบแล้ว", class: "status-teal", dot: "#2dd4bf", bg: "#1a3348", fg: "#2dd4bf" },
    "ส่งมอบงานตามสัญญา": { label: "ส่งมอบงานตามสัญญา", class: "status-teal", dot: "#2dd4bf", bg: "#1a3348", fg: "#2dd4bf" },
    "ส่งมอบงานตามใบสั่งซื้อ": { label: "ส่งมอบงานตามใบสั่งซื้อ", class: "status-teal", dot: "#2dd4bf", bg: "#1a3348", fg: "#2dd4bf" },
    "ตรวจรับแล้ว": { label: "ตรวจรับแล้ว", class: "status-green", dot: "#4ade80", bg: "#1c2f1c", fg: "#4ade80" },
    "เบิกจ่ายแล้ว": { label: "เบิกจ่ายแล้ว", class: "status-yellow", dot: "#fbbf24", bg: "#2a2520", fg: "#fbbf24" },
    "คืนหลักประกัน": { label: "คืนหลักประกัน", class: "status-purple", dot: "#c084fc", bg: "#2d2040", fg: "#c084fc" },
    "ยกเลิก": { label: "ยกเลิก", class: "status-red", dot: "#f87171", bg: "#2a1a1a", fg: "#f87171" },
    "ยกเลิกสัญญา": { label: "ยกเลิกสัญญา", class: "status-red", dot: "#f87171", bg: "#2a1a1a", fg: "#f87171" },
    "-": { label: "-", class: "status-gray", dot: "#94a3b8", bg: "#1e293b", fg: "#94a3b8" }
  },

  // สถานะรายงาน สขร.1
  REPORT_STATUSES: {
    draft: { label: "ร่าง", class: "status-yellow", dot: "#fbbf24" },
    ready: { label: "พร้อมเผยแพร่", class: "status-blue", dot: "#38bdf8" },
    published: { label: "เผยแพร่แล้ว", class: "status-green", dot: "#4ade80" }
  },

  // เดือนภาษาไทย
  THAI_MONTHS: [
    { num: "01", name: "มกราคม" },
    { num: "02", name: "กุมภาพันธ์" },
    { num: "03", name: "มีนาคม" },
    { num: "04", name: "เมษายน" },
    { num: "05", name: "พฤษภาคม" },
    { num: "06", name: "มิถุนายน" },
    { num: "07", name: "กรกฎาคม" },
    { num: "08", name: "สิงหาคม" },
    { num: "09", name: "กันยายน" },
    { num: "10", name: "ตุลาคม" },
    { num: "11", name: "พฤศจิกายน" },
    { num: "12", name: "ธันวาคม" }
  ]
};

// ตรวจสอบว่ามี Custom API URL บันทึกไว้ใน Local Storage หรือไม่
const savedCustomUrl = localStorage.getItem("procure_custom_api_url");
if (savedCustomUrl && savedCustomUrl !== "https://script.google.com/macros/s/AKfycby9H0DgQCCie6XxnvGmokCxCNwNnv16zlSSH0FZqN-d-ff2tIvoICtasD_xxxhxUaeT9Q/exec") {
  CONFIG.API_URL = savedCustomUrl;
} else if (savedCustomUrl === "https://script.google.com/macros/s/AKfycby9H0DgQCCie6XxnvGmokCxCNwNnv16zlSSH0FZqN-d-ff2tIvoICtasD_xxxhxUaeT9Q/exec") {
  localStorage.removeItem("procure_custom_api_url");
}

