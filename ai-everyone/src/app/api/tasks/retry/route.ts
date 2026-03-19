// src/app/api/tasks/retry/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { executeAgentTask } from "@/lib/firestore-tasks.server";
import type { AgentTask } from "@/lib/firestore-tasks";

export async function POST(req: NextRequest) {
    try {
        const { taskId } = await req.json();
        
        if (!taskId) {
            return NextResponse.json({ error: "taskId is required" }, { status: 400 });
        }

        const doc = await adminDb.collection("agentTasks").doc(taskId).get();
        if (!doc.exists) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        const task = doc.data() as AgentTask;
        
        // Trigger background execution
        executeAgentTask(task).catch(err => {
            console.error("[Task Retry Error]", err);
        });

        return NextResponse.json({ success: true, message: "Task retry initiated" });
    } catch (e: any) {
        console.error("[Retry API Error]", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
