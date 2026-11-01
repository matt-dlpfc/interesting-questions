// Small response helpers shared by the functions.

export function json(body: unknown, init: ResponseInit = {}): Response {
  return Response.json(body, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...init.headers },
  });
}

export function error(status: number, message: string): Response {
  return json({ error: message }, { status });
}
