import { NextResponse } from "next/server";
import { portfolio } from "@/data/portfolio";

// GET /api/portfolio: the same content the site renders, as JSON. No database involved.
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(portfolio);
}
