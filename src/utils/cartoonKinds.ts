// ── Category → icon + tile tint ───────────────────────────────────────
// Category icon keys (and legacy names) from utils/categoryIcons map onto the
// smaller cartoon kit; the tint is the soft fill of the square behind it.
const KEY_TO_KIND: Record<string, string> = {
  cart: 'groceries', fruit: 'banana',
  restaurant: 'food', fastfood: 'pizza', coffee: 'coffee', beer: 'coffee', icecream: 'food',
  car: 'transport', motorcycle: 'transport', bus: 'transport', train: 'transport', flight: 'travel', fuel: 'fuel', camping: 'travel',
  bag: 'shopping', jewelry: 'shopping', clothing: 'clothing', beauty: 'shopping',
  home: 'rent', sofa: 'rent', tools: 'rent', garden: 'rent',
  electricity: 'bills', water: 'bills', wifi: 'bills', washer: 'bills',
  phone: 'recharge', computer: 'recharge',
  medical: 'health', health: 'health', fitness: 'health', pharmacy: 'health',
  education: 'education', childcare: 'education', book: 'education',
  movie: 'fun', music: 'fun', gaming: 'fun', camera: 'fun', sports: 'fun', art: 'fun', pet: 'fun', smoking: 'fun',
  work: 'salary', salary: 'salary', savings: 'investment', investment: 'investment',
  gift: 'gift', charity: 'gift',
};

const NAME_TO_KIND: Record<string, string> = {
  groceries: 'groceries', grocery: 'groceries', vegetables: 'groceries',
  food: 'food', breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snacks: 'snacks', tea: 'tea', dining: 'food',
  transport: 'transport', travel: 'travel', petrol: 'fuel', fuel: 'fuel',
  rent: 'rent', bills: 'bills', broadband: 'bills', 'mobile recharge': 'recharge',
  shopping: 'shopping', 'clothing & accessories': 'clothing', clothing: 'clothing',
  health: 'health', education: 'education', books: 'education', learning: 'education',
  entertainment: 'fun', salary: 'salary', freelance: 'freelance', 'investment return': 'investment',
  interest: 'interest', reward: 'reward', rewards: 'reward', social: 'social', transfer: 'transfer', reconcile: 'reconcile', gift: 'gift', settlement: 'settlement', waived: 'settlement',
  'clean up': 'cleanup',
  fruits: 'banana', other: 'other', 'bank charges': 'bank', investment: 'investment', 'cred reward': 'reward',
  rentomojo: 'rent', emi: 'card',
  juice: 'juice', sweet: 'sweet', sweets: 'sweet', 'gadget & accessories': 'gadget', 'personal care': 'personalcare', workspace: 'workspace',
  subscriptions: 'subscription', subscription: 'subscription', 'accesories repair': 'repair', 'accessories repair': 'repair', repair: 'repair',
};

const KIND_TINT: Record<string, string> = {
  groceries: 'var(--c-sun-tint)', banana: 'var(--c-sun-tint)', food: 'var(--c-spend-tint)', pizza: 'var(--c-spend-tint)', coffee: 'var(--c-sun-tint)',
  transport: 'var(--c-sky-tint)', travel: 'var(--c-sky-tint)', fuel: 'var(--c-spend-tint)',
  shopping: 'var(--c-grape-tint)', clothing: 'var(--c-sky-tint)', rent: 'var(--c-spend-tint)', bills: 'var(--c-sun-tint)', recharge: 'var(--c-sky-tint)',
  health: 'var(--c-earn-tint)', education: 'var(--c-sky-tint)', fun: 'var(--c-grape-tint)',
  salary: 'var(--c-earn-tint)', investment: 'var(--c-earn-tint)', gift: 'var(--c-spend-tint)',
  card: 'var(--c-spend-tint)', bank: 'var(--c-sky-tint)', cash: 'var(--c-earn-tint)', wallet: 'var(--c-sun-tint)',
  breakfast: 'var(--c-sun-tint)', lunch: 'var(--c-sky-tint)', dinner: 'var(--c-grape-tint)', tea: 'var(--c-sun-tint)', snacks: 'var(--c-sun-tint)',
  freelance: 'var(--c-earn-tint)', interest: 'var(--c-earn-tint)', reward: 'var(--c-grape-tint)', social: 'var(--c-sky-tint)', transfer: 'var(--c-sky-tint)', reconcile: 'var(--c-grape-tint)',
  settlement: 'var(--c-sky-tint)', cleanup: 'var(--c-grape-tint)', tag: 'var(--c-sun-tint)',
  juice: 'var(--c-sun-tint)', sweet: 'var(--c-spend-tint)', gadget: 'var(--c-sky-tint)', personalcare: 'var(--c-grape-tint)',
  workspace: 'var(--c-sky-tint)', subscription: 'var(--c-grape-tint)', repair: 'var(--c-sun-tint)',
};

const SPECIFIC_NAME_KINDS = new Set([
  'breakfast', 'lunch', 'dinner', 'tea', 'snacks', 'freelance', 'interest', 'reward', 'rewards', 'social',
  'fruits', 'other', 'bank charges', 'investment', 'cred reward', 'rentomojo', 'emi',
  'juice', 'sweet', 'sweets', 'gadget & accessories', 'personal care', 'workspace', 'subscriptions', 'subscription',
  'accesories repair', 'accessories repair', 'repair',
]);

/** Pictures offered when creating or editing a category. Stored as `kind:<name>`. */
export const CATEGORY_KINDS = [
  'groceries', 'breakfast', 'lunch', 'dinner', 'tea', 'snacks', 'food', 'coffee', 'pizza', 'banana', 'milk',
  'transport', 'fuel', 'travel', 'shopping', 'clothing', 'bills', 'rent', 'recharge', 'health', 'education', 'fun',
  'gift', 'salary', 'freelance', 'interest', 'investment', 'reward', 'social', 'cash', 'bank', 'coins',
  'juice', 'sweet', 'gadget', 'personalcare', 'workspace', 'subscription', 'repair',
  'receipt', 'settlement', 'cleanup', 'tag',
];

export function categoryKind(iconKey: string | undefined, name: string): string {
  const n = name.trim().toLowerCase();
  if (iconKey?.startsWith('kind:')) return iconKey.slice(5);
  // A name with its own drawing (Breakfast, Tea, ...) beats a generic key like "restaurant".
  if (SPECIFIC_NAME_KINDS.has(n)) return NAME_TO_KIND[n];
  return (iconKey && KEY_TO_KIND[iconKey]) || NAME_TO_KIND[n] || 'tag';
}

export function kindTint(kind: string): string {
  return KIND_TINT[kind] ?? 'var(--c-sun-tint)';
}

// ── Accounts ──────────────────────────────────────────────────────────
const ACCOUNT_KIND: Record<string, string> = {
  credit_card: 'card', bank_account: 'bank', cash: 'cash', upi_wallet: 'wallet', investment: 'investment', other: 'wallet',
};
export function accountKind(type: string | undefined): string {
  return (type && ACCOUNT_KIND[type]) || 'wallet';
}

// ── Items (produce faces) ─────────────────────────────────────────────
const ITEM_KINDS = ['tomato', 'potato', 'onion', 'carrot', 'banana', 'milk', 'rice', 'egg'];
/** A drawn face for known produce ("Eggs" → egg), otherwise null. */
export function itemKind(name: string): string | null {
  const n = name.trim().toLowerCase();
  return ITEM_KINDS.find(k => n === k || n === `${k}s` || n === `${k}es` || n.startsWith(`${k} `))
    ?? ITEM_KEYWORDS.find(([word]) => n.includes(word))?.[1]
    ?? null;
}

// Things with a drawing that isn't named like the item: matched on a word in the name.
const ITEM_KEYWORDS: [string, string][] = [
  ['coffee', 'coffee'], ['petrol', 'fuel'], ['diesel', 'fuel'], ['biriyani', 'rice'], ['biryani', 'rice'],
  ['sandwich', 'snacks'], ['samosa', 'snacks'],
  ['trimmer', 'trimmer'], ['shampoo', 'shampoo'], ['dryer', 'dryer'], ['shoe rack', 'shoerack'], ['rasagulla', 'sweet'], ['rasgulla', 'sweet'],
  ['chana', 'chickpeas'], ['chickpea', 'chickpeas'], ['bean', 'bean'], ['rava', 'rava'], ['sugar', 'sugar'],
  ['cherrinet', 'router'], ['router', 'router'],
];
