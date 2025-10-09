import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@regintel/database";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { backgroundEnabled, backgroundType, backgroundGradient, backgroundCircles, backgroundImage } = body;

    // Upsert each config value
    await Promise.all([
      prisma.appConfig.upsert({
        where: { key: "backgroundEnabled" },
        update: { value: backgroundEnabled },
        create: {
          key: "backgroundEnabled",
          value: backgroundEnabled,
          category: "appearance",
          label: "Background Enabled",
          helpText: "Enable or disable decorative background on home page",
        },
      }),
      prisma.appConfig.upsert({
        where: { key: "backgroundType" },
        update: { value: backgroundType },
        create: {
          key: "backgroundType",
          value: backgroundType,
          category: "appearance",
          label: "Background Type",
          helpText: "Type of background: gradient or image",
        },
      }),
      prisma.appConfig.upsert({
        where: { key: "backgroundGradient" },
        update: { value: backgroundGradient },
        create: {
          key: "backgroundGradient",
          value: backgroundGradient,
          category: "appearance",
          label: "Background Gradient",
          helpText: "Tailwind gradient classes for background",
        },
      }),
      prisma.appConfig.upsert({
        where: { key: "backgroundCircles" },
        update: { value: backgroundCircles },
        create: {
          key: "backgroundCircles",
          value: backgroundCircles,
          category: "appearance",
          label: "Background Circles",
          helpText: "JSON array of decorative circles",
        },
      }),
      prisma.appConfig.upsert({
        where: { key: "backgroundImage" },
        update: { value: backgroundImage || "" },
        create: {
          key: "backgroundImage",
          value: backgroundImage || "",
          category: "appearance",
          label: "Background Image",
          helpText: "URL of uploaded background image",
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save appearance config:", error);
    return NextResponse.json(
      { error: "Failed to save configuration" },
      { status: 500 }
    );
  }
}
