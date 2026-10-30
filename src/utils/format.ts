export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** "1 kg", "500 g", "2" — empty when neither part is set. */
export function formatQty(quantity?: number, unit?: string) {
  return [quantity, unit].filter((p) => p !== undefined && p !== '').join(' ');
}
