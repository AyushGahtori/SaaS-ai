import { NextRequest, NextResponse } from "next/server";
import { getProviderConnection } from "@/lib/agents/user-access.server";
import { verifyFirebaseRequest } from "@/lib/server-auth";

type DriveFile = {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
    webViewLink?: string;
    iconLink?: string;
    size?: string;
};

export async function GET(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connection = await getProviderConnection(verifiedUser.uid, "google");
    if (!connection?.accessToken) {
        return NextResponse.json(
            { error: "Google Drive is not connected. Connect Google Bundle first." },
            { status: 403 }
        );
    }

    const query = req.nextUrl.searchParams.get("q")?.trim() || "";
    const pageSizeRaw = Number.parseInt(req.nextUrl.searchParams.get("pageSize") || "20", 10);
    const pageSize = Number.isFinite(pageSizeRaw)
        ? Math.max(1, Math.min(pageSizeRaw, 20))
        : 20;

    const queryParts = ["trashed = false"];
    if (query) {
        const escaped = query.replace(/'/g, "\\'");
        queryParts.push(`name contains '${escaped}'`);
    }

    const driveUrl = new URL("https://www.googleapis.com/drive/v3/files");
    driveUrl.searchParams.set("pageSize", String(pageSize));
    driveUrl.searchParams.set("orderBy", "modifiedTime desc");
    driveUrl.searchParams.set(
        "fields",
        "files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size)"
    );
    driveUrl.searchParams.set("q", queryParts.join(" and "));

    const response = await fetch(driveUrl.toString(), {
        headers: { Authorization: `Bearer ${connection.accessToken}` },
    });

    if (!response.ok) {
        const detail = await response.text();
        return NextResponse.json(
            {
                error: `Failed to fetch Drive files (${response.status}). ${detail || ""}`.trim(),
            },
            { status: response.status }
        );
    }

    const payload = (await response.json()) as { files?: DriveFile[] };
    return NextResponse.json({ files: payload.files || [] });
}

