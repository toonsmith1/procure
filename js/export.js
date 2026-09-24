/**
 * ============================================================================
 * ทะเบียนคุมพัสดุ V2 — Excel Export & Summary Sheets (export.js)
 * ============================================================================
 * รองรับ:
 * 1. Export รายงาน สขร.1 (ExcelJS) ตรงตามรูปแบบมาตรฐานเดิม
 * 2. Export สาระสำคัญของสัญญา (1 Sheet ต่อ 1 สัญญา ในไฟล์เดียวกัน)
 * 3. หน้าจอเลือกรายการสาระสำคัญของสัญญา (renderSummary)
 * ============================================================================
 */

// Local state for Summary Sheets
let summarySelectedIds = new Set();
let summarySearchKeyword = "";
let summaryTypeFilter = "all";

// ============================================================================
// 1. EXPORT สขร.1 EXCEL
// ============================================================================

window.exportSkr1Excel = async function(report, selectedContracts, thaiMonthName, thaiYear) {
  if (!window.ExcelJS) {
    showToast("กำลังโหลดไลบรารี ExcelJS กรุณาลองใหม่อีกครั้ง", "warning");
    return;
  }

  showToast("⏳ กำลังสร้างไฟล์ Excel สขร.1...", "info", 2000);

  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = CONFIG.AGENCY_NAME;
    wb.created = new Date();

    const sheetTitle = `สขร.1 ${thaiMonthName} ${thaiYear}`.substring(0, 31);
    const ws = wb.addWorksheet(sheetTitle, {
      views: [{ showGridLines: true }]
    });

    const fontTH = { name: "TH Sarabun New", size: 16 };
    const fontTHBold = { name: "TH Sarabun New", size: 16, bold: true };
    const thinBorder = {
      top: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } }
    };
    const centerWrap = { horizontal: "center", vertical: "middle", wrapText: true };
    const leftWrap = { horizontal: "left", vertical: "top", wrapText: true };
    const rightMiddle = { horizontal: "right", vertical: "middle" };

    // กำหนดความกว้างคอลัมน์
    ws.columns = [
      { width: 6 },  // A: ลำดับ
      { width: 38 }, // B: งานจัดซื้อจัดจ้าง
      { width: 16 }, // C: วงเงินงบประมาณ
      { width: 16 }, // D: ราคากลาง
      { width: 14 }, // E: วิธีซื้อ/จ้าง
      { width: 12 }, // F: รายชื่อผู้เสนอราคา (merged F-H)
      { width: 14 }, // G
      { width: 12 }, // H
      { width: 12 }, // I: ผู้ได้รับการคัดเลือก (merged I-K)
      { width: 14 }, // J
      { width: 12 }, // K
      { width: 22 }, // L: เหตุผลที่คัดเลือกโดยสรุป
      { width: 28 }, // M: เลขที่และวันที่ของสัญญา
      { width: 20 }  // N: เลขที่โครงการ e-GP
    ];

    // Row 1: ชื่อรายงาน
    ws.mergeCells("A1:N1");
    const r1 = ws.getCell("A1");
    r1.value = `สรุปผลการดำเนินการจัดซื้อจัดจ้างในรอบเดือน ${thaiMonthName} ${thaiYear}`;
    r1.font = fontTHBold;
    r1.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 28;

    // Row 2: หน่วยงาน
    ws.mergeCells("A2:N2");
    const r2 = ws.getCell("A2");
    r2.value = `${CONFIG.PARENT_AGENCY} ${CONFIG.AGENCY_NAME}`;
    r2.font = fontTHBold;
    r2.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 26;

    // Row 3: Spacer
    ws.getRow(3).height = 10;

    // Row 4: Table Headers
    const headers = [
      "ลำดับ",
      "งานจัดซื้อจัดจ้าง",
      "วงเงินที่จะซื้อหรือจ้าง\n(บาท)",
      "ราคากลาง\n(บาท)",
      "วิธีซื้อ/จ้าง",
      "รายชื่อผู้เสนอราคาและราคาที่เสนอ", "", "",
      "ผู้ได้รับการคัดเลือกและราคาที่ตกลงซื้อหรือจ้าง", "", "",
      "เหตุผลที่คัดเลือกโดยสรุป",
      "เลขที่และวันที่ของสัญญาหรือข้อตกลงในการซื้อหรือจ้าง",
      "เลขที่โครงการ"
    ];

    const hRow = ws.getRow(4);
    headers.forEach((v, i) => {
      const cell = hRow.getCell(i + 1);
      cell.value = v;
      cell.font = fontTHBold;
      cell.alignment = centerWrap;
      cell.border = thinBorder;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" }
      };
    });

    // Merge multi-column headers
    ws.mergeCells("F4:H4");
    ws.mergeCells("I4:K4");
    hRow.height = 42;

    // Data Rows
    let curRowIdx = 5;
    selectedContracts.forEach((item, idx) => {
      const typeLabel = item.type === "contract" ? "สัญญา" : (item.type === "po" ? "ใบสั่งจ้าง/ซื้อ" : "ข้อตกลง");
      const dRow = ws.getRow(curRowIdx);

      // Col 1: ลำดับ
      dRow.getCell(1).value = idx + 1;
      dRow.getCell(1).alignment = { horizontal: "center", vertical: "top" };

      // Col 2: งานจัดซื้อจัดจ้าง
      dRow.getCell(2).value = item.project_name || "";
      dRow.getCell(2).alignment = leftWrap;

      // Col 3: วงเงินงบประมาณ
      const budgetVal = parseMoney(item.budget);
      dRow.getCell(3).value = budgetVal;
      dRow.getCell(3).numFmt = "#,##0.00";
      dRow.getCell(3).alignment = { horizontal: "right", vertical: "top" };

      // Col 4: ราคากลาง
      const medianVal = parseMoney(item.median_price);
      dRow.getCell(4).value = medianVal;
      dRow.getCell(4).numFmt = "#,##0.00";
      dRow.getCell(4).alignment = { horizontal: "right", vertical: "top" };

      // Col 5: วิธีซื้อ/จ้าง
      dRow.getCell(5).value = "เฉพาะเจาะจง";
      dRow.getCell(5).alignment = { horizontal: "center", vertical: "top" };

      // Col 6-8: รายชื่อผู้เสนอราคาและราคาที่เสนอ
      const offeredAmt = parseMoney(item.offered_price || item.contract_amount);
      const offeredText = `${item.vendor_name || ""}\nเสนอราคา ${formatMoney(offeredAmt)} บาท`;
      dRow.getCell(6).value = offeredText;
      dRow.getCell(6).alignment = leftWrap;
      ws.mergeCells(curRowIdx, 6, curRowIdx, 8);

      // Col 9-11: ผู้ได้รับการคัดเลือกและราคาที่ตกลง
      const agreedAmt = parseMoney(item.agreed_price || item.contract_amount);
      const agreedText = `${item.vendor_name || ""}\nราคาที่ตกลง ${formatMoney(agreedAmt)} บาท`;
      dRow.getCell(9).value = agreedText;
      dRow.getCell(9).alignment = leftWrap;
      ws.mergeCells(curRowIdx, 9, curRowIdx, 11);

      // Col 12: เหตุผลที่คัดเลือกโดยสรุป
      dRow.getCell(12).value = "เป็นผู้มีคุณสมบัติตรงตามเงื่อนไขที่กำหนด";
      dRow.getCell(12).alignment = leftWrap;

      // Col 13: เลขที่และวันที่
      const dateText = item.document_date ? isoToThaiDate(item.document_date) : "";
      dRow.getCell(13).value = `${typeLabel} เลขที่ ${item.document_no || ""}\nวันที่ ${dateText}`;
      dRow.getCell(13).alignment = leftWrap;

      // Col 14: เลขที่โครงการ e-GP
      dRow.getCell(14).value = item.egp_project_no || "";
      dRow.getCell(14).alignment = leftWrap;

      // จัดรูปแบบ Font และ Border ให้ครบทุก Cell
      for (let c = 1; c <= 14; c++) {
        const cell = dRow.getCell(c);
        cell.font = fontTH;
        cell.border = thinBorder;
      }

      dRow.height = 45;
      curRowIdx++;
    });

    // Write file & trigger download
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const filename = `สขร1_${thaiMonthName}_${thaiYear}.xlsx`.replace(/\s+/g, "_");

    downloadBlob(blob, filename);
    showToast(`ส่งออกไฟล์ ${filename} เรียบร้อยแล้ว`, "success");
  } catch (err) {
    console.error("Export Skr1 error:", err);
    showToast("เกิดข้อผิดพลาดในการสร้างไฟล์ Excel: " + err.message, "error");
  }
};

// ============================================================================
// 2. EXPORT สาระสำคัญของสัญญา (1 SHEET PER RECORD)
// ============================================================================

window.exportSummarySheets = async function(selectedContracts) {
  if (!window.ExcelJS) {
    showToast("ไลบรารี ExcelJS ไม่พร้อมใช้งาน", "error");
    return;
  }
  if (!selectedContracts || selectedContracts.length === 0) {
    showToast("กรุณาเลือกรายการที่ต้องการส่งออกอย่างน้อย 1 รายการ", "warning");
    return;
  }

  showToast(`⏳ กำลังสร้างไฟล์สาระสำคัญสัญญา (${selectedContracts.length} Sheet)...`, "info", 2500);

  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = CONFIG.AGENCY_NAME;
    wb.created = new Date();

    const fontTH = { name: "TH Sarabun New", size: 16 };
    const fontTHBold = { name: "TH Sarabun New", size: 16, bold: true };
    const fontTitle = { name: "TH Sarabun New", size: 18, bold: true };
    const thinBorder = {
      top: { style: "thin", color: { argb: "FF334155" } },
      bottom: { style: "thin", color: { argb: "FF334155" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } }
    };
    const leftWrap = { horizontal: "left", vertical: "middle", wrapText: true };
    const centerWrap = { horizontal: "center", vertical: "middle", wrapText: true };

    selectedContracts.forEach((item, index) => {
      const typeLabel = item.type === "contract" ? "สัญญา" : (item.type === "po" ? "ใบสั่งจ้าง" : "ข้อตกลง");

      // ตั้งชื่อ Sheet: ตัดอักขระที่ไม่รองรับ (/\?*[]:) และจำกัดความยาว 31 ตัวอักษร
      const rawName = `${index + 1}.${typeLabel} ${item.document_no || ""}`;
      const sheetName = rawName.replace(/[\/\\?\*\[\]:]/g, "-").slice(0, 31);
      const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: true }] });

      ws.columns = [
        { width: 6 },
        { width: 30 },
        { width: 22 },
        { width: 10 },
        { width: 10 },
        { width: 18 },
        { width: 10 },
        { width: 20 },
        { width: 10 },
        { width: 14 },
        { width: 14 },
        { width: 22 }
      ];

      const setCell = (row, col, val, isBold, isCenter) => {
        const c = ws.getCell(row, col);
        c.value = val;
        c.font = isBold ? (isBold === "title" ? fontTitle : fontTHBold) : fontTH;
        c.alignment = isCenter ? centerWrap : leftWrap;
      };

      const setBorder = (row, col) => {
        ws.getCell(row, col).border = thinBorder;
      };

      const setMoneyCell = (row, col, num) => {
        const c = ws.getCell(row, col);
        c.value = parseMoney(num);
        c.numFmt = "#,##0.00";
        c.font = fontTH;
        c.alignment = { horizontal: "right", vertical: "middle" };
      };

      // Header 1: ชื่อรายงาน
      ws.mergeCells("A1:L1");
      setCell(1, 1, "ข้อมูลสาระสำคัญในสัญญา", "title", true);
      ws.getRow(1).height = 36;

      // Header 2: หน่วยงาน
      ws.mergeCells("A2:L2");
      setCell(2, 1, `${CONFIG.AGENCY_NAME} ${CONFIG.PARENT_AGENCY}`, true, true);
      ws.getRow(2).height = 26;

      // ส่วนข้อมูลพื้นฐาน (แถว 4-8)
      let r = 4;
      const infoList = [
        [1, "หน่วยงาน", `${CONFIG.AGENCY_NAME} ${CONFIG.PARENT_AGENCY}`],
        [2, "เลขที่โครงการ (e-GP)", item.egp_project_no || ""],
        [3, "ชื่อโครงการ/รายการ", item.project_name || ""],
        [4, "งบประมาณที่ได้รับจัดสรร (บาท)", "BUDGET"],
        [5, "ราคากลาง (บาท)", "MEDIAN"]
      ];

      infoList.forEach(([no, label, val]) => {
        setCell(r, 1, no, true, true);
        setCell(r, 2, label, true);
        if (val === "BUDGET") {
          setMoneyCell(r, 3, item.budget);
          setCell(r, 5, "บาท");
        } else if (val === "MEDIAN") {
          setMoneyCell(r, 3, item.median_price);
          setCell(r, 5, "บาท");
        } else {
          setCell(r, 3, val);
        }
        ws.getRow(r).height = 24;
        r++;
      });

      r++; // spacer

      // ส่วนที่ 6: รายชื่อผู้เสนอราคา
      setCell(r, 1, 6, true, true);
      setCell(r, 2, "รายชื่อผู้เสนอราคา มีดังนี้", true);
      ws.getRow(r).height = 24;
      r++;

      // Sub-header ส่วนที่ 6
      const subHdr6 = [
        "ลำดับ", "รายการพิจารณา", "", "", "เลขประจำตัว\nผู้เสียภาษีฯ", "",
        "รายชื่อผู้เสนอราคา", "", "", "", "ราคาที่เสนอ\n(บาท)", ""
      ];
      subHdr6.forEach((v, i) => {
        if (v) setCell(r, i + 1, v, true, true);
        setBorder(r, i + 1);
      });
      ws.mergeCells(r, 2, r, 4);
      ws.mergeCells(r, 5, r, 6);
      ws.mergeCells(r, 7, r, 10);
      ws.getRow(r).height = 36;
      r++;

      // ข้อมูลผู้เสนอราคา
      setCell(r, 1, 1, false, true);
      ws.mergeCells(r, 2, r, 4);
      setCell(r, 2, item.project_name || "");
      ws.mergeCells(r, 5, r, 6);
      setCell(r, 5, item.tax_id || "");
      ws.mergeCells(r, 7, r, 10);
      setCell(r, 7, item.vendor_name || "");
      setMoneyCell(r, 11, item.offered_price || item.contract_amount);
      for (let c = 1; c <= 12; c++) setBorder(r, c);
      ws.getRow(r).height = 28;
      r += 3;

      // ส่วนที่ 7: ผู้ที่ได้รับการคัดเลือก
      setCell(r, 1, 7, true, true);
      setCell(r, 2, "ผู้ที่ได้รับการคัดเลือก ได้แก่", true);
      ws.getRow(r).height = 24;
      r++;

      // Sub-header ส่วนที่ 7
      const subHdr7 = [
        "ลำดับ", "เลขประจำตัวผู้เสียภาษีฯ", "ชื่อผู้ขาย/คู่สัญญา", "", "", "",
        "เลขคุมสัญญาในระบบe-GP", `${typeLabel} เลขที่`, "วันที่ทำสัญญา",
        "จำนวนเงิน\n(บาท)", "สถานะสัญญา", "เหตุผลที่คัดเลือก"
      ];
      subHdr7.forEach((v, i) => {
        if (v) setCell(r, i + 1, v, true, true);
        setBorder(r, i + 1);
      });
      ws.mergeCells(r, 3, r, 6);
      ws.getRow(r).height = 36;
      r++;

      // ข้อมูลผู้ชนะ
      setCell(r, 1, 1, false, true);
      setCell(r, 2, item.tax_id || "");
      ws.mergeCells(r, 3, r, 6);
      setCell(r, 3, item.vendor_name || "");
      setCell(r, 7, item.control_no || "");
      setCell(r, 8, item.document_no || "");
      setCell(r, 9, item.document_date ? isoToThaiDate(item.document_date) : "");
      setMoneyCell(r, 10, item.contract_amount || item.agreed_price);
      setCell(r, 11, item.status || "");
      setCell(r, 12, "เป็นผู้มีคุณสมบัติตรงตามเงื่อนไขที่กำหนด");
      for (let c = 1; c <= 12; c++) setBorder(r, c);
      ws.getRow(r).height = 28;
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const todayThai = new Date().toLocaleDateString("th-TH").replace(/\//g, "-");
    const filename = `สาระสำคัญสัญญา_${todayThai}.xlsx`;

    downloadBlob(blob, filename);
    showToast(`ส่งออกสาระสำคัญสัญญา ${selectedContracts.length} Sheet สำเร็จ!`, "success");
  } catch (err) {
    console.error("Export summary sheets error:", err);
    showToast("เกิดข้อผิดพลาดในการสร้างไฟล์ Excel: " + err.message, "error");
  }
};

// ============================================================================
// 3. SUMMARY PAGE (สาระสำคัญของสัญญา) RENDERER
// ============================================================================

window.renderSummary = function() {
  const container = document.getElementById("page-summary");
  if (!container) return;

  const contracts = appState.contracts || [];

  // Filter items
  const filtered = contracts.filter(item => {
    if (summaryTypeFilter !== "all" && item.type !== summaryTypeFilter) return false;
    if (summarySearchKeyword) {
      const kw = summarySearchKeyword.toLowerCase();
      const mDoc = (item.document_no || "").toLowerCase().includes(kw);
      const mProj = (item.project_name || "").toLowerCase().includes(kw);
      const mVen = (item.vendor_name || "").toLowerCase().includes(kw);
      if (!mDoc && !mProj && !mVen) return false;
    }
    return true;
  });

  // Calculate selected total
  let selectedTotalAmt = 0;
  summarySelectedIds.forEach(id => {
    const c = contracts.find(it => it.id === id);
    if (c) selectedTotalAmt += parseMoney(c.contract_amount || c.agreed_price || c.budget);
  });

  container.innerHTML = `
    <div class="fade-up">
      <!-- Header -->
      <div style="margin-bottom: 20px;">
        <h2 style="font-size: 18px; font-weight: 700; color: #f1f5f9;">📄 เอกสารสาระสำคัญของสัญญา</h2>
        <p style="font-size: 12.5px; color: #94a3b8; margin-top: 2px;">
          เลือกรายการสัญญา / ใบสั่ง / ข้อตกลง ที่ต้องการ — ระบบจะสร้าง <b style="color: #38bdf8;">1 Sheet ต่อ 1 รายการ</b> รวมไว้ในไฟล์ Excel เดียวกัน
        </p>
      </div>

      <!-- Action & Summary Bar -->
      <div class="card" style="margin-bottom: 20px; padding: 16px 20px; background: rgba(99, 102, 241, 0.05); border-color: rgba(99, 102, 241, 0.2);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
          <div>
            <div style="font-size: 14px; font-weight: 600; color: #f1f5f9;">
              ✅ เลือกแล้ว <b style="color: #38bdf8; font-size: 16px;">${summarySelectedIds.size}</b> รายการ (จะได้ <b style="color: #a78bfa;">${summarySelectedIds.size} Sheet</b>)
            </div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 2px;">
              วงเงินรวม: <b class="mono" style="color: #fbbf24;">฿${formatMoney(selectedTotalAmt)}</b>
            </div>
          </div>

          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="downloadSelectedSummarySheets()" ${summarySelectedIds.size === 0 ? "disabled" : ""}>
              📄 ดาวน์โหลด Excel (แยก Sheet)
            </button>
            <button class="btn btn-ghost" onclick="summarySelectedIds.clear(); window.renderSummary()">
              🗑️ ล้างการเลือก
            </button>
          </div>
        </div>
      </div>

      <!-- Table Selection Card -->
      <div class="card" style="padding: 0; overflow: hidden;">
        <div style="padding: 14px 18px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <span style="font-size: 14px; font-weight: 600; color: #f1f5f9;">รายการเอกสารในระบบ</span>
            <input type="text" class="inp" style="width: 220px; padding: 6px 10px; font-size: 12.5px;" placeholder="ค้นหา..." value="${escapeHtml(summarySearchKeyword)}" oninput="summarySearchKeyword=this.value.trim(); window.renderSummary()">
            <select class="inp" style="width: 140px; padding: 6px 10px; font-size: 12.5px;" onchange="summaryTypeFilter=this.value; window.renderSummary()">
              <option value="all" ${summaryTypeFilter === "all" ? "selected" : ""}>ทุกประเภท</option>
              <option value="contract" ${summaryTypeFilter === "contract" ? "selected" : ""}>สัญญา</option>
              <option value="po" ${summaryTypeFilter === "po" ? "selected" : ""}>ใบสั่งซื้อ/จ้าง</option>
              <option value="agreement" ${summaryTypeFilter === "agreement" ? "selected" : ""}>ข้อตกลง</option>
            </select>
          </div>

          <div>
            <label style="font-size: 12.5px; color: #38bdf8; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <input type="checkbox" class="chk" onchange="toggleAllSummaryItems(this.checked)">
              เลือกทั้งหมดที่แสดง
            </label>
          </div>
        </div>

        <div class="table-container" style="border: none; border-radius: 0;">
          <table>
            <thead>
              <tr>
                <th style="width: 44px; text-align: center;">เลือก</th>
                <th style="width: 110px;">ประเภท</th>
                <th>เลขที่เอกสาร</th>
                <th>วันที่</th>
                <th>คู่สัญญา / ผู้ขาย</th>
                <th>รายการ / โครงการ</th>
                <th style="text-align: right;">วงเงิน (บาท)</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr><td colspan="8" style="text-align: center; padding: 36px; color: #64748b;">ไม่พบรายการที่ตรงกับเงื่อนไข</td></tr>
              ` : filtered.map(item => {
                const isChecked = summarySelectedIds.has(item.id);
                const typeInfo = getTypeInfo(item.type);
                const amt = parseMoney(item.contract_amount || item.agreed_price || item.budget);
                return `
                  <tr style="${isChecked ? 'background: rgba(99, 102, 241, 0.05);' : ''}">
                    <td style="text-align: center;">
                      <input type="checkbox" class="chk" ${isChecked ? "checked" : ""} onchange="toggleSummaryItem('${escapeHtml(item.id)}', this.checked)">
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

function toggleSummaryItem(id, checked) {
  if (checked) {
    summarySelectedIds.add(id);
  } else {
    summarySelectedIds.delete(id);
  }
  window.renderSummary();
}

function toggleAllSummaryItems(checked) {
  const contracts = appState.contracts || [];
  contracts.forEach(item => {
    if (summaryTypeFilter !== "all" && item.type !== summaryTypeFilter) return;
    if (checked) {
      summarySelectedIds.add(item.id);
    } else {
      summarySelectedIds.delete(item.id);
    }
  });
  window.renderSummary();
}

function downloadSelectedSummarySheets() {
  const contracts = appState.contracts || [];
  const selectedList = contracts.filter(c => summarySelectedIds.has(c.id));
  window.exportSummarySheets(selectedList);
}

/**
 * Helper: Download Blob as File
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
