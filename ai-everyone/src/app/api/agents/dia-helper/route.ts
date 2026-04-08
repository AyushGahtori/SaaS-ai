import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseRequest } from "@/lib/server-auth";

interface DiaHelperPayload {
    action: "generate_diagram" | "update_diagram";
    projectBrief?: string;
    editInstruction?: string;
    currentMermaid?: string;
    fileSnippet?: string;
    fileName?: string;
}

export async function POST(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: DiaHelperPayload;
    try {
        body = (await req.json()) as DiaHelperPayload;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const action = body.action;
    if (action !== "generate_diagram" && action !== "update_diagram") {
        return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }

    const projectContextParts: string[] = [];
    if (body.projectBrief?.trim()) {
        projectContextParts.push(body.projectBrief.trim());
    }
    if (body.fileName && body.fileSnippet) {
        projectContextParts.push(
            `File uploaded from Dia Helper UI: ${body.fileName}\n\nSnippet:\n${body.fileSnippet}`
        );
    }

    const agentPayload = {
        taskId: null,
        userId: verifiedUser.uid,
        agentId: "dia-helper-agent",
        action,
        prompt: body.projectBrief?.trim() || body.editInstruction?.trim() || "",
        projectContext: projectContextParts.join("\n\n"),
        diagramType: undefined,
        fileKey: undefined,
        currentMermaid: body.currentMermaid?.trim() || undefined,
        editInstruction: body.editInstruction?.trim() || undefined,
    };

    const baseUrl =
        process.env.DIA_HELPER_AGENT_URL ||
        process.env.AGENT_SERVER_URL ||
        "http://13.126.69.108";
    const url = `${baseUrl}/diahelper/action`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(agentPayload),
        });

        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (!response.ok) {
            return NextResponse.json(
                {
                    status: "failed",
                    error:
                        (data.error as string) ||
                        `Dia Helper agent returned HTTP ${response.status}.`,
                },
                { status: 502 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Dia Helper agent could not be reached.";
        return NextResponse.json(
            {
                status: "failed",
                error: `Cannot connect to Dia Helper agent: ${message}`,
            },
            { status: 502 }
        );
    }
}

