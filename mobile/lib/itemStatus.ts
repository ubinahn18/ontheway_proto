import { colors } from './theme';

const STATUS_LABELS: Record<string, string> = {
  available: '모집중',
  selected: '배정 완료',
  delivered: '배송 완료 (확인 대기)',
  completed: '거래 완료',
  paid: '결제 완료',
  expired: '마감',
};

const STATUS_COLORS: Record<string, { text: string; background: string }> = {
  available: { text: colors.primary, background: colors.primaryLight },
  selected: { text: colors.warning, background: colors.warningLight },
  delivered: { text: colors.info, background: colors.infoLight },
  completed: { text: colors.success, background: colors.successLight },
  paid: { text: colors.success, background: colors.successLight },
  expired: { text: colors.danger, background: colors.dangerLight },
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function statusColor(status: string): { text: string; background: string } {
  return STATUS_COLORS[status] ?? { text: colors.textSecondary, background: colors.border };
}
