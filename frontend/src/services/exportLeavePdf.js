import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MONTH_LABELS, formatAnnualPl, reportTitle, reportYear } from '../utils/leaveFormat.js';

// Matches the app's theme (App.vue) and status utility colors (Vuetify's
// default green/red), so the export looks the same as the on-screen table.
const PRIMARY_GREEN = [46, 125, 50];
const STATUS_GREEN = [76, 175, 80];
const STATUS_RED = [244, 67, 54];
const WARNING_ROW_FILL = [255, 237, 217];
const HEADER_GROUP_FILL = [232, 245, 233];

const LEADING_COLS = 4; // No, Employee Name, Annual PL (Day), Total PL
const USED_COL_INDEX = LEADING_COLS + MONTH_LABELS.length;
const REMAINING_COL_INDEX = USED_COL_INDEX + 1;

export function exportLeaveSummaryToPdf(summary, filename = `Remaining Paid Leave in ${reportYear()}.pdf`) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text(reportTitle(), 28, 30);

  const groupHeaderStyle = { halign: 'center', fillColor: HEADER_GROUP_FILL, textColor: PRIMARY_GREEN, fontStyle: 'bold' };
  const head = [
    [
      { content: 'Annual paid leave for each employee', colSpan: LEADING_COLS, styles: groupHeaderStyle },
      { content: 'Absence', colSpan: MONTH_LABELS.length, styles: groupHeaderStyle },
      { content: `Enter year ${reportYear()}`, colSpan: 2, styles: groupHeaderStyle },
    ],
    ['No', 'Employee Name', 'Annual PL (Day)', 'Total PL', ...MONTH_LABELS, 'Total (day)', 'Remaining day'],
  ];

  const body = summary.map((item, index) => [
    index + 1,
    item.name,
    formatAnnualPl(item),
    item.entitlement,
    ...MONTH_LABELS.map((_, i) => {
      const value = item.monthly?.[i] ?? 0;
      return value ? value : '—';
    }),
    item.used,
    item.remaining,
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 44,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 3 },
    // Row 3 (column headers) — green underline + green text, matching the
    // on-screen table (no solid fill).
    headStyles: {
      fillColor: false,
      textColor: PRIMARY_GREEN,
      fontStyle: 'bold',
      lineWidth: { bottom: 1.5 },
      lineColor: PRIMARY_GREEN,
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 90 },
      2: { cellWidth: 70 },
    },
    didParseCell(data) {
      if (data.section !== 'body') return;
      const item = summary[data.row.index];
      if (!item) return;

      if (data.column.index === USED_COL_INDEX) {
        data.cell.styles.textColor = item.used > item.entitlement ? STATUS_RED : STATUS_GREEN;
      }
      if (data.column.index === REMAINING_COL_INDEX) {
        data.cell.styles.textColor = item.remaining <= 0 ? STATUS_RED : STATUS_GREEN;
      }
      if (item.remaining <= 0) {
        data.cell.styles.fillColor = WARNING_ROW_FILL;
      }
    },
  });

  doc.save(filename);
}
