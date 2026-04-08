import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseRequest } from "@/lib/server-auth";
import { resolveBloomModel } from "@/modules/bloom-ai/lib/gemini";
import { updateBloomSettingsDoc } from "@/modules/bloom-ai/lib/server";

export async function PATCH(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const settings = await updateBloomSettingsDoc(verifiedUser.uid, {
            ...(typeof body.modelId === "string" ? { modelId: resolveBloomModel(body.modelId) } : {}),
            ...(body.dataAccess && typeof body.dataAccess === "object"
                ? {
                      dataAccess: {
                          ...(typeof body.dataAccess.notes === "boolean"
                              ? { notes: body.dataAccess.notes }
                              : {}),
                          ...(typeof body.dataAccess.habits === "boolean"
                              ? { habits: body.dataAccess.habits }
                              : {}),
                          ...(typeof body.dataAccess.journal === "boolean"
                              ? { journal: body.dataAccess.journal }
                              : {}),
                      },
                  }
                : {}),
        });

        return NextResponse.json({ settings });
    } catch (error) {
        console.error("[Bloom Settings PATCH]", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update Bloom AI settings." },
            { status: 500 }
        );
    }
}
