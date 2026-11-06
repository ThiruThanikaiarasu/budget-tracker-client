import toast from 'react-hot-toast';
import { toJpeg } from 'html-to-image';

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
/** iPhone / iPad (iPadOS reports itself as a Mac with a touch screen). */
export const isIos = /iP(hone|ad|od)/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);
/** Browsers that ignore <a download> (iOS) get the PDF opened in a tab instead, to save from there. */
export const canDownloadAttr = typeof HTMLAnchorElement !== 'undefined' && 'download' in HTMLAnchorElement.prototype && !isIos;

export const nextPaint = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** Photographs each `.bill-page` inside `stage` (A4, drawn off-screen) into one PDF. */
export async function renderPdf(stage: HTMLElement | null, fileName: string): Promise<File> {
  await nextPaint(); // the off-screen pages render first
  if (document.fonts?.ready) await document.fonts.ready;
  const nodes = Array.from(stage?.querySelectorAll<HTMLElement>('.bill-page') ?? []);
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  for (let i = 0; i < nodes.length; i++) {
    const o = { pixelRatio: 1.6, quality: 0.8, backgroundColor: '#ffffff', cacheBust: true };
    // Safari draws images and fonts blank on the first capture; a throw-away pass loads them.
    if (i === 0 && isSafari) await toJpeg(nodes[0], { ...o, skipFonts: true }).catch(() => undefined);
    const url = await toJpeg(nodes[i], o).catch(() => toJpeg(nodes[i], { ...o, skipFonts: true }));
    if (i > 0) pdf.addPage();
    pdf.addImage(url, 'JPEG', 0, 0, w, h);
  }
  return new File([pdf.output('blob')], fileName, { type: 'application/pdf' });
}

/** Hands the PDF to the browser. Returns how, so the message can be honest. */
export function savePdf(file: File, tab: Window | null): 'saved' | 'opened' {
  const url = URL.createObjectURL(file);
  // Revoked late: some browsers read the link after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
  if (canDownloadAttr) {
    const a = document.createElement('a');
    a.href = url; a.download = file.name; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); // Firefox ignores clicks on links outside the page
    a.click();
    a.remove();
    tab?.close();
    return 'saved';
  }
  if (tab && !tab.closed) tab.location.href = url;
  else {
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
  }
  return 'opened';
}

export const savedToast = (how: 'saved' | 'opened', name: string) =>
  toast.success(how === 'saved' ? `Saved ${name} — check your Downloads folder` : 'PDF opened in a new tab — use Share or Save to Files there', { duration: 6000 });
