/** List (select) and color attributes of one chosen variant, in display order. */
export type VariantDisplayAttr = {
  name: string;
  slug: string;
  value: string;
  type: string | null;
  colorCode: string | null;
  displayOrder: number;
};

export function mapVariantDisplayAttrs(variant: {
  variantAttributeValues?: Array<{
    attributeValue?: {
      value?: string | null;
      colorCode?: string | null;
      attribute?: {
        name?: string | null;
        slug?: string | null;
        type?: string | null;
        displayOrder?: number | null;
      } | null;
    } | null;
  }> | null;
} | null | undefined): VariantDisplayAttr[] {
  const rows: VariantDisplayAttr[] = [];
  for (const vav of variant?.variantAttributeValues || []) {
    const av = vav?.attributeValue;
    if (!av) continue;
    const value = String(av.value || '').trim();
    if (!value) continue;
    const attr = av.attribute;
    rows.push({
      name: attr?.name || '',
      slug: attr?.slug || '',
      value,
      type: attr?.type || null,
      colorCode: av.colorCode || null,
      displayOrder: Number(attr?.displayOrder ?? 0),
    });
  }
  rows.sort(
    (a, b) =>
      a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'fa'),
  );
  return rows;
}

const LIST_OR_COLOR = new Set(['select', 'color']);

/** "XL سفید" from the chosen variant. Title is only a fallback. */
export function variantListColorLabel(
  attributes: Array<{
    value?: string | null;
    type?: string | null;
    displayOrder?: number | null;
    name?: string | null;
  }> | null | undefined,
  variantTitle?: string | null,
): string {
  const rows = [...(attributes || [])]
    .filter((a) => {
      const value = String(a.value || '').trim();
      if (!value) return false;
      const type = String(a.type || '').trim().toLowerCase();
      if (!type) return true;
      return LIST_OR_COLOR.has(type);
    })
    .sort(
      (a, b) =>
        Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0) ||
        String(a.name || '').localeCompare(String(b.name || ''), 'fa'),
    );
  const text = rows.map((a) => String(a.value || '').trim()).join(' ');
  if (text) return text;
  return String(variantTitle || '').trim();
}
