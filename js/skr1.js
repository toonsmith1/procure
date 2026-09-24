/**
 * ============================================================================
 * ทะเบียนคุมพัสดุ V2 — Monthly Report (สขร.1) Controller (skr1.js)
 * ============================================================================
 * รองรับ:
 * - ถือว่า "รายงาน สขร.1 รายเดือน" เป็น Entity ของระบบ
 * - การเลือกปี (พ.ศ.) และเดือนเพื่อเปิดหรือสร้างรายงาน
 * - ตารางเลือกรายการจัดซื้อจัดจ้างเข้าสู่รายงาน (MonthlyReportItems)
 * - บันทึกและดึง Selection เดิมกลับมาแสดงได้ตลอดเวลา
 * - บันทึก วันที่เผยแพร่, ลิงก์ URL, สถานะ (ร่าง / พร้อมเผยแพร่ / เผยแพร่แล้ว) ลง Google Sheets
 * - ส่งออกรายงานเป็นไฟล์ Excel (สขร.1)
 * ============================================================================
 */

let selectedReportYear = "2569";
let selectedReportMonth = "08";
let currentMonthlyReport = null; // Object of MonthlyReports
let selectedContractIds = new Set(); // Set of contract_ids for this report
let skr1SearchKeyword = "";
let skr1TypeFilter = "all";

// ============================================================================
// OPEN SPECIFIC MONTH REPORT
// ============================================================================

window.openSkr1Report = function(year, month) {
  selectedReportYear = String(year);
  selectedReportMonth = String(month).padStart(2, "0");
  showPage("skr1");
};

// ============================================================================
// MAIN SKR.1 RENDERER
// ============================================================================

window.renderSkr1 = async function() {
  const container = document.getElementById("page-skr1");
  if (!container) return;

  const currentYear = new Date().getFullYear() + 543;
  const currentMonthNum = String(new Date().getMonth() + 1).padStart(2, "0");

  // ถ้ายังไม่มีการเลือก ให้ใช้ปีและเดือนปัจจุบัน
  if (!selectedReportYear) selectedReportYear = String(currentYear);
  if (!selectedReportMonth) selectedReportMonth = currentMonthNum;

  // ค้นหารายงานใน State หรือสร้าง Entity Id
  const reportId = `skr1-${selectedReportYear}-${selectedReportMonth}`;
  const existingReport = (appState.reports || []).find(r => r.id === reportId);

  currentMonthlyReport = existingReport || {
    id: reportId,
    year: selectedReportYear,
    month: selectedReportMonth,
    report_name: `สขร.1 ${getThaiMonthName(selectedReportMonth)} ${selectedReportYear}`,
    published_date: "",
    published_url: "",
    status: "draft",
    note: ""
  };

  // ดึงรายการ contract_id ที่เชื่อมกับ report นี้
  const currentLinkedItems = (appState.reportItems || [])
    .filter(it => it.report_id === reportId)
    .map(it => it.contract_id);
  
  selectedContractIds = new Set(currentLinkedItems);

  // คำนวณสรุปยอดเงินและจำนวนรายการที่เลือก
  const allContracts = appState.contracts || [];
  let selectedTotalAmt = 0;
  selectedContractIds.forEach(cId => {
    const c = allContracts.find(item => item.id === cId);
    if (c) {
      selectedTotalAmt += parseMoney(c.contract_amount || c.agreed_price || c.budget);
    }
  });

  // กรองรายการสัญญาสำหรับตารางเลือก
  const displayContracts = allContracts.filter(item => {
    if (skr1TypeFilter !== "all" && item.type !== skr1TypeFilter) return false;
    if (skr1SearchKeyword) {
      const kw = skr1SearchKeyword.toLowerCase();
      const mDoc = (item.document_no || "").toLowerCase().includes(kw);
      const mProj = (item.project_name || "").toLowerCase().includes(kw);
      const mVen = (item.vendor_name || "").toLowerCase().includes(kw);
      if (!mDoc && !mProj && !mVen) return false;
    }
    return true;
  });

  const monthObj = CONFIG.THAI_MONTHS.find(m => m.num === selectedReportMonth);
  const thaiMonthTitle = `${monthObj ? monthObj.name : selectedReportMonth} ${selectedReportYear}`;

  container.innerHTML = `
    <div class="fade-up">
      <!-- Title Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 14px;">
        <div>
          <h2 style="font-size: 18px; font-weight: 700; color: #f1f5f9;">📥 การจัดทำรายงาน สขร.1 ประจำเดือน</h2>
          <p style="font-size: 12.5px; color: #94a3b8; margin-top: 2px;">
            สรุปผลการดำเนินการจัดซื้อจัดจ้างในรอบเดือน และบันทึกข้อมูลการเผยแพร่ตาม พ.ร.บ. ข้อมูลข่าวสารฯ
          </p>
        </div>

        <!-- Past Reports Dropdown & History Link -->
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-sm btn-ghost" onclick="toggleReportHistoryModal()">
            📜 ประวัติรายงานทั้งหมด (${(appState.reports || []).length})
          </button>
        </div>
      </div>

      <!-- Month & Year Selector Card -->
      <div class="card" style="padding: 18px 20px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <label style="font-size: 13.5px; font-weight: 600; color: #f1f5f9; white-space: nowrap;">
              📅 เลือกรอบเดือนรายงาน:
            </label>

            <!-- Month Select -->
            <select class="inp" style="width: 160px;" id="skr1_month_select" onchange="changeReportPeriod()">
              ${CONFIG.THAI_MONTHS.map(m => `
                <option value="${m.num}" ${m.num === selectedReportMonth ? "selected" : ""}>
                  ${m.name}
                </option>
              `).join("")}
            </select>

            <!-- Year Select -->
            <select class="inp" style="width: 120px;" id="skr1_year_select" onchange="changeReportPeriod()">
              ${[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => `
                <option value="${y}" ${String(y) === String(selectedReportYear) ? "selected" : ""}>
                  ${y}
                </option>
              `).join("")}
            </select>

            <button class="btn btn-sm btn-ghost" onclick="changeReportPeriod()">โหลดรายงาน</button>
          </div>

          <div>
            <span style="font-size: 13px; color: #94a3b8; margin-right: 8px;">สถานะรายงาน:</span>
            ${getReportStatusBadge(currentMonthlyReport.status)}
          </div>
        </div>
      </div>

      <!-- Publication Metadata Card (วันที่เผยแพร่ & ลิงก์ URL) -->
      <div class="card" style="margin-bottom: 20px;">
        <div style="padding-bottom: 12px; margin-bottom: 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="font-size: 15px; font-weight: 600; color: #38bdf8;">
              🌐 ข้อมูลการเผยแพร่ สขร.1 — รอบเดือน ${escapeHtml(thaiMonthTitle)}
            </h3>
            <p style="font-size: 12px; color: #64748b; margin-top: 2px;">
              บันทึกวันที่และลิงก์ URL ที่นำขึ้นเว็บไซต์หน่วยงาน ข้อมูลจะถูกจัดเก็บลง Sheet <code>MonthlyReports</code>
            </p>
          </div>

          <button id="save-pub-btn" class="btn btn-sm btn-primary" onclick="savePublicationInfo()">
            💾 บันทึกข้อมูลการเผยแพร่
          </button>
        </div>

        <div class="grid-3">
          <!-- 1. Publication Status -->
          <div class="form-group">
            <label class="form-label">สถานะการเผยแพร่</label>
            <select id="pub_status" class="inp">
              <option value="draft" ${currentMonthlyReport.status === "draft" ? "selected" : ""}>ร่าง (ยังไม่เผยแพร่)</option>
              <option value="ready" ${currentMonthlyReport.status === "ready" ? "selected" : ""}>พร้อมเผยแพร่</option>
              <option value="published" ${currentMonthlyReport.status === "published" ? "selected" : ""}>เผยแพร่แล้ว (Published)</option>
            </select>
          </div>

          <!-- 2. Publication Date -->
          <div class="form-group">
            <label class="form-label">วันที่เผยแพร่บนเว็บไซต์</label>
            <input type="date" id="pub_date" class="inp" value="${escapeHtml(currentMonthlyReport.published_date || '')}">
          </div>

          <!-- 3. Report Name -->
          <div class="form-group">
            <label class="form-label">ชื่อรายงาน</label>
            <input type="text" id="pub_name" class="inp" value="${escapeHtml(currentMonthlyReport.report_name || `สขร.1 ${thaiMonthTitle}`)}">
          </div>

          <!-- 4. Publication URL (Wide) -->
          <div class="form-group grid-wide">
            <label class="form-label">ลิงก์ URL ที่เผยแพร่ (Public Link)</label>
            <div style="display: flex; gap: 10px;">
              <input type="url" id="pub_url" class="inp" placeholder="https://oae.go.th/... หรือ ลิงก์หน้าเว็บที่เผยแพร่ สขร.1" value="${escapeHtml(currentMonthlyReport.published_url || '')}">
              ${currentMonthlyReport.published_url ? `
                <a href="${escapeHtml(currentMonthlyReport.published_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost" style="color: #38bdf8; white-space: nowrap;">
                  เปิดดู ↗
                </a>
              ` : ""}
            </div>
          </div>
        </div>
      </div>

      <!-- Items Selection & Summary Toolbar -->
      <div class="card" style="margin-bottom: 20px; padding: 16px 20px; background: rgba(14, 165, 233, 0.05); border-color: rgba(56, 189, 248, 0.2);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
          <div>
            <div style="font-size: 14px; font-weight: 600; color: #f1f5f9;">
              ✅ เลือกแล้ว <span id="skr1-count-badge" style="color: #38bdf8; font-size: 16px;">${selectedContractIds.size}</span> รายการ
            </div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 2px;">
              วงเงินรวมในรายงาน: <b class="mono" id="skr1-amount-badge" style="color: #fbbf24; font-size: 15px;">฿${formatMoney(selectedTotalAmt)}</b>
            </div>
          </div>

          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button id="save-items-btn" class="btn btn-primary" onclick="saveSelectedReportItems()">
              💾 บันทึกรายการที่เลือก
            </button>
            <button class="btn btn-success" onclick="downloadSkr1Excel()">
              📥 ดาวน์โหลด สขร.1 (Excel)
            </button>
            <button class="btn btn-ghost" onclick="clearSkr1Selection()">
              🗑️ ล้างการเลือก
            </button>
          </div>
        </div>
      </div>

      <!-- Contracts Selection Table -->
      <div class="card" style="padding: 0; overflow: hidden;">
        <div style="padding: 14px 18px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <span style="font-size: 14px; font-weight: 600; color: #f1f5f9;">เลือกรายการจัดซื้อจัดจ้าง</span>
            <input type="text" class="inp" style="width: 220px; padding: 6px 10px; font-size: 12.5px;" placeholder="ค้นหาในตาราง..." value="${escapeHtml(skr1SearchKeyword)}" oninput="handleSkr1Search(this.value)">
            <select class="inp" style="width: 140px; padding: 6px 10px; font-size: 12.5px;" onchange="handleSkr1TypeFilter(this.value)">
              <option value="all" ${skr1TypeFilter === "all" ? "selected" : ""}>ทุกประเภท</option>
              <option value="contract" ${skr1TypeFilter === "contract" ? "selected" : ""}>สัญญา</option>
              <option value="po" ${skr1TypeFilter === "po" ? "selected" : ""}>ใบสั่งซื้อ/จ้าง</option>
              <option value="agreement" ${skr1TypeFilter === "agreement" ? "selected" : ""}>ข้อตกลง</option>
            </select>
          </div>

          <div>
            <label style="font-size: 12.5px; color: #38bdf8; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <input type="checkbox" class="chk" id="select-all-skr1" onchange="toggleAllSkr1Items(this.checked)">
              เลือกทั้งหมดที่แสดง
            </label>
          </div>
        </div>

        <div class="table-container" style="border: none; border-radius: 0;">
          <table>
            <thead>
              <tr>
                <th style="width: 44px; text-align: center;">เลือก</th>
                <th style="width: 100px;">ประเภท</th>
                <th>เลขที่เอกสาร</th>
                <th>วันที่</th>
                <th>คู่สัญญา / ผู้ขาย</th>
                <th>รายการ / โครงการ</th>
                <th style="text-align: right;">วงเงิน (บาท)</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              ${displayContracts.length === 0 ? `
                <tr><td colspan="8" style="text-align: center; padding: 36px; color: #64748b;">ไม่พบรายการที่ตรงกับเงื่อนไข</td></tr>
              ` : displayContracts.map(item => {
                const isChecked = selectedContractIds.has(item.id);
                const typeInfo = getTypeInfo(item.type);
                const amt = parseMoney(item.contract_amount || item.agreed_price || item.budget);
                return `
                  <tr style="${isChecked ? 'background: rgba(56, 189, 248, 0.05);' : ''}">
                    <td style="text-align: center;">
                      <input type="checkbox" class="chk skr1-row-chk" value="${escapeHtml(item.id)}" ${isChecked ? "checked" : ""} onchange="toggleSkr1Item('${escapeHtml(item.id)}', this.checked)">
                    </td>
                    <td style="white-space: nowrap;">${typeInfo.icon} ${escapeHtml(typeInfo.label)}</td>
                    <td style="font-weight: 600; color: #e2e8f0; white-space: nowrap;">${escapeHtml(item.document_no)}</td>
                    <td style="color: #94a3b8; white-space: nowrap;">${escapeHtml(isoToThaiDate(item.document_date))}</td>
                    <td style="color: #cbd5e1; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.vendor_name)}</td>
                    <td style="color: #94a3b8; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.project_name)}</td>
                    <td class="mono" style="text-align: right; color: #f1f5f9; white-space: nowrap;">฿${formatMoney(amt)}</td>
                    <td>${getStatusBadge(item.status)}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
};

// ============================================================================
// PERIOD CHANGE & FILTER HANDLERS
// ============================================================================

function changeReportPeriod() {
  const m = document.getElementById("skr1_month_select")?.value;
  const y = document.getElementById("skr1_year_select")?.value;
  if (m && y) {
    selectedReportMonth = m;
    selectedReportYear = y;
    window.renderSkr1();
  }
}

function handleSkr1Search(kw) {
  skr1SearchKeyword = kw.trim();
  window.renderSkr1();
}

function handleSkr1TypeFilter(type) {
  skr1TypeFilter = type;
  window.renderSkr1();
}

function toggleSkr1Item(contractId, checked) {
  if (checked) {
    selectedContractIds.add(contractId);
  } else {
    selectedContractIds.delete(contractId);
  }
  updateSkr1ToolbarSummary();
}

function toggleAllSkr1Items(checked) {
  const allContracts = appState.contracts || [];
  allContracts.forEach(item => {
    if (skr1TypeFilter !== "all" && item.type !== skr1TypeFilter) return;
    if (checked) {
      selectedContractIds.add(item.id);
    } else {
      selectedContractIds.delete(item.id);
    }
  });
  window.renderSkr1();
}

function clearSkr1Selection() {
  selectedContractIds.clear();
  window.renderSkr1();
}

function updateSkr1ToolbarSummary() {
  const countEl = document.getElementById("skr1-count-badge");
  const amtEl = document.getElementById("skr1-amount-badge");
  if (!countEl || !amtEl) return;

  const allContracts = appState.contracts || [];
  let total = 0;
  selectedContractIds.forEach(id => {
    const c = allContracts.find(item => item.id === id);
    if (c) {
      total += parseMoney(c.contract_amount || c.agreed_price || c.budget);
    }
  });

  countEl.textContent = selectedContractIds.size;
  amtEl.textContent = `฿${formatMoney(total)}`;
}

// ============================================================================
// SAVE PUBLICATION INFO & SAVE ITEMS
// ============================================================================

async function savePublicationInfo() {
  const btn = document.getElementById("save-pub-btn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `⏳ กำลังบันทึก...`;
  }

  const payload = {
    id: currentMonthlyReport.id,
    year: selectedReportYear,
    month: selectedReportMonth,
    report_name: document.getElementById("pub_name")?.value.trim() || currentMonthlyReport.report_name,
    published_date: document.getElementById("pub_date")?.value || "",
    published_url: document.getElementById("pub_url")?.value.trim() || "",
    status: document.getElementById("pub_status")?.value || "draft",
    note: currentMonthlyReport.note || ""
  };

  try {
    await api.updateReport(payload);
    showToast("บันทึกข้อมูลการเผยแพร่ สขร.1 สำเร็จ!", "success");

    // อัปเดตใน appState.reports
    const existingIdx = (appState.reports || []).findIndex(r => r.id === payload.id);
    if (existingIdx !== -1) {
      appState.reports[existingIdx] = payload;
    } else {
      appState.reports.push(payload);
    }

    currentMonthlyReport = payload;
    window.renderSkr1();
  } catch (err) {
    showToast("บันทึกข้อมูลการเผยแพร่ล้มเหลว: " + err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `💾 บันทึกข้อมูลการเผยแพร่`;
    }
  }
}

async function saveSelectedReportItems() {
  const btn = document.getElementById("save-items-btn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `⏳ กำลังบันทึกรายการ...`;
  }

  const contractIds = Array.from(selectedContractIds);

  try {
    // 1. บันทึก Report ถ้ายังไม่มี
    await api.updateReport({
      id: currentMonthlyReport.id,
      year: selectedReportYear,
      month: selectedReportMonth,
      report_name: document.getElementById("pub_name")?.value.trim() || currentMonthlyReport.report_name,
      published_date: document.getElementById("pub_date")?.value || "",
      published_url: document.getElementById("pub_url")?.value.trim() || "",
      status: document.getElementById("pub_status")?.value || "draft"
    });

    // 2. บันทึก ReportItems
    await api.saveReportItems(currentMonthlyReport.id, contractIds);

    // 3. อัปเดต state
    appState.reportItems = appState.reportItems.filter(it => it.report_id !== currentMonthlyReport.id);
    contractIds.forEach(cId => {
      appState.reportItems.push({
        id: "MRI-" + Date.now(),
        report_id: currentMonthlyReport.id,
        contract_id: cId,
        created_at: new Date().toISOString()
      });
    });

    showToast(`บันทึกการเลือก ${contractIds.length} รายการ เรียบร้อยแล้ว!`, "success");
  } catch (err) {
    showToast("เกิดข้อผิดพลาดในการบันทึกรายการ: " + err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `💾 บันทึกรายการที่เลือก`;
    }
  }
}

// ============================================================================
// EXPORT EXCEL สขร.1 HANDLER
// ============================================================================

function downloadSkr1Excel() {
  if (selectedContractIds.size === 0) {
    showToast("กรุณาเลือกรายการจัดซื้อจัดจ้างอย่างน้อย 1 รายการก่อนดาวน์โหลด", "warning");
    return;
  }

  const allContracts = appState.contracts || [];
  const selectedList = [];
  selectedContractIds.forEach(id => {
    const c = allContracts.find(item => item.id === id);
    if (c) selectedList.push(c);
  });

  const monthObj = CONFIG.THAI_MONTHS.find(m => m.num === selectedReportMonth);
  const thaiMonthName = monthObj ? monthObj.name : selectedReportMonth;

  if (window.exportSkr1Excel) {
    window.exportSkr1Excel(currentMonthlyReport, selectedList, thaiMonthName, selectedReportYear);
  } else {
    showToast("โมดูล Export Excel ไม่พร้อมใช้งาน", "error");
  }
}

// ============================================================================
// REPORT HISTORY MODAL
// ============================================================================

function toggleReportHistoryModal() {
  const reports = appState.reports || [];
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 720px;">
      <div class="modal-header">
        <h3 style="font-size: 16px; font-weight: 700; color: #f1f5f9;">📜 ประวัติรายงาน สขร.1 ทั้งหมด</h3>
        <button class="modal-close-btn" id="history-modal-close">&times;</button>
      </div>

      <div class="modal-body" style="padding: 0;">
        <div class="table-container" style="border: none; border-radius: 0;">
          <table>
            <thead>
              <tr>
                <th>รอบเดือน</th>
                <th>สถานะ</th>
                <th>วันที่เผยแพร่</th>
                <th>ลิงก์ URL</th>
                <th style="text-align: center;">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${reports.length === 0 ? `
                <tr><td colspan="5" style="text-align: center; padding: 36px; color: #64748b;">ยังไม่มีรายงานที่ถูกสร้างในระบบ</td></tr>
              ` : reports.map(r => {
                const thaiD = r.published_date ? isoToThaiDate(r.published_date) : "-";
                return `
                  <tr>
                    <td style="font-weight: 600; color: #f1f5f9;">${escapeHtml(r.report_name || `สขร.1 ${r.month}/${r.year}`)}</td>
                    <td>${getReportStatusBadge(r.status)}</td>
                    <td style="color: #94a3b8;">${escapeHtml(thaiD)}</td>
                    <td>
                      ${r.published_url ? `
                        <a href="${escapeHtml(r.published_url)}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: none; font-size: 12px;">
                          🔗 เปิดลิงก์
                        </a>
                      ` : `<span style="color:#475569;">-</span>`}
                    </td>
                    <td style="text-align: center;">
                      <button class="btn btn-sm btn-primary" onclick="document.querySelector('.modal-overlay').remove(); window.openSkr1Report('${r.year}', '${r.month}')">
                        เปิดดู
                      </button>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" id="history-modal-close-btn">ปิด</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector("#history-modal-close").onclick = close;
  modal.querySelector("#history-modal-close-btn").onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };
}

function getThaiMonthName(monthNumber) {
  const m = CONFIG.THAI_MONTHS.find(item => item.num === String(monthNumber).padStart(2, "0"));
  return m ? m.name : monthNumber;
}
