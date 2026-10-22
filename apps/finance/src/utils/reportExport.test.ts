import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { reportCsv, reportWorkbook, reportPdf, reportFilename, withTotal, type ReportSheet } from './reportExport';

const sheet: ReportSheet = {
  name: 'Statement', title: 'Statement of Financial Position', property: 'Atrium Suites Lombok', period: '2026-09',
  headers: ['Reference', 'Description', 'Amount (Rp)'],
  rows: [['000123', 'Owner, "A"\nSecond line', -12345.67], ['000124', '=SUM(A1:A2)', 0], ['TOTAL', 'Total Assets', 9876543210.12]],
};

test('CSV preserves quoted commas, quotes, multiline text, zero and negative amounts', () => {
  const csv = reportCsv(sheet);
  assert.ok(csv.startsWith('\uFEFF"Reference","Description","Amount (Rp)"\r\n'));
  assert.ok(csv.includes('"000123","Owner, ""A""\nSecond line","-12345.67"'));
  assert.ok(csv.includes('"\'=SUM(A1:A2)","0"'));
  assert.equal(reportFilename('path/Statement.xlsx', 'pdf'), 'path_Statement.pdf');
});

test('Excel round-trip preserves numeric types, leading-zero IDs and all worksheets', () => {
  const wb = reportWorkbook([sheet, { ...sheet, name: 'Statement' }]);
  const bytes = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const parsed = XLSX.read(bytes, { type: 'buffer', cellNF: true });
  assert.deepEqual(parsed.SheetNames, ['Statement', 'Statement 2']);
  const ws = parsed.Sheets.Statement;
  assert.equal(ws.A1.v, sheet.property);
  assert.equal(ws.A7.v, '000123');
  assert.equal(ws.C7.t, 'n');
  assert.equal(ws.C7.v, -12345.67);
  assert.equal(ws.C8.v, 0);
  assert.equal(ws.B8.f, undefined);
  assert.match(ws.C7.z, /#,##0\.00/);
});

test('PDF includes every row, repeated headers, accurate page numbers and no clipped text', async () => {
  const long: ReportSheet = {
    ...sheet,
    rows: Array.from({ length: 140 }, (_, i) => [`REF-${i}`, `Report entry ${i}: a long description with enough detail to wrap neatly across lines.`, i ? i * 1234.5 : -9876543.21]),
  };
  const output = reportPdf([long]);
  const pdf = await getDocument({ data: new Uint8Array(output.output('arraybuffer')), useSystemFonts: true }).promise;
  assert.ok(pdf.numPages > 1);
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items.filter((item): item is Extract<typeof item, { str: string }> => 'str' in item);
    const text = items.map(item => item.str).join(' ');
    assert.ok(text.includes('Statement of Financial Position'));
    assert.ok(text.includes('Amount (Rp)'));
    assert.ok(text.includes(`Page ${i} of ${pdf.numPages}`));
    for (const item of items) {
      const x = item.transform[4];
      assert.ok(x >= 40 && x + item.width <= page.view[2] - 35, `Text outside margins: ${item.str}`);
      assert.ok(item.transform[5] >= 20, `Text clipped at page bottom: ${item.str}`);
    }
    fullText += text;
  }
  assert.ok(fullText.includes('(9,876,543.21)'));
  for (let i = 0; i < 140; i++) assert.ok(fullText.includes(`REF-${i}`));
  await pdf.cleanup();
});

test('wide PDF matrices repeat identifiers across panels and preserve the last columns', async () => {
  const wide: ReportSheet = {
    name: 'Matrix', title: 'Executive Owner Return Matrix',
    headers: Array.from({ length: 20 }, (_, i) => `Column ${i}`),
    rows: [Array.from({ length: 20 }, (_, i) => i < 2 ? `Identifier-${i}` : `Value-${i}`)],
  };
  const pdf = await getDocument({ data: new Uint8Array(reportPdf([wide]).output('arraybuffer')), useSystemFonts: true }).promise;
  assert.equal(pdf.numPages, 3);
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    const pageText = content.items.map(item => 'str' in item ? item.str : '').join(' ');
    assert.ok(pageText.includes('Identifier-0'));
    assert.ok(pageText.includes('Identifier-1'));
    text += pageText;
  }
  assert.ok(text.includes('Value-19'));
  await pdf.cleanup();
});

test('empty reports still produce valid, labelled files', async () => {
  const empty = { ...sheet, rows: [] };
  const csv = reportCsv(empty).split('\r\n');
  assert.equal(csv.length, 3);
  assert.ok(csv[1].includes('No records available for the selected filters.'));
  const pdf = await getDocument({ data: new Uint8Array(reportPdf([empty]).output('arraybuffer')), useSystemFonts: true }).promise;
  const content = await (await pdf.getPage(1)).getTextContent();
  assert.ok(content.items.some(item => 'str' in item && item.str.includes('No records available for the selected filters.')));
  await pdf.cleanup();
});

test('a totals line is only appended when there are records to total', () => {
  const total = ['TOTAL', 'Batch Totals', 0];
  assert.deepEqual(withTotal([], total), []);
  assert.deepEqual(withTotal([['A', 'Row', 5]], total), [['A', 'Row', 5], total]);
  assert.ok(!reportCsv({ ...sheet, rows: withTotal([], total) }).includes('Batch Totals'));
  assert.ok(reportCsv({ ...sheet, rows: withTotal([], total) }).includes('No records available for the selected filters.'));
});

test('withTotal appends in place and never duplicates the existing rows', () => {
  const rows: (string | number)[][] = [['301', 'A'], ['302', 'B'], ['303', 'C']];
  const returned = withTotal(rows, ['TOTAL', 'Totals', 3]);
  assert.equal(returned, rows, 'should mutate and return the same array');
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[3], ['TOTAL', 'Totals', 3]);
  // Spreading the result back over the source array used to double every row.
  const spread = [...withTotal(rows, ['SECOND', 'Total', 6])];
  assert.equal(spread.length, 5);
  assert.equal(spread.filter(r => r[0] === '301').length, 1);
});
