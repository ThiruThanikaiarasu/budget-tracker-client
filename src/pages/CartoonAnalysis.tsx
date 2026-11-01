import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, Treemap, XAxis, YAxis } from 'recharts';
import useAnalysisStore, { type AnalysisItem, type MonthAnalysis } from '../store/analysisStore';
import CartoonIcon from '../components/CartoonIcon';
import { CartoonHead } from '../components/cartoon';
import { renderCategoryIcon } from '../utils/categoryIcons';
import { categoryKind, itemKind } from '../utils/cartoonKinds';
import { deltaPct, formatQty, inr, inrExact, monthLabel, shiftMonth } from '../utils/analysisFormat';

const LEAF = '#4CB86A';
const TOMATO = '#EF4B3C';
const PALETTE = ['#FFC83D', '#6CC4F5', '#4CB86A', '#F7A8C8', '#9B7BE0', '#FF9F43', '#EF4B3C', '#9FD3A5'];
const PREVIEW = 8;

const tipStyle = { background: '#fff', border: '2.5px solid #1E1B18', borderRadius: 12, fontWeight: 800, fontSize: 13, boxShadow: '2px 2px 0 #1E1B18' };

/** "▲ 12%" / "▼ 5%" next to a number, tinted by whether more is bad news (spending) or not. */
function Delta({ pct, upIsBad = true }: { pct: number | null; upIsBad?: boolean }) {
  if (pct == null || Math.abs(pct) < 1) return null;
  const up = pct > 0;
  const bad = up === upIsBad;
  return <span className={`an-delta ${bad ? 'is-bad' : 'is-good'}`}>{up ? '▲' : '▼'} {Math.abs(Math.round(pct))}%</span>;
}

/** The little rectangles in the "money map" — one per item, grouped by category colour. */
interface CellProps { x?: number; y?: number; width?: number; height?: number; name?: string; depth?: number; color?: string; size?: number }
function MapCell({ x = 0, y = 0, width = 0, height = 0, name = '', depth = 0, color = '#FFC83D', size = 0 }: CellProps) {
  if (depth === 0 || width < 2 || height < 2) return null;
  const big = width > 70 && height > 34;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={depth === 1 ? 10 : 6} fill={depth === 1 ? 'none' : color} stroke="#1E1B18" strokeWidth={depth === 1 ? 3 : 1.5} />
      {depth === 2 && big && (
        <>
          <text x={x + 8} y={y + 18} fontSize={12} fontWeight={800} fill="#1E1B18">{name.length > width / 7.5 ? `${name.slice(0, Math.max(3, Math.floor(width / 7.5) - 1))}…` : name}</text>
          <text x={x + 8} y={y + 33} fontSize={11} fontWeight={700} fill="#1E1B18" opacity={0.75}>{inr(size)}</text>
        </>
      )}
    </g>
  );
}

function Tile({ tone, kicker, icon, big, sub, delta }: { tone: string; kicker: string; icon: string; big: string; sub: React.ReactNode; delta?: React.ReactNode }) {
  return (
    <div className={`cartoon-stat ${tone}`}>
      <div className="cartoon-stat-top"><span className="cartoon-kicker">{kicker}</span><CartoonIcon kind={icon} size={38} /></div>
      <p className="cartoon-stat-big">{big} {delta}</p>
      <p className="cartoon-sub">{sub}</p>
    </div>
  );
}

function Panel({ title, hint, children, wide }: { title: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`cartoon-panel an-panel ${wide ? 'is-wide' : ''}`}>
      <div className="an-panel-head">
        <h2 className="cartoon-section-title">{title}</h2>
        {hint && <p className="an-hint">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const EMPTY = (text: string) => <p className="cartoon-empty" style={{ padding: '26px 0' }}>{text}</p>;

export default function CartoonAnalysis() {
  const { data, loading, failed, fetch } = useAnalysisStore();
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [basis, setBasis] = useState<'bill' | 'mine'>('mine');
  useEffect(() => { fetch(month, basis); }, [month, basis, fetch]);

  const shown = data?.month ?? month;
  const step = (by: number) => { if (shown) setMonth(shiftMonth(shown, by)); };

  return (
    <div className="cartoon-page an-page">
      <CartoonHead
        kicker="Your month in review"
        title="Analysis"
        actions={
          <>
            <div className="an-seg" role="group" aria-label="Count whole bills or only my share">
              <button type="button" className={basis === 'mine' ? 'is-on' : ''} onClick={() => setBasis('mine')}>My share</button>
              <button type="button" className={basis === 'bill' ? 'is-on' : ''} onClick={() => setBasis('bill')}>Whole bills</button>
            </div>
            <div className="cartoon-stepper">
              <button className="cartoon-round-btn is-small" aria-label="Previous month" onClick={() => step(-1)}>‹</button>
              <p className="cartoon-stepper-title">{shown ? monthLabel(shown) : '…'}</p>
              <button className="cartoon-round-btn is-small" aria-label="Next month" onClick={() => step(1)}>›</button>
            </div>
          </>
        }
      />
      <p className="an-basis">{basis === 'mine' ? 'Counting only your part of split bills: each item is divided between the people who share it.' : 'Counting the full amount of every bill, whoever pays for it.'}</p>
      {failed && !data && EMPTY('Could not load the analysis. Check the server and try again.')}
      {!data && !failed && <div className="an-skeleton" aria-busy>Counting your month…</div>}
      {data && <AnalysisBody data={data} dimmed={loading} />}
    </div>
  );
}

function AnalysisBody({ data, dimmed }: { data: MonthAnalysis; dimmed: boolean }) {
  const t = data.totals;
  const prev = data.prevTotals;
  const noted = data.merchants.filter((m) => m.noted);
  const unnoted = data.merchants.find((m) => !m.noted);
  const maxMerchant = Math.max(1, ...noted.map((m) => m.total));
  const fees = data.extras.filter((e) => e.kind === 'fee');
  const discounts = data.extras.filter((e) => e.kind === 'discount');
  const maxExtra = Math.max(1, ...data.extras.map((e) => Math.abs(e.amount)));
  const netExtra = t.fees - t.discounts + t.roundOff;
  const extraPct = t.items > 0 ? (t.fees / t.items) * 100 : 0;
  const byFees = noted.filter((m) => m.fees > 0).sort((a, b) => b.fees - a.fees);

  if (t.bills === 0) {
    return <section className="cartoon-panel">{EMPTY(`Nothing spent in ${monthLabel(data.month)} yet.`)}</section>;
  }

  return (
    <div className={`an-body ${dimmed ? 'is-dim' : ''}`}>
      <div className="cartoon-tiles-4">
        <Tile tone="is-spend" kicker="Spent" icon="shopping" big={inr(t.spent)}
          delta={<Delta pct={deltaPct(t.spent, prev?.spent)} />}
          sub={<>{t.bills} bills over {t.activeDays} days · avg {inr(t.avgBill)}</>} />
        <Tile tone="is-plain" kicker="Bought" icon="groceries" big={inr(t.items)}
          sub={<>{t.itemLines} item lines{t.merchants > 0 ? ` from ${t.merchants} place${t.merchants === 1 ? '' : 's'}` : ''}</>} />
        <Tile tone="is-sun" kicker="Extras paid" icon="receipt" big={inr(t.fees)}
          sub={t.items > 0 ? `${extraPct.toFixed(1)}% on top of what you bought` : 'fees and taxes'} />
        <Tile tone="is-earn" kicker="Saved" icon="tag" big={inr(t.discounts)} sub={t.discounts > 0 ? 'with coupons and offers' : 'no coupons used'} />
      </div>

      {data.insights.length > 0 && (
        <Panel title="What stands out">
          <ul className="an-insights">
            {data.insights.map((i, n) => (
              <li key={n}>
                <CartoonIcon kind={{ merchant: 'shopping', extras: 'receipt', saving: 'tag', item: 'groceries', price: 'coins', trend: 'analysis', day: 'calendar' }[i.kind]} size={30} />
                <span>{i.text}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="an-grid">
        <Panel title="Where you shopped" hint="Who got your money, and how much of it was extras">
          {noted.length === 0 ? (
            EMPTY('No places noted this month. Add “Where from” when you save a bill to see this.')
          ) : (
            <div className="an-rows">
              {noted.slice(0, 8).map((m) => {
                const itemsW = m.total > 0 ? (m.items / m.total) * 100 : 100;
                return (
                  <div key={m.name} className="an-merchant">
                    <div className="an-merchant-top">
                      <span className="an-tile"><CartoonIcon kind="shopping" size={22} /></span>
                      <b className="an-name">{m.name}</b>
                      {m.fees > 0 && <span className="an-chip is-warn">+{m.extrasPct.toFixed(m.extrasPct < 10 ? 1 : 0)}% extras</span>}
                      <b className="an-money">{inr(m.total)}</b>
                    </div>
                    <div className="an-track"><span style={{ width: `${(m.total / maxMerchant) * 100}%` }}>
                      <i style={{ width: `${itemsW}%`, background: LEAF }} />
                      {m.fees > 0 && <i style={{ flex: 1, background: TOMATO, minWidth: 4 }} />}
                    </span></div>
                    <p className="an-sub">{m.bills} bill{m.bills === 1 ? '' : 's'} · avg {inr(m.avgBill)}{m.topCategory ? ` · mostly ${m.topCategory}` : ''}</p>
                  </div>
                );
              })}
              <p className="an-key"><i style={{ background: LEAF }} /> what you bought <i style={{ background: TOMATO }} /> fees and taxes</p>
            </div>
          )}
          {unnoted && (
            <p className="an-nudge">
              <CartoonIcon kind="note" size={22} />
              {unnoted.bills} bills ({inr(unnoted.total)}) have no place noted. Fill “Where from” on a bill and it shows up above.
            </p>
          )}
        </Panel>

        <Panel title="What you paid on top" hint="Fees, taxes, delivery and the like">
          {data.extras.length === 0 ? (
            EMPTY('No fees, taxes or discounts on any bill this month.')
          ) : (
            <>
              <p className="an-net">
                <b>{inrExact(t.fees)}</b> fees
                {t.discounts > 0 && <> − <b className="is-good">{inrExact(t.discounts)}</b> saved</>}
                {t.roundOff !== 0 && <> {t.roundOff < 0 ? '−' : '+'} <b>{inrExact(Math.abs(t.roundOff))}</b> round-off</>}
                {' '}= <b>{inrExact(netExtra)}</b> net
              </p>
              <div className="an-rows">
                {[...fees, ...discounts].map((e) => (
                  <div key={`${e.kind}-${e.label}`} className="an-extra">
                    <CartoonIcon kind={e.kind === 'discount' ? 'tag' : 'receipt'} size={22} />
                    <span className="an-name">{e.label}<small>{e.count}× {e.merchants.length ? `· ${e.merchants.slice(0, 2).join(', ')}` : ''}</small></span>
                    <span className="an-bar"><i style={{ width: `${(Math.abs(e.amount) / maxExtra) * 100}%`, background: e.kind === 'discount' ? LEAF : TOMATO }} /></span>
                    <b className={`an-money ${e.kind === 'discount' ? 'is-good' : ''}`}>{e.kind === 'discount' ? '−' : ''}{inrExact(e.amount)}</b>
                  </div>
                ))}
              </div>
              {byFees.length > 0 && (
                <>
                  <p className="an-subhead">Who charges you most</p>
                  <div className="an-rows">
                    {byFees.slice(0, 4).map((m) => (
                      <div key={m.name} className="an-extra">
                        <CartoonIcon kind="shopping" size={22} />
                        <span className="an-name">{m.name}<small>{inrExact(m.fees)} on {inr(m.items)}</small></span>
                        <span className="an-chip is-warn">{m.extrasPct.toFixed(m.extrasPct < 10 ? 1 : 0)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </Panel>
      </div>

      <ItemsPanel data={data} />
      <MoneyMap data={data} />

      <div className="an-grid">
        <Panel title="Last 6 months" hint="What you bought, with fees on top">
          <div className="an-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.trend.map((m) => ({ ...m, label: monthLabel(m.month, 'short') }))} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#E6DDC9" strokeDasharray="4 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#1E1B18', strokeWidth: 2 }} tick={{ fontWeight: 800, fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontWeight: 700, fontSize: 11 }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip contentStyle={tipStyle} cursor={{ fill: 'rgba(30,27,24,.06)' }} formatter={(v) => inrExact(Number(v))} />
                <Bar dataKey="items" name="Bought" stackId="a" fill={LEAF} stroke="#1E1B18" strokeWidth={2} />
                <Bar dataKey="fees" name="Fees & taxes" stackId="a" fill={TOMATO} stroke="#1E1B18" strokeWidth={2} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Day by day" hint={`${t.activeDays} days with spending`}>
          <div className="an-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byDay.map((d) => ({ ...d, label: String(Number(d.date.slice(8))) }))} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#E6DDC9" strokeDasharray="4 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#1E1B18', strokeWidth: 2 }} tick={{ fontWeight: 700, fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontWeight: 700, fontSize: 11 }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip contentStyle={tipStyle} cursor={{ fill: 'rgba(30,27,24,.06)' }} formatter={(v) => inrExact(Number(v))} labelFormatter={(l) => `Day ${l}`} />
                <Bar dataKey="total" name="Spent" radius={[5, 5, 0, 0]} stroke="#1E1B18" strokeWidth={1.5}>
                  {data.byDay.map((d, i) => <Cell key={i} fill={d.total === Math.max(...data.byDay.map((x) => x.total)) ? TOMATO : '#FFC83D'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/** Every item bought this month: how much, how often, at what price, and from where. */
function ItemsPanel({ data }: { data: MonthAnalysis }) {
  const [sort, setSort] = useState<'spent' | 'buys' | 'price'>('spent');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PREVIEW);
  const needle = q.trim().toLowerCase();

  const rows = useMemo(() => {
    const list = data.items.filter((i) => !needle || i.name.toLowerCase().includes(needle) || i.categoryName.toLowerCase().includes(needle));
    const by: Record<typeof sort, (a: AnalysisItem, b: AnalysisItem) => number> = {
      spent: (a, b) => b.spent - a.spent,
      buys: (a, b) => b.buys - a.buys || b.spent - a.spent,
      price: (a, b) => (b.changePct ?? -999) - (a.changePct ?? -999),
    };
    return [...list].sort(by[sort]);
  }, [data.items, needle, sort]);

  const shown = needle ? rows : rows.slice(0, limit);
  const max = Math.max(1, ...data.items.map((i) => i.spent));
  const hidden = rows.length - shown.length;

  return (
    <Panel title="What you bought" hint={`${data.items.length} different items · tap a sort to see what matters`} wide>
      {data.items.length === 0 ? (
        EMPTY('No itemised bills this month. Break a bill into items to see each thing you bought.')
      ) : (
        <>
          <div className="an-tools">
            <input type="search" className="an-find" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an item or category" aria-label="Find an item" />
            <div className="an-seg is-small" role="group" aria-label="Sort items">
              {([['spent', 'Spent most'], ['buys', 'Bought often'], ['price', 'Price rise']] as const).map(([k, label]) => (
                <button key={k} type="button" className={sort === k ? 'is-on' : ''} onClick={() => setSort(k)}>{label}</button>
              ))}
            </div>
          </div>
          <div className="an-items">
            {shown.map((i) => (
              <div key={i.key} className="an-item">
                <CartoonIcon kind={itemKind(i.name) ?? categoryKind(i.categoryIcon, i.categoryName)} size={34} />
                <div className="an-item-main">
                  <div className="an-item-top">
                    <b className="an-name">{i.name}</b>
                    <span className="an-cat">{renderCategoryIcon(i.categoryIcon, i.categoryName, 16)}{i.categoryName}</span>
                  </div>
                  <div className="an-bar"><i style={{ width: `${(i.spent / max) * 100}%`, background: '#FFC83D' }} /></div>
                  <p className="an-sub">
                    {i.buys}× bought{i.qty != null ? ` · ${formatQty(i.qty, i.unit)}` : ''}
                    {i.avgUnit != null && <> · avg {inrExact(i.avgUnit)}/{i.unit}</>}
                    {i.minUnit != null && i.maxUnit != null && i.minUnit !== i.maxUnit && <> (from {inrExact(i.minUnit)} to {inrExact(i.maxUnit)})</>}
                  </p>
                  <p className="an-from">
                    {i.merchants.slice(0, 3).map((m) => <span key={m.name} className="an-chip">{m.name === 'No merchant noted' ? 'place not noted' : m.name}</span>)}
                    {i.merchants.length > 3 && <span className="an-chip">+{i.merchants.length - 3}</span>}
                  </p>
                </div>
                <div className="an-item-right">
                  <b className="an-money">{inrExact(i.spent)}</b>
                  {i.changePct != null && Math.abs(i.changePct) >= 1 && (
                    <span className="an-sub" title={`Last month ${inrExact(i.prevAvgUnit ?? 0)} per ${i.unit}`}><Delta pct={i.changePct} /> vs last month</span>
                  )}
                </div>
              </div>
            ))}
            {shown.length === 0 && <p className="an-sub" style={{ padding: 12 }}>No item matches “{q.trim()}”.</p>}
          </div>
          {!needle && rows.length > PREVIEW && (
            <div className="tx-more">
              <span className="tx-more-count">{shown.length} of {rows.length}</span>
              {hidden > 0 ? (
                <>
                  <button type="button" className="tx-more-btn" onClick={() => setLimit((n) => n + PREVIEW)}>Show {Math.min(PREVIEW, hidden)} more</button>
                  <button type="button" className="tx-more-btn is-go" onClick={() => setLimit(rows.length)}>Show all {rows.length}</button>
                </>
              ) : (
                <button type="button" className="tx-more-btn is-go" onClick={() => setLimit(PREVIEW)}>Collapse</button>
              )}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

/** A treemap: every category is a block, every item inside it sized by what you spent. */
function MoneyMap({ data }: { data: MonthAnalysis }) {
  const tree = useMemo(() => {
    return data.categories.filter((c) => c.total > 0).slice(0, 8).map((c, ci) => {
      const color = PALETTE[ci % PALETTE.length];
      const mine = data.items.filter((i) => i.categoryId === c.id).slice(0, 7);
      const used = mine.reduce((s, i) => s + i.spent, 0);
      const rest = Math.max(0, c.total - used);
      const children = [
        ...mine.map((i) => ({ name: i.name, size: Math.max(1, Math.round(i.spent)), color })),
        ...(rest > 1 ? [{ name: mine.length ? 'everything else' : c.name, size: Math.round(rest), color }] : []),
      ];
      return { name: c.name, color, children };
    });
  }, [data]);

  if (tree.length === 0) return null;
  return (
    <Panel title="Money map" hint="Every block is a category; every tile inside is something you bought" wide>
      <div className="an-map">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={tree} dataKey="size" aspectRatio={2} isAnimationActive={false} content={<MapCell />}>
            <Tooltip contentStyle={tipStyle} formatter={(v) => inrExact(Number(v))} />
          </Treemap>
        </ResponsiveContainer>
      </div>
      <div className="an-legend">
        {tree.map((c) => <span key={c.name}><i style={{ background: c.color }} />{c.name}</span>)}
      </div>
    </Panel>
  );
}
