import {
  minEffectiveVariantPrice,
  pickEffectivePrice,
  priceAmounts,
  sameMoney,
} from './effective-price';

describe('pickEffectivePrice', () => {
  const base = new Date('2026-06-15T12:00:00.000Z');

  it('returns null for empty list', () => {
    expect(pickEffectivePrice([])).toBeNull();
    expect(pickEffectivePrice(null)).toBeNull();
  });

  it('picks latest effectiveFrom that is not in the future', () => {
    const prices = [
      {
        amount: '100',
        isActive: true,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        amount: '200',
        isActive: true,
        effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
        createdAt: new Date('2026-05-20T00:00:00.000Z'),
      },
      {
        amount: '50',
        isActive: true,
        effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
        createdAt: new Date('2026-06-10T00:00:00.000Z'),
      },
    ];
    const picked = pickEffectivePrice(prices, base);
    expect(picked?.amount).toBe('200');
  });

  it('ignores inactive and soft-deleted rows', () => {
    const prices = [
      {
        amount: '100',
        isActive: false,
        effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      },
      {
        amount: '150',
        isActive: true,
        deletedAt: new Date('2026-06-02T00:00:00.000Z'),
        effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      },
      {
        amount: '90',
        isActive: true,
        effectiveFrom: new Date('2026-05-01T00:00:00.000Z'),
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    ];
    expect(pickEffectivePrice(prices, base)?.amount).toBe('90');
  });

  it('breaks ties with createdAt', () => {
    const prices = [
      {
        amount: '1',
        isActive: true,
        effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
        createdAt: new Date('2026-06-01T10:00:00.000Z'),
      },
      {
        amount: '2',
        isActive: true,
        effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
        createdAt: new Date('2026-06-01T12:00:00.000Z'),
      },
    ];
    expect(pickEffectivePrice(prices, base)?.amount).toBe('2');
  });

  it('falls back to createdAt when effectiveFrom missing', () => {
    const prices = [
      {
        amount: '10',
        isActive: true,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
      {
        amount: '20',
        isActive: true,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ];
    expect(pickEffectivePrice(prices, base)?.amount).toBe('20');
  });
});

describe('priceAmounts / minEffectiveVariantPrice / sameMoney', () => {
  it('parses amounts', () => {
    expect(
      priceAmounts({
        amount: '1000.50',
        compareAtAmount: '2000',
        currency: 'IRR',
      }),
    ).toEqual({
      amount: 1000.5,
      compareAtAmount: 2000,
      currency: 'IRR',
    });
  });

  it('picks cheapest effective among variants', () => {
    const result = minEffectiveVariantPrice(
      [
        {
          isActive: true,
          prices: [
            {
              amount: '500',
              isActive: true,
              effectiveFrom: new Date('2026-01-01'),
              createdAt: new Date('2026-01-01'),
            },
          ],
        },
        {
          isActive: true,
          prices: [
            {
              amount: '300',
              compareAtAmount: '400',
              isActive: true,
              effectiveFrom: new Date('2026-01-01'),
              createdAt: new Date('2026-01-01'),
            },
          ],
        },
        {
          isActive: false,
          prices: [
            {
              amount: '100',
              isActive: true,
              effectiveFrom: new Date('2026-01-01'),
              createdAt: new Date('2026-01-01'),
            },
          ],
        },
      ],
      new Date('2026-06-01'),
    );
    expect(result.price).toBe(300);
    expect(result.compareAtPrice).toBe(400);
  });

  it('sameMoney compares decimals safely', () => {
    expect(sameMoney('100.00', 100)).toBe(true);
    expect(sameMoney(null, null)).toBe(true);
    expect(sameMoney('100', '101')).toBe(false);
  });
});
