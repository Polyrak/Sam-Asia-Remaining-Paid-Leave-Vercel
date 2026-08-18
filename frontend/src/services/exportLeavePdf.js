import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MONTH_LABELS, formatAnnualPl, reportTitle, reportYear } from '../utils/leaveFormat.js';

export function exportLeaveSummaryToPdf(summary, filename = 'remaining-paid-leave.pdf') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text(reportTitle(), 28, 30);

  const groupHeaderStyle = { halign: 'center', fillColor: [216, 220, 240], fontStyle: 'bold' };
  const head = [
    [
      { content: 'Annual paid leave for each employee', colSpan: 4, styles: groupHeaderStyle },
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
    headStyles: { fillColor: [232, 234, 246], textColor: 20, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 90 },
      2: { cellWidth: 70 },
    },
  });

  doc.save(filename);
}
