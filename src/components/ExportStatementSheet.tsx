import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import CartoonIcon from './CartoonIcon';
import StatementPages from './StatementPages';
import DatePicker from './DatePicker';
import useAuthStore from '../store/authStore';
import type { Friend } from '../store/friendStore';
import type { SharedExpense } from '../store/splitStore';
import { PAGE_W } from '../utils/billExport';
import { buildStatement, localDay, paginateStatement, statementAtoms, type StmtOptions, type StmtScope } from '../utils/friendStatement';
import { canDownloadAttr, renderPdf, savePdf, savedToast } from '../utils/pdfExport';

const OPTIONS: { key: keyof StmtOptions | 'separate'; title: (f: string, y: string) => string; sub: string }[] = [
  { key: 'items', title: () => 'Items inside each bill', sub: 'Adds the item list under every bill' },
  { key: 'separate', title: (f, y) => `Keep "paid by ${y}" and "paid by ${f}" separate`, sub: 'Always on, so nothing gets mixed up' },
  { key: 'history', title: () => 'Payments already settled', sub: 'Shown at the end as a history' },
];

/**
 * "Export with <friend>": pick which bills (not settled, this month, the ones you selected, or a date
 * range) and what to include, then download or share an A4 statement PDF. The pages are drawn in
 * StatementPages, photographed off-screen one by one and put into the PDF (see utils/pdfExport).
 */
export default function ExportStatementSheet({ friend, expenses, netLive, selectedIds, onClose }: {
  friend: Friend; expenses: SharedExpense[]; netLive: number; selectedIds: Set<string>; onClose: () => void;
}) {
  const you = (useAuthStore((s) => s.user?.name) ?? 'You').trim().split(/\s+/)[0];
  const [scope, setScope] = useState<StmtScope>('open');
  const [opts, setOpts] = useState<StmtOptions>({ items: false, history: false });
  const today = localDay(new Date());
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState<'download' | 'share' | null>(null);
  // A finished PDF kept for a second tap: the share sheet only opens straight from a tap.
  const [ready, setReady] = useState<{ file: File; sig: string } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const model = useMemo(
    () => buildStatement({ friend, expenses, netLive, you, scope, selectedIds, from, to, opts }),
    [friend, expenses, netLive, you, scope, selectedIds, from, to, opts],
  );
  const pages = useMemo(() => paginateStatement(statementAtoms(model)), [model]);
  const empty = model.lent.length === 0 && model.borrowed.length === 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); if (preview) setPreview(false); else onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview, onClose]);

  const sig = JSON.stringify([scope, opts, from, to, [...selectedIds]]);
  const fileName = () => {
    const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${slug(you)}-and-${slug(friend.name)}-${scope === 'open' ? 'not-settled' : scope}-${today}.pdf`;
  };

  const run = async (mode: 'download' | 'share') => {
    // A tab for browsers that can't download is opened now, inside the tap, or pop-up blockers refuse it later.
    const tab = !canDownloadAttr && mode === 'download' ? window.open('', '_blank') : null;
    setBusy(mode);
    try {
      const reused = !!ready && ready.sig === sig;
      const file = reused ? ready!.file : await renderPdf(stageRef.current, fileName());
      if (mode === 'download' && !reused && !tab && navigator.userActivation && !navigator.userActivation.isActive) {
        setReady({ file, sig });
        toast('PDF is ready — tap Save PDF', { duration: 6000 });
        return;
      }
      if (mode === 'share') {
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: `${you} and ${friend.name}` });
            setReady(null);
            return;
          } catch (e) {
            const name = (e as Error)?.name;
            if (name === 'AbortError') return;
            if (name === 'NotAllowedError') {
              setReady({ file, sig });
              toast(`PDF is ready — tap Share with ${friend.name} again to send it`);
              return;
            }
          }
        }
        savedToast(savePdf(file, null), file.name);
        toast('This device can’t share files, so the PDF was saved instead');
        return;
      }
      savedToast(savePdf(file, tab), file.name);
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
  const chip = (id: StmtScope, label: string, extra?: { disabled?: boolean; dashed?: boolean; icon?: boolean }) => (
    <button key={id} type="button" disabled={extra?.disabled} aria-pressed={scope === id}
      className={`stmt-chip ${scope === id ? 'is-on' : ''} ${extra?.dashed ? 'is-dashed' : ''}`} onClick={() => setScope(id)}>
      {extra?.icon && <CartoonIcon kind="calendar" size={18} />}{label}
    </button>
  );
  const ready_ = !!ready && ready.sig === sig;

  return createPortal(
    <div className="bill-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bill-sheet" role="dialog" aria-label={`Export with ${friend.name}`}>
        <div className="bill-sheet-head">
          <CartoonIcon kind="receipt" size={40} />
          <h2>Export with {friend.name}</h2>
          <button type="button" className="bill-x" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <p className="bill-label">WHICH BILLS?</p>
        <div className="stmt-chips">
          {chip('open', 'Not settled')}
          {chip('month', 'This month')}
          {chip('selected', selectedIds.size > 0 ? `Selected (${selectedIds.size})` : 'Selected', { disabled: selectedIds.size === 0 })}
          {chip('dates', 'Pick dates', { dashed: true, icon: true })}
        </div>
        {scope === 'dates' && (
          <div className="stmt-dates">
            <label><span>From</span><DatePicker value={from} onChange={setFrom} className="t-input" /></label>
            <label><span>To</span><DatePicker value={to} onChange={setTo} className="t-input" /></label>
          </div>
        )}

        <div className="bill-opts">
          {OPTIONS.map((o) => {
            const locked = o.key === 'separate';
            const on = locked ? true : opts[o.key as keyof StmtOptions];
            return (
              <button key={o.key} type="button" disabled={locked} className="bill-opt" aria-pressed={on}
                onClick={() => setOpts((cur) => ({ ...cur, [o.key]: !cur[o.key as keyof StmtOptions] }))}>
                {tick(on)}
                <span><b>{o.title(friend.name, you)}</b><small>{o.sub}</small></span>
              </button>
            );
          })}
        </div>

        <div className="bill-meta">
          <span>{empty ? 'No unsettled bills here' : `${pages.length} ${pages.length === 1 ? 'page' : 'pages'} · A4`}</span>
          <button type="button" className="bill-link" onClick={() => setPreview(true)}>Preview</button>
        </div>
        <div className="bill-actions">
          <button type="button" className="bill-btn" disabled={!!busy || empty} onClick={() => run('download')}>{busy === 'download' ? 'Printing…' : ready_ ? 'Save PDF' : 'Download PDF'}</button>
          <button type="button" className="bill-btn is-go" disabled={!!busy || empty} onClick={() => run('share')}>{busy === 'share' ? 'Printing…' : ready_ ? 'Tap to share' : `Share with ${friend.name}`}</button>
        </div>
      </div>

      {preview && (
        <div className="bill-preview" onMouseDown={(e) => { if (e.target === e.currentTarget) setPreview(false); }}>
          <button type="button" className="bill-x is-float" aria-label="Close preview" onClick={() => setPreview(false)}>×</button>
          <div className="bill-preview-pages"><StatementPages model={model} pages={pages} scale={scale} /></div>
        </div>
      )}
      {busy && (
        <div className="sharecard-stage" ref={stageRef} aria-hidden><StatementPages model={model} pages={pages} /></div>
      )}
    </div>,
    document.body,
  );
}
