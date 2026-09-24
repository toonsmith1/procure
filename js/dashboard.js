/**
 * ============================================================================
 * ทะเบียนคุมพัสดุ V2 — Dashboard Page (dashboard.js)
 * ============================================================================
 * แสดงภาพรวมข้อมูลจัดซื้อจัดจ้าง:
 * - การ์ดสรุปยอดเงินและจำนวนเอกสาร
 * - สถิติสถานะงานพร้อม Donut Chart
 * - ข้อมูลรายงาน สขร.1 ล่าสุด พร้อมปุ่มเปิดหน้าที่เผยแพร่
 * ============================================================================
 */

window.renderDashboard = function() {
  const container = document.getElementById("page-dashboard");
  if (!container) return;

  const contracts = appState.contracts || [];
  const reports = appState.reports || [];
  const reportItems = appState.reportItems || [];

  // 1. คำนวณสถิติภาพรวม
  let grandTotal = 0;
  let contractCount = 0;
  let poCount = 0;
  let agreementCount = 0;
  let contractTotal = 0;
  let poTotal = 0;
  let agreementTotal = 0;

  const statusMap = {
    "ดำเนินการ": 0,
    "รอส่งมอบ": 0,
    "ส่งมอบแล้ว": 0,
    "ตรวจรับแล้ว": 0,
    "เบิกจ่ายแล้ว": 0,
    "คืนหลักประกัน": 0,
    "ยกเลิก": 0
  };

  contracts.forEach(item => {
    const amt = parseMoney(item.contract_amount || item.agreed_price || item.budget);
    grandTotal += amt;

    if (item.type === "contract") {
      contractCount++;
      contractTotal += amt;
    } else if (item.type === "po") {
      poCount++;
      poTotal += amt;
    } else if (item.type === "agreement") {
      agreementCount++;
      agreementTotal += amt;
    }

    const st = (item.status || "").trim();
    if (st.includes("ยกเลิก")) {
      statusMap["ยกเลิก"] = (statusMap["ยกเลิก"] || 0) + 1;
    } else if (st.includes("คืนหลักประกัน")) {
      statusMap["คืนหลักประกัน"] = (statusMap["คืนหลักประกัน"] || 0) + 1;
    } else if (st.includes("เบิกจ่ายแล้ว")) {
      statusMap["เบิกจ่ายแล้ว"] = (statusMap["เบิกจ่ายแล้ว"] || 0) + 1;
    } else if (st.includes("ตรวจรับแล้ว")) {
      statusMap["ตรวจรับแล้ว"] = (statusMap["ตรวจรับแล้ว"] || 0) + 1;
    } else if (st.includes("ส่งมอบแล้ว") || st.includes("ส่งมอบงาน")) {
      statusMap["ส่งมอบแล้ว"] = (statusMap["ส่งมอบแล้ว"] || 0) + 1;
    } else if (st.includes("รอส่งมอบ")) {
      statusMap["รอส่งมอบ"] = (statusMap["รอส่งมอบ"] || 0) + 1;
    } else if (st.includes("ดำเนินการ")) {
      statusMap["ดำเนินการ"] = (statusMap["ดำเนินการ"] || 0) + 1;
    } else if (st) {
      statusMap[st] = (statusMap[st] || 0) + 1;
    }
  });

  // 2. หาสขร.1 ล่าสุด
  // เรียงลำดับจากล่าสุด
  const sortedReports = [...reports].sort((a, b) => {
    const keyA = `${a.year || ""}-${a.month || ""}`;
    const keyB = `${b.year || ""}-${b.month || ""}`;
    return keyB.localeCompare(keyA);
  });
  const latestReport = sortedReports.length > 0 ? sortedReports[0] : null;

  let latestReportItemCount = 0;
  let latestReportTotalAmount = 0;

  if (latestReport) {
    const linkedItemIds = reportItems
      .filter(it => it.report_id === latestReport.id)
      .map(it => it.contract_id);
    
    latestReportItemCount = linkedItemIds.length;
    contracts.forEach(c => {
      if (linkedItemIds.includes(c.id)) {
        latestReportTotalAmount += parseMoney(c.contract_amount || c.agreed_price || c.budget);
      }
    });
  }

  // 3. Render HTML
  let html = `<div class="fade-up">`;

  // --- Grand Summary Cards ---
  html += `
    <div class="summary-grid">
      <!-- Grand Total -->
      <div class="card summary-card summary-card-grand">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
          <div>
            <div class="summary-label">วงเงินรวมทุกประเภทสัญญา</div>
            <div class="summary-val" style="font-size: 32px; color: #f8fafc;">
              ฿${formatMoney(grandTotal)}
            </div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 6px;">
              ทั้งหมด <b style="color: #38bdf8;">${contracts.length}</b> รายการ ในระบบ
            </div>
          </div>
          <div style="display: flex; gap: 24px; align-items: center; flex-wrap: wrap;">
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #e2e8f0;">${contractCount}</div>
              <div style="font-size: 11.5px; color: #94a3b8;">📜 สัญญา</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #e2e8f0;">${poCount}</div>
              <div style="font-size: 11.5px; color: #94a3b8;">🛒 ใบสั่งซื้อ/จ้าง</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #e2e8f0;">${agreementCount}</div>
              <div style="font-size: 11.5px; color: #94a3b8;">🤝 ข้อตกลง</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Contract Card -->
      <div class="card summary-card">
        <div class="icon-watermark">📜</div>
        <div class="summary-label">📜 ทะเบียนสัญญา</div>
        <div class="summary-val" style="color: #38bdf8;">${contractCount} <span style="font-size: 14px; font-weight: 400; color: #64748b;">รายการ</span></div>
        <div style="font-size: 12.5px; color: #94a3b8; margin-top: 8px;">วงเงินรวม ฿${formatMoney(contractTotal)}</div>
      </div>

      <!-- PO Card -->
      <div class="card summary-card">
        <div class="icon-watermark">🛒</div>
        <div class="summary-label">🛒 ใบสั่งซื้อ / ใบสั่งจ้าง / ใบสั่งเช่า</div>
        <div class="summary-val" style="color: #2dd4bf;">${poCount} <span style="font-size: 14px; font-weight: 400; color: #64748b;">รายการ</span></div>
        <div style="font-size: 12.5px; color: #94a3b8; margin-top: 8px;">วงเงินรวม ฿${formatMoney(poTotal)}</div>
      </div>

      <!-- Agreement Card -->
      <div class="card summary-card">
        <div class="icon-watermark">🤝</div>
        <div class="summary-label">🤝 ข้อตกลง</div>
        <div class="summary-val" style="color: #c084fc;">${agreementCount} <span style="font-size: 14px; font-weight: 400; color: #64748b;">รายการ</span></div>
        <div style="font-size: 12.5px; color: #94a3b8; margin-top: 8px;">วงเงินรวม ฿${formatMoney(agreementTotal)}</div>
      </div>
    </div>
  `;

  // --- Two Column: Status Breakdown + Latest SKR.1 ---
  html += `
    <div class="grid-2" style="margin-bottom: 24px;">
      <!-- Status Breakdown Card -->
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--border);">
          <h3 style="font-size: 15px; font-weight: 600; color: #f1f5f9;">📊 สถานะการดำเนินงาน</h3>
          <span style="font-size: 12px; color: #64748b;">รวม ${contracts.length} รายการ</span>
        </div>

        <div style="display: flex; align-items: center; gap: 24px; flex-wrap: wrap;">
          <!-- SVG Donut Chart -->
          <div class="donut-wrapper">
            ${renderDonutSvg(statusMap, contracts.length, 120)}
          </div>

          <!-- Status List -->
          <div style="flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 8px;">
            ${renderStatusListItems(statusMap)}
          </div>
        </div>
      </div>

      <!-- Latest SKR.1 Report Card -->
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--border);">
          <h3 style="font-size: 15px; font-weight: 600; color: #f1f5f9;">📥 รายงาน สขร.1 ล่าสุด</h3>
          ${latestReport ? getReportStatusBadge(latestReport.status) : `<span class="status-badge status-gray">ยังไม่มีรายงาน</span>`}
        </div>
  `;

  if (latestReport) {
    const thaiDate = latestReport.published_date ? isoToThaiDate(latestReport.published_date) : "ยังไม่ได้ระบุ";
    const pubUrl = latestReport.published_url || "";

    html += `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(148,163,184,0.06); padding-bottom: 8px;">
          <span style="font-size: 12.5px; color: #94a3b8;">เดือนที่จัดทำ:</span>
          <span style="font-size: 14px; font-weight: 600; color: #38bdf8;">${escapeHtml(latestReport.report_name || `สขร.1 ${latestReport.month}/${latestReport.year}`)}</span>
        </div>

        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(148,163,184,0.06); padding-bottom: 8px;">
          <span style="font-size: 12.5px; color: #94a3b8;">จำนวนรายการที่เลือก:</span>
          <span style="font-size: 13.5px; font-weight: 600; color: #f1f5f9;">${latestReportItemCount} รายการ</span>
        </div>

        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(148,163,184,0.06); padding-bottom: 8px;">
          <span style="font-size: 12.5px; color: #94a3b8;">ยอดรวมในรายงาน:</span>
          <span class="mono" style="font-size: 14px; font-weight: 600; color: #fbbf24;">฿${formatMoney(latestReportTotalAmount)}</span>
        </div>

        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(148,163,184,0.06); padding-bottom: 8px;">
          <span style="font-size: 12.5px; color: #94a3b8;">วันที่เผยแพร่:</span>
          <span style="font-size: 13px; color: #cbd5e1;">${escapeHtml(thaiDate)}</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
          <span style="font-size: 12.5px; color: #94a3b8;">ลิงก์ URL ที่เผยแพร่:</span>
          ${pubUrl ? `
            <div style="display: flex; gap: 10px; align-items: center;">
              <a href="${escapeHtml(pubUrl)}" target="_blank" rel="noopener noreferrer" style="font-size: 12.5px; color: #38bdf8; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                🔗 ${escapeHtml(pubUrl)}
              </a>
              <a href="${escapeHtml(pubUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-ghost" style="color: #38bdf8; border-color: rgba(56,189,248,0.3);">
                เปิดหน้าที่เผยแพร่ ↗
              </a>
            </div>
          ` : `
            <span style="font-size: 12px; color: #64748b;">(ยังไม่ได้บันทึกลิงก์ URL เผยแพร่)</span>
          `}
        </div>

        <div style="margin-top: 14px; display: flex; gap: 10px;">
          <button class="btn btn-sm btn-primary" onclick="window.openSkr1Report('${latestReport.year}', '${latestReport.month}')" style="flex: 1;">
            📥 เปิดจัดการ สขร.1 เดือนนี้
          </button>
        </div>
      </div>
    `;
  } else {
    html += `
      <div style="text-align: center; padding: 32px 16px; color: #64748b;">
        <div style="font-size: 36px; margin-bottom: 12px;">📁</div>
        <p style="font-size: 13.5px; color: #94a3b8; margin-bottom: 12px;">ยังไม่มีรายงาน สขร.1 ในระบบ</p>
        <button class="btn btn-sm btn-primary" onclick="showPage('skr1')">เริ่มจัดทำ สขร.1 ประจำเดือน</button>
      </div>
    `;
  }

  html += `
      </div>
    </div>
  `;

  // --- Recent 5 Contracts Table ---
  html += `
    <div class="card" style="padding: 0; overflow: hidden;">
      <div style="padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <h3 style="font-size: 15px; font-weight: 600; color: #f1f5f9;">📋 รายการจัดซื้อจัดจ้างล่าสุด</h3>
          <p style="font-size: 12px; color: #64748b; margin-top: 2px;">แสดงรายการล่าสุด 5 รายการ</p>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="showPage('register')">ดูทั้งหมด (${contracts.length}) &rarr;</button>
      </div>

      <div class="table-container" style="border: none; border-radius: 0;">
        <table>
          <thead>
            <tr>
              <th>ประเภท</th>
              <th>เลขที่เอกสาร</th>
              <th>วันที่</th>
              <th>คู่สัญญา / ผู้ขาย</th>
              <th>โครงการ / รายการ</th>
              <th style="text-align: right;">วงเงิน (บาท)</th>
              <th>สถานะ</th>
              <th style="text-align: center;">จัดการ</th>
            </tr>
          </thead>
          <tbody>
  `;

  const recentItems = contracts.slice(0, 5);
  if (recentItems.length === 0) {
    html += `<tr><td colspan="8" style="text-align:center; padding: 36px; color: #64748b;">ยังไม่มีรายการในระบบ กด "เพิ่มรายการ" เพื่อเริ่มต้น</td></tr>`;
  } else {
    recentItems.forEach(item => {
      const typeInfo = getTypeInfo(item.type);
      const amt = parseMoney(item.contract_amount || item.agreed_price || item.budget);
      html += `
        <tr class="clickable-row" onclick="window.viewContractDetail('${escapeHtml(item.id)}')">
          <td style="white-space: nowrap;"><span title="${escapeHtml(typeInfo.label)}">${typeInfo.icon} ${escapeHtml(typeInfo.label)}</span></td>
          <td style="font-weight: 600; color: #e2e8f0; white-space: nowrap;">${escapeHtml(item.document_no)}</td>
          <td style="color: #94a3b8; white-space: nowrap;">${escapeHtml(isoToThaiDate(item.document_date))}</td>
          <td style="color: #cbd5e1; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.vendor_name)}</td>
          <td style="color: #94a3b8; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.project_name)}</td>
          <td class="mono" style="text-align: right; color: #f1f5f9; white-space: nowrap;">฿${formatMoney(amt)}</td>
          <td>${getStatusBadge(item.status)}</td>
          <td style="text-align: center; white-space: nowrap;" onclick="event.stopPropagation()">
            <div class="action-btns">
              <button class="action-btn" onclick="window.viewContractDetail('${escapeHtml(item.id)}')">ดู</button>
              <button class="action-btn" onclick="window.editContract('${escapeHtml(item.id)}')">แก้ไข</button>
            </div>
          </td>
        </tr>
      `;
    });
  }

  html += `
          </tbody>
        </table>
      </div>
    </div>
  </div>`;

  container.innerHTML = html;
};

/**
 * SVG Donut Chart Generator
 */
function renderDonutSvg(statusMap, total, size) {
  if (!total) {
    return `<div style="width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:12px;">ไม่มีข้อมูล</div>`;
  }

  const entries = Object.entries(statusMap).filter(([, count]) => count > 0);
  let cumAngle = 0;
  const radius = 42;
  const cx = 55;
  const cy = 55;
  let paths = "";

  entries.forEach(([status, count]) => {
    const angle = (count / total) * 360;
    const startAngle = cumAngle;
    const endAngle = cumAngle + angle;
    cumAngle += angle;

    const cfg = CONFIG.STATUS_COLORS[status] || { dot: "#94a3b8" };
    const largeArc = angle > 180 ? 1 : 0;

    const rad1 = (startAngle - 90) * Math.PI / 180;
    const rad2 = (endAngle - 90) * Math.PI / 180;

    const x1 = cx + radius * Math.cos(rad1);
    const y1 = cy + radius * Math.sin(rad1);
    const x2 = cx + radius * Math.cos(rad2);
    const y2 = cy + radius * Math.sin(rad2);

    paths += `<path d="M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}" fill="none" stroke="${cfg.dot}" stroke-width="12" stroke-linecap="round"/>`;
  });

  return `
    <div style="position:relative; width:${size}px; height:${size}px;">
      <svg viewBox="0 0 110 110" width="${size}" height="${size}">
        ${paths}
      </svg>
      <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;">
        <span style="font-size:20px; font-weight:700; color:#f1f5f9; line-height:1;">${total}</span>
        <span style="font-size:10px; color:#64748b; margin-top:2px;">รายการ</span>
      </div>
    </div>
  `;
}

/**
 * รายการสถานะพร้อม Dot
 */
function renderStatusListItems(statusMap) {
  const activeEntries = Object.entries(statusMap).filter(([, count]) => count > 0);
  if (activeEntries.length === 0) {
    return `<div style="font-size: 12px; color: #64748b;">ไม่มีข้อมูลสถานะ</div>`;
  }

  return activeEntries.map(([status, count]) => {
    const cfg = CONFIG.STATUS_COLORS[status] || { dot: "#94a3b8" };
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:12.5px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="width:8px; height:8px; border-radius:50%; background:${cfg.dot};"></span>
          <span style="color:#cbd5e1;">${escapeHtml(status)}</span>
        </div>
        <span class="mono" style="font-weight:600; color:#f1f5f9;">${count}</span>
      </div>
    `;
  }).join("");
}
