import { adminDb } from "@/lib/firebase-admin";
import { readRestaurantWorkspaceMemoryFromChatRecord } from "@/lib/agents/restaurant-workspace-memory.server";
import { readShelfieWorkspaceMemoryFromChatRecord } from "@/lib/agents/shelfie-workspace-memory.server";
import type {
    ConversationContext,
    IndexedEntity,
    RecentMessageContext,
} from "./types";
import { compactString } from "./text";

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRecord(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
}

function asString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function getTimestampMillis(value: unknown): number {
    if (value && typeof value === "object" && "toMillis" in value) {
        const toMillis = (value as { toMillis?: () => number }).toMillis;
        if (typeof toMillis === "function") {
            const millis = Number(toMillis.call(value));
            return Number.isFinite(millis) ? millis : 0;
        }
    }
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function compactTask(task: Record<string, unknown>): Record<string, unknown> {
    const agentInput = asRecord(task.agentInput);
    const output = asRecord(task.agentOutput);
    const result = asRecord(output.result);
    const uiPayload = asRecord(output.ui_payload);
    return {
        taskId: asString(task.taskId),
        agentId: asString(task.agentId),
        status: asString(task.status),
        action: asString(agentInput.action) || asString(output.action),
        agentInput: {
            action: agentInput.action,
            agent_type: agentInput.agent_type,
            message_id: agentInput.message_id,
            file_id: agentInput.file_id,
            parameters: compactString(agentInput.parameters, 240),
        },
        output: {
            type: asString(output.type),
            action: asString(output.action),
            summary: compactString(output.summary || output.message || output.error, 500),
            result,
            ui_payload: uiPayload,
        },
    };
}

function findArrayPayload(
    output: Record<string, unknown>,
    keys: string[]
): unknown[] {
    for (const key of keys) {
        const direct = output[key];
        if (Array.isArray(direct)) return direct;
    }

    const result = asRecord(output.result);
    for (const key of keys) {
        const nested = result[key];
        if (Array.isArray(nested)) return nested;
    }

    const originalResult = asRecord(output.originalResult);
    const originalNested = asRecord(originalResult.result);
    for (const key of keys) {
        const nested = originalNested[key];
        if (Array.isArray(nested)) return nested;
    }

    return [];
}

function emailEntity(
    item: Record<string, unknown>,
    index: number,
    task: Record<string, unknown>
): IndexedEntity | null {
    const id = asString(item.id) || asString(item.message_id);
    if (!id) return null;
    return {
        index,
        id,
        message_id: id,
        thread_id: asString(item.threadId) || asString(item.thread_id) || null,
        kind: "gmail_email",
        agentId: "google-agent",
        action: asString(asRecord(task.agentInput).action) || asString(asRecord(task.agentOutput).action),
        sender: asString(item.from) || asString(item.sender),
        subject: asString(item.subject),
        snippet: asString(item.snippet),
        date: asString(item.date),
        raw: item,
    };
}

function driveEntity(
    item: Record<string, unknown>,
    index: number,
    task: Record<string, unknown>
): IndexedEntity | null {
    const id = asString(item.id) || asString(item.file_id);
    const name = asString(item.name) || asString(item.title);
    if (!id && !name) return null;
    return {
        index,
        id: id || name,
        kind: "drive_file",
        agentId: "google-agent",
        action: asString(asRecord(task.agentInput).action) || asString(asRecord(task.agentOutput).action),
        name,
        title: name,
        snippet: asString(item.mimeType) || asString(item.type),
        date: asString(item.modifiedTime) || asString(item.date),
        raw: item,
    };
}

function todoEntity(
    item: Record<string, unknown>,
    index: number,
    task: Record<string, unknown>
): IndexedEntity | null {
    const id = asString(item.id) || asString(item._id) || asString(item.task_id);
    const title = asString(item.title) || asString(item.name);
    if (!id && !title) return null;
    return {
        index,
        id: id || title,
        kind: "todo_task",
        agentId: asString(task.agentId) || "todo-agent",
        action: asString(asRecord(task.agentInput).action) || asString(asRecord(task.agentOutput).action),
        title,
        name: title,
        date: asString(item.datetime) || asString(item.date),
        raw: item,
    };
}

function appendUniqueEntity(target: IndexedEntity[], entity: IndexedEntity | null): void {
    if (!entity) return;
    const key = `${entity.kind}:${entity.id}`;
    if (target.some((item) => `${item.kind}:${item.id}` === key)) return;
    target.push({ ...entity, index: target.length + 1 });
}

function buildEntityIndex(tasksNewestFirst: Record<string, unknown>[]): ConversationContext["entity_index"] {
    const index: ConversationContext["entity_index"] = {
        gmail_emails: [],
        drive_files: [],
        todo_tasks: [],
        generic_items: [],
    };

    for (const task of tasksNewestFirst) {
        const agentId = asString(task.agentId);
        const output = asRecord(task.agentOutput);
        const agentInput = asRecord(task.agentInput);
        const agentType = asString(agentInput.agent_type) || asString(output.agent_type);
        const type = asString(output.type);

        if (agentId === "google-agent" && (agentType === "gmail" || type === "google_gmail")) {
            const emails = findArrayPayload(output, ["emails"]);
            for (const item of emails) {
                if (isRecord(item)) appendUniqueEntity(index.gmail_emails, emailEntity(item, index.gmail_emails.length + 1, task));
            }
            continue;
        }

        if (agentId === "google-agent" && (agentType === "drive" || type === "google_drive")) {
            const files = findArrayPayload(output, ["files", "documents"]);
            for (const item of files) {
                if (isRecord(item)) appendUniqueEntity(index.drive_files, driveEntity(item, index.drive_files.length + 1, task));
            }
            continue;
        }

        if (agentId === "todo-agent" || agentId === "day-planner-agent") {
            const tasks = findArrayPayload(output, ["tasks", "items", "plans"]);
            for (const item of tasks) {
                if (isRecord(item)) appendUniqueEntity(index.todo_tasks, todoEntity(item, index.todo_tasks.length + 1, task));
            }
        }
    }

    return index;
}

function buildRecentAgentOutputs(tasksNewestFirst: Record<string, unknown>[]): Record<string, unknown> {
    const outputs: Record<string, unknown> = {};

    for (const task of tasksNewestFirst) {
        const agentId = asString(task.agentId);
        if (!agentId || outputs[agentId]) continue;

        const output = asRecord(task.agentOutput);
        const result = asRecord(output.result);
        outputs[agentId] = {
            status: asString(task.status),
            action: asString(asRecord(task.agentInput).action) || asString(output.action),
            type: asString(output.type),
            summary: compactString(output.summary || output.message || output.error, 700),
            result,
        };

        if (agentId === "google-agent") {
            const agentInput = asRecord(task.agentInput);
            const agentType = asString(agentInput.agent_type) || asString(output.agent_type);
            if (agentType === "gmail" || asString(output.type) === "google_gmail") {
                outputs.gmail = {
                    action: asString(agentInput.action) || asString(output.action),
                    emails: findArrayPayload(output, ["emails"]).slice(0, 20),
                    last_result: result,
                };
            }
            if (agentType === "drive" || asString(output.type) === "google_drive") {
                outputs.drive = {
                    action: asString(agentInput.action) || asString(output.action),
                    files: findArrayPayload(output, ["files", "documents"]).slice(0, 20),
                    last_result: result,
                };
            }
        }
    }

    return outputs;
}

function findLastReferencedEntity(tasksNewestFirst: Record<string, unknown>[]): IndexedEntity | null {
    for (const task of tasksNewestFirst) {
        const agentInput = asRecord(task.agentInput);
        const output = asRecord(task.agentOutput);
        const agentId = asString(task.agentId);
        const messageId = asString(agentInput.message_id) || asString(asRecord(output.result).id);
        if (agentId === "google-agent" && messageId) {
            return {
                index: Number(agentInput.row_index || 0) || 1,
                id: messageId,
                message_id: messageId,
                kind: "gmail_email",
                agentId,
                action: asString(agentInput.action) || asString(output.action),
                subject: asString(asRecord(output.result).subject),
                sender: asString(asRecord(output.result).from),
                raw: asRecord(output.result),
            };
        }
    }
    return null;
}

function extractRestaurantSnapshotsFromTasks(tasksNewestFirst: Record<string, unknown>[]): {
    order_snapshot: Record<string, unknown> | null;
    session_snapshot: Record<string, unknown> | null;
} {
    for (const task of tasksNewestFirst) {
        if (asString(task.agentId) !== "restaurant-concierge-agent") continue;
        const output = asRecord(task.agentOutput);
        const result = asRecord(output.result);

        const order = asRecord(result.order);
        const session = asRecord(result.session);

        return {
            order_snapshot: Object.keys(order).length > 0 ? order : null,
            session_snapshot: Object.keys(session).length > 0 ? session : null,
        };
    }

    return {
        order_snapshot: null,
        session_snapshot: null,
    };
}

export async function loadConversationContext(params: {
    userId: string;
    chatId: string;
    recentMessages?: RecentMessageContext[];
}): Promise<ConversationContext> {
    const recentMessages = (params.recentMessages || [])
        .slice(-12)
        .map((message) => ({
            role: message.role,
            content: compactString(message.content, 900),
            taskId: message.taskId,
            agentId: message.agentId,
        }));

    let taskRows: Record<string, unknown>[] = [];
    let chatMemory: Record<string, unknown> = {};
    if (params.chatId) {
        try {
            const chatSnapshot = await adminDb
                .collection("users")
                .doc(params.userId)
                .collection("chats")
                .doc(params.chatId)
                .get();
            if (chatSnapshot.exists) {
                chatMemory = asRecord(chatSnapshot.data());
            }

            const snapshot = await adminDb
                .collection("agentTasks")
                .where("chatId", "==", params.chatId)
                .limit(30)
                .get();

            taskRows = snapshot.docs
                .map((doc) => ({ taskId: doc.id, ...asRecord(doc.data()) } as Record<string, unknown>))
                .filter((task) => asString(task.userId) === params.userId)
                .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt))
                .slice(0, 12);
        } catch (error) {
            console.error("[LangGraphContext] failed to load recent tasks:", error);
        }
    }

    const recent_agent_tasks = taskRows.map(compactTask);
    const recent_agent_outputs = buildRecentAgentOutputs(taskRows);
    const entity_index = buildEntityIndex(taskRows);
    const lastTask = taskRows[0];
    const restaurantMemory = readRestaurantWorkspaceMemoryFromChatRecord(chatMemory);
    const shelfieMemory = readShelfieWorkspaceMemoryFromChatRecord(chatMemory);
    const restaurantSnapshots = extractRestaurantSnapshotsFromTasks(taskRows);

    return {
        recent_messages: recentMessages,
        recent_agent_tasks,
        recent_agent_outputs,
        entity_index,
        agent_workspace_memory: {
            restaurant_concierge: {
                menu_items: restaurantMemory.menu_items,
                updated_at: restaurantMemory.updated_at,
                order_snapshot: restaurantSnapshots.order_snapshot,
                session_snapshot: restaurantSnapshots.session_snapshot,
            },
            shelfie_grocery: {
                grocery_memory: shelfieMemory.grocery_memory,
                updated_at: shelfieMemory.updated_at,
            },
        },
        last_agent_id: lastTask ? asString(lastTask.agentId) : undefined,
        last_action: lastTask
            ? asString(asRecord(lastTask.agentInput).action) || asString(asRecord(lastTask.agentOutput).action)
            : undefined,
        last_referenced_entity: findLastReferencedEntity(taskRows),
    };
}
