import { NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";

export async function POST() {
  const auth = await apiRequireAdmin();
  if (isNextResponse(auth)) return auth;

  return NextResponse.json({ message: "Not implemented yet" }, { status: 501 });
}
