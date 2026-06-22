import { NextRequest, NextResponse } from "next/server";
import { getWalletData } from "@/app/lib/alchemy";

// GET /api/wallet/0x123...
// Runs server-side. The browser calls this; this calls Alchemy.
// That way the Alchemy API key never reaches the user's browser.
export async function GET(
  _request: NextRequest,
  { params }: { params: { address: string } }
) {
  const { address } = params;

  if (!address) {
    return NextResponse.json(
      { error: "No address provided" },
      { status: 400 }
    );
  }

  const data = await getWalletData(address);
  return NextResponse.json(data);
}
