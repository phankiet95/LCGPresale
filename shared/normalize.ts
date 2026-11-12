/**
 * Customer name normalisation for matching (SRS 8.1):
 * drop "Co., Ltd.", "Corporation", "株式会社" and brackets, case/width-insensitive.
 * No imports: also loaded directly by Node in scripts/build-seed.ts.
 */
export function normalizeCustomerName(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/株式会社|有限会社/g, ' ')
    .replace(/\bco\.?\s*,?\s*ltd\.?/g, ' ')
    .replace(/\b(corporation|corp\.?|inc\.?|limited|ltd\.?)(?=\s|$|[()[\]（）])/g, ' ')
    .replace(/[()[\]{}（）「」『』【】]/g, ' ')
    .replace(/[.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
