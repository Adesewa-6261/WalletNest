import { NextResponse } from "next/server";
import spec from "@/docs/openapi.json";

// The spec describes how to authenticate; requiring authentication to read it
// would be a locked door with the instructions nailed to the inside. Public,
// and cacheable — it only changes on deploy.
export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
