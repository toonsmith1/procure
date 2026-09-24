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
            <li>คัดลอกโค้ดจากไฟล์ <code>apps-script/Code.gs</code> ไปวาง</li>
            <li>กดเรียกฟังก์ชัน <code>setupDatabase()</code> เพื่อสร้าง Sheet และ Headers อัตโนมัติ</li>
            <li>กด <b>ทำให้ใช้งานได้ (Deploy)</b> &rarr; <b>การทำให้ใช้งานได้รายการใหม่ (New deployment)</b></li>
            <li>เลือกประเภท <b>เว็บแอป (Web app)</b>, ตั้งค่า ผู้มีสิทธิ์เข้าถึง = <b>ทุกคน (Anyone)</b></li>
            <li>คัดลอก URL ที่ได้มาใส่ใน <code>js/config.js</code> และบันทึก</li>
          </ol>
        </div>
      </div>
    </div>
  `;
};

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
