// NextAuth.js catch-all route
// TODO: export { GET, POST } from lib/auth once NextAuth is configured

export function GET() {
  return new Response('NextAuth not yet configured', { status: 501 });
}

export function POST() {
  return new Response('NextAuth not yet configured', { status: 501 });
}
