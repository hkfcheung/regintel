import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { url, type } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const apiBody: { url: string; type?: string } = { url };
    if (type && type !== "") {
      apiBody.type = type;
    }

    const response = await fetch(`${apiUrl}/ingest/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiBody),
    });

    // Check content type before parsing
    const contentType = response.headers.get("content-type");
    
    if (!contentType?.includes("application/json")) {
      const text = await response.text();
      console.error("Non-JSON response from API:", text.substring(0, 500));
      return NextResponse.json(
        { error: "API returned invalid response (HTML instead of JSON). Check if the API service is running correctly." },
        { status: 502 }
      );
    }

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: result.error || "Failed to trigger ingest" },
        { status: response.status }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error triggering ingest:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}