describe('torob price helpers', () => {
  /** Mirror of TorobService.toToman — Rial → Toman */
  function toToman(rial: number | null | undefined): number {
    if (rial == null || !Number.isFinite(rial) || rial <= 0) return 0;
    return Math.max(0, Math.round(rial / 10));
  }

  it('converts rial to toman', () => {
    expect(toToman(1_000_000)).toBe(100_000);
    expect(toToman(15)).toBe(2);
    expect(toToman(0)).toBe(0);
    expect(toToman(null)).toBe(0);
  });
});
