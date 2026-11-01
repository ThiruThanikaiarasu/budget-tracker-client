import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toJpeg } from 'html-to-image';
import toast from 'react-hot-toast';
import CartoonIcon from './CartoonIcon';
import { FaceAvatar } from './cartoon';
import BillPages from './BillPages';
import { buildAtoms, HEAD_FIRST, PAGE_W, paginate, STATS_H, statBoxes, type BillModel, type BillOptions, type CopyOf } from '../utils/billExport';

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
/** iPhone / iPad (iPadOS reports itself as a Mac with a touch screen). */
const isIos = /iP(hone|ad|od)/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);
/** Browsers that ignore <a download> (iOS) get the PDF opened in a tab instead, to save from there. */
const canDownloadAttr = typeof HTMLAnchorElement !== 'undefined' && 'download' in HTMLAnchorElement.prototype && !isIos;

const nextPaint = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

const OPTIONS: { key: keyof BillOptions | 'separate'; title: string; sub: string; needsSplit?: boolean }[] = [
  { key: 'items', title: 'Items and quantities', sub: 'Every line with its quantity' },
  { key: 'price', title: 'Price of each item', sub: 'Turn off to show only totals' },
  { key: 'pct', title: 'Share of its category', sub: 'e.g. chocolate is 20% of Snacks — spot the big spends' },
  { key: 'chart', title: 'Spending analysis', sub: 'Where it went, common vs personal, each person, biggest spends' },
  { key: 'who', title: 'Who pays for each line', sub: 'Shared, only one person, custom amounts', needsSplit: true },
  { key: 'separate', title: 'Keep shared and personal separate', sub: 'Always on, so nothing gets mixed up', needsSplit: true },
  { key: 'fees', title: 'Fees, discounts and notes', sub: 'Delivery fee, coupons, your note' },
];

/**
 * "Export this bill": pick whose copy and what to include, then download or
 * share an A4 PDF. The pages are drawn in the page's own layout (BillPages),
 * photographed one by one off-screen and put into the PDF.
 */
export default function ExportBillSheet({ model, onClose }: { model: BillModel; onClose: () => void }) {
  const canCopies = model.split && model.detailed;
  const [copy, setCopy] = useState<CopyOf>('full');
  const [opts, setOpts] = useState<BillOptions>({ items: true, price: true, pct: true, chart: true, who: true, fees: false });
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState<'download' | 'share' | null>(null);
  // A finished PDF kept for a second tap: the share sheet only opens straight from a tap, and
  // building a long PDF can outlast the tap on phones.
  const [ready, setReady] = useState<{ file: File; sig: string } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const pages = useMemo(() => {
    const boxes = statBoxes(model, copy);
    return paginate(buildAtoms(model, copy, opts), HEAD_FIRST + (boxes.length > 0 ? STATS_H : 0));
  }, [model, copy, opts]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); if (preview) setPreview(false); else onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview, onClose]);

  const sig = JSON.stringify([copy, opts]);
  const nameOf = (k: string) => model.names[k] ?? '';
  const copyLabel = (k: string) => (k === model.youKey ? 'My copy' : `${nameOf(k)}'s copy`);
  const fileName = () => {
    const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${slug(model.title)}-${slug(model.dateLabel)}${copy === 'full' ? '' : `-${slug(copyLabel(copy))}`}.pdf`;
  };

  const makePdf = async (): Promise<File> => {
    await nextPaint(); // the off-screen pages render first
    if (document.fonts?.ready) await document.fonts.ready;
    const nodes = Array.from(stageRef.current?.querySelectorAll<HTMLElement>('.bill-page') ?? []);
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
    return new File([pdf.output('blob')], fileName(), { type: 'application/pdf' });
  };

  /** Hands the PDF to the browser. Returns how, so the message can be honest. */
  const save = (file: File, tab: Window | null): 'saved' | 'opened' => {
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
  };
  const done = (how: 'saved' | 'opened', name: string) =>
    toast.success(how === 'saved' ? `Saved ${name} — check your Downloads folder` : 'PDF opened in a new tab — use Share or Save to Files there', { duration: 6000 });

  const run = async (mode: 'download' | 'share') => {
    // A tab for browsers that can't download is opened now, inside the tap, or pop-up blockers refuse it later.
    const tab = !canDownloadAttr && mode === 'download' ? window.open('', '_blank') : null;
    setBusy(mode);
    try {
      const reused = !!ready && ready.sig === sig;
      const file = reused ? ready!.file : await makePdf();
      // Browsers only allow a download that follows a tap, and building the PDF takes seconds, so the
      // tap has usually expired. Keep the PDF and ask for one more tap instead of being blocked.
      if (mode === 'download' && !reused && !tab && navigator.userActivation && !navigator.userActivation.isActive) {
        setReady({ file, sig });
        toast('PDF is ready — tap Save PDF', { duration: 6000 });
        return;
      }
      if (mode === 'share') {
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: model.title });
            setReady(null);
            return;
          } catch (e) {
            const name = (e as Error)?.name;
            if (name === 'AbortError') return;
            if (name === 'NotAllowedError') {
              // The tap expired while the PDF was being made: keep it, one more tap shares it.
              setReady({ file, sig });
              toast('PDF is ready — tap Share PDF again to send it');
              return;
            }
          }
        }
        done(save(file, null), file.name);
        toast('This device can’t share files, so the PDF was saved instead');
        return;
      }
      done(save(file, tab), file.name);
      setReady(null);
    } catch (e) {
      tab?.close();
      if ((e as Error)?.name !== 'AbortError') toast.error('Could not make the PDF. Try again, or turn off some options.');
    } finally {
      setBusy(null);
    }
  };

  const tick = (on: boolean) => (
    <span className={`bill-check ${on ? 'is-on' : ''}`} aria-hidden>
      {on && <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
    </span>
  );
  const scale = Math.min(1, (Math.min(window.innerWidth, 760) - 40) / PAGE_W);

  return createPortal(
    <div className="bill-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bill-sheet" role="dialog" aria-label="Export this bill">
        <div className="bill-sheet-head">
          <CartoonIcon kind="receipt" size={40} />
          <h2>Export this bill</h2>
          <button type="button" className="bill-x" aria-label="Close" onClick={onClose}>×</button>
        </div>

        {canCopies && (
          <>
            <p className="bill-label">WHOSE COPY?</p>
            <div className="bill-copies">
              <button type="button" className={`bill-copy ${copy === 'full' ? 'is-on' : ''}`} onClick={() => setCopy('full')}>
                <span className="bill-faces">{model.keys.slice(0, 3).map((k) => <FaceAvatar key={k} name={nameOf(k)} size={30} />)}</span>
                <b>Full bill</b><small>everyone</small>
              </button>
              {model.keys.map((k) => (
                <button key={k} type="button" className={`bill-copy ${copy === k ? 'is-on' : ''}`} onClick={() => setCopy(k)}>
                  <FaceAvatar name={nameOf(k)} size={30} />
                  <b>{copyLabel(k)}</b><small>{k === model.youKey ? 'your lines only' : 'their lines only'}</small>
                </button>
              ))}
            </div>
          </>
        )}

        <p className="bill-label">WHAT TO INCLUDE</p>
        <div className="bill-opts">
          {OPTIONS.filter((o) => !o.needsSplit || canCopies).map((o) => {
            const locked = o.key === 'separate';
            const on = locked ? true : opts[o.key as keyof BillOptions];
            return (
              <button key={o.key} type="button" disabled={locked} className="bill-opt" aria-pressed={on}
                onClick={() => setOpts((cur) => ({ ...cur, [o.key]: !cur[o.key as keyof BillOptions] }))}>
                {tick(on)}
                <span><b>{o.title}</b><small>{o.sub}</small></span>
              </button>
            );
          })}
        </div>

        <div className="bill-meta">
          <span>{pages.length} {pages.length === 1 ? 'page' : 'pages'} · A4</span>
          <button type="button" className="bill-link" onClick={() => setPreview(true)}>Preview</button>
        </div>
        <div className="bill-actions">
          <button type="button" className="bill-btn" disabled={!!busy} onClick={() => run('download')}>{busy === 'download' ? 'Printing…' : ready && ready.sig === sig ? 'Save PDF' : 'Download PDF'}</button>
          <button type="button" className="bill-btn is-go" disabled={!!busy} onClick={() => run('share')}>{busy === 'share' ? 'Printing…' : ready && ready.sig === sig ? 'Tap to share' : 'Share PDF'}</button>
        </div>
        <p className="bill-foot-note">Share opens WhatsApp, Mail and others on your phone. On desktop it downloads.</p>
      </div>

      {preview && (
        <div className="bill-preview" onMouseDown={(e) => { if (e.target === e.currentTarget) setPreview(false); }}>
          <button type="button" className="bill-x is-float" aria-label="Close preview" onClick={() => setPreview(false)}>×</button>
          <div className="bill-preview-pages"><BillPages model={model} copy={copy} pages={pages} scale={scale} /></div>
        </div>
      )}
      {busy && (
        <div className="sharecard-stage" ref={stageRef} aria-hidden><BillPages model={model} copy={copy} pages={pages} /></div>
      )}
    </div>,
    document.body,
  );
}
