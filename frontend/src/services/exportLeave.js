import ExcelJS from 'exceljs/dist/exceljs.min.js';
import { MONTH_LABELS, formatAnnualPl, reportTitle, reportYear } from '../utils/leaveFormat.js';

// Displays 0 as "—" while keeping the cell a real, sortable/summable number.
const DASH_FOR_ZERO = '0.##;-0.##;"—"';

// Matches the app's theme (App.vue) and status utility colors (Vuetify's
// default green/red), so the export looks the same as the on-screen table.
const PRIMARY_GREEN = 'FF2E7D32';
const STATUS_GREEN = 'FF4CAF50';
const STATUS_RED = 'FFF44336';
const WARNING_ROW_FILL = 'FFFFEDD9';
const HEADER_GROUP_FILL = 'FFE8F5E9';

const LEADING_COLS = 4; // No, Employee Name, Annual PL (Day), Total PL
const MONTH_COLS = MONTH_LABELS.length;
const TRAILING_COLS = 2; // Total (day), Remaining day
const TOTAL_COLS = LEADING_COLS + MONTH_COLS + TRAILING_COLS;

export async function exportLeaveSummaryToExcel(summary, filename = `Remaining Paid Leave in ${reportYear()}.xlsx`) {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Leave');

  sheet.columns = [
    { key: 'no', width: 6 },
    { key: 'name', width: 24 },
    { key: 'annualPl', width: 20 },
    { key: 'entitlement', width: 10 },
    ...MONTH_LABELS.map((_, i) => ({ key: `m${i}`, width: 7 })),
    { key: 'used', width: 12 },
    { key: 'remaining', width: 14 },
  ];

  // Row 1: report title, spanning every column.
  sheet.mergeCells(1, 1, 1, TOTAL_COLS);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = reportTitle();
  titleCell.font = { bold: true, size: 13 };

  // Row 2: grouped section headers.
  sheet.mergeCells(2, 1, 2, LEADING_COLS);
  sheet.getCell(2, 1).value = 'Annual paid leave for each employee';
  sheet.mergeCells(2, LEADING_COLS + 1, 2, LEADING_COLS + MONTH_COLS);
  sheet.getCell(2, LEADING_COLS + 1).value = 'Absence';
  sheet.mergeCells(2, LEADING_COLS + MONTH_COLS + 1, 2, TOTAL_COLS);
  sheet.getCell(2, LEADING_COLS + MONTH_COLS + 1).value = `Enter year ${reportYear()}`;
  const groupRow = sheet.getRow(2);
  groupRow.font = { bold: true, color: { argb: PRIMARY_GREEN } };
  groupRow.alignment = { vertical: 'middle', horizontal: 'center' };
  groupRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_GROUP_FILL } };
    cell.border = { bottom: { style: 'thin', color: { argb: PRIMARY_GREEN } } };
  });

  // Row 3: actual column headers — matches the on-screen table's green
  // underline + green text (not a solid fill).
  sheet.getRow(3).values = [
    'No',
    'Employee Name',
    'Annual PL (Day)',
    'Total PL',
    ...MONTH_LABELS,
    'Total (day)',
    'Remaining day',
  ];
  const headerRow = sheet.getRow(3);
  headerRow.font = { bold: true, color: { argb: PRIMARY_GREEN } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = { bottom: { style: 'medium', color: { argb: PRIMARY_GREEN } } };
  });

  summary.forEach((item, index) => {
    const record = {
      no: index + 1,
      name: item.name,
      annualPl: formatAnnualPl(item),
      entitlement: item.entitlement,
      used: item.used,
      remaining: item.remaining,
    };
    MONTH_LABELS.forEach((_, i) => {
      record[`m${i}`] = item.monthly?.[i] ?? 0;
    });
    const row = sheet.addRow(record);

    // Same status coloring as the dashboard: used > entitlement is red,
    // remaining <= 0 is red, otherwise green.
    row.getCell('used').font = { color: { argb: item.used > item.entitlement ? STATUS_RED : STATUS_GREEN } };
    row.getCell('remaining').font = { color: { argb: item.remaining <= 0 ? STATUS_RED : STATUS_GREEN } };

    // Same amber "warning row" highlight as the dashboard when out of leave.
    if (item.remaining <= 0) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WARNING_ROW_FILL } };
      });
    }
  });

  const numericColumns = ['entitlement', ...MONTH_LABELS.map((_, i) => `m${i}`), 'used', 'remaining'];
  numericColumns.forEach((key) => {
    sheet.getColumn(key).numFmt = DASH_FOR_ZERO;
  });

  sheet.views = [{ state: 'frozen', ySplit: 3 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
