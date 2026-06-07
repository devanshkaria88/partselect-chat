import { INTERNAL_API_URL } from '@/lib/api';

export const runtime = 'nodejs';

const ALLOWED = new Set(['add', 'set-qty', 'checkout']);

/** Same-origin proxy for the direct (agent-free) cart endpoints. */
export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }): Promise<Response> {
  const { action } = await ctx.params;
  if (!ALLOWED.has(action)) return new Response('not found', { status: 404 });
  const body = await req.text();
  const upstream = await fetch(`${INTERNAL_API_URL}/cart/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
