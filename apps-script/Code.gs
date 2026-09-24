/**
 * ============================================================================
 * ทะเบียนคุมพัสดุ V2 — Google Apps Script Backend (Code.gs)
 * ============================================================================
 * รองรับ:
 * - ทะเบียนสัญญา, ใบสั่งซื้อ/จ้าง/เช่า, ข้อตกลง (Contracts)
 * - รายงาน สขร.1 รายเดือน (MonthlyReports)
 * - รายการที่เลือกใน สขร.1 (MonthlyReportItems)
 * - API GET / POST พร้อมระบบค้นหา ID ที่แท้จริง (ไม่พึ่ง row number)
 * - ฟังก์ชัน setupDatabase() สำหรับสร้าง Sheet และ Header ครั้งแรก
 * ============================================================================
 */

// ใส่ Spreadsheet ID ของท่านที่นี่ (หรือถ้าใช้ Bound Script ให้ปล่อยว่างไว้)
var SPREADSHEET_ID = "";

/**
 * ดึง Spreadsheet Object
 */
function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "" && SPREADSHEET_ID !== "YOUR_SPREADSHEET_ID") {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * นิยาม Schema และ Headers ของแต่ละ Sheet
 */
var SCHEMA = {
  Contracts: [
    "id",
    "type",
    "document_no",
    "egp_project_no",
    "control_no",
    "gfmis_po",
    "document_date",
    "vendor_name",
    "tax_id",
    "project_name",
    "budget",
    "median_price",
    "offered_price",
    "agreed_price",
    "contract_amount",
    "start_date",
    "end_date",
    "guarantee_type",
    "guarantee_amount",
    "status",
    "note",
    "created_at",
    "updated_at"
  ],
  MonthlyReports: [
    "id",
    "year",
    "month",
    "report_name",
    "published_date",
    "published_url",
    "status",
    "note",
    "created_at",
    "updated_at"
  ],
  MonthlyReportItems: [
    "id",
    "report_id",
    "contract_id",
    "created_at"
  ]
};

/**
 * ฟังก์ชันสำหรับ Setup Database ครั้งแรก
 * ตรวจสอบและสร้าง Sheet ที่ยังไม่มี พร้อมทั้งใส่ Header
 * ถ้ามีอยู่แล้วจะไม่ลบข้อมูลเดิม
 */
function setupDatabase() {
  var ss = getSpreadsheet();
  var sheetNames = Object.keys(SCHEMA);
  
  sheetNames.forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    var headers = SCHEMA[sheetName];
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers);
      
      // จัดรูปแบบแถว Header
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#0f172a");
      headerRange.setFontColor("#f1f5f9");
      sheet.setFrozenRows(1);
    } else {
      // หากมี Sheet แล้วแต่แถวแรกว่าง ให้ใส่ Header
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(headers);
        var hr = sheet.getRange(1, 1, 1, headers.length);
        hr.setFontWeight("bold");
        hr.setBackground("#0f172a");
        hr.setFontColor("#f1f5f9");
        sheet.setFrozenRows(1);
      }
    }
  });

  // ลบ Sheet1 เริ่มต้น หากมี Sheet อื่นแล้ว
  var defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("แผ่นงาน1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  return "Setup completed successfully!";
}

/**
 * ส่ง Response เป็น JSON หรือ JSONP
 */
function respondJson(data, callback) {
  var output = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + output + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Helper แปลงแถวข้อมูลเป็น Object ตาม Headers
 */
function rowsToObjects(sheet, headers) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];
  
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var result = [];
  
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      var val = row[c];
      if (val instanceof Date) {
        // จัดเก็บและแปลง Date เป็น YYYY-MM-DD
        var y = val.getFullYear();
        var m = ("0" + (val.getMonth() + 1)).slice(-2);
        var d = ("0" + val.getDate()).slice(-2);
        obj[headers[c]] = y + "-" + m + "-" + d;
      } else {
        obj[headers[c]] = (val !== null && val !== undefined) ? String(val) : "";
      }
    }
    result.push(obj);
  }
  return result;
}

/**
 * GET Handler
 */
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var action = params.action || "getAllData";
  var callback = params.callback || null;
  
  try {
    var ss = getSpreadsheet();
    
    if (action === "listContracts") {
      var cSheet = ss.getSheetByName("Contracts");
      var contracts = cSheet ? rowsToObjects(cSheet, SCHEMA.Contracts) : [];
      return respondJson({ success: true, data: contracts, error: null }, callback);
    }
    
    if (action === "getContract") {
      var cId = params.id;
      if (!cId) return respondJson({ success: false, data: null, error: "ระบุ contract id" }, callback);
      var cSheet2 = ss.getSheetByName("Contracts");
      var all = cSheet2 ? rowsToObjects(cSheet2, SCHEMA.Contracts) : [];
      var found = all.find(function(c) { return c.id === cId; });
      return respondJson({ success: !!found, data: found || null, error: found ? null : "ไม่พบสัญญา" }, callback);
    }
    
    if (action === "listReports") {
      var rSheet = ss.getSheetByName("MonthlyReports");
      var reports = rSheet ? rowsToObjects(rSheet, SCHEMA.MonthlyReports) : [];
      return respondJson({ success: true, data: reports, error: null }, callback);
    }
    
    if (action === "getReport") {
      var rId = params.id;
      if (!rId) return respondJson({ success: false, data: null, error: "ระบุ report id" }, callback);
      var rSheet2 = ss.getSheetByName("MonthlyReports");
      var allReports = rSheet2 ? rowsToObjects(rSheet2, SCHEMA.MonthlyReports) : [];
      var report = allReports.find(function(r) { return r.id === rId; });
      
      var mriSheet = ss.getSheetByName("MonthlyReportItems");
      var items = mriSheet ? rowsToObjects(mriSheet, SCHEMA.MonthlyReportItems) : [];
      var selectedIds = items.filter(function(it) { return it.report_id === rId; })
                             .map(function(it) { return it.contract_id; });
      
      return respondJson({
        success: true,
        data: { report: report || null, contractIds: selectedIds },
        error: null
      }, callback);
    }
    
    if (action === "getReportItems") {
      var repId = params.reportId;
      var itemSheet = ss.getSheetByName("MonthlyReportItems");
      var allItems = itemSheet ? rowsToObjects(itemSheet, SCHEMA.MonthlyReportItems) : [];
      var filtered = allItems.filter(function(it) { return it.report_id === repId; });
      return respondJson({ success: true, data: filtered, error: null }, callback);
    }
    
    if (action === "getAllData") {
      var sContracts = ss.getSheetByName("Contracts");
      var sReports = ss.getSheetByName("MonthlyReports");
      var sItems = ss.getSheetByName("MonthlyReportItems");
      
      return respondJson({
        success: true,
        data: {
          contracts: sContracts ? rowsToObjects(sContracts, SCHEMA.Contracts) : [],
          reports: sReports ? rowsToObjects(sReports, SCHEMA.MonthlyReports) : [],
          reportItems: sItems ? rowsToObjects(sItems, SCHEMA.MonthlyReportItems) : []
        },
        error: null
      }, callback);
    }
    
    return respondJson({ success: false, data: null, error: "ไม่พบ action: " + action }, callback);
  } catch (err) {
    return respondJson({ success: false, data: null, error: err.toString() }, callback);
  }
}

/**
 * Helper สร้าง ID ที่ไม่ซ้ำ
 */
function generateId(prefix) {
  var rand = Math.random().toString(36).substring(2, 10);
  var ts = Date.now().toString(36);
  return prefix + "-" + ts + "-" + rand;
}

/**
 * POST Handler
 */
function doPost(e) {
  try {
    var raw = e.postData ? e.postData.contents : "";
    var body = {};
    if (raw) {
      body = JSON.parse(raw);
    }
    var action = body.action;
    var ss = getSpreadsheet();
    var nowIso = new Date().toISOString();
    
    // -------------------------------------------------------------
    // 1. CREATE CONTRACT
    // -------------------------------------------------------------
    if (action === "createContract") {
      var payload = body.data || {};
      var sheet = ss.getSheetByName("Contracts");
      if (!sheet) {
        setupDatabase();
        sheet = ss.getSheetByName("Contracts");
      }
      
      var type = payload.type || "contract";
      var yearStr = new Date().getFullYear();
      var prefix = type === "contract" ? "CTR" : (type === "po" ? "PO" : "AGR");
      var newId = generateId(prefix + "-" + yearStr);
      
      payload.id = newId;
      payload.created_at = nowIso;
      payload.updated_at = nowIso;
      
      var row = SCHEMA.Contracts.map(function(col) {
        return payload[col] !== undefined ? payload[col] : "";
      });
      
      sheet.appendRow(row);
      return respondJson({ success: true, data: payload, error: null });
    }
    
    // -------------------------------------------------------------
    // 2. UPDATE CONTRACT
    // -------------------------------------------------------------
    if (action === "updateContract") {
      var updatePayload = body.data || {};
      var targetId = updatePayload.id;
      if (!targetId) return respondJson({ success: false, data: null, error: "Missing contract id" });
      
      var sheet2 = ss.getSheetByName("Contracts");
      var data = sheet2.getDataRange().getValues();
      var targetRowIndex = -1;
      
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(targetId)) {
          targetRowIndex = i + 1; // 1-indexed
          break;
        }
      }
      
      if (targetRowIndex === -1) {
        return respondJson({ success: false, data: null, error: "ไม่พบสัญญา id: " + targetId });
      }
      
      updatePayload.updated_at = nowIso;
      var updatedRow = SCHEMA.Contracts.map(function(col, idx) {
        if (updatePayload[col] !== undefined) {
          return updatePayload[col];
        }
        return data[targetRowIndex - 1][idx];
      });
      
      sheet2.getRange(targetRowIndex, 1, 1, SCHEMA.Contracts.length).setValues([updatedRow]);
      return respondJson({ success: true, data: updatePayload, error: null });
    }
    
    // -------------------------------------------------------------
    // 3. DELETE CONTRACT
    // -------------------------------------------------------------
    if (action === "deleteContract") {
      var delId = body.id || (body.data && body.data.id);
      if (!delId) return respondJson({ success: false, data: null, error: "Missing contract id to delete" });
      
      var sheet3 = ss.getSheetByName("Contracts");
      var data3 = sheet3.getDataRange().getValues();
      var delRowIndex = -1;
      
      for (var j = 1; j < data3.length; j++) {
        if (String(data3[j][0]) === String(delId)) {
          delRowIndex = j + 1;
          break;
        }
      }
      
      if (delRowIndex !== -1) {
        sheet3.deleteRow(delRowIndex);
        
        // ลบความสัมพันธ์ใน MonthlyReportItems ด้วย
        var mriSheet = ss.getSheetByName("MonthlyReportItems");
        if (mriSheet && mriSheet.getLastRow() > 1) {
          var mriData = mriSheet.getDataRange().getValues();
          for (var k = mriData.length - 1; k >= 1; k--) {
            if (String(mriData[k][2]) === String(delId)) {
              mriSheet.deleteRow(k + 1);
            }
          }
        }
        return respondJson({ success: true, data: { id: delId }, error: null });
      }
      return respondJson({ success: false, data: null, error: "ไม่พบรายการที่ต้องการลบ" });
    }
    
    // -------------------------------------------------------------
    // 4. CREATE OR GET MONTHLY REPORT
    // -------------------------------------------------------------
    if (action === "createReport") {
      var repData = body.data || {};
      var rSheet = ss.getSheetByName("MonthlyReports");
      if (!rSheet) {
        setupDatabase();
        rSheet = ss.getSheetByName("MonthlyReports");
      }
      
      var reportId = repData.id || ("skr1-" + repData.year + "-" + repData.month);
      var rValues = rSheet.getDataRange().getValues();
      var foundRow = -1;
      
      for (var rIdx = 1; rIdx < rValues.length; rIdx++) {
        if (String(rValues[rIdx][0]) === String(reportId)) {
          foundRow = rIdx + 1;
          break;
        }
      }
      
      if (foundRow !== -1) {
        // คืนค่ารายงานที่มีอยู่แล้ว
        var existing = {};
        for (var c = 0; c < SCHEMA.MonthlyReports.length; c++) {
          existing[SCHEMA.MonthlyReports[c]] = rValues[foundRow - 1][c];
        }
        return respondJson({ success: true, data: existing, error: null });
      }
      
      // สร้างรายงานใหม่
      repData.id = reportId;
      repData.status = repData.status || "draft";
      repData.created_at = nowIso;
      repData.updated_at = nowIso;
      
      var newRepRow = SCHEMA.MonthlyReports.map(function(col) {
        return repData[col] !== undefined ? repData[col] : "";
      });
      rSheet.appendRow(newRepRow);
      return respondJson({ success: true, data: repData, error: null });
    }
    
    // -------------------------------------------------------------
    // 5. UPDATE MONTHLY REPORT (Publication status / URL / Date)
    // -------------------------------------------------------------
    if (action === "updateReport") {
      var uRep = body.data || {};
      var repIdToUpdate = uRep.id;
      if (!repIdToUpdate) return respondJson({ success: false, data: null, error: "Missing report id" });
      
      var rSheet2 = ss.getSheetByName("MonthlyReports");
      var rVals2 = rSheet2.getDataRange().getValues();
      var targetRIndex = -1;
      
      for (var ri = 1; ri < rVals2.length; ri++) {
        if (String(rVals2[ri][0]) === String(repIdToUpdate)) {
          targetRIndex = ri + 1;
          break;
        }
      }
      
      if (targetRIndex === -1) {
        // หากยังไม่มีให้สร้างใหม่
        uRep.created_at = nowIso;
        uRep.updated_at = nowIso;
        var newRow = SCHEMA.MonthlyReports.map(function(col) {
          return uRep[col] !== undefined ? uRep[col] : "";
        });
        rSheet2.appendRow(newRow);
        return respondJson({ success: true, data: uRep, error: null });
      }
      
      uRep.updated_at = nowIso;
      var updatedRepRow = SCHEMA.MonthlyReports.map(function(col, idx) {
        if (uRep[col] !== undefined) {
          return uRep[col];
        }
        return rVals2[targetRIndex - 1][idx];
      });
      
      rSheet2.getRange(targetRIndex, 1, 1, SCHEMA.MonthlyReports.length).setValues([updatedRepRow]);
      return respondJson({ success: true, data: uRep, error: null });
    }
    
    // -------------------------------------------------------------
    // 6. SAVE REPORT ITEMS (Selection for สขร.1)
    // -------------------------------------------------------------
    if (action === "saveReportItems") {
      var itemData = body.data || {};
      var rptId = itemData.reportId;
      var contractIds = itemData.contractIds || []; // array of contract ids
      
      if (!rptId) return respondJson({ success: false, data: null, error: "Missing reportId" });
      
      var itemsSheet = ss.getSheetByName("MonthlyReportItems");
      if (!itemsSheet) {
        setupDatabase();
        itemsSheet = ss.getSheetByName("MonthlyReportItems");
      }
      
      // ลบรายการเดิมของ reportId นี้ออกทั้งหมด
      var curData = itemsSheet.getDataRange().getValues();
      for (var rowI = curData.length - 1; rowI >= 1; rowI--) {
        if (String(curData[rowI][1]) === String(rptId)) {
          itemsSheet.deleteRow(rowI + 1);
        }
      }
      
      // เพิ่มรายการใหม่
      if (contractIds.length > 0) {
        var newRows = contractIds.map(function(cId) {
          return [
            generateId("MRI"),
            rptId,
            cId,
            nowIso
          ];
        });
        
        itemsSheet.getRange(itemsSheet.getLastRow() + 1, 1, newRows.length, 4).setValues(newRows);
      }
      
      return respondJson({
        success: true,
        data: { reportId: rptId, count: contractIds.length, contractIds: contractIds },
        error: null
      });
    }
    
    return respondJson({ success: false, data: null, error: "Unknown POST action: " + action });
  } catch (err) {
    return respondJson({ success: false, data: null, error: err.toString() });
  }
}
