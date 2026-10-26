import { PropertyStatus } from '../../generated/prisma/enums';
import {
  canTransition,
  formatCoordinate,
  formatMoney,
  normalizeDecimal,
} from './property-rules';

describe('property rules', () => {
  it('keeps money and coordinates at a fixed scale', () => {
    expect(formatMoney('4250000.5')).toBe('4250000.50');
    expect(formatMoney(4250000)).toBe('4250000.00');
    expect(formatCoordinate('37.87')).toBe('37.870000');
    expect(normalizeDecimal(4250000.5, 2)).toBe('4250000.50');
    expect(normalizeDecimal('37.87', 6)).toBe('37.870000');
  });

  it('rejects extra fractional digits instead of rounding them', () => {
    expect(normalizeDecimal('1.239', 2)).toBe('1.239');
    expect(normalizeDecimal(1.239, 2)).toBe(1.239);
  });

  it('allows only the listing transitions', () => {
    expect(canTransition(PropertyStatus.ACTIVE, PropertyStatus.INACTIVE)).toBe(
      true,
    );
    expect(canTransition(PropertyStatus.ACTIVE, PropertyStatus.SOLD)).toBe(
      true,
    );
    expect(canTransition(PropertyStatus.ACTIVE, PropertyStatus.RENTED)).toBe(
      true,
    );
    expect(canTransition(PropertyStatus.INACTIVE, PropertyStatus.ACTIVE)).toBe(
      true,
    );
    expect(canTransition(PropertyStatus.SOLD, PropertyStatus.ACTIVE)).toBe(
      true,
    );
    expect(canTransition(PropertyStatus.RENTED, PropertyStatus.ACTIVE)).toBe(
      true,
    );
    expect(canTransition(PropertyStatus.SOLD, PropertyStatus.RENTED)).toBe(
      false,
    );
    expect(canTransition(PropertyStatus.INACTIVE, PropertyStatus.SOLD)).toBe(
      false,
    );
    expect(canTransition(PropertyStatus.ACTIVE, PropertyStatus.ACTIVE)).toBe(
      false,
    );
  });
});
