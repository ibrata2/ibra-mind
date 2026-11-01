export type ScannedPage = { pageNumber: number; imageDataUrl: string };
export type ExtractedDocument = { text: string; sourceName: string; pages?: number; scannedPages?: ScannedPage[]; moreScannedPages?: boolean };
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_TEXT = 250_000;

export async function extractDocumentText(file: File): Promise<ExtractedDocument> {
  if (file.size === 0) throw new Error('الملف فارغ.');
  if (file.size > MAX_BYTES) throw new Error('حجم الملف أكبر من 25 ميغابايت.');
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  let text = '';
  let pages: number | undefined;
  const scannedPages: ScannedPage[] = [];
  let moreScannedPages = false;
  if (['txt', 'md', 'markdown', 'csv'].includes(ext)) {
    text = await file.text();
  } else if (ext === 'pdf') {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdfDocument = await pdfjs.getDocument({ data: await file.arrayBuffer(), useSystemFonts: true }).promise;
    pages = pdfDocument.numPages;
    const sections: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = content.items.flatMap((item) => 'str' in item && item.str ? [item.str] : []);
      const pageText = lines.join(' ').trim();
      if (pageText.length >= 20) sections.push(`[صفحة ${pageNumber}]\n${pageText}`);
      else if (scannedPages.length < 10) {
        const original = page.getViewport({ scale: 1 });
        const scale = Math.min(1.6, 1800 / original.width, 1800 / original.height);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d', { alpha: false });
        if (context) {
          context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: context, viewport, canvas }).promise;
          let imageDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          if (imageDataUrl.length > 14_000_000) imageDataUrl = canvas.toDataURL('image/jpeg', 0.62);
          if (imageDataUrl.length > 14_000_000) throw new Error(`صورة صفحة PDF ${pageNumber} أكبر من حد الإرسال الآمن.`);
          scannedPages.push({ pageNumber, imageDataUrl });
        }
      } else moreScannedPages = true;
      if (sections.join('\n').length > MAX_TEXT) break;
    }
    text = sections.join('\n\n');
  } else if (ext === 'docx') {
    const { default: mammoth } = await import('mammoth/mammoth.browser');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
  } else if (ext === 'xlsx') {
    const { default: readXlsxFile } = await import('read-excel-file/browser');
    const sheets = await readXlsxFile(file);
    text = sheets.map((sheet) => `## ${sheet.sheet}\n${sheet.data.map((row) => row.map((cell) => cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell ?? '')).join('\t')).join('\n')}`).join('\n\n');
  } else if (ext === 'pptx') {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slideFiles = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/slide(\d+)/)?.[1]) - Number(b.match(/slide(\d+)/)?.[1]));
    const slides: string[] = [];
    for (let index = 0; index < slideFiles.length; index += 1) {
      const xml = await zip.files[slideFiles[index]].async('text');
      const parsed = new DOMParser().parseFromString(xml, 'application/xml');
      const words = [...parsed.getElementsByTagName('a:t')].map((item) => item.textContent?.trim()).filter(Boolean);
      if (words.length) slides.push(`[شريحة ${index + 1}]\n${words.join(' ')}`);
    }
    text = slides.join('\n\n');
  } else {
    throw new Error('الصيغ المدعومة حالياً: PDF وDOCX وTXT وMarkdown وPPTX وXLSX وCSV.');
  }
  text = text.replace(/\u0000/g, '').trim();
  if (!text && !scannedPages.length) throw new Error('لم يُعثر على نص قابل للاستخراج. الملف فارغ نصياً أو غير مدعوم.');
  if (text.length > MAX_TEXT) text = `${text.slice(0, MAX_TEXT)}\n[تم الاقتصار على أول 250,000 حرف.]`;
  return { text, sourceName: file.name, pages, scannedPages: scannedPages.length ? scannedPages : undefined, moreScannedPages };
}
