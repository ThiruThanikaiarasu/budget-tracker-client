import { Fragment } from 'react';
import CartoonIcon from './CartoonIcon';
import { FaceAvatar } from './cartoon';
import { formatCurrency } from '../utils/format';
import { PAGE_H, PAGE_W } from '../utils/billExport';
import { fmtStmtDay, type SAtom, type StmtModel, type StmtPage } from '../utils/friendStatement';

const money = (n: number) => formatCurrency(n);
const COLS = '64px minmax(0,1fr) 112px 120px';

/**
 * The friend statement as A4 pages (794 × 1123 px), for the PDF or a scaled preview.
 * Same plain-white look as the single-bill export: thin ink lines, light tints.
 */
export default function StatementPages({ model, pages, scale }: { model: StmtModel; pages: StmtPage[]; scale?: number }) {
  const owedToYou = model.net > 0;
  const heading = model.net === 0 ? 'ALL SQUARE' : owedToYou ? `${model.friend.toUpperCase()} OWES ${model.you.toUpperCase()}` : `${model.you.toUpperCase()} OWES ${model.friend.toUpperCase()}`;

  const atom = (a: SAtom, key: string) => {
    switch (a.t) {
      case 'band': return (
        <div key={key} className={`bill-band stmt-band is-${a.tone}`}>
          {a.tone === 'lent' && <FaceAvatar name={model.you} size={24} />}
          {a.tone === 'borrowed' && <FaceAvatar name={model.friend} size={24} />}
          {a.tone === 'history' && <CartoonIcon kind="calendar" size={22} />}
          <b>{a.title}</b>
          <span>{a.cont ? 'continued' : a.sub}</span>
        </div>
      );
      case 'cols': return a.kind === 'bill' ? (
        <div key={key} className="bill-row bill-cols" style={{ gridTemplateColumns: COLS }}>
          <span className="bill-cell">DATE</span><span className="bill-cell">BILL</span>
          <span className="bill-cell bill-num">TOTAL</span><span className="bill-cell bill-num">{a.owes}</span>
        </div>
      ) : (
        <div key={key} className="bill-row bill-cols" style={{ gridTemplateColumns: COLS }}>
          <span className="bill-cell">DATE</span><span className="bill-cell">WHAT</span>
          <span className="bill-cell" /><span className="bill-cell bill-num">{a.owes}</span>
        </div>
      );
      case 'row': return (
        <div key={key} className="bill-row" style={{ gridTemplateColumns: COLS }}>
          <span className="bill-cell">{fmtStmtDay(a.bill.date)}</span>
          <span className="bill-cell bill-item">{a.bill.label}</span>
          <span className="bill-cell bill-num">{money(a.bill.total)}</span>
          <span className={`bill-cell bill-num bill-bold ${a.bill.signed > 0 ? 'stmt-in' : 'stmt-out'}`}>{money(Math.abs(a.bill.signed))}</span>
        </div>
      );
      case 'sub': return (
        <div key={key} className="stmt-sub" style={{ gridTemplateColumns: COLS }}>
          <span /><span className="bill-cell">{a.name}{a.qty ? <em> · {a.qty}</em> : null}</span>
          <span className="bill-cell bill-num">{money(a.amount)}</span><span />
        </div>
      );
      case 'hrow': return (
        <div key={key} className="bill-row stmt-hist" style={{ gridTemplateColumns: COLS }}>
          <span className="bill-cell">{fmtStmtDay(a.row.date)}</span>
          <span className="bill-cell bill-item">{a.row.what}</span>
          <span className="bill-cell bill-qty">{a.row.tag}</span>
          <span className="bill-cell bill-num">{money(Math.abs(a.row.amount))}</span>
        </div>
      );
      case 'adjust': return (
        <div key={key} className="bill-row" style={{ gridTemplateColumns: COLS }}>
          <span /><span className="bill-cell bill-item">Part payments already made</span><span />
          <span className={`bill-cell bill-num bill-bold ${a.amount > 0 ? 'stmt-in' : 'stmt-out'}`}>{a.amount > 0 ? '+' : '−'}{money(Math.abs(a.amount))}</span>
        </div>
      );
      case 'total': return (
        <div key={key} className="stmt-pay"><b>{a.text}</b><b>{money(a.amount)}</b></div>
      );
      case 'empty': return <div key={key} className="bill-empty"><span>{a.text}</span></div>;
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
                <div className="bill-head stmt-head">
                  <span className="bill-faces stmt-faces">
                    <FaceAvatar name={model.you} size={46} />
                    <FaceAvatar name={model.friend} size={46} />
                  </span>
                  <div className="bill-head-text">
                    <h1>{model.you} and {model.friend}</h1>
                    <p className="is-faint">{model.subtitle}</p>
                  </div>
                  <div className="bill-head-total">
                    <span>{heading}</span>
                    <b className={model.net === 0 ? '' : owedToYou ? 'stmt-in' : 'stmt-out'}>{money(Math.abs(model.net))}</b>
                  </div>
                </div>
              ) : (
                <div className="bill-run"><b>{model.you} and {model.friend}</b><span>continued</span></div>
              )}
              {page.atoms.map((a, i) => <Fragment key={i}>{atom(a, `${p}-${i}`)}</Fragment>)}
            </div>
            <div className="bill-foot">
              <span>Made with Budget Tracker</span>
              <span>Page {p + 1} of {pages.length}{p < pages.length - 1 ? ` · more bills on page ${p + 2}` : ''}</span>
            </div>
          </div>
        );
        return scale ? (
          <div key={p} className="bill-scaled" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0', width: PAGE_W, height: PAGE_H }}>{sheet}</div>
          </div>
        ) : sheet;
      })}
    </>
  );
}
