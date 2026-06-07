import { INTERNAL_API_URL } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Same-origin SSE proxy: browser → here → NestJS. Pipes the stream straight through. */
export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  const upstream = await fetch(`${INTERNAL_API_URL}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    // @ts-expect-error Node fetch streaming flag
    duplex: 'half',
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
