import { Fragment } from 'react';
import CartoonIcon from './CartoonIcon';
import { FaceAvatar } from './cartoon';
import { renderCategoryIcon } from '../utils/categoryIcons';
import { formatCurrency } from '../utils/format';
import { heightOf, PAGE_H, PAGE_W, statBoxes, type Slice, type Atom, type BillModel, type BillPage, type CopyOf, type Cols, type Section } from '../utils/billExport';

const money = (n: number) => formatCurrency(n);
const signed = (n: number) => `${n < 0 ? '−' : '+'}${formatCurrency(Math.abs(n))}`;

/** "20%", or "<1%" for crumbs. */
const pctText = (p: number) => (p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`);
/** The number sits on a thin bar as wide as its share, so the big spends stand out. */
const pctBar = (p: number) => ({ backgroundImage: `linear-gradient(to right, #FFE08A ${Math.min(100, p)}%, transparent ${Math.min(100, p)}%)` });

const template = (c: Cols) => [
  'minmax(0,1fr)', '110px',
  ...(c.price ? ['100px'] : []),
  ...(c.pct ? ['84px'] : []),
  ...(c.each ? ['110px'] : []),
  ...(c.people ? c.people.map(() => '100px') : []),
].join(' ');

/**
 * The bill as A4 pages (794 × 1123 px), ready to be photographed into a PDF or
 * shown scaled down as a preview. Plain white, thin ink lines, light tints.
 */
export default function BillPages({ model, copy, pages, scale }: { model: BillModel; copy: CopyOf; pages: BillPage[]; scale?: number }) {
  const boxes = statBoxes(model, copy);
  const nameOf = (k: string) => model.names[k] ?? '';

  const tableRow = (a: Extract<Atom, { t: 'line' }>, key: string) => (
    <div key={key} className="bill-row" style={{ gridTemplateColumns: template(a.cols) }}>
      <span className="bill-cell bill-item">{a.line.name}</span>
      <span className="bill-cell bill-qty">{a.line.qty ?? ''}</span>
      {a.cols.price && <span className="bill-cell bill-num">{money(a.line.amount)}</span>}
      {a.cols.pct && <span className="bill-cell bill-pct" style={pctBar(a.bar ?? 0)}>{pctText(a.pct ?? 0)}</span>}
      {a.cols.each && <span className="bill-cell bill-num bill-bold">{a.each !== undefined ? money(a.each) : ''}</span>}
      {a.cols.people?.map((k) => (
        <span key={k} className="bill-cell bill-num bill-bold">{a.line.people.includes(k) ? money(a.line.shares[k] ?? 0) : '—'}</span>
      ))}
    </div>
  );

  const miniTable = (s: Section, price: boolean, pct: boolean, pctOf: Record<string, number>, barOf: Record<string, number>) => (
    <div className={`bill-only ${s.person === model.youKey ? 'is-you' : 'is-friend'}`}>
      <div className="bill-only-head">
        <FaceAvatar name={nameOf(s.person ?? '')} size={24} />
        <b>{s.title}</b>
        <span>{money(s.total)}</span>
      </div>
      {s.rows.flatMap((r) => r.lines).map((l) => (
        <div key={l.key} className="bill-row" style={{ gridTemplateColumns: `minmax(0,1fr) 56px${price ? ' 76px' : ''}${pct ? ' 56px' : ''}` }}>
          <span className="bill-cell bill-item">{l.plain ? r0(s, l.key) : l.name}</span>
          <span className="bill-cell bill-qty">{l.qty ?? ''}</span>
          {price && <span className="bill-cell bill-num bill-bold">{money(l.amount)}</span>}
          {pct && <span className="bill-cell bill-pct" style={pctBar(barOf[l.key] ?? 0)}>{pctText(pctOf[l.key] ?? 0)}</span>}
        </div>
      ))}
    </div>
  );
  const r0 = (s: Section, key: string) => s.rows.find((r) => r.lines.some((l) => l.key === key))?.group.name ?? '';

  /** A ring split into coloured slices (the same drawing for the big pie and the small per-person ones). */
  const donut = (slices: Slice[], size: number, ring: number) => {
    const c = size / 2;
    const R = c - ring / 2 - 3;
    const C = 2 * Math.PI * R;
    let off = 0;
    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="bill-donut">
        <circle cx={c} cy={c} r={R} fill="none" stroke="#EFE9DC" strokeWidth={ring} />
        {slices.map((s) => {
          const len = (s.pct / 100) * C;
          const dash = Math.max(0, len - 2.5);
          const el = <circle key={s.name} cx={c} cy={c} r={R} fill="none" stroke={s.color} strokeWidth={ring} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-off} transform={`rotate(-90 ${c} ${c})`} />;
          off += len;
          return el;
        })}
        <circle cx={c} cy={c} r={R + ring / 2} fill="none" stroke="#1E1B18" strokeWidth="2.5" />
        <circle cx={c} cy={c} r={R - ring / 2} fill="#fff" stroke="#1E1B18" strokeWidth="2.5" />
      </svg>
    );
  };
  const legendRow = (s: Slice) => (
    <div key={s.name} className="bill-legend-row">
      <i style={{ background: s.color }} />
      {s.other ? <span className="bill-legend-gap" /> : renderCategoryIcon(s.icon, s.name, 20)}
      <span className="bill-legend-name">{s.name}</span>
      <b>{money(s.amount)}</b>
      <em>{pctText(s.pct)}</em>
    </div>
  );

  const atom = (a: Atom, key: string) => {
    switch (a.t) {
      case 'band': return (
        <div key={key} className={`bill-band ${a.section.kind === 'shared' ? 'is-shared' : a.section.kind === 'custom' ? 'is-custom' : a.section.kind === 'only' ? (a.section.person === model.youKey ? 'is-you' : 'is-friend') : 'is-plain'}`}>
          {a.section.kind === 'shared' && (
            <span className="bill-faces">{model.keys.map((k) => <FaceAvatar key={k} name={nameOf(k)} size={24} />)}</span>
          )}
          {a.section.kind === 'only' && <FaceAvatar name={nameOf(a.section.person ?? '')} size={24} />}
          {a.section.kind === 'custom' && <CartoonIcon kind="coins" size={22} />}
          <b>{a.section.title}</b>
          <span>{a.section.kind === 'only' ? money(a.section.total) : a.sub}</span>
        </div>
      );
      case 'cols': return (
        <div key={key} className="bill-row bill-cols" style={{ gridTemplateColumns: template(a.cols) }}>
          <span className="bill-cell">ITEM</span><span className="bill-cell">{a.qtyLabel}</span>
          {a.cols.price && <span className="bill-cell bill-num">PRICE</span>}
          {a.cols.pct && <span className="bill-cell bill-num">% OF CAT.</span>}
          {a.cols.each && <span className="bill-cell bill-num">EACH PAYS</span>}
          {a.cols.people?.map((k) => <span key={k} className="bill-cell bill-num">{nameOf(k).toUpperCase()} PAYS</span>)}
        </div>
      );
      case 'cat': return (
        <div key={key} className="bill-cat">
          {renderCategoryIcon(a.group.icon, a.group.name, 22)}<b>{a.group.name}</b>{a.cont && <span>(continued)</span>}
        </div>
      );
      case 'line': return tableRow(a, key);
      case 'fee': return (
        <div key={key} className="bill-row" style={{ gridTemplateColumns: 'minmax(0,1fr) 140px' }}>
          <span className="bill-cell bill-item">{a.label}</span><span className="bill-cell bill-num bill-bold">{signed(a.amount)}</span>
        </div>
      );
      case 'pair': return (
        <div key={key} className="bill-pair">
          {miniTable(a.left, a.price, a.pct, a.pctOf, a.barOf)}
          {miniTable(a.right, a.price, a.pct, a.pctOf, a.barOf)}
        </div>
      );
      case 'empty': return (
        <div key={key} className="bill-empty"><CartoonIcon kind="coins" size={22} /><b>Custom amounts</b><span>{a.text}</span></div>
      );
      case 'title': return <p key={key} className="bill-title2">{a.text}</p>;
      case 'total': return <div key={key} className="bill-total"><span>{a.label}</span><b>{money(a.amount)}</b></div>;
      case 'text': return <p key={key} className="bill-text" style={{ height: a.lines * 20 + 12 }}>{a.text}</p>;
      case 'chart': return (
        <div key={key} className="bill-chart">
          <p className="bill-title2">{a.title}</p>
          <div className="bill-chart-body">
            {donut(a.slices, 220, 44)}
            <div className="bill-legend">{a.slices.map((s) => legendRow(s))}</div>
          </div>
        </div>
      );
      case 'stack': return (
        <div key={key} className="bill-chart" style={{ height: heightOf(a) }}>
          <p className="bill-title2">{a.title}</p>
          <div className="bill-key">
            {a.legend.map((l) => <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>)}
          </div>
          {a.rows.map((r) => (
            <div key={r.name} className="bill-stack-row">
              <span className="bill-stack-name">{renderCategoryIcon(r.icon, r.name, 20)}{r.name}</span>
              <span className="bill-stack-track">
                <span className="bill-stack-bar" style={{ width: `${r.bar}%` }}>
                  {r.parts.map((p, i) => <span key={i} style={{ flex: p.frac, background: p.color }} />)}
                </span>
              </span>
              <b>{money(r.total)}</b>
            </div>
          ))}
        </div>
      );
      case 'people': return (
        <div key={key} className="bill-chart" style={{ height: 366 }}>
          <p className="bill-title2">{a.title}</p>
          <div className="bill-people" style={{ gridTemplateColumns: `repeat(${a.cols.length}, minmax(0, 1fr))` }}>
            {a.cols.map((c) => (
              <div key={c.who} className="bill-person">
                <p className="bill-person-head">{c.who}<b>{money(c.total)}</b></p>
                {donut(c.slices, 130, 28)}
                <div className="bill-legend is-tight">{c.slices.map((s) => legendRow(s))}</div>
              </div>
            ))}
          </div>
        </div>
      );
      case 'top': return (
        <div key={key} className="bill-chart" style={{ height: heightOf(a) }}>
          <p className="bill-title2">{a.title}</p>
          {a.rows.map((r, i) => (
            <div key={i} className="bill-top-row">
              <span className="bill-top-rank">{i + 1}</span>
              <span className="bill-top-name">{r.name}<small>{r.cat}</small></span>
              <span className="bill-top-track"><span style={{ width: `${r.bar}%` }} /></span>
              <b>{money(r.amount)}</b>
              <em>{pctText(r.pct)}</em>
            </div>
          ))}
        </div>
      );
      case 'gap': return <div key={key} style={{ height: a.h }} />;
    }
  };

  return (
    <>
      {pages.map((page, p) => {
        const sheet = (
        <div key={p} className="bill-page">
          <div className="bill-body">
            {p === 0 ? (
              <>
                <div className="bill-head">
                  <span className="bill-logo"><CartoonIcon kind="wallet" size={46} /></span>
                  <div className="bill-head-text">
                    <h1>{model.title}</h1>
                    <p>{model.subtitle}</p>
                    <p className="is-faint">{model.dateLabel} · exported from Budget Tracker</p>
                  </div>
                  <div className="bill-head-total"><span>TOTAL</span><b>{money(model.total)}</b></div>
                </div>
                {boxes.length > 0 && (
                  <div className="bill-stats">
                    {boxes.map((b, i) => (
                      <div key={i} className={`bill-stat ${b.settle ? 'is-settle' : ''}`}>
                        {b.person && <FaceAvatar name={nameOf(b.person)} size={38} />}
                        <div>
                          <span>{(b.settle ? b.text ? 'To settle' : b.label : b.label).toUpperCase()}</span>
                          {b.settle && b.text && <em>{b.text}</em>}
                          <b>{money(b.amount)}</b>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="bill-run"><b>{model.title}</b><span>continued</span></div>
            )}
            {page.atoms.map((a, i) => <Fragment key={i}>{atom(a, `${p}-${i}`)}</Fragment>)}
          </div>
          {page.continues && <p className="bill-cont">{page.continues}</p>}
          <div className="bill-foot"><span>Made with Budget Tracker</span><span>Page {p + 1} of {pages.length}</span></div>
        </div>
        );
        // Preview: each page shrunk into a box of its scaled size.
        return scale ? (
          <div key={p} className="bill-scaled" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0', width: PAGE_W, height: PAGE_H }}>{sheet}</div>
          </div>
        ) : sheet;
      })}
    </>
  );
}
