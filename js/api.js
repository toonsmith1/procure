/**
 * ============================================================================
 * ทะเบียนคุมพัสดุ V2 — API Client (api.js)
 * ============================================================================
 * ติดต่อกับ Google Apps Script Web App ผ่าน REST-like GET / POST
 * มีระบบ Error Handling, Timeout, และ Fallback อัตโนมัติ
 * ============================================================================
 */

const api = (function() {

  /**
   * ส่งคำขอ GET ไปยัง Apps Script Web App
   */
  async function get(action, params = {}) {
    const url = new URL(CONFIG.API_URL);
    url.searchParams.set("action", action);
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.set(key, params[key]);
      }
    });

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { "Accept": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const res = await response.json();
      if (!res.success) {
        throw new Error(res.error || "เกิดข้อผิดพลาดในการดึงข้อมูล");
      }
      return res.data;
    } catch (err) {
      // ลองสำรองด้วย JSONP หาก fetch ติดปัญหา CORS
      console.warn("Fetch failed, attempting JSONP fallback...", err);
      return await getJsonp(action, params);
    }
  }

  /**
   * Fallback: ดึงข้อมูลผ่าน JSONP กรณี CORS บน Google Apps Script มีปัญหา
   */
  function getJsonp(action, params = {}) {
    return new Promise((resolve, reject) => {
      const callbackName = "_cb_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      const url = new URL(CONFIG.API_URL);
      url.searchParams.set("action", action);
      url.searchParams.set("callback", callbackName);
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          url.searchParams.set(key, params[key]);
        }
      });

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("หมดเวลาเชื่อมต่อ Apps Script (Timeout)"));
      }, 15000);

      function cleanup() {
        clearTimeout(timer);
        delete window[callbackName];
        const scriptEl = document.getElementById(callbackName);
        if (scriptEl) scriptEl.remove();
      }

      window[callbackName] = function(result) {
        cleanup();
        if (result && result.success) {
          resolve(result.data);
        } else {
          reject(new Error(result?.error || "ไม่สามารถดึงข้อมูลผ่าน JSONP ได้"));
        }
      };

      const script = document.createElement("script");
      script.id = callbackName;
      script.src = url.toString();
      script.onerror = function() {
        cleanup();
        reject(new Error("ไม่สามารถโหลดสคริปต์ Apps Script ได้ ตรวจสอบ URL หรือสิทธิ์"));
      };
      document.body.appendChild(script);
    });
  }

  /**
   * ส่งคำขอ POST ไปยัง Apps Script Web App
   */
  async function post(action, payload = {}) {
    try {
      const body = {
        action: action,
        data: payload
      };

      const response = await fetch(CONFIG.API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8" // ใช้ text/plain เพื่อหลีกเลี่ยง preflight CORS issues ใน Apps Script
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const res = await response.json();
      if (!res.success) {
        throw new Error(res.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }
      return res.data;
    } catch (err) {
      console.error("API POST error:", err);
      throw err;
    }
  }

  // ==========================================
  // Public Interface Methods
  // ==========================================

  return {
    /**
     * ดึงข้อมูลทั้งหมดในครั้งเดียว (เร็วและลดการเรียก API ซ้ำ)
     */
    async getAllData() {
      return await get("getAllData");
    },

    /**
     * ดึงรายการสัญญาทั้งหมด
     */
    async listContracts() {
      return await get("listContracts");
    },

    /**
     * ดึงข้อมูลสัญญาเดี่ยวตาม ID
     */
    async getContract(id) {
      return await get("getContract", { id });
    },

    /**
     * สร้างสัญญา / ใบสั่ง / ข้อตกลงใหม่
     */
    async createContract(contractData) {
      return await post("createContract", contractData);
    },

    /**
     * อัปเดตข้อมูลสัญญา
     */
    async updateContract(contractData) {
      return await post("updateContract", contractData);
    },

    /**
     * ลบสัญญาตาม ID
     */
    async deleteContract(id) {
      return await post("deleteContract", { id });
    },

    /**
     * ดึงรายการ สขร.1 ทั้งหมด
     */
    async listReports() {
      return await get("listReports");
    },

    /**
     * ดึงข้อมูล สขร.1 ตาม ID พร้อมรายการที่เลือกไว้
     */
    async getReport(id) {
      return await get("getReport", { id });
    },

    /**
     * สร้างหรือโหลดรายงาน สขร.1
     */
    async createReport(reportData) {
      return await post("createReport", reportData);
    },

    /**
     * อัปเดตข้อมูล สขร.1 (สถานะ, วันที่เผยแพร่, ลิงก์ URL)
     */
    async updateReport(reportData) {
      return await post("updateReport", reportData);
    },

    /**
     * บันทึกรายการเอกสารที่ถูกเลือกใน สขร.1
     */
    async saveReportItems(reportId, contractIds) {
      return await post("saveReportItems", { reportId, contractIds });
    }
  };

})();
