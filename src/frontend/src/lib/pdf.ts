/**
 * Dependency-free PDF generation for record and prediction exports.
 *
 * Produces a valid PDF 1.4 document with Helvetica text and simple rules,
 * then triggers a browser download. No network access, no external library.
 */

export interface PdfSection {
  heading?: string;
  lines: string[];
}

export interface PdfDocument {
  title: string;
  subtitle?: string;
  sections: PdfSection[];
  footer?: string;
}

const PAGE_WIDTH = 595.28; // A4 points
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const MAX_CHARS = 88;

/** Escape characters that are special inside a PDF string literal. */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "-");
}

/** Wrap a long line to the printable width. */
function wrap(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];
  const words = text.split(/\s+/);
  const out: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > MAX_CHARS) {
      if (current) out.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

interface Op {
  text: string;
  size: number;
  bold: boolean;
  gapBefore: number;
}

function buildOps(doc: PdfDocument): Op[] {
  const ops: Op[] = [];
  ops.push({ text: doc.title, size: 20, bold: true, gapBefore: 0 });
  if (doc.subtitle) {
    ops.push({ text: doc.subtitle, size: 11, bold: false, gapBefore: 6 });
  }
  for (const section of doc.sections) {
    if (section.heading) {
      ops.push({ text: section.heading, size: 13, bold: true, gapBefore: 18 });
    }
    for (const line of section.lines) {
      for (const wrapped of wrap(line)) {
        ops.push({ text: wrapped, size: 10.5, bold: false, gapBefore: 4 });
      }
    }
  }
  if (doc.footer) {
    ops.push({ text: doc.footer, size: 9, bold: false, gapBefore: 22 });
  }
  return ops;
}

/** Build the PDF byte string. */
function renderPdf(doc: PdfDocument): string {
  const ops = buildOps(doc);
  const pages: string[][] = [];
  let page: string[] = [];
  let y = PAGE_HEIGHT - MARGIN;

  for (const op of ops) {
    const needed = op.gapBefore + op.size;
    if (y - needed < MARGIN) {
      pages.push(page);
      page = [];
      y = PAGE_HEIGHT - MARGIN;
    }
    y -= op.gapBefore;
    const font = op.bold ? "/F2" : "/F1";
    page.push(
      `BT ${font} ${op.size} Tf 1 0 0 1 ${MARGIN} ${y.toFixed(2)} Tm (${escapeText(op.text)}) Tj ET`,
    );
    y -= op.size;
  }
  pages.push(page);

  const objects: string[] = [];
  const pageCount = pages.length;
  const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ");

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);
  objects.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  objects.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );

  pages.forEach((content, i) => {
    const contentObjNum = 5 + i * 2;
    const stream = content.join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >>`,
    );
    objects.push(
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefStart}\n%%EOF`;
  return pdf;
}

/** Trigger a browser download of the given PDF document. */
export function downloadPdf(doc: PdfDocument, filename: string): void {
  const pdf = renderPdf(doc);
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff;
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Format a timestamp for PDF output. */
export function formatPdfDate(value: number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
