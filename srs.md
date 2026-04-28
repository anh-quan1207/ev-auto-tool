# 🧾 EV VISA AUTO WEB TOOL

## 🎯 1. Mục tiêu

Xây dựng web app nội bộ giúp tự động hóa quy trình:

Tra cứu CMS → Download PDF → Parse dữ liệu → Phân loại → Xuất Excel

Giảm thao tác thủ công, tăng tốc độ xử lý và hạn chế sai sót.

---

## 👤 2. Người dùng

- Nhân viên xử lý visa
- Không yêu cầu kỹ thuật
- Sử dụng qua giao diện web

---

## 🔁 3. Luồng nghiệp vụ

### Quy trình chính

B1. Upload passport.txt  
B2. Upload TEMPLATE.xlsx  
B3. Click “Mở CMS”  
B4. User login + captcha thủ công  
B5. Click “Tôi đã login xong”  
B6. System tự động:
- nhập passport
- search
- download PDF  

B7. Parse PDF  
B8. Validate dữ liệu  
B9. Phân loại  
B10. Xuất Excel  
B11. Download kết quả  

---

## 📥 4. Input

### passport.txt
- Mỗi dòng 1 passport

Ví dụ:
E12345678  
E90123456  

### TEMPLATE.xlsx
- File Excel mẫu để ghi dữ liệu

---

## 📄 5. Parse PDF

Trích xuất các thông tin:

- Name (Full name)
- DOB (Date of birth)
- Passport
- EV number
- Issue date
- Expiry date
- Entry type (1L hoặc NL)

---

## 📅 6. Validate

- Nếu Issue date > ngày hiện tại → bỏ qua visa

---

## 🧩 7. Phân loại (Grouping)

Group theo:

(Entry, Expiry)

Ví dụ:
(NL, 30/05/2026)  
(1L, 15/06/2026)  

---

## 📊 8. Xuất Excel

Mapping dữ liệu:

- Họ tên (tiếng Anh) → Name  
- Ngày sinh → DOB  
- Số giấy tờ → Passport  
- Số Visa điện tử → EV  
- Ngày hiệu lực → Issue  
- Ngày hết hạn → Expiry  

---

## 📁 9. Quy tắc đặt tên file

EV {Entry} {Số người}K (DY) {3 số cuối EV} - {Expiry}.xlsx

Ví dụ:

EV NL 03K (DY) 123 - 30-05-2026.xlsx

---

## 🧱 10. Kiến trúc hệ thống

Frontend (VueJS)  
↓  
Backend API (Node.js)  
↓  
Playwright (Automation CMS)  
↓  
File system (PDF / Excel)  

---

## ⚙️ 11. Tech Stack

### Frontend
- Vue 3
- Vite
- Axios

### Backend
- Node.js
- Express

### Automation
- Playwright

### Xử lý file
- pdf-parse
- exceljs
- multer

---

## 🔌 12. API Design

### POST /upload
Upload:
- passport.txt
- template.xlsx

---

### POST /open-cms
- Mở browser CMS bằng Playwright

---

### POST /start-job
- Bắt đầu xử lý:
  - tra cứu passport
  - download PDF
  - parse
  - export Excel

---

### GET /status

Response:
{
  "progress": 70,
  "current_passport": "E12345678",
  "done": false
}

---

### GET /download/:file
- Download file Excel kết quả

---

## 🖥️ 13. UI Flow

[ Upload passport.txt ]  
[ Upload TEMPLATE.xlsx ]  

[ Mở CMS ]  

→ User login + captcha  

[ Tôi đã login xong ]  

[ Bắt đầu xử lý ]  

Hiển thị:
- tiến độ (%)
- passport đang xử lý  

Danh sách file Excel  

[ Download ]  

---

## ⚠️ 14. Lưu ý quan trọng

### Security
- Không lưu password CMS
- Không auto login
- User login thủ công

---

### Automation
- Chỉ chạy sau khi user login xong
- Dùng Playwright (ổn định hơn Selenium)

---

### File system

/uploads  
/downloads  
/outputs  

---

### Printing
- Không auto in PDF trong web version

---

## 🚀 15. Roadmap

### MVP (nên làm trước)
- Upload PDF thủ công
- Parse PDF
- Group
- Export Excel

---

### Full version
- Auto CMS tra cứu
- Download PDF
- Progress realtime
- Multi-user

---

## 🧠 16. Prompt AI Coding

Build a fullstack web app using Vue 3 (frontend) and Node.js Express (backend).

Features:
- Upload passport.txt and template.xlsx
- Use Playwright to open CMS
- Wait for manual login
- Auto search passport and download visa PDFs
- Parse PDF:
  Name, DOB, Passport, EV number, Issue date, Expiry date, Entry type
- Validate issue date
- Group by Entry + Expiry
- Export Excel using template
- Provide download

Tech:
- multer
- pdf-parse
- exceljs
- playwright

Include:
- REST API
- basic UI
- progress tracking

---

## 🧾 17. Tổng kết

Hệ thống này bao gồm:

- Automation (Playwright)
- Data extraction (PDF)
- Data processing (group, validate)
- File generation (Excel)
- Web UI (Vue)

→ Có thể mở rộng thành tool nội bộ cho team hoặc doanh nghiệp.
