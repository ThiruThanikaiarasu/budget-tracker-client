import { useMemo } from 'react';
import type { Transaction } from '../store/transactionStore';
import useAccountStore from '../store/accountStore';
import CartoonIcon from './CartoonIcon';
import { FaceAvatar } from './cartoon';
import { renderCategoryIcon } from '../utils/categoryIcons';
import { accountKind, categoryKind, itemKind, kindTint } from '../utils/cartoonKinds';
import { formatCurrency } from '../utils/format';
import { summariseDay, type DayCat as Cat } from '../utils/daySummary';
import RemindButton from './RemindButton';
import { friendLines } from '../utils/shareLines';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** The little bar that previews a day's mix (used on the day row and in the panel). */
export function DayMixBar({ rows, withIcons }: { rows: { name: string; icon: string; total: number }[]; withIcons?: boolean }) {
  return (
    <span className={`daymix ${withIcons ? 'is-big' : ''}`} aria-hidden>
      {rows.map((r) => {
        const kind = categoryKind(r.icon, r.name);
        return (
          <span key={r.name} className="daymix-slice" style={{ flexGrow: r.total, background: kindTint(kind) }}>
            {withIcons && <CartoonIcon kind={kind} size={18} />}
          </span>
        );
      })}
    </span>
  );
}

export default function CartoonDayView({
  dateKey, txs, categories, onClose, onPrev, onNext, onAdd,
}: {
  dateKey: string;
  txs: Transaction[];
  categories: Cat[];
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onAdd: () => void;
}) {
  const accountList = useAccountStore((s) => s.accounts);
  const accountTypes = useMemo(() => new Map(accountList.map((a) => [a._id, a.type])), [accountList]);
  const [y, m, d] = dateKey.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const day = useMemo(() => summariseDay(txs, categories), [txs, categories]);
  const accountRows = day.accounts.map((a) => ({ ...a }));
  const accountIdByName = new Map(txs.filter((t) => t.accountId).map((t) => [t.accountId!.name, t.accountId!._id]));

  const boughtText = day.bought.map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(', ');
  const faces = day.bought.map(([n]) => itemKind(n)).filter((k): k is string => !!k).slice(0, 3);

  return (
    <div className="dayv">
      <div className="dayv-head">
        <span className="cartoon-cal dayv-cal" aria-hidden>
          <span className="cartoon-cal-top">{MONTHS[m - 1]}</span>
          <span className="cartoon-cal-day">{d}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="cartoon-kicker">Day view</p>
          <p className="dayv-title">{weekday}</p>
        </div>
        <button type="button" className="dayv-round" onClick={onPrev} disabled={!onPrev} aria-label="Earlier day">‹</button>
        <button type="button" className="dayv-round" onClick={onNext} disabled={!onNext} aria-label="Later day">›</button>
        <button type="button" className="dayv-round" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="dayv-tiles">
        <div className="dayv-tile is-spend"><CartoonIcon kind="shopping" size={26} /><p>Your spend</p><b>{formatCurrency(day.yourSpend)}</b></div>
        <div className="dayv-tile"><CartoonIcon kind="wallet" size={26} /><p>Left accounts</p><b>{formatCurrency(day.leftAccounts)}</b></div>
        {day.comingBack > 0 && <div className="dayv-tile is-earn"><CartoonIcon kind="friends" size={26} /><p>Coming back</p><b>{formatCurrency(day.comingBack)}</b></div>}
      </div>

      {(day.catRows.length > 0 || day.fees !== 0) && (
        <section className="dayv-card">
          <h3>Where your {formatCurrency(day.yourSpend)} went</h3>
          {day.catRows.length > 0 && <DayMixBar rows={day.catRows} withIcons />}
          {day.catRows.map((c) => (
            <div key={c.name} className="dayv-row">
              {renderCategoryIcon(c.icon, c.name, 44)}
              <p className="min-w-0 flex-1"><b>{c.name}</b> {c.note && <span>{c.note}</span>}</p>
              <b>{formatCurrency(c.total)}</b>
            </div>
          ))}
          {day.fees !== 0 && (
            <div className="dayv-row">
              <span className="cartoon-tile" style={{ width: 44, height: 44, background: kindTint('receipt') }}><CartoonIcon kind="receipt" size={30} /></span>
              <p className="min-w-0 flex-1"><b>Fees and discounts</b> <span>{txs.some((t) => t.personalShare != null && t.personalShare !== t.amount) ? 'your half' : ''}</span></p>
              <b className={day.fees < 0 ? 'is-earn' : ''}>{day.fees < 0 ? '−' : '+'}{formatCurrency(Math.abs(day.fees))}</b>
            </div>
          )}
        </section>
      )}

      <div className="dayv-pair">
        {accountRows.length > 0 && (
          <section className="dayv-card">
            <h3>Paid from</h3>
            {accountRows.map((a) => (
              <div key={a.name} className="dayv-line">
                <CartoonIcon kind={accountKind(accountTypes.get(accountIdByName.get(a.name) ?? ''))} size={26} />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <b>{formatCurrency(a.total)}</b>
              </div>
            ))}
          </section>
        )}
        {day.owedToYou.length > 0 && (
          <section className="dayv-card is-earn">
            <h3>Owed to you</h3>
            {day.owedToYou.map((f) => (
              <div key={f.id} className="dayv-owe">
                <div className="dayv-line"><FaceAvatar name={f.name} size={30} /><span className="min-w-0 flex-1 truncate">{f.name}</span><b className="is-earn">{formatCurrency(f.amount)}</b></div>
                <RemindButton friend={f.name} amount={f.amount} lines={friendLines(txs, f.id, f.amount)} dateLabel={`${d} ${MONTHS[m - 1].slice(0, 1)}${MONTHS[m - 1].slice(1).toLowerCase()}`} />
              </div>
            ))}
          </section>
        )}
        {day.youOwe.length > 0 && (
          <section className="dayv-card is-spend">
            <h3>You owe</h3>
            {day.youOwe.map((f) => (
              <div key={f.id} className="dayv-line"><FaceAvatar name={f.name} size={30} /><span className="min-w-0 flex-1 truncate">{f.name}</span><b>{formatCurrency(f.amount)}</b></div>
            ))}
          </section>
        )}
      </div>

      {day.bought.length > 0 && (
        <section className="dayv-card dayv-bought">
          <span className="dayv-faces">{(faces.length ? faces : ['items']).map((k, i) => <CartoonIcon key={i} kind={k} size={34} />)}</span>
          <p className="min-w-0 flex-1"><b>{day.bought.reduce((sum, [, c]) => sum + c, 0)} items bought</b><span>{boughtText}</span></p>
        </section>
      )}

      <button type="button" className="dayv-add" onClick={onAdd}>+ Add to {weekday}</button>
    </div>
  );
}
