// supabase errors (PostgrestError, AuthError, FunctionsHttpError, ...) are
// plain objects with a message field, not Error instances — String(e) on
// those yields the useless "[object Object]" instead of the real message
export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (
    typeof e === 'object' &&
    e !== null &&
    'message' in e &&
    typeof (e as { message: unknown }).message === 'string'
  ) {
    return (e as { message: string }).message;
  }
  return String(e);
}
