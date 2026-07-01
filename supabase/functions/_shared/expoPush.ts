export async function sendExpoPush(to: string, title: string, body: string, data?: Record<string, unknown>) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to, title, body, data }),
  });
}
