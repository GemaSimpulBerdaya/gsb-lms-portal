import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { SubCategory } from "@/models/SubCategory";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  try {
    await connectDB();
    const subs = await SubCategory.find().sort({ type: 1, order: 1, name: 1 });
    return NextResponse.json({ subCategories: subs });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    await connectDB();
    const sub = await SubCategory.create(body);
    return NextResponse.json({ subCategory: sub });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, ...data } = body;
    await connectDB();
    const sub = await SubCategory.findByIdAndUpdate(id, data, { new: true });
    return NextResponse.json({ subCategory: sub });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    await connectDB();
    await SubCategory.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}
