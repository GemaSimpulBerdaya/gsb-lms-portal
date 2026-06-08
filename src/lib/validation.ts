import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

export type ParsedBody<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<ParsedBody<T>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json({ error: "Payload JSON tidak valid" }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(body);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  return {
    success: false,
    response: NextResponse.json(
      { error: formatZodError(parsed.error) },
      { status: 400 },
    ),
  };
}

function formatZodError(error: ZodError): string {
  const first = error.issues[0];
  if (!first) return "Payload tidak valid";

  const field = first.path.join(".");
  return field ? `${field}: ${first.message}` : first.message;
}
