import { INTERNAL_API_URL } from '@/lib/api';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  try {
    await fetch(`${INTERNAL_API_URL}/session/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch {
    /* best effort */
  }
  return Response.json({ ok: true });
}
