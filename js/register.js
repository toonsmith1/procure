/**
 * ============================================================================
 * ทะเบียนคุมพัสดุ V2 — Register & Form Controller (register.js)
 * ============================================================================
 * รองรับ:
 * - ตารางทะเบียนรวมทุกประเภทสัญญา/ใบสั่ง/ข้อตกลง
 * - ระบบค้นหาและตัวกรอง (ประเภท, ปี พ.ศ., สถานะ)
 * - Modal แสดงรายละเอียดครบทุกฟิลด์
 * - ฟอร์มเพิ่มและแก้ไขข้อมูลรายการ พร้อม Dynamic Fields ตามประเภท
 * - ระบบตรวจสอบความถูกต้อง (Validation) และ Feedback ป้องกัน Double Submit
 * ============================================================================
 */

// Local state for editing
let currentEditingId = null;
let currentFormType = "contract";

// ============================================================================
// REGISTER TABLE RENDERER
// ============================================================================

window.renderRegister = function() {
  const container = document.getElementById("page-register");
  if (!container) return;

  const contracts = appState.contracts || [];

  // หาปี พ.ศ. ที่มีในข้อมูลสำหรับ Dropdown filter
  const yearsSet = new Set();
  contracts.forEach(item => {
    if (item.document_date) {
      const parts = item.document_date.split("-");
      if (parts.length > 0) {
        const y = parseInt(parts[0], 10);
        if (!isNaN(y)) yearsSet.add(y + 543);
      }
    }
  });
  const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

  // กรองข้อมูล
  const filtered = contracts.filter(item => {
    // กรองประเภท
    if (appState.activeFilterType !== "all" && item.type !== appState.activeFilterType) {
      return false;
    }

    // กรองปี
    if (appState.activeFilterYear !== "all") {
      if (!item.document_date) return false;
      const y = parseInt(item.document_date.split("-")[0], 10) + 543;
      if (String(y) !== String(appState.activeFilterYear)) return false;
    }

    // กรองสถานะ
    if (appState.activeFilterStatus !== "all") {
      const st = (item.status || "").trim();
      if (st !== appState.activeFilterStatus) return false;
    }

    // ค้นหาข้อความ
    if (appState.searchKeyword) {
      const kw = appState.searchKeyword.toLowerCase();
      const matchDocNo = (item.document_no || "").toLowerCase().includes(kw);
      const matchProject = (item.project_name || "").toLowerCase().includes(kw);
      const matchVendor = (item.vendor_name || "").toLowerCase().includes(kw);
      const matchEgp = (item.egp_project_no || "").toLowerCase().includes(kw);
      const matchControl = (item.control_no || "").toLowerCase().includes(kw);
      const matchPoGfmis = (item.gfmis_po || "").toLowerCase().includes(kw);
      if (!matchDocNo && !matchProject && !matchVendor && !matchEgp && !matchControl && !matchPoGfmis) {
        return false;
      }
    }

    return true;
  });

  // Render Layout
  container.innerHTML = `
    <div class="fade-up">
      <!-- Header Bar with Add Button -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
        <div>
          <h2 style="font-size: 18px; font-weight: 700; color: #f1f5f9;">📋 ทะเบียนคุมการจัดซื้อจัดจ้าง</h2>
          <p style="font-size: 12.5px; color: #94a3b8; margin-top: 2px;">
            สัญญา, ใบสั่งซื้อ/จ้าง/เช่า, และข้อตกลง (พบ ${filtered.length} จากทั้งหมด ${contracts.length} รายการ)
          </p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-primary" onclick="window.openNewContractForm()">
            ➕ เพิ่มรายการใหม่
          </button>
        </div>
      </div>

      <!-- Filter Controls Bar -->
      <div class="card" style="padding: 16px; margin-bottom: 20px;">
        <div class="filter-bar">
          <!-- Search Box -->
          <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input type="text" class="inp" id="register_search" placeholder="ค้นหา: เลขที่เอกสาร, ชื่อโครงการ, คู่สัญญา, e-GP..." value="${escapeHtml(appState.searchKeyword)}" oninput="handleRegisterSearch(this.value)">
          </div>

          <!-- Type Filter -->
          <div style="min-width: 140px;">
            <select class="inp" id="register_type_filter" onchange="handleTypeFilter(this.value)">
              <option value="all" ${appState.activeFilterType === "all" ? "selected" : ""}>ทุกประเภทเอกสาร</option>
              <option value="contract" ${appState.activeFilterType === "contract" ? "selected" : ""}>📜 สัญญา</option>
              <option value="po" ${appState.activeFilterType === "po" ? "selected" : ""}>🛒 ใบสั่งซื้อ/จ้าง</option>
              <option value="agreement" ${appState.activeFilterType === "agreement" ? "selected" : ""}>🤝 ข้อตกลง</option>
            </select>
          </div>

          <!-- Year Filter -->
          <div style="min-width: 120px;">
            <select class="inp" id="register_year_filter" onchange="handleYearFilter(this.value)">
              <option value="all" ${appState.activeFilterYear === "all" ? "selected" : ""}>ทุกปี พ.ศ.</option>
              ${availableYears.map(y => `<option value="${y}" ${String(appState.activeFilterYear) === String(y) ? "selected" : ""}>พ.ศ. ${y}</option>`).join("")}
            </select>
          </div>

          <!-- Status Filter -->
          <div style="min-width: 140px;">
            <select class="inp" id="register_status_filter" onchange="handleStatusFilter(this.value)">
              <option value="all" ${appState.activeFilterStatus === "all" ? "selected" : ""}>ทุกสถานะ</option>
              <option value="ดำเนินการ" ${appState.activeFilterStatus === "ดำเนินการ" ? "selected" : ""}>ดำเนินการ</option>
              <option value="รอส่งมอบ" ${appState.activeFilterStatus === "รอส่งมอบ" ? "selected" : ""}>รอส่งมอบ</option>
              <option value="ส่งมอบแล้ว" ${appState.activeFilterStatus === "ส่งมอบแล้ว" ? "selected" : ""}>ส่งมอบแล้ว</option>
              <option value="ตรวจรับแล้ว" ${appState.activeFilterStatus === "ตรวจรับแล้ว" ? "selected" : ""}>ตรวจรับแล้ว</option>
              <option value="เบิกจ่ายแล้ว" ${appState.activeFilterStatus === "เบิกจ่ายแล้ว" ? "selected" : ""}>เบิกจ่ายแล้ว</option>
              <option value="คืนหลักประกัน" ${appState.activeFilterStatus === "คืนหลักประกัน" ? "selected" : ""}>คืนหลักประกัน</option>
              <option value="ยกเลิก" ${appState.activeFilterStatus === "ยกเลิก" ? "selected" : ""}>ยกเลิก</option>
            </select>
          </div>

          <!-- Reset Filter -->
          ${(appState.activeFilterType !== "all" || appState.activeFilterYear !== "all" || appState.activeFilterStatus !== "all" || appState.searchKeyword) ? `
            <button class="btn btn-sm btn-ghost" onclick="resetRegisterFilters()">ล้างตัวกรอง</button>
          ` : ""}
        </div>
      </div>

      <!-- Main Data Table -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th style="width: 110px;">ประเภท</th>
              <th>เลขที่เอกสาร</th>
              <th>วันที่ลงนาม/ออกใบสั่ง</th>
              <th>คู่สัญญา / ผู้ขาย</th>
              <th>รายการ / โครงการ</th>
              <th style="text-align: right;">วงเงิน (บาท)</th>
              <th>สถานะ</th>
              <th style="text-align: center; width: 140px;">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `
              <tr>
                <td colspan="8" style="text-align: center; padding: 48px; color: #64748b;">
                  <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
                  ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา
                </td>
              </tr>
            ` : filtered.map(item => {
              const typeInfo = getTypeInfo(item.type);
              const amt = parseMoney(item.contract_amount || item.agreed_price || item.budget);
              return `
                <tr class="clickable-row" onclick="window.viewContractDetail('${escapeHtml(item.id)}')">
                  <td style="white-space: nowrap;">
                    <span>${typeInfo.icon} ${escapeHtml(typeInfo.label)}</span>
                  </td>
                  <td style="font-weight: 600; color: #f1f5f9; white-space: nowrap;">
                    ${escapeHtml(item.document_no)}
                  </td>
                  <td style="color: #94a3b8; white-space: nowrap;">
                    ${escapeHtml(isoToThaiDate(item.document_date))}
                  </td>
                  <td style="color: #cbd5e1; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.vendor_name)}">
                    ${escapeHtml(item.vendor_name)}
                  </td>
                  <td style="color: #94a3b8; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.project_name)}">
                    ${escapeHtml(item.project_name)}
                  </td>
                  <td class="mono" style="text-align: right; color: #f1f5f9; font-weight: 500; white-space: nowrap;">
                    ฿${formatMoney(amt)}
                  </td>
                  <td>${getStatusBadge(item.status)}</td>
                  <td style="text-align: center; white-space: nowrap;" onclick="event.stopPropagation()">
                    <div class="action-btns">
                      <button class="action-btn" title="ดูรายละเอียด" onclick="window.viewContractDetail('${escapeHtml(item.id)}')">👁️ ดู</button>
                      <button class="action-btn" title="แก้ไขข้อมูล" onclick="window.editContract('${escapeHtml(item.id)}')">✏️ แก้ไข</button>
                      <button class="action-btn action-btn-danger" title="ลบรายการ" onclick="window.deleteContractItem('${escapeHtml(item.id)}', '${escapeHtml(item.document_no)}')">🗑️ ลบ</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
};

// Filter event handlers
function handleRegisterSearch(val) {
  appState.searchKeyword = val.trim();
  window.renderRegister();
}

function handleTypeFilter(val) {
  appState.activeFilterType = val;
  window.renderRegister();
}

function handleYearFilter(val) {
  appState.activeFilterYear = val;
  window.renderRegister();
}

function handleStatusFilter(val) {
  appState.activeFilterStatus = val;
  window.renderRegister();
}

function resetRegisterFilters() {
  appState.activeFilterType = "all";
  appState.activeFilterYear = "all";
  appState.activeFilterStatus = "all";
  appState.searchKeyword = "";
  window.renderRegister();
}

// ============================================================================
// DETAIL MODAL VIEW
// ============================================================================

window.viewContractDetail = function(id) {
  const item = (appState.contracts || []).find(c => c.id === id);
  if (!item) {
    showToast("ไม่พบข้อมูลรายการนี้", "error");
    return;
  }

  const typeInfo = getTypeInfo(item.type);
  const amt = parseMoney(item.contract_amount || item.agreed_price || item.budget);

  const fields = [
    { label: "รหัสระบบ (ID)", value: item.id },
    { label: "ประเภทเอกสาร", value: `${typeInfo.icon} ${typeInfo.label}` },
    { label: "เลขที่เอกสาร", value: item.document_no },
    { label: "เลขที่โครงการ (e-GP)", value: item.egp_project_no },
    { label: "เลขคุมสัญญา / เลขคุมใบสั่ง", value: item.control_no },
    { label: "เลขที่ PO (GFMIS)", value: item.gfmis_po },
    { label: "วันที่ลงนาม / วันที่ออกใบสั่ง", value: isoToThaiDate(item.document_date) },
    { label: "คู่สัญญา / ผู้ขาย", value: item.vendor_name },
    { label: "เลขประจำตัวผู้เสียภาษี", value: item.tax_id },
    { label: "รายการ / โครงการ", value: item.project_name },
    { label: "วงเงินงบประมาณ", value: item.budget ? `฿${formatMoney(item.budget)}` : "" },
    { label: "ราคากลาง", value: item.median_price ? `฿${formatMoney(item.median_price)}` : "" },
    { label: "ราคาที่เสนอ", value: item.offered_price ? `฿${formatMoney(item.offered_price)}` : "" },
    { label: "ราคาที่ตกลง", value: item.agreed_price ? `฿${formatMoney(item.agreed_price)}` : "" },
    { label: "วงเงินตามสัญญา / วงเงิน", value: `฿${formatMoney(amt)}` },
    { label: "ระยะเวลาเริ่มต้น", value: isoToThaiDate(item.start_date) },
    { label: "ระยะเวลาสิ้นสุด / ส่งมอบ", value: isoToThaiDate(item.end_date) },
    { label: "ประเภทหลักประกัน", value: item.guarantee_type },
    { label: "มูลค่าหลักประกัน", value: item.guarantee_amount ? `฿${formatMoney(item.guarantee_amount)}` : "" },
    { label: "สถานะ", value: item.status },
    { label: "หมายเหตุ", value: item.note },
    { label: "บันทึกข้อมูลเมื่อ", value: item.created_at ? new Date(item.created_at).toLocaleString("th-TH") : "" },
    { label: "แก้ไขล่าสุดเมื่อ", value: item.updated_at ? new Date(item.updated_at).toLocaleString("th-TH") : "" }
  ];

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <div>
          <div style="font-size: 16px; font-weight: 700; color: #f1f5f9;">
            ${typeInfo.icon} ${escapeHtml(item.document_no)}
          </div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
            ${escapeHtml(item.vendor_name)}
          </div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          ${getStatusBadge(item.status)}
          <button class="modal-close-btn" id="view-modal-close">&times;</button>
        </div>
      </div>

      <div class="modal-body">
        ${fields.map(f => `
          <div class="detail-row">
            <div class="detail-label">${escapeHtml(f.label)}</div>
            <div class="detail-value">${escapeHtml(f.value)}</div>
          </div>
        `).join("")}
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" id="view-modal-close-btn">ปิด</button>
        <button class="btn btn-primary" onclick="document.querySelector('.modal-overlay').remove(); window.editContract('${escapeHtml(item.id)}')">
          ✏️ แก้ไขข้อมูลนี้
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector("#view-modal-close").onclick = close;
  modal.querySelector("#view-modal-close-btn").onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };
};

// ============================================================================
// DELETE CONTRACT HANDLER
// ============================================================================

window.deleteContractItem = function(id, docNo) {
  showConfirmModal({
    title: "ยืนยันการลบรายการ",
    message: `คุณแน่ใจหรือไม่ว่าต้องการลบเอกสารเลขที่ "${docNo}" ออกจากระบบ? การกระทำนี้ไม่สามารถเรียกคืนได้`,
    confirmText: "ลบรายการ",
    onConfirm: async () => {
      showToast("กำลังลบข้อมูล...", "info");
      try {
        await api.deleteContract(id);
        showToast("ลบข้อมูลสำเร็จ", "success");
        // อัปเดต state ท้องถิ่น
        appState.contracts = appState.contracts.filter(c => c.id !== id);
        // Refresh ทั้งหมด
        refreshData();
      } catch (err) {
        showToast("เกิดข้อผิดพลาดในการลบ: " + err.message, "error");
      }
    }
  });
};

// ============================================================================
// FORM (ADD & EDIT) RENDERER & HANDLER
// ============================================================================

window.openNewContractForm = function(type = "contract") {
  currentEditingId = null;
  currentFormType = type;
  showPage("form");
};

window.editContract = function(id) {
  const item = (appState.contracts || []).find(c => c.id === id);
  if (!item) {
    showToast("ไม่พบข้อมูลที่ต้องการแก้ไข", "error");
    return;
  }
  currentEditingId = id;
  currentFormType = item.type || "contract";
  showPage("form");
};

window.renderForm = function() {
  const container = document.getElementById("page-form");
  if (!container) return;

  const isEdit = !!currentEditingId;
  const item = isEdit ? (appState.contracts || []).find(c => c.id === currentEditingId) : null;
  const formType = currentFormType;
  const typeInfo = getTypeInfo(formType);

  container.innerHTML = `
    <div class="fade-up">
      <!-- Edit Mode Banner -->
      ${isEdit ? `
        <div style="margin-bottom: 16px; padding: 12px 18px; border-radius: var(--radius-md); background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.25); color: #fbbf24; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <span>✏️ กำลังแก้ไข: <b>${escapeHtml(item?.document_no || "")}</b> — ${escapeHtml(item?.project_name || "")}</span>
          </div>
          <button class="btn btn-sm btn-ghost" onclick="currentEditingId=null; window.renderForm()" style="color: #fbbf24; border-color: rgba(251, 191, 36, 0.3);">
            ✕ ยกเลิกการแก้ไข (สร้างรายการใหม่)
          </button>
        </div>
      ` : `
        <!-- Type Selection Tabs (Only when creating new) -->
        <div class="tab-group">
          <button class="tab-btn ${formType === 'contract' ? 'active' : ''}" onclick="currentFormType='contract'; window.renderForm()">
            📜 สัญญา (Contract)
          </button>
          <button class="tab-btn ${formType === 'po' ? 'active' : ''}" onclick="currentFormType='po'; window.renderForm()">
            🛒 ใบสั่งซื้อ/จ้าง/เช่า (PO)
          </button>
          <button class="tab-btn ${formType === 'agreement' ? 'active' : ''}" onclick="currentFormType='agreement'; window.renderForm()">
            🤝 ข้อตกลง (Agreement)
          </button>
        </div>
      `}

      <!-- Main Form Card -->
      <div class="card">
        <div style="padding-bottom: 16px; margin-bottom: 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 16px; font-weight: 700; color: #f1f5f9;">
            ${typeInfo.icon} ${isEdit ? "แก้ไข" : "เพิ่ม"}${typeInfo.label}
          </h3>
          <span style="font-size: 12px; color: #94a3b8;">* จำเป็นต้องระบุข้อมูล</span>
        </div>

        <form id="contract-form" onsubmit="handleFormSubmit(event)">
          <div class="grid-2">
            <!-- 1. เลขที่เอกสาร -->
            <div class="form-group">
              <label class="form-label">
                ${formType === 'contract' ? 'เลขที่สัญญา' : (formType === 'po' ? 'เลขที่ใบสั่งซื้อ/จ้าง/เช่า' : 'เลขที่ข้อตกลง')}
                <span class="req">*</span>
              </label>
              <input type="text" id="f_document_no" class="inp" placeholder="${formType === 'contract' ? 'เช่น 1/2569' : (formType === 'po' ? 'เช่น ซ.1/2569' : 'เช่น ขต.1/2569')}" value="${escapeHtml(item?.document_no || '')}" required>
            </div>

            <!-- 2. เลขที่โครงการ e-GP -->
            <div class="form-group">
              <label class="form-label">เลขที่โครงการ (e-GP)</label>
              <input type="text" id="f_egp_project_no" class="inp" placeholder="เช่น 69017482910" value="${escapeHtml(item?.egp_project_no || '')}">
            </div>

            <!-- 3. เลขคุมสัญญา / เลขคุมใบสั่ง -->
            <div class="form-group">
              <label class="form-label">${formType === 'po' ? 'เลขคุมใบสั่ง' : 'เลขคุมสัญญา'}</label>
              <input type="text" id="f_control_no" class="inp" placeholder="เช่น 690214008123" value="${escapeHtml(item?.control_no || '')}">
            </div>

            <!-- 4. PO GFMIS -->
            <div class="form-group">
              <label class="form-label">เลขที่ PO (GFMIS)</label>
              <input type="text" id="f_gfmis_po" class="inp" placeholder="เช่น 4500019283" value="${escapeHtml(item?.gfmis_po || '')}">
            </div>

            <!-- 5. วันที่เอกสาร -->
            <div class="form-group">
              <label class="form-label">
                ${formType === 'contract' ? 'วันที่ลงนาม' : (formType === 'po' ? 'วันที่ออกใบสั่ง' : 'วันที่ทำข้อตกลง')}
              </label>
              <input type="date" id="f_document_date" class="inp" value="${escapeHtml(item?.document_date || '')}">
            </div>

            <!-- 6. เลขประจำตัวผู้เสียภาษี -->
            <div class="form-group">
              <label class="form-label">เลขประจำตัวผู้เสียภาษี (13 หลัก)</label>
              <input type="text" id="f_tax_id" class="inp" maxlength="13" placeholder="เช่น 0105558012345" value="${escapeHtml(item?.tax_id || '')}">
            </div>

            <!-- 7. คู่สัญญา / ผู้ขาย (Wide) -->
            <div class="form-group grid-wide">
              <label class="form-label">
                ${formType === 'po' ? 'ผู้ขาย / ผู้รับจ้าง' : 'คู่สัญญา (บริษัท / ห้างหุ้นส่วน / บุคคล)'}
                <span class="req">*</span>
              </label>
              <input type="text" id="f_vendor_name" class="inp" placeholder="ชื่อบริษัทหรือผู้รับจ้าง" value="${escapeHtml(item?.vendor_name || '')}" required>
            </div>

            <!-- 8. รายการ / โครงการ (Wide) -->
            <div class="form-group grid-wide">
              <label class="form-label">
                ${formType === 'po' ? 'รายการพัสดุ / บริการ' : 'รายการ / ชื่อโครงการ'}
                <span class="req">*</span>
              </label>
              <textarea id="f_project_name" class="inp" rows="2" placeholder="รายละเอียดรายการหรือโครงการจัดซื้อจัดจ้าง" required>${escapeHtml(item?.project_name || '')}</textarea>
            </div>

            <!-- 9. วงเงินงบประมาณ -->
            <div class="form-group">
              <label class="form-label">วงเงินงบประมาณ (บาท)</label>
              <input type="number" step="0.01" min="0" id="f_budget" class="inp" placeholder="0.00" value="${escapeHtml(item?.budget || '')}">
            </div>

            <!-- 10. ราคากลาง -->
            <div class="form-group">
              <label class="form-label">ราคากลาง (บาท)</label>
              <input type="number" step="0.01" min="0" id="f_median_price" class="inp" placeholder="0.00" value="${escapeHtml(item?.median_price || '')}">
            </div>

            <!-- 11. ราคาที่เสนอ -->
            <div class="form-group">
              <label class="form-label">ราคาที่เสนอ (บาท)</label>
              <input type="number" step="0.01" min="0" id="f_offered_price" class="inp" placeholder="0.00" value="${escapeHtml(item?.offered_price || '')}">
            </div>

            <!-- 12. ราคาที่ตกลง -->
            <div class="form-group">
              <label class="form-label">ราคาที่ตกลงจ้าง/ซื้อ (บาท)</label>
              <input type="number" step="0.01" min="0" id="f_agreed_price" class="inp" placeholder="0.00" value="${escapeHtml(item?.agreed_price || '')}">
            </div>

            <!-- 13. วงเงินตามสัญญา / วงเงิน -->
            <div class="form-group">
              <label class="form-label">
                ${formType === 'po' ? 'วงเงินตามใบสั่ง (บาท)' : 'วงเงินตามสัญญา (บาท)'}
              </label>
              <input type="number" step="0.01" min="0" id="f_contract_amount" class="inp" placeholder="0.00" value="${escapeHtml(item?.contract_amount || '')}">
            </div>

            <!-- 14. สถานะ -->
            <div class="form-group">
              <label class="form-label">สถานะ</label>
              <select id="f_status" class="inp">
                <option value="ดำเนินการ" ${(!item || item.status === "ดำเนินการ" || item.status === "ดำเนินการตามสัญญา") ? "selected" : ""}>ดำเนินการ</option>
                <option value="รอส่งมอบ" ${item?.status === "รอส่งมอบ" ? "selected" : ""}>รอส่งมอบ</option>
                <option value="ส่งมอบแล้ว" ${item?.status === "ส่งมอบแล้ว" ? "selected" : ""}>ส่งมอบแล้ว</option>
                <option value="ตรวจรับแล้ว" ${item?.status === "ตรวจรับแล้ว" ? "selected" : ""}>ตรวจรับแล้ว</option>
                <option value="เบิกจ่ายแล้ว" ${item?.status === "เบิกจ่ายแล้ว" ? "selected" : ""}>เบิกจ่ายแล้ว</option>
                <option value="คืนหลักประกัน" ${item?.status === "คืนหลักประกัน" ? "selected" : ""}>คืนหลักประกัน</option>
                <option value="ยกเลิก" ${item?.status === "ยกเลิก" ? "selected" : ""}>ยกเลิก</option>
              </select>
            </div>

            <!-- 15. วันเริ่มต้น -->
            <div class="form-group">
              <label class="form-label">${formType === 'po' ? 'กำหนดส่งมอบ (เริ่มต้น)' : 'ระยะเวลาสัญญา (เริ่มต้น)'}</label>
              <input type="date" id="f_start_date" class="inp" value="${escapeHtml(item?.start_date || '')}">
            </div>

            <!-- 16. วันสิ้นสุด -->
            <div class="form-group">
              <label class="form-label">${formType === 'po' ? 'กำหนดส่งมอบ (สิ้นสุด)' : 'ระยะเวลาสัญญา (สิ้นสุด)'}</label>
              <input type="date" id="f_end_date" class="inp" value="${escapeHtml(item?.end_date || '')}">
            </div>

            <!-- เฉพาะ Contract และ Agreement: มีหลักประกัน -->
            ${formType !== 'po' ? `
              <div class="form-group">
                <label class="form-label">ประเภทหลักประกันสัญญา</label>
                <select id="f_guarantee_type" class="inp">
                  <option value="หนังสือค้ำประกัน" ${item?.guarantee_type === "หนังสือค้ำประกัน" ? "selected" : ""}>หนังสือค้ำประกัน</option>
                  <option value="เงินสด" ${item?.guarantee_type === "เงินสด" ? "selected" : ""}>เงินสด</option>
                  <option value="เช็คธนาคาร" ${item?.guarantee_type === "เช็คธนาคาร" ? "selected" : ""}>เช็คธนาคาร</option>
                  <option value="พันธบัตร" ${item?.guarantee_type === "พันธบัตร" ? "selected" : ""}>พันธบัตร</option>
                  <option value="ยกเว้น" ${item?.guarantee_type === "ยกเว้น" ? "selected" : ""}>ยกเว้น</option>
                  <option value="-" ${item?.guarantee_type === "-" ? "selected" : ""}>-</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">มูลค่าหลักประกัน (บาท)</label>
                <input type="text" id="f_guarantee_amount" class="inp" placeholder="0.00 หรือ ยกเว้น" value="${escapeHtml(item?.guarantee_amount || '')}">
              </div>
            ` : ""}

            <!-- 17. หมายเหตุ (Wide) -->
            <div class="form-group grid-wide">
              <label class="form-label">หมายเหตุ</label>
              <textarea id="f_note" class="inp" rows="2" placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)">${escapeHtml(item?.note || '')}</textarea>
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; gap: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border);">
            <button type="submit" id="submit-contract-btn" class="btn btn-primary" style="flex: 2; padding: 14px;">
              💾 ${isEdit ? "อัปเดตข้อมูล" : "บันทึกลงระบบ"}
            </button>
            <button type="button" class="btn btn-ghost" onclick="clearContractForm()" style="flex: 1;">
              🗑️ ล้างข้อมูล
            </button>
            <button type="button" class="btn btn-ghost" onclick="showPage('register')">
              ย้อนกลับ
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
};

function clearContractForm() {
  currentEditingId = null;
  const form = document.getElementById("contract-form");
  if (form) form.reset();
}

/**
 * จัดการการ Submit Form (ตรวจสอบ Validation และส่ง API)
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const docNo = document.getElementById("f_document_no").value.trim();
  const vendorName = document.getElementById("f_vendor_name").value.trim();
  const projectName = document.getElementById("f_project_name").value.trim();

  // Validations
  if (!docNo) {
    showToast("กรุณาระบุเลขที่เอกสาร", "warning");
    return;
  }
  if (!vendorName) {
    showToast("กรุณาระบุชื่อคู่สัญญา / ผู้ขาย", "warning");
    return;
  }
  if (!projectName) {
    showToast("กรุณาระบุชื่อโครงการ / รายการ", "warning");
    return;
  }

  const submitBtn = document.getElementById("submit-contract-btn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `⏳ กำลังบันทึก...`;
  }

  const payload = {
    id: currentEditingId || undefined,
    type: currentFormType,
    document_no: docNo,
    egp_project_no: document.getElementById("f_egp_project_no")?.value.trim() || "",
    control_no: document.getElementById("f_control_no")?.value.trim() || "",
    gfmis_po: document.getElementById("f_gfmis_po")?.value.trim() || "",
    document_date: document.getElementById("f_document_date")?.value || "",
    vendor_name: vendorName,
    tax_id: document.getElementById("f_tax_id")?.value.trim() || "",
    project_name: projectName,
    budget: document.getElementById("f_budget")?.value || "0",
    median_price: document.getElementById("f_median_price")?.value || "0",
    offered_price: document.getElementById("f_offered_price")?.value || "0",
    agreed_price: document.getElementById("f_agreed_price")?.value || "0",
    contract_amount: document.getElementById("f_contract_amount")?.value || "0",
    status: document.getElementById("f_status")?.value || "ดำเนินการ",
    start_date: document.getElementById("f_start_date")?.value || "",
    end_date: document.getElementById("f_end_date")?.value || "",
    guarantee_type: document.getElementById("f_guarantee_type")?.value || "-",
    guarantee_amount: document.getElementById("f_guarantee_amount")?.value.trim() || "",
    note: document.getElementById("f_note")?.value.trim() || ""
  };

  try {
    if (currentEditingId) {
      await api.updateContract(payload);
      showToast("อัปเดตข้อมูลสำเร็จ!", "success");
    } else {
      await api.createContract(payload);
      showToast("บันทึกข้อมูลใหม่เรียบร้อย!", "success");
    }

    currentEditingId = null;
    await refreshData();
    showPage("register");
  } catch (err) {
    showToast("เกิดข้อผิดพลาด: " + err.message, "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `💾 บันทึกลงระบบ`;
    }
  }
}
