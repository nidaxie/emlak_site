export const adminPalette = {
  brand: '#174D3C',
  positive: '#329A78',
  info: '#5486C5',
  pending: '#E7B74F',
  neutral: '#9CA3AF',
  neutralText: '#4B5563',
  danger: '#D76B6B',
  analytic: '#8065B8',
  ink: '#1F2933',
} as const;

export const roleColor: Record<'USER' | 'AGENT' | 'ADMIN', string> = {
  USER: adminPalette.info,
  AGENT: adminPalette.positive,
  ADMIN: adminPalette.analytic,
};

export const listingStatusColor = {
  active: adminPalette.positive,
  inactive: adminPalette.neutral,
  sold: adminPalette.info,
  rented: adminPalette.analytic,
} as const;

export const applicationStatusColor = {
  DRAFT: adminPalette.info,
  PENDING: adminPalette.pending,
  APPROVED: adminPalette.positive,
  REJECTED: adminPalette.danger,
} as const;
