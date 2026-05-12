import { NextResponse } from "next/server";

// Serves the Apple Pay merchant domain association file required by Apple Pay JS API.
// The file content is provided by Mercado Pago DevPanel (or directly from Apple).
// Configure APPLE_PAY_DOMAIN_ASSOCIATION_FILE with the exact file content as an env var.
// In sandbox: obtain from Mercado Pago DevPanel under the Apple Pay sandbox configuration.
// The domain serving this endpoint must be registered with Mercado Pago and verified by Apple.
export async function GET() {
  const fileContent = process.env.APPLE_PAY_DOMAIN_ASSOCIATION_FILE ?? "";
  if (!fileContent) {
    return new NextResponse("Apple Pay domain association file not configured.", { status: 404 });
  }
  return new NextResponse(fileContent, {
    headers: { "Content-Type": "text/plain" },
  });
}
