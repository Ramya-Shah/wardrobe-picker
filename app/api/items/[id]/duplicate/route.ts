import { NextResponse } from "next/server";
import { route } from "@/lib/api/http";
import { duplicateItem } from "@/lib/wardrobe/items";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (_request, { params }) => {
  const { id } = await params;
  const item = await duplicateItem(id);
  return NextResponse.json({ item }, { status: 201 });
});
