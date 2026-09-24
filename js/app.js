/**
 * ============================================================================
 * ทะเบียนคุมพัสดุ V2 — Main Application Controller (app.js)
 * ============================================================================
 * จัดการ State ส่วนกลาง, การเปลี่ยนหน้า, Toast Notification,
 * Modal รายละเอียด และ Helper Functions สำหรับจัดรูปแบบตัวเลขและวันที่
 * ============================================================================
 */

// Global State
const appState = {
  contracts: [],
  reports: [],
  reportItems: [],
  currentPage: "dashboard",
  isLoading: false,
  lastUpdated: null,
  activeFilterType: "all",
  activeFilterYear: "all",
  activeFilterStatus: "all",
  searchKeyword: ""
};

// ============================================================================
// FORMATTING & SECURITY HELPERS
// ============================================================================

/**
 * ป้องกัน XSS Injection โดยการแปลง HTML Entities
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

/**
 * จัดรูปแบบตัวเลขเงินเป็นภาษาไทยตามมาตรฐานราชการ
 */
function formatMoney(num) {
  const n = parseFloat(num);
  if (isNaN(n)) return "0.00";
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

/**
 * แปลงข้อความหรือตัวเลขเป็น Number
 */
function parseMoney(val) {
  if (!val) return 0;
  const cleaned = String(val).replace(/,/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * แปลง ISO Date (YYYY-MM-DD) เป็นวันที่ไทย พ.ศ. (DD/MM/YYYY)
 */
function isoToThaiDate(isoStr) {
  if (!isoStr) return "";
  const parts = String(isoStr).split("T")[0].split("-");
  if (parts.length !== 3) return isoStr;
  const y = parseInt(parts[0], 10);
  const m = parts[1];
  const d = parts[2];
  if (isNaN(y)) return isoStr;
  const thaiYear = y + 543;
  return `${d}/${m}/${thaiYear}`;
}

/**
 * แปลงวันที่ไทย พ.ศ. (DD/MM/YYYY) เป็น ISO Date (YYYY-MM-DD)
 */
function thaiDateToIso(thaiDateStr) {
  if (!thaiDateStr) return "";
  const parts = String(thaiDateStr).trim().split("/");
  if (parts.length !== 3) return thaiDateStr;
  const d = parts[0].padStart(2, "0");
  const m = parts[1].padStart(2, "0");
  const thaiYear = parseInt(parts[2], 10);
  if (isNaN(thaiYear)) return "";
  const gYear = thaiYear > 2400 ? thaiYear - 543 : thaiYear;
  return `${gYear}-${m}-${d}`;
}

/**
 * สร้าง HTML สำหรับ Status Badge
 */
function getStatusBadge(status) {
  if (!status || status === "-") return `<span class="status-badge status-gray"><span class="status-dot"></span>-</span>`;
  const cfg = CONFIG.STATUS_COLORS[status] || { class: "status-gray", dot: "#94a3b8" };
  return `<span class="status-badge ${cfg.class}"><span class="status-dot"></span>${escapeHtml(status)}</span>`;
}

/**
 * สร้าง HTML สำหรับ Report Status Badge (สขร.1)
 */
function getReportStatusBadge(status) {
  const cfg = CONFIG.REPORT_STATUSES[status] || CONFIG.REPORT_STATUSES.draft;
  return `<span class="status-badge ${cfg.class}"><span class="status-dot"></span>${escapeHtml(cfg.label)}</span>`;
}

/**
 * หาข้อมูลประเภทเอกสาร
 */
function getTypeInfo(type) {
  return CONFIG.DOCUMENT_TYPES[type] || { id: type, label: type, icon: "📄" };
}

// ============================================================================
// UI FEEDBACK: TOAST NOTIFICATIONS & CONFIRM MODALS
// ============================================================================

/**
 * แสดง Toast Notification
 */
function showToast(message, type = "info", duration = 3500) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  if (type === "error") icon = "❌";
  if (type === "warning") icon = "⚠️";

  toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity 0.3s, transform 0.3s";
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * แสดง Confirmation Modal
 */
function showConfirmModal({ title = "ยืนยันการทำรายการ", message, confirmText = "ยืนยัน", cancelText = "ยกเลิก", onConfirm }) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box" style="max-width: 440px;">
      <div class="modal-header">
        <h3 style="font-size: 16px; font-weight: 700; color: #f1f5f9;">${escapeHtml(title)}</h3>
        <button class="modal-close-btn" id="modal-close-x">&times;</button>
      </div>
      <div class="modal-body" style="padding: 24px; color: #cbd5e1; font-size: 14px; line-height: 1.6;">
        ${escapeHtml(message)}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="modal-cancel-btn">${escapeHtml(cancelText)}</button>
        <button class="btn btn-danger" id="modal-confirm-btn">${escapeHtml(confirmText)}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("#modal-close-x").onclick = close;
  overlay.querySelector("#modal-cancel-btn").onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };

  overlay.querySelector("#modal-confirm-btn").onclick = async () => {
    close();
    if (typeof onConfirm === "function") {
      await onConfirm();
    }
  };
}

// ============================================================================
// PAGE ROUTING & NAVIGATION
// ============================================================================

function showPage(pageId) {
  appState.currentPage = pageId;

  // Toggle active class on navigation buttons
  document.querySelectorAll(".nav-btn").forEach(btn => {
    const target = btn.getAttribute("data-page");
    btn.classList.toggle("active", target === pageId);
  });

  // Toggle visible sections
  const pages = ["dashboard", "register", "form", "skr1", "summary", "settings"];
  pages.forEach(p => {
    const el = document.getElementById("page-" + p);
    if (el) {
      el.classList.toggle("hidden", p !== pageId);
    }
  });

  // Render specific page
  if (pageId === "dashboard" && window.renderDashboard) {
    window.renderDashboard();
  } else if (pageId === "register" && window.renderRegister) {
    window.renderRegister();
  } else if (pageId === "form" && window.renderForm) {
    window.renderForm();
  } else if (pageId === "skr1" && window.renderSkr1) {
    window.renderSkr1();
  } else if (pageId === "summary" && window.renderSummary) {
    window.renderSummary();
  } else if (pageId === "settings" && window.renderSettings) {
    window.renderSettings();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================================
// DATA FETCHING & SYNCHRONIZATION
// ============================================================================

async function refreshData() {
  const statusEl = document.getElementById("statusText");
  const refreshBtn = document.getElementById("refreshBtn");
  
  if (statusEl) statusEl.innerHTML = `⏳ กำลังดึงข้อมูลจากระบบ...`;
  if (refreshBtn) refreshBtn.disabled = true;
  appState.isLoading = true;

  try {
    const result = await api.getAllData();
    appState.contracts = result.contracts || [];
    appState.reports = result.reports || [];
    appState.reportItems = result.reportItems || [];
    appState.lastUpdated = new Date();

    const timeStr = appState.lastUpdated.toLocaleTimeString("th-TH");
    if (statusEl) {
      statusEl.innerHTML = `✅ อัปเดตล่าสุด: ${timeStr} • ทั้งหมด ${appState.contracts.length} รายการ`;
    }
    showToast("ดึงข้อมูลล่าสุดเรียบร้อยแล้ว", "success", 2000);

    // Re-render current page
    showPage(appState.currentPage);
  } catch (err) {
    console.error("Refresh data error:", err);
    if (statusEl) {
      statusEl.innerHTML = `⚠️ โหมดสาธิต (ไม่สามารถเชื่อมต่อ Google Sheet ได้) — ตรวจสอบ Web App URL ในหน้าตั้งค่า`;
    }
    showToast("ไม่สามารถเชื่อมต่อ Google Apps Script: " + err.message, "error", 5000);

    // โหลด Mock Data หากยังไม่มีข้อมูล เพื่อให้ผู้ใช้สามารถทดลองเล่นหน้าตาและฟังก์ชันได้
    if (appState.contracts.length === 0) {
      loadSampleData();
      showPage(appState.currentPage);
    }
  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
    appState.isLoading = false;
  }
}

/**
 * ข้อมูลจำลองสำหรับทดสอบระบบ
 */
function loadSampleData() {
  appState.contracts = [
    {
      id: "CTR-2026-k8f9a2",
      type: "contract",
      document_no: "1/2569",
      egp_project_no: "69017482910",
      control_no: "690214008123",
      gfmis_po: "4500019283",
      document_date: "2026-02-26",
      vendor_name: "บริษัท ดาต้าเทค อินโนเวชั่น จำกัด",
      tax_id: "0105558012345",
      project_name: "จ้างพัฒนาระบบคลังข้อมูลสารสนเทศการเกษตรอัจฉริยะ ระยะที่ 2",
      budget: "4500000.00",
      median_price: "4480000.00",
      offered_price: "4350000.00",
      agreed_price: "4350000.00",
      contract_amount: "4350000.00",
      start_date: "2026-02-27",
      end_date: "2026-09-24",
      guarantee_type: "หนังสือค้ำประกัน",
      guarantee_amount: "217500.00",
      status: "ดำเนินการ",
      note: "งวดที่ 1 ส่งมอบเรียบร้อย",
      created_at: "2026-02-26T08:30:00.000Z",
      updated_at: "2026-02-26T08:30:00.000Z"
    },
    {
      id: "PO-2026-m3x7p1",
      type: "po",
      document_no: "ซ.12/2569",
      egp_project_no: "69018492011",
      control_no: "690314002819",
      gfmis_po: "4500019550",
      document_date: "2026-03-10",
      vendor_name: "บริษัท สยาม ออฟฟิศ ซัพพลายส์ จำกัด",
      tax_id: "0105552098761",
      project_name: "ซื้อวัสดุคอมพิวเตอร์และอุปกรณ์ประมวลผลเครือข่าย",
      budget: "185000.00",
      median_price: "182000.00",
      offered_price: "179000.00",
      agreed_price: "179000.00",
      contract_amount: "179000.00",
      start_date: "2026-03-11",
      end_date: "2026-03-25",
      guarantee_type: "ยกเว้น",
      guarantee_amount: "0",
      status: "ตรวจรับแล้ว",
      note: "ตรวจรับพัสดุครบถ้วน",
      created_at: "2026-03-10T10:00:00.000Z",
      updated_at: "2026-03-26T09:00:00.000Z"
    },
    {
      id: "AGR-2026-q4w1b9",
      type: "agreement",
      document_no: "ขต.5/2569",
      egp_project_no: "69020194821",
      control_no: "690319001928",
      gfmis_po: "4500019882",
      document_date: "2026-04-05",
      vendor_name: "ห้างหุ้นส่วนจำกัด เกษตรดิจิทัลเซอร์วิส",
      tax_id: "0103551029384",
      project_name: "จ้างบำรุงรักษาและปรับปรุงเว็บไซต์ศูนย์ข้อมูลเกษตรแห่งชาติ",
      budget: "360000.00",
      median_price: "360000.00",
      offered_price: "355000.00",
      agreed_price: "355000.00",
      contract_amount: "355000.00",
      start_date: "2026-04-06",
      end_date: "2026-09-30",
      guarantee_type: "หนังสือค้ำประกัน",
      guarantee_amount: "17750.00",
      status: "ดำเนินการ",
      note: "รอบบำรุงรักษาประจำเดือน",
      created_at: "2026-04-05T11:00:00.000Z",
      updated_at: "2026-04-05T11:00:00.000Z"
    },
    {
      id: "CTR-2026-u9v2t5",
      type: "contract",
      document_no: "2/2569",
      egp_project_no: "69022019482",
      control_no: "690412001920",
      gfmis_po: "4500020112",
      document_date: "2026-05-15",
      vendor_name: "บริษัท คลาวด์ ซิสเต็มส์ แอนด์ ซีเคียวริตี้ จำกัด",
      tax_id: "0105561029381",
      project_name: "จ้างเช่าบริการคลาวด์คอมพิวติ้งและระบบสำรองข้อมูลฉุกเฉิน",
      budget: "1200000.00",
      median_price: "1200000.00",
      offered_price: "1180000.00",
      agreed_price: "1180000.00",
      contract_amount: "1180000.00",
      start_date: "2026-06-01",
      end_date: "2026-09-30",
      guarantee_type: "หนังสือค้ำประกัน",
      guarantee_amount: "59000.00",
      status: "เบิกจ่ายแล้ว",
      note: "เบิกจ่ายงวดที่ 1 แล้ว",
      created_at: "2026-05-15T09:15:00.000Z",
      updated_at: "2026-06-15T14:20:00.000Z"
    }
  ];

  appState.reports = [
    {
      id: "skr1-2569-03",
      year: "2569",
      month: "03",
      report_name: "สขร.1 มีนาคม 2569",
      published_date: "2026-04-05",
      published_url: "https://oae.go.th/view/1/สขร1-มีนาคม-2569",
      status: "published",
      note: "เผยแพร่บนเว็บไซต์เรียบร้อย",
      created_at: "2026-04-01T08:00:00.000Z",
      updated_at: "2026-04-05T09:00:00.000Z"
    }
  ];

  appState.reportItems = [
    { id: "MRI-1", report_id: "skr1-2569-03", contract_id: "PO-2026-m3x7p1", created_at: "2026-04-01T08:05:00.000Z" }
  ];
}

// ============================================================================
// SETTINGS PAGE RENDERER
// ============================================================================

window.renderSettings = function() {
  const el = document.getElementById("page-settings");
  if (!el) return;

  el.innerHTML = `
    <div class="fade-up">
      <div class="card" style="margin-bottom: 20px;">
        <h3 style="font-size: 16px; font-weight: 700; color: #fbbf24; margin-bottom: 8px;">⚙️ การตั้งค่าระบบและการเชื่อมต่อ Google Sheets</h3>
        <p style="font-size: 13px; color: #94a3b8; line-height: 1.6;">
          ระบบทำงานร่วมกับ Google Apps Script Web App เพื่อจัดเก็บข้อมูลลงใน Google Sheets โดยไม่มีค่าใช้จ่าย และรองรับการนำขึ้น GitHub Pages ทันที
        </p>
      </div>

      <div class="grid-2">
        <!-- Form Endpoint Config -->
        <div class="card">
          <h4 style="font-size: 14px; font-weight: 600; color: #f1f5f9; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid var(--border);">
            🔗 Web App URL ปัจจุบัน
          </h4>
          <div class="form-group">
            <label class="form-label">Google Apps Script Web App URL</label>
            <input type="url" id="setting_api_url" class="inp" value="${escapeHtml(CONFIG.API_URL)}" placeholder="https://script.google.com/macros/s/.../exec">
            <div style="font-size: 11.5px; color: #64748b; margin-top: 6px;">
              * URL นี้สามารถตั้งในไฟล์ <code>js/config.js</code> หรือบันทึกเพื่อทดสอบในเครื่องนี้ได้
            </div>
          </div>
          <div style="display: flex; gap: 10px; margin-top: 16px;">
            <button class="btn btn-primary" onclick="saveSettingUrl()">💾 บันทึก URL</button>
            <button class="btn btn-ghost" onclick="resetSettingUrl()">🔄 คืนค่าเริ่มต้น</button>
          </div>
        </div>

        <!-- Guide Steps -->
        <div class="card">
          <h4 style="font-size: 14px; font-weight: 600; color: #38bdf8; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid var(--border);">
            📋 ขั้นตอนการติดตั้ง Backend
          </h4>
          <ol style="font-size: 13px; color: #cbd5e1; line-height: 2; padding-left: 20px;">
            <li>สร้าง <b>Google Sheet</b> เปล่า 1 ไฟล์</li>
            <li>ไปที่เมนู <b>ส่วนขยาย (Extensions)</b> &rarr; <b>Apps Script</b></li>
            <li>กดปุ่ม <b>"📋 คัดลอกโค้ด Apps Script"</b> ด้านล่างนี้ แล้วนำไปวางทับโค้ดเดิมทั้งหมด</li>
            <li>กดเรียกฟังก์ชัน <code>setupDatabase()</code> เพื่อสร้าง Sheet และ Headers อัตโนมัติ</li>
            <li>กด <b>ทำให้ใช้งานได้ (Deploy)</b> &rarr; <b>การทำให้ใช้งานได้รายการใหม่ (New deployment)</b></li>
            <li>เลือกประเภท <b>เว็บแอป (Web app)</b>, ตั้งค่า ผู้มีสิทธิ์เข้าถึง = <b>ทุกคน (Anyone)</b></li>
            <li>คัดลอก URL ที่ได้มาใส่ในช่องด้านซ้าย แล้วกด <b>"💾 บันทึก URL"</b></li>
          </ol>
        </div>
      </div>

      <!-- Apps Script Code Box with Copy Button -->
      <div class="card" style="margin-top: 20px; padding: 0; overflow: hidden;">
        <div style="padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); background: rgba(15, 23, 42, 0.95); flex-wrap: wrap; gap: 10px;">
          <div>
            <span style="font-size: 14px; font-weight: 600; color: #38bdf8;">📄 โค้ด Google Apps Script (Code.gs)</span>
            <span style="font-size: 12px; color: #64748b; margin-left: 8px;">พร้อมฟังก์ชัน setupDatabase() และ API ครบถ้วน</span>
          </div>
          <button id="copy-script-btn" class="btn btn-sm btn-primary" onclick="copyAppsScriptCode()">
            📋 คัดลอกโค้ด Apps Script ทั้งหมด
          </button>
        </div>
        <pre id="apps-script-code" class="mono" style="margin: 0; padding: 20px; font-size: 12px; line-height: 1.7; color: #a5f3fc; background: rgba(8, 14, 26, 0.95); overflow: auto; max-height: 480px; white-space: pre-wrap; word-break: break-word;">${escapeHtml(APPS_SCRIPT_CODE)}</pre>
      </div>
    </div>
  `;
};

function copyAppsScriptCode() {
  const btn = document.getElementById("copy-script-btn");
  navigator.clipboard.writeText(APPS_SCRIPT_CODE).then(() => {
    if (btn) {
      btn.innerHTML = "✅ คัดลอกแล้ว!";
      btn.classList.add("btn-success");
      setTimeout(() => {
        btn.innerHTML = "📋 คัดลอกโค้ด Apps Script ทั้งหมด";
        btn.classList.remove("btn-success");
      }, 2500);
    }
    showToast("คัดลอกโค้ด Google Apps Script สำเร็จ!", "success");
  }).catch(err => {
    showToast("ไม่สามารถคัดลอกอัตโนมัติได้: " + err.message, "error");
  });
}


function saveSettingUrl() {
  const input = document.getElementById("setting_api_url");
  if (!input) return;
  const val = input.value.trim();
  if (!val) {
    showToast("กรุณากรอก Web App URL", "warning");
    return;
  }
  CONFIG.API_URL = val;
  localStorage.setItem("procure_custom_api_url", val);
  showToast("บันทึกการตั้งค่า URL สำเร็จ กำลังเชื่อมต่อ...", "success");
  refreshData();
}

function resetSettingUrl() {
  localStorage.removeItem("procure_custom_api_url");
  location.reload();
}

// ============================================================================
// APP BOOTSTRAP
// ============================================================================

window.addEventListener("DOMContentLoaded", () => {
  // Navigation button listeners
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.getAttribute("data-page");
      if (page) showPage(page);
    });
  });

  // Initial load
  refreshData();
});


const APPS_SCRIPT_CODE = "/**\n * ============================================================================\n * ทะเบียนคุมพัสดุ V2 — Google Apps Script Backend (Code.gs)\n * ============================================================================\n * รองรับ:\n * - ทะเบียนสัญญา, ใบสั่งซื้อ/จ้าง/เช่า, ข้อตกลง (Contracts)\n * - รายงาน สขร.1 รายเดือน (MonthlyReports)\n * - รายการที่เลือกใน สขร.1 (MonthlyReportItems)\n * - API GET / POST พร้อมระบบค้นหา ID ที่แท้จริง (ไม่พึ่ง row number)\n * - ฟังก์ชัน setupDatabase() สำหรับสร้าง Sheet และ Header ครั้งแรก\n * ============================================================================\n */\n\n// ใส่ Spreadsheet ID ของท่านที่นี่ (หรือถ้าใช้ Bound Script ให้ปล่อยว่างไว้)\nvar SPREADSHEET_ID = \"\";\n\n/**\n * ดึง Spreadsheet Object\n */\nfunction getSpreadsheet() {\n  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== \"\" && SPREADSHEET_ID !== \"YOUR_SPREADSHEET_ID\") {\n    return SpreadsheetApp.openById(SPREADSHEET_ID);\n  }\n  return SpreadsheetApp.getActiveSpreadsheet();\n}\n\n/**\n * นิยาม Schema และ Headers ของแต่ละ Sheet\n */\nvar SCHEMA = {\n  Contracts: [\n    \"id\",\n    \"type\",\n    \"document_no\",\n    \"egp_project_no\",\n    \"control_no\",\n    \"gfmis_po\",\n    \"document_date\",\n    \"vendor_name\",\n    \"tax_id\",\n    \"project_name\",\n    \"budget\",\n    \"median_price\",\n    \"offered_price\",\n    \"agreed_price\",\n    \"contract_amount\",\n    \"start_date\",\n    \"end_date\",\n    \"guarantee_type\",\n    \"guarantee_amount\",\n    \"status\",\n    \"note\",\n    \"created_at\",\n    \"updated_at\"\n  ],\n  MonthlyReports: [\n    \"id\",\n    \"year\",\n    \"month\",\n    \"report_name\",\n    \"published_date\",\n    \"published_url\",\n    \"status\",\n    \"note\",\n    \"created_at\",\n    \"updated_at\"\n  ],\n  MonthlyReportItems: [\n    \"id\",\n    \"report_id\",\n    \"contract_id\",\n    \"created_at\"\n  ]\n};\n\n/**\n * ฟังก์ชันสำหรับ Setup Database ครั้งแรก\n * ตรวจสอบและสร้าง Sheet ที่ยังไม่มี พร้อมทั้งใส่ Header\n * ถ้ามีอยู่แล้วจะไม่ลบข้อมูลเดิม\n */\nfunction setupDatabase() {\n  var ss = getSpreadsheet();\n  var sheetNames = Object.keys(SCHEMA);\n  \n  sheetNames.forEach(function(sheetName) {\n    var sheet = ss.getSheetByName(sheetName);\n    var headers = SCHEMA[sheetName];\n    \n    if (!sheet) {\n      sheet = ss.insertSheet(sheetName);\n      sheet.appendRow(headers);\n      \n      // จัดรูปแบบแถว Header\n      var headerRange = sheet.getRange(1, 1, 1, headers.length);\n      headerRange.setFontWeight(\"bold\");\n      headerRange.setBackground(\"#0f172a\");\n      headerRange.setFontColor(\"#f1f5f9\");\n      sheet.setFrozenRows(1);\n    } else {\n      // หากมี Sheet แล้วแต่แถวแรกว่าง ให้ใส่ Header\n      if (sheet.getLastRow() === 0) {\n        sheet.appendRow(headers);\n        var hr = sheet.getRange(1, 1, 1, headers.length);\n        hr.setFontWeight(\"bold\");\n        hr.setBackground(\"#0f172a\");\n        hr.setFontColor(\"#f1f5f9\");\n        sheet.setFrozenRows(1);\n      }\n    }\n  });\n\n  // ลบ Sheet1 เริ่มต้น หากมี Sheet อื่นแล้ว\n  var defaultSheet = ss.getSheetByName(\"Sheet1\") || ss.getSheetByName(\"แผ่นงาน1\");\n  if (defaultSheet && ss.getSheets().length > 1) {\n    try { ss.deleteSheet(defaultSheet); } catch (e) {}\n  }\n\n  return \"Setup completed successfully!\";\n}\n\n/**\n * ส่ง Response เป็น JSON หรือ JSONP\n */\nfunction respondJson(data, callback) {\n  var output = JSON.stringify(data);\n  if (callback) {\n    return ContentService.createTextOutput(callback + \"(\" + output + \")\")\n      .setMimeType(ContentService.MimeType.JAVASCRIPT);\n  }\n  return ContentService.createTextOutput(output)\n    .setMimeType(ContentService.MimeType.JSON);\n}\n\n/**\n * Helper แปลงแถวข้อมูลเป็น Object ตาม Headers\n */\nfunction rowsToObjects(sheet, headers) {\n  var lastRow = sheet.getLastRow();\n  var lastCol = sheet.getLastColumn();\n  if (lastRow <= 1 || lastCol === 0) return [];\n  \n  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();\n  var result = [];\n  \n  for (var r = 0; r < values.length; r++) {\n    var row = values[r];\n    var obj = {};\n    for (var c = 0; c < headers.length; c++) {\n      var val = row[c];\n      if (val instanceof Date) {\n        // จัดเก็บและแปลง Date เป็น YYYY-MM-DD\n        var y = val.getFullYear();\n        var m = (\"0\" + (val.getMonth() + 1)).slice(-2);\n        var d = (\"0\" + val.getDate()).slice(-2);\n        obj[headers[c]] = y + \"-\" + m + \"-\" + d;\n      } else {\n        obj[headers[c]] = (val !== null && val !== undefined) ? String(val) : \"\";\n      }\n    }\n    result.push(obj);\n  }\n  return result;\n}\n\n/**\n * GET Handler\n */\nfunction doGet(e) {\n  var params = (e && e.parameter) ? e.parameter : {};\n  var action = params.action || \"getAllData\";\n  var callback = params.callback || null;\n  \n  try {\n    var ss = getSpreadsheet();\n    \n    if (action === \"listContracts\") {\n      var cSheet = ss.getSheetByName(\"Contracts\");\n      var contracts = cSheet ? rowsToObjects(cSheet, SCHEMA.Contracts) : [];\n      return respondJson({ success: true, data: contracts, error: null }, callback);\n    }\n    \n    if (action === \"getContract\") {\n      var cId = params.id;\n      if (!cId) return respondJson({ success: false, data: null, error: \"ระบุ contract id\" }, callback);\n      var cSheet2 = ss.getSheetByName(\"Contracts\");\n      var all = cSheet2 ? rowsToObjects(cSheet2, SCHEMA.Contracts) : [];\n      var found = all.find(function(c) { return c.id === cId; });\n      return respondJson({ success: !!found, data: found || null, error: found ? null : \"ไม่พบสัญญา\" }, callback);\n    }\n    \n    if (action === \"listReports\") {\n      var rSheet = ss.getSheetByName(\"MonthlyReports\");\n      var reports = rSheet ? rowsToObjects(rSheet, SCHEMA.MonthlyReports) : [];\n      return respondJson({ success: true, data: reports, error: null }, callback);\n    }\n    \n    if (action === \"getReport\") {\n      var rId = params.id;\n      if (!rId) return respondJson({ success: false, data: null, error: \"ระบุ report id\" }, callback);\n      var rSheet2 = ss.getSheetByName(\"MonthlyReports\");\n      var allReports = rSheet2 ? rowsToObjects(rSheet2, SCHEMA.MonthlyReports) : [];\n      var report = allReports.find(function(r) { return r.id === rId; });\n      \n      var mriSheet = ss.getSheetByName(\"MonthlyReportItems\");\n      var items = mriSheet ? rowsToObjects(mriSheet, SCHEMA.MonthlyReportItems) : [];\n      var selectedIds = items.filter(function(it) { return it.report_id === rId; })\n                             .map(function(it) { return it.contract_id; });\n      \n      return respondJson({\n        success: true,\n        data: { report: report || null, contractIds: selectedIds },\n        error: null\n      }, callback);\n    }\n    \n    if (action === \"getReportItems\") {\n      var repId = params.reportId;\n      var itemSheet = ss.getSheetByName(\"MonthlyReportItems\");\n      var allItems = itemSheet ? rowsToObjects(itemSheet, SCHEMA.MonthlyReportItems) : [];\n      var filtered = allItems.filter(function(it) { return it.report_id === repId; });\n      return respondJson({ success: true, data: filtered, error: null }, callback);\n    }\n    \n    if (action === \"getAllData\") {\n      var sContracts = ss.getSheetByName(\"Contracts\");\n      var sReports = ss.getSheetByName(\"MonthlyReports\");\n      var sItems = ss.getSheetByName(\"MonthlyReportItems\");\n      \n      return respondJson({\n        success: true,\n        data: {\n          contracts: sContracts ? rowsToObjects(sContracts, SCHEMA.Contracts) : [],\n          reports: sReports ? rowsToObjects(sReports, SCHEMA.MonthlyReports) : [],\n          reportItems: sItems ? rowsToObjects(sItems, SCHEMA.MonthlyReportItems) : []\n        },\n        error: null\n      }, callback);\n    }\n    \n    return respondJson({ success: false, data: null, error: \"ไม่พบ action: \" + action }, callback);\n  } catch (err) {\n    return respondJson({ success: false, data: null, error: err.toString() }, callback);\n  }\n}\n\n/**\n * Helper สร้าง ID ที่ไม่ซ้ำ\n */\nfunction generateId(prefix) {\n  var rand = Math.random().toString(36).substring(2, 10);\n  var ts = Date.now().toString(36);\n  return prefix + \"-\" + ts + \"-\" + rand;\n}\n\n/**\n * POST Handler\n */\nfunction doPost(e) {\n  try {\n    var raw = e.postData ? e.postData.contents : \"\";\n    var body = {};\n    if (raw) {\n      body = JSON.parse(raw);\n    }\n    var action = body.action;\n    var ss = getSpreadsheet();\n    var nowIso = new Date().toISOString();\n    \n    // -------------------------------------------------------------\n    // 1. CREATE CONTRACT\n    // -------------------------------------------------------------\n    if (action === \"createContract\") {\n      var payload = body.data || {};\n      var sheet = ss.getSheetByName(\"Contracts\");\n      if (!sheet) {\n        setupDatabase();\n        sheet = ss.getSheetByName(\"Contracts\");\n      }\n      \n      var type = payload.type || \"contract\";\n      var yearStr = new Date().getFullYear();\n      var prefix = type === \"contract\" ? \"CTR\" : (type === \"po\" ? \"PO\" : \"AGR\");\n      var newId = generateId(prefix + \"-\" + yearStr);\n      \n      payload.id = newId;\n      payload.created_at = nowIso;\n      payload.updated_at = nowIso;\n      \n      var row = SCHEMA.Contracts.map(function(col) {\n        return payload[col] !== undefined ? payload[col] : \"\";\n      });\n      \n      sheet.appendRow(row);\n      return respondJson({ success: true, data: payload, error: null });\n    }\n    \n    // -------------------------------------------------------------\n    // 2. UPDATE CONTRACT\n    // -------------------------------------------------------------\n    if (action === \"updateContract\") {\n      var updatePayload = body.data || {};\n      var targetId = updatePayload.id;\n      if (!targetId) return respondJson({ success: false, data: null, error: \"Missing contract id\" });\n      \n      var sheet2 = ss.getSheetByName(\"Contracts\");\n      var data = sheet2.getDataRange().getValues();\n      var targetRowIndex = -1;\n      \n      for (var i = 1; i < data.length; i++) {\n        if (String(data[i][0]) === String(targetId)) {\n          targetRowIndex = i + 1; // 1-indexed\n          break;\n        }\n      }\n      \n      if (targetRowIndex === -1) {\n        return respondJson({ success: false, data: null, error: \"ไม่พบสัญญา id: \" + targetId });\n      }\n      \n      updatePayload.updated_at = nowIso;\n      var updatedRow = SCHEMA.Contracts.map(function(col, idx) {\n        if (updatePayload[col] !== undefined) {\n          return updatePayload[col];\n        }\n        return data[targetRowIndex - 1][idx];\n      });\n      \n      sheet2.getRange(targetRowIndex, 1, 1, SCHEMA.Contracts.length).setValues([updatedRow]);\n      return respondJson({ success: true, data: updatePayload, error: null });\n    }\n    \n    // -------------------------------------------------------------\n    // 3. DELETE CONTRACT\n    // -------------------------------------------------------------\n    if (action === \"deleteContract\") {\n      var delId = body.id || (body.data && body.data.id);\n      if (!delId) return respondJson({ success: false, data: null, error: \"Missing contract id to delete\" });\n      \n      var sheet3 = ss.getSheetByName(\"Contracts\");\n      var data3 = sheet3.getDataRange().getValues();\n      var delRowIndex = -1;\n      \n      for (var j = 1; j < data3.length; j++) {\n        if (String(data3[j][0]) === String(delId)) {\n          delRowIndex = j + 1;\n          break;\n        }\n      }\n      \n      if (delRowIndex !== -1) {\n        sheet3.deleteRow(delRowIndex);\n        \n        // ลบความสัมพันธ์ใน MonthlyReportItems ด้วย\n        var mriSheet = ss.getSheetByName(\"MonthlyReportItems\");\n        if (mriSheet && mriSheet.getLastRow() > 1) {\n          var mriData = mriSheet.getDataRange().getValues();\n          for (var k = mriData.length - 1; k >= 1; k--) {\n            if (String(mriData[k][2]) === String(delId)) {\n              mriSheet.deleteRow(k + 1);\n            }\n          }\n        }\n        return respondJson({ success: true, data: { id: delId }, error: null });\n      }\n      return respondJson({ success: false, data: null, error: \"ไม่พบรายการที่ต้องการลบ\" });\n    }\n    \n    // -------------------------------------------------------------\n    // 4. CREATE OR GET MONTHLY REPORT\n    // -------------------------------------------------------------\n    if (action === \"createReport\") {\n      var repData = body.data || {};\n      var rSheet = ss.getSheetByName(\"MonthlyReports\");\n      if (!rSheet) {\n        setupDatabase();\n        rSheet = ss.getSheetByName(\"MonthlyReports\");\n      }\n      \n      var reportId = repData.id || (\"skr1-\" + repData.year + \"-\" + repData.month);\n      var rValues = rSheet.getDataRange().getValues();\n      var foundRow = -1;\n      \n      for (var rIdx = 1; rIdx < rValues.length; rIdx++) {\n        if (String(rValues[rIdx][0]) === String(reportId)) {\n          foundRow = rIdx + 1;\n          break;\n        }\n      }\n      \n      if (foundRow !== -1) {\n        // คืนค่ารายงานที่มีอยู่แล้ว\n        var existing = {};\n        for (var c = 0; c < SCHEMA.MonthlyReports.length; c++) {\n          existing[SCHEMA.MonthlyReports[c]] = rValues[foundRow - 1][c];\n        }\n        return respondJson({ success: true, data: existing, error: null });\n      }\n      \n      // สร้างรายงานใหม่\n      repData.id = reportId;\n      repData.status = repData.status || \"draft\";\n      repData.created_at = nowIso;\n      repData.updated_at = nowIso;\n      \n      var newRepRow = SCHEMA.MonthlyReports.map(function(col) {\n        return repData[col] !== undefined ? repData[col] : \"\";\n      });\n      rSheet.appendRow(newRepRow);\n      return respondJson({ success: true, data: repData, error: null });\n    }\n    \n    // -------------------------------------------------------------\n    // 5. UPDATE MONTHLY REPORT (Publication status / URL / Date)\n    // -------------------------------------------------------------\n    if (action === \"updateReport\") {\n      var uRep = body.data || {};\n      var repIdToUpdate = uRep.id;\n      if (!repIdToUpdate) return respondJson({ success: false, data: null, error: \"Missing report id\" });\n      \n      var rSheet2 = ss.getSheetByName(\"MonthlyReports\");\n      var rVals2 = rSheet2.getDataRange().getValues();\n      var targetRIndex = -1;\n      \n      for (var ri = 1; ri < rVals2.length; ri++) {\n        if (String(rVals2[ri][0]) === String(repIdToUpdate)) {\n          targetRIndex = ri + 1;\n          break;\n        }\n      }\n      \n      if (targetRIndex === -1) {\n        // หากยังไม่มีให้สร้างใหม่\n        uRep.created_at = nowIso;\n        uRep.updated_at = nowIso;\n        var newRow = SCHEMA.MonthlyReports.map(function(col) {\n          return uRep[col] !== undefined ? uRep[col] : \"\";\n        });\n        rSheet2.appendRow(newRow);\n        return respondJson({ success: true, data: uRep, error: null });\n      }\n      \n      uRep.updated_at = nowIso;\n      var updatedRepRow = SCHEMA.MonthlyReports.map(function(col, idx) {\n        if (uRep[col] !== undefined) {\n          return uRep[col];\n        }\n        return rVals2[targetRIndex - 1][idx];\n      });\n      \n      rSheet2.getRange(targetRIndex, 1, 1, SCHEMA.MonthlyReports.length).setValues([updatedRepRow]);\n      return respondJson({ success: true, data: uRep, error: null });\n    }\n    \n    // -------------------------------------------------------------\n    // 6. SAVE REPORT ITEMS (Selection for สขร.1)\n    // -------------------------------------------------------------\n    if (action === \"saveReportItems\") {\n      var itemData = body.data || {};\n      var rptId = itemData.reportId;\n      var contractIds = itemData.contractIds || []; // array of contract ids\n      \n      if (!rptId) return respondJson({ success: false, data: null, error: \"Missing reportId\" });\n      \n      var itemsSheet = ss.getSheetByName(\"MonthlyReportItems\");\n      if (!itemsSheet) {\n        setupDatabase();\n        itemsSheet = ss.getSheetByName(\"MonthlyReportItems\");\n      }\n      \n      // ลบรายการเดิมของ reportId นี้ออกทั้งหมด\n      var curData = itemsSheet.getDataRange().getValues();\n      for (var rowI = curData.length - 1; rowI >= 1; rowI--) {\n        if (String(curData[rowI][1]) === String(rptId)) {\n          itemsSheet.deleteRow(rowI + 1);\n        }\n      }\n      \n      // เพิ่มรายการใหม่\n      if (contractIds.length > 0) {\n        var newRows = contractIds.map(function(cId) {\n          return [\n            generateId(\"MRI\"),\n            rptId,\n            cId,\n            nowIso\n          ];\n        });\n        \n        itemsSheet.getRange(itemsSheet.getLastRow() + 1, 1, newRows.length, 4).setValues(newRows);\n      }\n      \n      return respondJson({\n        success: true,\n        data: { reportId: rptId, count: contractIds.length, contractIds: contractIds },\n        error: null\n      });\n    }\n    \n    return respondJson({ success: false, data: null, error: \"Unknown POST action: \" + action });\n  } catch (err) {\n    return respondJson({ success: false, data: null, error: err.toString() });\n  }\n}\n";
