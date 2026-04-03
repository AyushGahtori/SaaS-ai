import { NextResponse } from "next/server";

export async function GET() {
    const clientId =
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
        process.env.GOOGLE_CLIENT_ID?.trim() ||
        "";

    if (!clientId) {
        return NextResponse.json(
            { error: "Google client id is not configured for Drive upload." },
            { status: 500 }
        );
    }

    return NextResponse.json({ clientId });
}

