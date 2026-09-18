# Mojaru QC Report Scraper & Analytics Dashboard
### Chrome Extension (Manifest V3) & Full-Featured Teacher Analytics

A dedicated Chrome Extension and analytics tool tailored for teachers at [Mojaru](https://teacher.mojaru.com). It automates scraping monthly QC reports across custom month ranges, applies the strict bonus calculation rules, detects discrepancies, and provides an interactive CRUD dashboard where **edited or manually created rows are clearly highlighted with a distinct warning color**.

---

## 🌟 Key Features

### 1. Automated Month-Range Scraper
- **Seamless Session Integration**: Runs directly in Chrome while you are already logged in to `teacher.mojaru.com`. No need to re-enter passwords or bypass 2FA.
- **Custom Month Range**: Select **From Month** (e.g., `2026-06`) to **To Month** (e.g., `2026-09`) or use quick presets (**This Month**, **Past 3 Months**, **Past 6 Months**).
- **Sequential Scraping**: Automatically selects each month, fetches reports, parses the table, and accumulates all data.
- **Two Easy Scraping Interfaces**:
  1. **Extension Popup**: Click the extension icon in your Chrome toolbar.
  2. **In-Page Floating Bar**: An unobtrusive floating widget directly on `teacher.mojaru.com/teacher/qc-report`.

### 2. Business Logic & Bonus Engine
Implements the exact Mojaru teacher evaluation policy:
- **On Time**: Present on time = `1 pt` (Strict prerequisite: if `0`, bonus is `0 Tk`).
- **Camera On**: Teacher camera active = `1 pt`.
- **Class Test**: Performance/test submitted by 11:59 PM = `1 pt`.
- **Attendance**:
  - 75% to 84% student attendance = `1 pt`.
  - &ge;85% student attendance = `2 pts`.
- **Bonus Calculation**:
  - `40 Tk` per earned point.
  - **Penalty Condition 1**: If teacher was not present on time (`on_time === 0`), bonus is `0 Tk`.
  - **Penalty Condition 2**: If total score is less than 3 (`total < 3`), bonus is `0 Tk`.
  - **Discrepancy Detection**: Highlights any mismatch between raw portal bonus and calculated policy bonus (e.g., special adjustments or overrides).

### 3. Interactive CRUD Dashboard
- **Create**: Add a manual class entry with live score & bonus preview.
- **Read**: Rich table showing Course, Batch (`MOPP 60`, `MOPJ 35`, etc.), Subject, Class Time, Point Breakdown, Total Score, and Bonus.
- **Update (Edit)**: Edit any field; stores original backup for one-click restoration.
- **Delete**: Remove unwanted records with confirmation.
- **⚡ Warning Color Highlighting (Requested Feature)**:
  - Any edited row or manually created row is automatically styled with a **prominent amber warning background and border** (`[EDITED]` or `[MANUAL]` badge).
  - Click the **"Edited / Manual Rows"** badge filter to instantly isolate and review all modified entries.
  - One-click **"Restore Original"** button reverts any edited row back to its pristine scraped state.

### 4. Filters, Search & Analytics
- **Summary KPIs**: Total Earned Bonus (Tk), Bonus Lost due to late/low points (Tk), On-Time Adherence %, Camera Adherence %, High-Attendance Rate %.
- **Multi-Filter Toolbar**: Filter by Month, Batch, Course, Bonus Status (Paid, 0 Tk, Discrepancies), and Modification Status.
- **Live Search**: Instant keyword filtering across batch, subject, date, or notes.
- **Export & Import**: One-click CSV export, plus raw HTML paste/file import option.
- **Theme**: Dark Mode and Light Mode support with smooth transition.

---

## 🚀 How to Install in Google Chrome

1. Open Google Chrome.
2. In the address bar, navigate to:
   ```text
   chrome://extensions
   ```
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **"Load unpacked"** button in the top-left corner.
5. Select this project folder:
   ```text
   d:\BlackPuzzle\MJ_QC
   ```
6. The extension **"Mojaru QC Report Scraper & Analytics"** will appear in your extensions list.
7. Click the Chrome Extensions puzzle icon in your toolbar and pin **Mojaru QC Tool** for quick access.

---

## 📖 How to Use

### Step 1: Scrape Month Reports
1. Log in to [https://teacher.mojaru.com](https://teacher.mojaru.com).
2. Click the **Mojaru QC Tool** extension icon in your Chrome toolbar (or use the floating QC Scraper widget on the page).
3. Select your desired month range:
   - Example: From `2026-06` to `2026-09` (or click **Past 3 Mos**).
4. Click **"Scrape Range Now"**.
5. Watch the progress bar as each month is fetched and parsed.

### Step 2: Open Analytics Dashboard
- Click **"Open Full Analytics Dashboard"** in the popup or floating panel.
- The dashboard opens in a clean, full-page view displaying all your classes.

### Step 3: Edit and Review
- To edit any record, click the **Edit (pencil)** icon on that row.
- Change scores or add notes; the live bonus recalculates immediately.
- Click **"Save Record"**.
- The entire row is immediately highlighted in **amber warning color** with an **`[EDITED]`** badge.
- To filter and review only modified entries, click the **"Edited / Manual Rows"** badge filter at the top.

---

## 💻 Standalone Local Preview Server

You can also run the dashboard as a local web server:
```powershell
# From d:\BlackPuzzle\MJ_QC
npm start
```
Then open your browser to:
- Dashboard: [http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html)
- Extension Popup Preview: [http://localhost:3000/popup.html](http://localhost:3000/popup.html)

---

## 🧪 Automated Verification

To run the built-in test suite:
```powershell
node test/test_qc.js
```
Verifies rules engine, 22 seed classes from September 2026, storage CRUD, warning highlights, and Manifest V3 assets.
