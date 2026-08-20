import { describe, expect, it } from 'vitest';
import { mortgagePayment, parseInterestRateRows } from './index.js';

describe('mortgagePayment', () => {
  it('handles a zero interest loan', () => {
    expect(mortgagePayment({ principal: 120_000, annualRate: 0, years: 10 })).toBe(1_000);
  });

  it('calculates a standard amortising payment', () => {
    expect(mortgagePayment({ principal: 500_000, annualRate: 3, years: 25 })).toBeCloseTo(
      2371.06,
      1,
    );
  });
});

describe('parseInterestRateRows', () => {
  it('normalises and orders official data.gov.sg monthly columns', () => {
    const payload = {
      result: {
        records: [
          {
            DataSeries: 'Compounded Singapore Overnight Rate Average (SORA) - 3 Month',
            '2025 Dec': '1.25',
            '2026Jan': '1.10',
            '2026Feb': 'na',
            _id: 1,
          },
        ],
      },
    };

    expect(parseInterestRateRows(payload)).toEqual([
      {
        name: 'Compounded Singapore Overnight Rate Average (SORA) - 3 Month',
        unit: 'per cent per annum',
        observations: [
          { period: '2026-01', value: 1.1 },
          { period: '2025-12', value: 1.25 },
        ],
      },
    ]);
  });

  it('returns an empty list for malformed upstream data', () => {
    expect(parseInterestRateRows({ result: { records: null } })).toEqual([]);
  });

  it('rejects a data.gov.sg application-error envelope', () => {
    expect(() => parseInterestRateRows({ code: 13, errorMsg: 'not available' })).toThrow(
      'not available',
    );
  });
});
