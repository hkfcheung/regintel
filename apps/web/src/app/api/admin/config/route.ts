import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@regintel/database";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: key, value" },
        { status: 400 }
      );
    }

    const config = await prisma.appConfig.update({
      where: { key },
      data: { value },
    });

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error("Error updating config:", error);
    return NextResponse.json(
      { error: "Failed to update configuration" },
      { status: 500 }
    );
  }
}
