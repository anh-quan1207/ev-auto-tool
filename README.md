# EV Visa Auto Web Tool

MVP fullstack cho quy trinh:

1. Upload `template.xlsx`
2. Upload PDF visa thu cong
3. Parse du lieu visa
4. Validate `issue date`
5. Group theo `Entry + Expiry`
6. Xuat Excel va tai file ket qua

## Cau truc

- `backend`: Express API, upload file, parse PDF, export Excel
- `frontend`: Vue 3 + Vite, giao dien thao tac noi bo

## Chay local

```bash
npm run install:all
npm run dev:backend
npm run dev:frontend
```

Frontend chay o `http://localhost:5173`, backend o `http://localhost:3001`.

## API hien co

- `POST /upload`
- `POST /start-job`
- `GET /status/:jobId`
- `GET /download/:file`
- `POST /open-cms` hien dang la placeholder cho giai doan sau

## Gioi han hien tai

- MVP can upload PDF visa thu cong
- Template nen duoc chuan hoa sang `.xlsx` de giu dung format khi xuat
- Parser da duoc chinh theo mau e-visa hien tai, nhung van nen kiem thu voi nhieu PDF that
- Chua co automation CMS bang Playwright o ban dau nay
