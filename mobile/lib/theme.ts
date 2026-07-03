export const colors = {
  primary: '#2F6FED',
  primaryDark: '#1E54C7',
  primaryLight: '#EAF1FF',
  background: '#F7F8FB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textInverse: '#FFFFFF',
  success: '#16A34A',
  successLight: '#E9F9EF',
  warning: '#F59E0B',
  warningLight: '#FFF6E5',
  info: '#7C3AED',
  infoLight: '#F2EBFE',
  danger: '#DC2626',
  dangerLight: '#FDECEC',
  kakaoYellow: '#FEE500',
  kakaoText: '#3C1E1E',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.textPrimary },
  subtitle: { fontSize: 16, fontWeight: '600' as const, color: colors.textPrimary },
  body: { fontSize: 14, fontWeight: '400' as const, color: colors.textPrimary },
  caption: { fontSize: 12, fontWeight: '400' as const, color: colors.textSecondary },
  price: { fontSize: 18, fontWeight: '700' as const, color: colors.textPrimary },
};

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;
