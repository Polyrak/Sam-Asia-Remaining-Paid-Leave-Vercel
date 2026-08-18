import ExcelJS from 'exceljs/dist/exceljs.min.js';
import { MONTH_LABELS, formatAnnualPl, reportTitle, reportYear } from '../utils/leaveFormat.js';

// Displays 0 as "—" while keeping the cell a real, sortable/summable number.
const DASH_FOR_ZERO = '0.##;-0.##;"—"';

const LEADING_COLS = 4; // No, Employee Name, Annual PL (Day), Total PL
const MONTH_COLS = MONTH_LABELS.length;
const TRAILING_COLS = 2; // Total (day), Remaining day
const TOTAL_COLS = LEADING_COLS + MONTH_COLS + TRAILING_COLS;

export async function exportLeaveSummaryToExcel(summary, filename = 'remaining-paid-leave.xlsx') {
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
  groupRow.font = { bold: true };
  groupRow.alignment = { vertical: 'middle', horizontal: 'center' };
  groupRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD8DCF0' } };
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } };
  });

  // Row 3: actual column headers.
  sheet.getRow(3).values = [
    'No',
    'Employee Name',
    'Annual PL (Day)',
    'Total PL',
    ...MONTH_LABELS,
    'Total (day)',
    'Remaining day',
  ];

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
    sheet.addRow(record);
  });

  const numericColumns = ['entitlement', ...MONTH_LABELS.map((_, i) => `m${i}`), 'used', 'remaining'];
  numericColumns.forEach((key) => {
    sheet.getColumn(key).numFmt = DASH_FOR_ZERO;
  });

  const headerRow = sheet.getRow(3);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };
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
