import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { SubCategory } from "@/models/SubCategory";
import { withAdmin } from "@/lib/apiAuth";

export const GET = withAdmin(async () => {
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
});

export const POST = withAdmin(async (request) => {
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
});

export const PUT = withAdmin(async (request) => {
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
});

export const DELETE = withAdmin(async (request) => {
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
});
