import { NextRequest, NextResponse } from "next/server";
import {
    MAX_UPLOAD_BYTES,
    persistUploadedDoc,
    type UploadedDocSource,
} from "@/lib/uploads/uploaded-docs.server";
import { verifyFirebaseRequest } from "@/lib/server-auth";

type UploadBody = {
    source?: UploadedDocSource;
    name?: string;
    mimeType?: string;
    size?: number;
    driveFileId?: string;
    webViewLink?: string;
    dataBase64?: string;
};

function normalizeSource(value: unknown): UploadedDocSource | null {
    if (value === "computer" || value === "drive") return value;
    return null;
}

export async function POST(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as UploadBody;
    const source = normalizeSource(body.source);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const mimeType =
        typeof body.mimeType === "string" && body.mimeType.trim()
            ? body.mimeType.trim()
            : "application/octet-stream";
    const size = Number(body.size || 0);

    if (!source) {
        return NextResponse.json({ error: "Invalid upload source." }, { status: 400 });
    }
    if (!name) {
        return NextResponse.json({ error: "File name is required." }, { status: 400 });
    }
    if (!Number.isFinite(size) || size <= 0) {
        return NextResponse.json({ error: "File size is required." }, { status: 400 });
    }
    if (size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
            { error: "File is too large. Maximum allowed size is 20MB." },
            { status: 400 }
        );
    }

    const dataBase64 =
        typeof body.dataBase64 === "string" && body.dataBase64.trim()
            ? body.dataBase64
            : undefined;

    if (source === "computer" && !dataBase64) {
        return NextResponse.json(
            { error: "Computer uploads require file data." },
            { status: 400 }
        );
    }
    if (source === "drive" && !body.driveFileId) {
        return NextResponse.json(
            { error: "Drive uploads require driveFileId." },
            { status: 400 }
        );
    }

    try {
        const persisted = await persistUploadedDoc({
            uid: verifiedUser.uid,
            source,
            name,
            mimeType,
            size,
            driveFileId: typeof body.driveFileId === "string" ? body.driveFileId : undefined,
            webViewLink: typeof body.webViewLink === "string" ? body.webViewLink : undefined,
            dataBase64,
        });

        return NextResponse.json({
            status: "success",
            uploadedDocId: persisted.docId,
            storagePath: persisted.storagePath,
            expiresAt: persisted.expiresAt,
        });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Failed to store uploaded file.";
        const isStorageProvisioningIssue =
            message.toLowerCase().includes("bucket") &&
            (message.toLowerCase().includes("not provisioned") ||
                message.toLowerCase().includes("does not exist"));
        return NextResponse.json(
            { error: message },
            { status: isStorageProvisioningIssue ? 503 : 500 }
        );
    }
}
