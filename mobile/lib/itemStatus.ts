const STATUS_LABELS: Record<string, string> = {
  available: '모집중',
  selected: '배정 완료',
  delivered: '배송 완료 (확인 대기)',
  completed: '거래 완료',
  paid: '결제 완료',
  expired: '마감',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
