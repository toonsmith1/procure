# ระบบทะเบียนคุมพัสดุ V2 (Procurement Register V2)

ระบบเว็บแอปพลิเคชันสำหรับงานทะเบียนจัดซื้อจัดจ้างภายในหน่วยงาน พัฒนาขึ้นใหม่ทั้งหมดโดยแยกส่วนชัดเจน บำรุงรักษาง่าย โฮสต์บน **GitHub Pages** ได้โดยตรง ไม่ต้องมี Server หรือ Database ที่มีค่าใช้จ่าย โดยใช้ **Google Apps Script** เป็น Backend API และ **Google Sheets** เป็นฐานข้อมูล

---

## 🚀 ฟังก์ชันหลักของระบบ

1. **ทะเบียนรวมสัญญา / ใบสั่ง / ข้อตกลง**:
   - รองรับสัญญา (Contract), ใบสั่งซื้อ/จ้าง/เช่า (PO), และข้อตกลง (Agreement)
   - ฟอร์มกรอกและแก้ไขรายการเดียวที่ปรับเปลี่ยนฟิลด์ตามประเภทเอกสารโดยอัตโนมัติ
   - ตารางค้นหาข้อมูล คัดกรองตามประเภทเอกสาร, ปี พ.ศ., และสถานะการดำเนินงาน
   - หน้าต่างดูรายละเอียดข้อมูลครบทุกฟิลด์ (View Detail Modal) พร้อมระบบยืนยันก่อนลบ (Confirm Delete)
2. **รายงาน สขร.1 รายเดือน (Monthly Report Entity)**:
   - สขร.1 เป็น Entity ของระบบ ไม่ใช่แค่ปุ่ม Export
   - เลือกปี พ.ศ. และเดือน เพื่อสร้างหรือโหลดรายงาน
   - เลือกรายการจัดซื้อจัดจ้างที่ต้องการบรรจุในรายงาน (บันทึก Selection เดิมไว้ ไม่สูญหายเมื่อเปิดซ้ำ)
   - บันทึก **วันที่เผยแพร่** และ **ลิงก์ URL ที่เผยแพร่** ลง Google Sheets ทันที
   - กำหนดสถานะรายงาน: ร่าง (Draft) / พร้อมเผยแพร่ (Ready) / เผยแพร่แล้ว (Published)
3. **ส่งออกเอกสาร Excel (ExcelJS)**:
   - **รายงาน สขร.1**: จัดรูปแบบตารางภาษาไทย (TH Sarabun New), วงเงิน, ผู้เสนอราคา, ผู้ชนะ, เลขที่และวันที่ของสัญญา, ตีเส้น Border และ Wrap Text ตามมาตรฐานราชการ
   - **สาระสำคัญของสัญญา**: ส่งออกรายการที่เลือกเป็น **1 Sheet ต่อ 1 สัญญา** รวมอยู่ในไฟล์ Excel เดียวกัน
4. **Dashboard ภาพรวม**:
   - การ์ดสรุปยอดเงินรวม, จำนวนรายการรวม, แยกตามประเภทสัญญา
   - กราฟวงกลม (Donut Chart) และแถบแจกแจงสถานะการดำเนินงาน
   - การ์ดแสดงสถานะรายงาน สขร.1 ล่าสุด พร้อมปุ่มเปิดดูหน้าที่เผยแพร่บนเว็บไซต์จริง
5. **ความปลอดภัยและมาตรฐาน**:
   - ทำงานแบบ Static Web 100% ไม่ต้องติดตั้ง Node.js หรือ Python
   - ป้องกัน XSS Injection ด้วยการ Escape User Input ทุกจุดก่อนแสดงผล
   - จัดรูปแบบตัวเลขเงินด้วย `Intl.NumberFormat('th-TH')`
   - รองรับการทำงานทั้งบน Desktop และอุปกรณ์เคลื่อนที่ (Responsive Design)

---

## 📁 โครงสร้างโปรเจกต์ (Repository Structure)

```text
c:\eoffice/
│
├── index.html              # หน้าเว็บหลักและ Container ของหน้าต่างๆ
│
├── css/
│   └── app.css             # สไตล์และธีม Dark Professional ราชการ
│
├── js/
│   ├── config.js           # ตั้งค่าระบบและ Web App URL
│   ├── api.js              # โมดูลเชื่อมต่อ Google Apps Script Web App
│   ├── app.js              # State ส่วนกลาง, Toast, Modal, Helper Formats
│   ├── dashboard.js        # แดชบอร์ดสรุปยอดและ Donut Chart
│   ├── register.js         # ตารางทะเบียนรวม และ Form เพิ่ม/แก้ไขข้อมูล
│   ├── skr1.js             # การจัดการรายงาน สขร.1 รายเดือน และ Selection
│   └── export.js           # สร้างไฟล์ Excel (สขร.1 & สาระสำคัญแยก Sheet)
│
├── apps-script/
│   └── Code.gs             # Backend API และ ฟังก์ชัน setupDatabase() บน Google Sheets
│
├── README.md               # คู่มือการติดตั้งและใช้งานระบบ
└── .gitignore              # ไฟล์ยกเว้นสำหรับ Git
```

---

## 🗄️ โครงสร้างฐานข้อมูล (Google Sheets Schema)

ระบบจะสร้าง 3 Sheet ให้อัตโนมัติเมื่อเรียกฟังก์ชัน `setupDatabase()`:

### 1. Sheet: `Contracts`
เก็บรายการสัญญา, ใบสั่งซื้อ/จ้าง, และข้อตกลงทั้งหมดไว้ใน Sheet เดียว
* `id` : Permanent ID เช่น `CTR-2026-xxxx`, `PO-2026-xxxx`, `AGR-2026-xxxx`
* `type` : `contract`, `po`, `agreement`
* `document_no` : เลขที่เอกสาร
* `egp_project_no` : เลขที่โครงการ e-GP
* `control_no` : เลขคุมสัญญา / เลขคุมใบสั่ง
* `gfmis_po` : เลขที่ PO (GFMIS)
* `document_date` : วันที่เอกสาร (จัดเก็บแบบ ISO: YYYY-MM-DD)
* `vendor_name` : คู่สัญญา / ผู้ขาย
* `tax_id` : เลขประจำตัวผู้เสียภาษี (13 หลัก)
* `project_name` : รายการ / ชื่อโครงการ
* `budget` : วงเงินงบประมาณ
* `median_price` : ราคากลาง
* `offered_price` : ราคาที่เสนอ
* `agreed_price` : ราคาที่ตกลง
* `contract_amount` : วงเงินตามสัญญา
* `start_date` : วันเริ่มต้นสัญญา / กำหนดส่งมอบ
* `end_date` : วันสิ้นสุดสัญญา / กำหนดส่งมอบ
* `guarantee_type` : ประเภทหลักประกัน
* `guarantee_amount` : มูลค่าหลักประกัน
* `status` : สถานะ (ดำเนินการ, รอส่งมอบ, ส่งมอบแล้ว, ตรวจรับแล้ว, เบิกจ่ายแล้ว, คืนหลักประกัน, ยกเลิก)
* `note` : หมายเหตุ
* `created_at` / `updated_at` : วันเวลาสร้างและแก้ไขข้อมูล

### 2. Sheet: `MonthlyReports`
เก็บบันทึกรายงาน สขร.1 รายเดือน
* `id` : รหัสรายงาน เช่น `skr1-2569-08`
* `year` : ปี พ.ศ. (เช่น 2569)
* `month` : เลขเดือน (เช่น 08)
* `report_name` : ชื่อรายงาน เช่น สขร.1 สิงหาคม 2569
* `published_date` : วันที่เผยแพร่ลงเว็บไซต์หน่วยงาน (YYYY-MM-DD)
* `published_url` : ลิงก์ URL หน้าเว็บที่เผยแพร่
* `status` : สถานะ (`draft`, `ready`, `published`)
* `note` : หมายเหตุ
* `created_at` / `updated_at` : วันเวลาสร้างและแก้ไข

### 3. Sheet: `MonthlyReportItems`
เก็บความสัมพันธ์รายการที่ถูกเลือกในแต่ละเดือน (Many-to-Many ไม่ duplicate แถว)
* `id` : รหัสไอเทม เช่น `MRI-xxxx`
* `report_id` : รหัสรายงาน สขร.1
* `contract_id` : รหัสสัญญาจาก Sheet `Contracts`
* `created_at` : วันเวลาที่เลือก

---

## 🛠️ ขั้นตอนการติดตั้งและ Deploy ใช้งาน

### ขั้นตอนที่ 1: ตั้งค่า Google Sheets และ Google Apps Script
1. เข้าไปที่ [Google Sheets](https://sheets.new) แล้วสร้าง Spreadsheet เปล่าใหม่ 1 ไฟล์
2. ตั้งชื่อไฟล์ เช่น `ระบบทะเบียนคุมพัสดุ V2`
3. ไปที่เมนูด้านบน: **ส่วนขยาย (Extensions)** &rarr; **Apps Script**
4. ลบโค้ดเริ่มต้นทั้งหมดในโปรเจกต์ Apps Script แล้วคัดลอกโค้ดจากไฟล์ [`apps-script/Code.gs`](file:///c:/eoffice/apps-script/Code.gs) ไปวางทั้งหมด
5. ในแถบเครื่องมือ Apps Script ด้านบน:
   - เลือกฟังก์ชัน **`setupDatabase`** ใน Dropdown
   - กดปุ่ม **เรียกใช้ (Run)**
   - กดยินยอมสิทธิ์การเข้าถึง (Review permissions &rarr; Allow)
   - สคริปต์จะสร้าง Sheet: `Contracts`, `MonthlyReports`, `MonthlyReportItems` พร้อมหัวตารางสี Dark และตรึงแถวแรกให้ทันที
6. กดปุ่มสีน้ำเงิน **ทำให้ใช้งานได้ (Deploy)** มุมบนขวา &rarr; เลือก **การทำให้ใช้งานได้รายการใหม่ (New deployment)**
7. กดรูปเฟือง &rarr; เลือก **เว็บแอป (Web app)**
8. ตั้งค่าดังนี้:
   - **คำอธิบาย (Description)**: `ทะเบียนคุมพัสดุ V2 Production`
   - **ดำเนินการในฐานะ (Execute as)**: **ฉัน (Me)**
   - **ผู้มีสิทธิ์เข้าถึง (Who has access)**: **ทุกคน (Anyone)** *(สำคัญมาก เพื่อให้หน้าเว็บเรียก API ได้)*
9. กด **ทำให้ใช้งานได้ (Deploy)**
10. คัดลอก **URL ของเว็บแอป (Web App URL)** ที่ได้ (รูปแบบ `https://script.google.com/macros/s/.../exec`)

### ขั้นตอนที่ 2: นำ Web App URL มาใส่ในระบบ
1. เปิดไฟล์ [`js/config.js`](file:///c:/eoffice/js/config.js)
2. แก้ไขค่า `CONFIG.API_URL`:
   ```javascript
   const CONFIG = {
     API_URL: "https://script.google.com/macros/s/ใส่_URL_ของท่านที่นี่/exec",
     AGENCY_NAME: "ศูนย์ข้อมูลเกษตรแห่งชาติ",
     PARENT_AGENCY: "สำนักงานเศรษฐกิจการเกษตร",
     APP_TITLE: "ทะเบียนคุมพัสดุ V2"
   };
   ```
3. บันทึกไฟล์ *(หรือหากเปิดหน้าเว็บอยู่ สามารถไปที่แท็บ "⚙️ ตั้งค่า" แล้ววาง URL กดบันทึกได้ทันที)*

### ขั้นตอนที่ 3: นำขึ้น GitHub Pages
1. สร้าง New Repository บน [GitHub](https://github.com/new)
2. อัปโหลดไฟล์ทั้งหมดขึ้น Repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: ทะเบียนคุมพัสดุ V2"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
3. ไปที่แท็บ **Settings** ของ Repository บน GitHub &rarr; เมนูด้านซ้ายเลือก **Pages**
4. ในส่วน **Build and deployment**:
   - Source: `Deploy from a branch`
   - Branch: `main` / Folder: `/(root)`
   - กด **Save**
5. รอประมาณ 1-2 นาที GitHub จะสร้าง URL สำหรับเข้าใช้งาน เช่น `https://<your-username>.github.io/<repo-name>/`
6. สามารถเปิดใช้งานผ่าน Browser ได้ทันที ทั้งบนคอมพิวเตอร์และมือถือ

---

## 💡 แนวทางการใช้งานประจำวัน

### 1. การเพิ่ม/แก้ไข รายการสัญญาและใบสั่งซื้อ
* กดแท็บ **"➕ บันทึกข้อมูล"**
* เลือกประเภท (สัญญา / ใบสั่งซื้อ / ข้อตกลง)
* กรอกข้อมูลและกด **"💾 บันทึกลงระบบ"**
* หากต้องการแก้ไขข้อมูลย้อนหลัง ให้ไปที่หน้า **"📋 ทะเบียน"** กดปุ่ม **"✏️ แก้ไข"** ระบบจะโหลดข้อมูลเดิมขึ้นมาให้อัปเดตและบันทึกทับ

### 2. การจัดทำรายงาน สขร.1 ประจำเดือน
1. กดแท็บ **"📥 สขร.1"**
2. เลือกรอบเดือนและปี พ.ศ. ที่ต้องการจัดทำ
3. ระบบจะดึงรายการที่เคยเลือกไว้เดิมขึ้นมา (ถ้ามี)
4. ทำเครื่องหมายถูกหน้าข้อรายการที่ต้องการนำเข้า สขร.1 รอบเดือนนั้น
5. ตรวจสอบจำนวนรายการและวงเงินรวม
6. กด **"💾 บันทึกรายการที่เลือก"**
7. กด **"📥 ดาวน์โหลด สขร.1 (Excel)"** เพื่อนำไฟล์ไปใช้งาน
8. เมื่อนำไฟล์ขึ้นเผยแพร่บนเว็บไซต์ของหน่วยงานแล้ว ให้กลับมากรอก:
   - วันที่เผยแพร่
   - ลิงก์ URL
   - เปลี่ยนสถานะเป็น **"เผยแพร่แล้ว (Published)"**
   - กด **"💾 บันทึกข้อมูลการเผยแพร่"**

### 3. การออกเอกสารสาระสำคัญของสัญญา
* กดแท็บ **"📄 สาระสำคัญ"**
* ติ๊กเลือกรายการสัญญาหรือใบสั่งที่ต้องการ
* กด **"📄 ดาวน์โหลด Excel (แยก Sheet)"** ระบบจะสร้างไฟล์ Excel ที่แยก 1 Sheet ต่อ 1 สัญญา พร้อมข้อมูลและฟอร์แมตครบถ้วนในคลิกเดียว

---

## 🧪 ชุดข้อมูลจำลอง (Mockup Data)

ระบบได้จัดเตรียมชุดข้อมูลจำลองสมจริงสำหรับหน่วยงานภาครัฐ (อิงบริบทศูนย์ข้อมูลเกษตรแห่งชาติ สศก.) จำนวน 18 รายการ (สัญญา 6, ใบสั่ง 7, ข้อตกลง 5) พร้อมรายงาน สขร.1 จำนวน 6 เดือน:

1. **ไฟล์ Excel สำเร็จรูป**:
   - [`mockup-data-procurement.xlsx`](file:///c:/eoffice/mockup-data-procurement.xlsx): รวม 4 Sheet (`Contracts`, `MonthlyReports`, `MonthlyReportItems`, และตาราง `สขร.1_มกราคม_2569` ฟอร์แมตทางการราชการ)
2. **ไฟล์ CSV แยก Sheet สำหรับ Import ลง Google Sheets ทันที**:
   - [`mockup_contracts.csv`](file:///c:/eoffice/mockup_contracts.csv) (18 รายการ)
   - [`mockup_monthly_reports.csv`](file:///c:/eoffice/mockup_monthly_reports.csv) (6 เดือน)
   - [`mockup_monthly_report_items.csv`](file:///c:/eoffice/mockup_monthly_report_items.csv) (16 การผูกโยง)
3. **ไฟล์ JSON**: [`mockup-data.json`](file:///c:/eoffice/mockup-data.json)
4. **โหลดบนหน้าเว็บโดยตรง (1-Click)**:
   - กดปุ่ม **"🧪 โหลดข้อมูลจำลอง"** บนแถบด้านบนของหน้าเว็บ หรือไปที่หน้า **"⚙️ ตั้งค่า"**
5. **เติมข้อมูลลง Google Sheets ผ่าน Apps Script**:
   - ใน Apps Script Editor เลือกฟังก์ชัน **`seedMockData`** แล้วกด **เรียกใช้ (Run)** ข้อมูลจะถูกบันทึกลง 3 Sheet อัตโนมัติ

---

## 🛡️ เทคโนโลยีที่ใช้
* **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+), ExcelJS 4.4.0 (CDN)
* **Backend**: Google Apps Script (REST-like Web App)
* **Database**: Google Sheets
* **Fonts**: IBM Plex Sans Thai, JetBrains Mono, TH Sarabun New
