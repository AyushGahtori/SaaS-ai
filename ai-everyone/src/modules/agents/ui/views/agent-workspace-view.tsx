"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  Loader2,
  MessageSquarePlus,
  NotebookPen,
  PencilLine,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { getAgentById, type Agent } from "@/lib/firestore-agents";
import { getAgentCatalogEntry } from "@/lib/agents/catalog";
import { getWorkspaceIntakeSchemaForAgent } from "@/lib/agents/workspace-intake";
import { getAgentDetailContent } from "@/modules/agents/data/agent-details";
import { ChatInput } from "@/modules/chat/ui/components/chat-input";
import { ChatMessageList } from "@/modules/chat/ui/components/chat-message-list";
import { useChatContext } from "@/modules/chat/context/chat-context";
import { cn } from "@/lib/utils";

interface AgentWorkspaceViewProps {
  agentId: string;
}

interface AgentStateResponse {
  installedAgentIds: string[];
  accessibleAgentIds: string[];
  connectedBundleIds: string[];
}

interface RestaurantMenuRow {
  id: string;
  name: string;
  price: string;
  contains: string;
  description: string;
}

interface ShelfieMemoryItemRow {
  id: string;
  name: string;
  quantity: string;
  purchased: boolean;
  finished: boolean;
}

interface ShelfieMemoryEntryRow {
  id: string;
  title: string;
  buyingDate: string;
  endDate: string;
  notes: string;
  items: ShelfieMemoryItemRow[];
}

async function getAuthHeaders() {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Authentication expired. Please sign in again.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function buildExamplePrompts(agent: Agent): string[] {
  const catalog = getAgentCatalogEntry(agent.id);
  const detail = getAgentDetailContent(agent.id);
  const examples = [
    ...(catalog?.examplePrompts || []),
    detail?.examplePrompt,
    agent.description,
  ].filter((item): item is string => Boolean(item && item.trim()));

  return Array.from(new Set(examples)).slice(0, 5);
}

function buildUseCases(agent: Agent): string[] {
  const catalog = getAgentCatalogEntry(agent.id);
  const detail = getAgentDetailContent(agent.id);
  const useCases = [
    ...(detail?.useCases || []),
    ...(catalog?.tags || agent.tags || []),
  ].filter(Boolean);

  return Array.from(new Set(useCases)).slice(0, 8);
}

const DEVIKA_ACTION_PROMPTS: Record<string, string> = {
  run_devika_agent: "Design a retry-safe webhook processor with idempotency keys.",
  plan_project: "Plan the architecture for a multi-tenant SaaS billing module.",
  research_plan: "Research best practices for multi-tenant RBAC in SaaS.",
  implement_feature: "Add optimistic UI updates with rollback when the API fails.",
  fix_bug: "Fix this bug: TypeError reading status from undefined.",
  run_project: "How should I run this Next.js app in staging with strict env validation?",
  deploy_project: "Give me a production deployment and rollback checklist for this API service.",
  generate_report: "Generate an engineering report for the payment retries module.",
  answer_question: "Why should we normalize agent action aliases before dispatch?",
  repo_intake: "Onboard this repo: https://github.com/example-org/service-core",
  browser_strategy: "Create a browser strategy for testing a multi-step signup and checkout flow.",
  list_snapshots: "Show my recent Devika snapshots.",
  agent_status: "Show the Devika agent status for my recent runs.",
  token_estimate: "Estimate tokens for this prompt before I send it to the coding agent.",
};

const DEVIKA_RUNTIME_NOTES = [
  "Prompt-driven actions use cache-aware responses, while live status and snapshots always stay fresh.",
  "Repository intake, browser strategy, token estimates, and snapshot history are all available from this one workspace.",
  "The workspace is hard-locked to Devika so engineering prompts never drift into unrelated agents.",
];

const RESTAURANT_ACTION_PROMPTS: Record<string, string> = {
  run_restaurant_concierge: "Add 2 chicken biryanis, 1 mango lassi, and tell me the current total.",
  browse_menu: "Show me the vegetarian mains menu.",
  search_menu: "Search the menu for paneer dishes.",
  get_item_details: "Tell me about Masala Dosa.",
  get_recommendations: "What do you recommend for a vegetarian dinner?",
  get_order_summary: "Show my current order summary.",
  get_session_analytics: "Show this restaurant session analytics and recent logs.",
  reset_session: "Reset my restaurant session and start fresh.",
  suggest_items: "Suggest likely menu items for 'biry'.",
  request_human_help: "Escalate this wrong-order complaint to a human teammate.",
  list_capabilities: "Show what this restaurant concierge can do.",
};

const RESTAURANT_RUNTIME_NOTES = [
  "This workspace stays locked to one restaurant ordering session, so order state and edits persist across messages.",
  "Use the Add Menu Items button beside the new chat button to define name, pricing, contents, and description for every menu item.",
  "Use the controls here for menu browsing, order review, recommendations, resets, and escalation without switching agents.",
  "The normal chat card stays compact, while the workspace conversation can expose session logs, actions, and richer order context.",
];

const SHELFIE_ACTION_PROMPTS: Record<string, string> = {
  run_shelfie_grocery_agent: "Plan a weekly high-protein grocery list for two adults under a moderate budget.",
  get_history: "Load history for session abc123-session.",
  list_sessions: "Show my recent Shelfie sessions.",
  reset_session: "Reset session abc123-session.",
  list_capabilities: "Show Shelfie Grocery capabilities.",
};

const SHELFIE_RUNTIME_NOTES = [
  "Shelfie keeps a session timeline so grocery planning can continue over multiple conversations.",
  "Store grocery cycles with buying date, end date, and item-level purchased/finished state for each chat.",
  "Redis cache and persistent history are used for fast recall, with safe fallbacks when infrastructure is unavailable.",
  "Use history and reset controls when you want to branch into a fresh shopping plan without losing other sessions.",
];

function formatActionLabel(action: string): string {
  return action
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatFieldLabel(label: string): string {
  return label.replace(/\s+/g, " ").trim();
}

function createRestaurantMenuRow(seed?: Partial<Omit<RestaurantMenuRow, "id">>): RestaurantMenuRow {
  return {
    id: `menu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: seed?.name || "",
    price: seed?.price || "",
    contains: seed?.contains || "",
    description: seed?.description || "",
  };
}

function createShelfieItemRow(seed?: Partial<Omit<ShelfieMemoryItemRow, "id">>): ShelfieMemoryItemRow {
  return {
    id: `shelfie_item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: seed?.name || "",
    quantity: seed?.quantity || "",
    purchased: Boolean(seed?.purchased),
    finished: Boolean(seed?.finished),
  };
}

function createShelfieEntryRow(
  seed?: Partial<Omit<ShelfieMemoryEntryRow, "id" | "items">> & { items?: ShelfieMemoryItemRow[] }
): ShelfieMemoryEntryRow {
  return {
    id: `shelfie_entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: seed?.title || "Weekly grocery",
    buyingDate: seed?.buyingDate || "",
    endDate: seed?.endDate || "",
    notes: seed?.notes || "",
    items: seed?.items?.length ? seed.items : [createShelfieItemRow()],
  };
}

type WorkspaceActionCard = {
  action: string;
  description: string;
  required: Array<{ key: string; label: string }>;
  optional?: Array<{ key: string; label: string }>;
  examples?: string[];
};

interface AgentActionControlsSectionProps {
  actions: WorkspaceActionCard[];
  title: string;
  notesTitle: string;
  notes: string[];
  quickFlowsTitle: string;
  quickFlows: string[];
  isAccessible: boolean;
  sendWorkspacePrompt: (prompt: string, forceNewChat?: boolean) => Promise<void>;
  prepareWorkspacePrompt?: (prompt: string) => void;
  formatActionLabel: (action: string) => string;
  formatFieldLabel: (label: string) => string;
  actionPrompts: Record<string, string>;
  requiredToneClassName: string;
  sectionClassName: string;
}

function AgentActionControlsSection({
  actions,
  title,
  notesTitle,
  notes,
  quickFlowsTitle,
  quickFlows,
  isAccessible,
  sendWorkspacePrompt,
  prepareWorkspacePrompt,
  formatActionLabel,
  formatFieldLabel,
  actionPrompts,
  requiredToneClassName,
  sectionClassName,
}: AgentActionControlsSectionProps) {
  return (
    <section className={sectionClassName}>
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/44">
          {title}
        </h2>
        <div className="mt-4 grid gap-3">
          {actions.map((workspaceAction) => {
            const example =
              actionPrompts[workspaceAction.action] ||
              workspaceAction.examples?.[0] ||
              "";
            const requiredFields = workspaceAction.required || [];
            const optionalFields = workspaceAction.optional || [];

            return (
              <div
                key={workspaceAction.action}
                className="rounded-2xl border border-white/10 bg-black/18 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                      {formatActionLabel(workspaceAction.action)}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-white/62">
                      {workspaceAction.description}
                    </p>
                  </div>

                  {example ? (
                    <button
                      disabled={!isAccessible}
                      onClick={() =>
                        prepareWorkspacePrompt
                          ? prepareWorkspacePrompt(example)
                          : void sendWorkspacePrompt(example, true)
                      }
                      className="rounded-lg border border-primary/26 bg-primary/12 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {prepareWorkspacePrompt ? "Edit example" : "Use example"}
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(requiredFields.length
                    ? requiredFields.map((field) => ({
                        key: field.key,
                        label: formatFieldLabel(field.label),
                        tone: requiredToneClassName,
                      }))
                    : [
                        {
                          key: "none",
                          label: "No required fields",
                          tone: "border-white/10 bg-white/[0.05] text-white/62",
                        },
                      ]
                  ).map((field) => (
                    <span
                      key={`${workspaceAction.action}-${field.key}`}
                      className={`rounded-full border px-3 py-1 text-[11px] ${field.tone}`}
                    >
                      {field.label}
                    </span>
                  ))}

                  {optionalFields.slice(0, 3).map((field) => (
                    <span
                      key={`${workspaceAction.action}-optional-${field.key}`}
                      className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] text-white/62"
                    >
                      Optional: {formatFieldLabel(field.label)}
                    </span>
                  ))}
                </div>

                {example ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm leading-6 text-white/70">
                    {example}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/44">
            {notesTitle}
          </h2>
          <div className="mt-4 space-y-3">
            {notes.map((note) => (
              <div
                key={note}
                className="rounded-2xl border border-white/10 bg-black/18 px-4 py-3 text-sm leading-6 text-white/68"
              >
                {note}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/44">
            {quickFlowsTitle}
          </h2>
          <div className="mt-4 grid gap-2">
            {quickFlows.map((prompt) => (
              <button
                key={prompt}
                disabled={!isAccessible}
                onClick={() =>
                  prepareWorkspacePrompt
                    ? prepareWorkspacePrompt(prompt)
                    : void sendWorkspacePrompt(prompt, true)
                }
                className="rounded-xl border border-white/10 bg-black/18 px-4 py-3 text-left text-sm leading-6 text-white/72 transition hover:border-primary/28 hover:bg-primary/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function AgentWorkspaceView({ agentId }: AgentWorkspaceViewProps) {
  const searchParams = useSearchParams();
  const {
    activeChatId,
    messages,
    createNewChat,
    ensureActiveChat,
    sendMessage,
    setWorkspaceScope,
    workspaceScope,
  } = useChatContext();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccessible, setIsAccessible] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMenuEditorOpen, setIsMenuEditorOpen] = useState(false);
  const [isMenuLoading, setIsMenuLoading] = useState(false);
  const [isMenuSaving, setIsMenuSaving] = useState(false);
  const [menuRows, setMenuRows] = useState<RestaurantMenuRow[]>([createRestaurantMenuRow()]);
  const [menuFeedback, setMenuFeedback] = useState<string | null>(null);
  const [isShelfieMemoryOpen, setIsShelfieMemoryOpen] = useState(false);
  const [isShelfieLoading, setIsShelfieLoading] = useState(false);
  const [isShelfieSaving, setIsShelfieSaving] = useState(false);
  const [shelfieFeedback, setShelfieFeedback] = useState<string | null>(null);
  const [shelfieEntries, setShelfieEntries] = useState<ShelfieMemoryEntryRow[]>([
    createShelfieEntryRow(),
  ]);
  const [promptEditorDraft, setPromptEditorDraft] = useState("");
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const consumedPromptRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [agentRecord, headers] = await Promise.all([
          getAgentById(agentId),
          getAuthHeaders(),
        ]);

        if (!agentRecord) {
          throw new Error("This agent does not exist in the marketplace.");
        }

        const stateResponse = await fetch("/api/agents", {
          method: "GET",
          headers,
        });
        if (!stateResponse.ok) {
          const data = await stateResponse.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load your agent access.");
        }

        const state = (await stateResponse.json()) as AgentStateResponse;
        const accessible =
          (state.accessibleAgentIds || []).includes(agentRecord.id) ||
          (!agentRecord.requiresConnection && (state.installedAgentIds || []).includes(agentRecord.id));

        if (cancelled) return;
        setAgent(agentRecord);
        setIsAccessible(accessible);
        setWorkspaceScope({
          type: "agent",
          agentId: agentRecord.id,
          agentName: agentRecord.name,
        });
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Failed to load this workspace.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [agentId, setWorkspaceScope]);

  const examples = useMemo(() => (agent ? buildExamplePrompts(agent) : []), [agent]);
  const useCases = useMemo(() => (agent ? buildUseCases(agent) : []), [agent]);
  const detailContent = useMemo(
    () => (agent ? getAgentDetailContent(agent.id) : undefined),
    [agent]
  );
  const intakeSchema = useMemo(
    () => (agent ? getWorkspaceIntakeSchemaForAgent(agent.id) : null),
    [agent]
  );
  const devikaActions = useMemo(
    () => (agent?.id === "devika-engineer-agent" ? intakeSchema?.actions || [] : []),
    [agent, intakeSchema]
  );
  const restaurantActions = useMemo(
    () => (agent?.id === "restaurant-concierge-agent" ? intakeSchema?.actions || [] : []),
    [agent, intakeSchema]
  );
  const shelfieActions = useMemo(
    () => (agent?.id === "shelfie-grocery-agent" ? intakeSchema?.actions || [] : []),
    [agent, intakeSchema]
  );
  const isRestaurantWorkspace = agent?.id === "restaurant-concierge-agent";
  const isShelfieWorkspace = agent?.id === "shelfie-grocery-agent";
  const workspaceNotes = useMemo(
    () =>
      agent?.id === "devika-engineer-agent"
        ? DEVIKA_RUNTIME_NOTES
        : [
            "Recent chats stay scoped to this agent.",
            "The composer calls only this workspace endpoint.",
            "Task cards reuse the existing production renderers.",
          ],
    [agent]
  );
  const hasConversation = activeChatId !== null || messages.length > 0;

  const sendWorkspacePrompt = useCallback(
    async (prompt: string, forceNewChat = false) => {
      if (!agent || !isAccessible) return;
      if (workspaceScope.type !== "agent" || workspaceScope.agentId !== agent.id) {
        setWorkspaceScope({ type: "agent", agentId: agent.id, agentName: agent.name });
      }
      await sendMessage(prompt, false, [], [], { forceNewChat });
    },
    [agent, isAccessible, sendMessage, setWorkspaceScope, workspaceScope]
  );

  const upsertMenuRow = useCallback((rowId: string, key: keyof RestaurantMenuRow, value: string) => {
    setMenuRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [key]: value } : row))
    );
  }, []);

  const removeMenuRow = useCallback((rowId: string) => {
    setMenuRows((prev) => {
      const next = prev.filter((row) => row.id !== rowId);
      return next.length > 0 ? next : [createRestaurantMenuRow()];
    });
  }, []);

  const upsertShelfieEntry = useCallback(
    (entryId: string, key: keyof Omit<ShelfieMemoryEntryRow, "id" | "items">, value: string) => {
      setShelfieEntries((prev) =>
        prev.map((entry) => (entry.id === entryId ? { ...entry, [key]: value } : entry))
      );
    },
    []
  );

  const upsertShelfieItem = useCallback(
    (
      entryId: string,
      itemId: string,
      key: keyof Omit<ShelfieMemoryItemRow, "id">,
      value: string | boolean
    ) => {
      setShelfieEntries((prev) =>
        prev.map((entry) =>
          entry.id !== entryId
            ? entry
            : {
                ...entry,
                items: entry.items.map((item) =>
                  item.id === itemId ? { ...item, [key]: value } : item
                ),
              }
        )
      );
    },
    []
  );

  const loadRestaurantMenuMemory = useCallback(
    async (chatId: string) => {
      if (!agent || agent.id !== "restaurant-concierge-agent") return;
      setIsMenuLoading(true);
      setMenuFeedback(null);
      try {
        const response = await fetch(
          `/api/agents/${encodeURIComponent(agent.id)}/workspace/menu?chatId=${encodeURIComponent(chatId)}`,
          {
            method: "GET",
            headers: await getAuthHeaders(),
          }
        );
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load restaurant menu memory.");
        }
        const data = (await response.json()) as {
          menu_items?: Array<{ name?: string; price?: number; contains?: string; description?: string }>;
        };
        const rows = (data.menu_items || []).map((item) =>
          createRestaurantMenuRow({
            name: item.name || "",
            price:
              typeof item.price === "number" && Number.isFinite(item.price)
                ? String(item.price)
                : "",
            contains: item.contains || "",
            description: item.description || "",
          })
        );
        setMenuRows(rows.length > 0 ? rows : [createRestaurantMenuRow()]);
      } catch (error) {
        setMenuFeedback(error instanceof Error ? error.message : "Failed to load menu memory.");
      } finally {
        setIsMenuLoading(false);
      }
    },
    [agent]
  );

  const openRestaurantMenuEditor = useCallback(async () => {
    if (!agent || agent.id !== "restaurant-concierge-agent") return;
    const chatId = activeChatId || (await ensureActiveChat({ seedTitle: "Restaurant menu setup" }));
    if (!chatId) {
      setMenuFeedback("Create a chat session first, then add your menu.");
      setIsMenuEditorOpen(true);
      return;
    }
    setIsMenuEditorOpen(true);
    await loadRestaurantMenuMemory(chatId);
  }, [activeChatId, agent, ensureActiveChat, loadRestaurantMenuMemory]);

  const saveRestaurantMenuMemory = useCallback(async () => {
    if (!agent || agent.id !== "restaurant-concierge-agent") return;
    const chatId = activeChatId || (await ensureActiveChat({ seedTitle: "Restaurant menu setup" }));
    if (!chatId) {
      setMenuFeedback("Unable to create a chat session for this menu.");
      return;
    }

    const menuItems = menuRows
      .map((row) => ({
        name: row.name.trim(),
        price: Number(row.price),
        contains: row.contains.trim(),
        description: row.description.trim(),
      }))
      .filter((row) => row.name.length > 0);

    setIsMenuSaving(true);
    setMenuFeedback(null);
    try {
      const response = await fetch(`/api/agents/${encodeURIComponent(agent.id)}/workspace/menu`, {
        method: "PUT",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          chatId,
          menu_items: menuItems,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save restaurant menu memory.");
      }
      setMenuFeedback(
        menuItems.length > 0
          ? `Saved ${menuItems.length} menu item${menuItems.length > 1 ? "s" : ""}.`
          : "Menu cleared for this chat."
      );
      await loadRestaurantMenuMemory(chatId);
    } catch (error) {
      setMenuFeedback(error instanceof Error ? error.message : "Failed to save restaurant menu.");
    } finally {
      setIsMenuSaving(false);
    }
  }, [activeChatId, agent, ensureActiveChat, loadRestaurantMenuMemory, menuRows]);

  const prepareRestaurantPrompt = useCallback((prompt: string) => {
    setPromptEditorDraft(prompt);
    setIsPromptEditorOpen(true);
  }, []);

  const sendEditedRestaurantPrompt = useCallback(
    async (forceNewChat = false) => {
      const prompt = promptEditorDraft.trim();
      if (!prompt) return;
      await sendWorkspacePrompt(prompt, forceNewChat);
      setIsPromptEditorOpen(false);
    },
    [promptEditorDraft, sendWorkspacePrompt]
  );

  const loadShelfieMemory = useCallback(
    async (chatId: string) => {
      if (!agent || agent.id !== "shelfie-grocery-agent") return;
      setIsShelfieLoading(true);
      setShelfieFeedback(null);
      try {
        const response = await fetch(
          `/api/agents/${encodeURIComponent(agent.id)}/workspace/shelfie-memory?chatId=${encodeURIComponent(chatId)}`,
          {
            method: "GET",
            headers: await getAuthHeaders(),
          }
        );
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load Shelfie memory.");
        }
        const data = (await response.json()) as {
          grocery_memory?: Array<{
            id?: string;
            title?: string;
            buying_date?: string;
            end_date?: string;
            notes?: string;
            items?: Array<{
              name?: string;
              quantity?: string;
              purchased?: boolean;
              finished?: boolean;
            }>;
          }>;
        };
        const entries = (data.grocery_memory || []).map((entry) =>
          createShelfieEntryRow({
            title: entry.title || "Weekly grocery",
            buyingDate: entry.buying_date || "",
            endDate: entry.end_date || "",
            notes: entry.notes || "",
            items:
              (entry.items || []).map((item) =>
                createShelfieItemRow({
                  name: item.name || "",
                  quantity: item.quantity || "",
                  purchased: Boolean(item.purchased),
                  finished: Boolean(item.finished),
                })
              ) || [createShelfieItemRow()],
          })
        );
        setShelfieEntries(entries.length > 0 ? entries : [createShelfieEntryRow()]);
      } catch (error) {
        setShelfieFeedback(error instanceof Error ? error.message : "Failed to load Shelfie memory.");
      } finally {
        setIsShelfieLoading(false);
      }
    },
    [agent]
  );

  const openShelfieMemory = useCallback(async () => {
    if (!agent || agent.id !== "shelfie-grocery-agent") return;
    const chatId = activeChatId || (await ensureActiveChat({ seedTitle: "Shelfie grocery memory" }));
    setIsShelfieMemoryOpen(true);
    if (chatId) {
      await loadShelfieMemory(chatId);
    }
  }, [activeChatId, agent, ensureActiveChat, loadShelfieMemory]);

  const saveShelfieMemory = useCallback(async () => {
    if (!agent || agent.id !== "shelfie-grocery-agent") return;
    const chatId = activeChatId || (await ensureActiveChat({ seedTitle: "Shelfie grocery memory" }));
    if (!chatId) {
      setShelfieFeedback("Unable to resolve chat for Shelfie memory.");
      return;
    }
    const payload = shelfieEntries.map((entry) => ({
      id: entry.id,
      title: entry.title.trim(),
      buying_date: entry.buyingDate.trim(),
      end_date: entry.endDate.trim(),
      notes: entry.notes.trim(),
      items: entry.items
        .map((item) => ({
          name: item.name.trim(),
          quantity: item.quantity.trim(),
          purchased: item.purchased,
          finished: item.finished,
        }))
        .filter((item) => item.name.length > 0),
    }));

    setIsShelfieSaving(true);
    setShelfieFeedback(null);
    try {
      const response = await fetch(`/api/agents/${encodeURIComponent(agent.id)}/workspace/shelfie-memory`, {
        method: "PUT",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          chatId,
          grocery_memory: payload,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save Shelfie memory.");
      }
      setShelfieFeedback("Shelfie memory saved for this chat.");
      await loadShelfieMemory(chatId);
    } catch (error) {
      setShelfieFeedback(error instanceof Error ? error.message : "Failed to save Shelfie memory.");
    } finally {
      setIsShelfieSaving(false);
    }
  }, [activeChatId, agent, ensureActiveChat, loadShelfieMemory, shelfieEntries]);

  useEffect(() => {
    const prompt = searchParams.get("prompt");
    if (!prompt || !agent || !isAccessible) return;
    if (consumedPromptRef.current === prompt) return;
    consumedPromptRef.current = prompt;
    createNewChat();
    void sendWorkspacePrompt(prompt, true);
  }, [agent, createNewChat, isAccessible, searchParams, sendWorkspacePrompt]);

  useEffect(() => {
    if (!isRestaurantWorkspace || !isMenuEditorOpen || !activeChatId) return;
    void loadRestaurantMenuMemory(activeChatId);
  }, [activeChatId, isMenuEditorOpen, isRestaurantWorkspace, loadRestaurantMenuMemory]);

  useEffect(() => {
    if (!isShelfieWorkspace || !isShelfieMemoryOpen || !activeChatId) return;
    void loadShelfieMemory(activeChatId);
  }, [activeChatId, isShelfieMemoryOpen, isShelfieWorkspace, loadShelfieMemory]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-300" />
      </div>
    );
  }

  if (loadError || !agent) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center px-6">
        <div className="ui-surface max-w-lg rounded-2xl p-6 text-center">
          <Bot className="mx-auto mb-4 h-9 w-9 text-violet-200" />
          <h1 className="text-xl font-semibold text-white">Workspace unavailable</h1>
          <p className="mt-2 text-sm text-white/55">{loadError}</p>
          <Link
            href="/agents"
            className="mt-5 inline-flex rounded-lg border border-primary/30 bg-primary/15 px-4 py-2 text-sm font-semibold text-white hover:bg-primary/22"
          >
            Back to marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      <div
        className={cn(
          "custom-scrollbar min-h-0 flex-1 overflow-y-auto",
          hasConversation ? "flex flex-col" : ""
        )}
      >
        {hasConversation ? (
          <ChatMessageList />
        ) : (
          <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Link
                  href="/"
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-primary/30 hover:bg-primary/12 hover:text-white"
                >
                  Home
                </Link>
                <Link
                  href="/agents"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-primary/30 hover:bg-primary/12 hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Agents
                </Link>
              </div>

              <div className="flex items-center gap-2">
                {isRestaurantWorkspace ? (
                  <button
                    disabled={!isAccessible}
                    onClick={() => void openRestaurantMenuEditor()}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-400/24 bg-amber-400/12 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/18 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <PencilLine className="h-4 w-4" />
                    Add Menu Items
                  </button>
                ) : null}
                {isShelfieWorkspace ? (
                  <button
                    disabled={!isAccessible}
                    onClick={() => void openShelfieMemory()}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/24 bg-emerald-500/12 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <NotebookPen className="h-4 w-4" />
                    Grocery Memory
                  </button>
                ) : null}

                <button
                  onClick={createNewChat}
                  className="inline-flex items-center gap-2 rounded-lg border border-primary/26 bg-primary/14 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary/22"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                  New {agent.name} Chat
                </button>
              </div>
            </div>

            {!isAccessible ? (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/8 p-4 text-sm text-amber-100">
                Install and connect {agent.name} from the marketplace before using this workspace.
              </div>
            ) : null}

            {isRestaurantWorkspace && isMenuEditorOpen ? (
              <section className="rounded-2xl border border-amber-400/26 bg-amber-400/8 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-100/90">
                      Restaurant Menu Memory
                    </h2>
                    <p className="mt-1 text-sm text-amber-100/78">
                      These menu items stay scoped to this restaurant agent chat.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMenuRows((prev) => [...prev, createRestaurantMenuRow()])}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/16 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.14]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add row
                    </button>
                    <button
                      disabled={isMenuSaving || isMenuLoading}
                      onClick={() => void saveRestaurantMenuMemory()}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/28 bg-emerald-500/16 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/22 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isMenuSaving ? "Saving..." : "Save menu"}
                    </button>
                  </div>
                </div>

                {menuFeedback ? (
                  <p className="mt-3 rounded-lg border border-white/12 bg-black/18 px-3 py-2 text-xs text-white/78">
                    {menuFeedback}
                  </p>
                ) : null}

                <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                  <table className="min-w-full text-left text-xs text-white/82">
                    <thead className="bg-black/28 text-[11px] uppercase tracking-[0.12em] text-white/58">
                      <tr>
                        <th className="px-3 py-2">Menu name</th>
                        <th className="px-3 py-2">Pricing</th>
                        <th className="px-3 py-2">What it contains</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {menuRows.map((row) => (
                        <tr key={row.id} className="border-t border-white/8 bg-black/18">
                          <td className="px-3 py-2 align-top">
                            <input
                              value={row.name}
                              onChange={(event) => upsertMenuRow(row.id, "name", event.target.value)}
                              className="w-44 rounded-md border border-white/12 bg-black/28 px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/35 focus:border-primary/35"
                              placeholder="Paneer Tikka"
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <input
                              value={row.price}
                              onChange={(event) => upsertMenuRow(row.id, "price", event.target.value)}
                              className="w-24 rounded-md border border-white/12 bg-black/28 px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/35 focus:border-primary/35"
                              placeholder="299"
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <input
                              value={row.contains}
                              onChange={(event) => upsertMenuRow(row.id, "contains", event.target.value)}
                              className="w-56 rounded-md border border-white/12 bg-black/28 px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/35 focus:border-primary/35"
                              placeholder="Paneer, yogurt, spices"
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <input
                              value={row.description}
                              onChange={(event) => upsertMenuRow(row.id, "description", event.target.value)}
                              className="w-72 rounded-md border border-white/12 bg-black/28 px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/35 focus:border-primary/35"
                              placeholder="Clay-oven grilled starter."
                            />
                          </td>
                          <td className="px-3 py-2 text-right align-top">
                            <button
                              onClick={() => removeMenuRow(row.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-white/14 bg-white/[0.06] px-2 py-1.5 text-[11px] text-white/78 transition hover:bg-white/[0.12]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {isMenuLoading ? (
                  <p className="mt-3 text-xs text-white/62">Loading menu memory...</p>
                ) : null}
              </section>
            ) : null}

            {isShelfieWorkspace && isShelfieMemoryOpen ? (
              <section className="rounded-2xl border border-emerald-400/24 bg-emerald-500/8 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-100/90">
                      Shelfie Grocery Memory
                    </h2>
                    <p className="mt-1 text-sm text-emerald-100/78">
                      Persisted per user and per Shelfie chat: buying date, end date, and purchased/finished item status.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShelfieEntries((prev) => [...prev, createShelfieEntryRow()])}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/16 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.14]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add grocery cycle
                    </button>
                    <button
                      disabled={isShelfieSaving || isShelfieLoading}
                      onClick={() => void saveShelfieMemory()}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/16 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/24 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isShelfieSaving ? "Saving..." : "Save memory"}
                    </button>
                  </div>
                </div>

                {shelfieFeedback ? (
                  <p className="mt-3 rounded-lg border border-white/12 bg-black/18 px-3 py-2 text-xs text-white/80">
                    {shelfieFeedback}
                  </p>
                ) : null}

                <div className="mt-4 space-y-4">
                  {shelfieEntries.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="grid gap-2 md:grid-cols-4">
                        <input
                          value={entry.title}
                          onChange={(event) => upsertShelfieEntry(entry.id, "title", event.target.value)}
                          className="rounded-md border border-white/12 bg-black/28 px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/35 focus:border-primary/35"
                          placeholder="Weekly grocery"
                        />
                        <input
                          value={entry.buyingDate}
                          onChange={(event) => upsertShelfieEntry(entry.id, "buyingDate", event.target.value)}
                          className="rounded-md border border-white/12 bg-black/28 px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/35 focus:border-primary/35"
                          placeholder="Buying date (YYYY-MM-DD)"
                        />
                        <input
                          value={entry.endDate}
                          onChange={(event) => upsertShelfieEntry(entry.id, "endDate", event.target.value)}
                          className="rounded-md border border-white/12 bg-black/28 px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/35 focus:border-primary/35"
                          placeholder="End date (YYYY-MM-DD)"
                        />
                        <input
                          value={entry.notes}
                          onChange={(event) => upsertShelfieEntry(entry.id, "notes", event.target.value)}
                          className="rounded-md border border-white/12 bg-black/28 px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/35 focus:border-primary/35"
                          placeholder="Notes"
                        />
                      </div>

                      <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
                        <table className="min-w-full text-left text-xs text-white/82">
                          <thead className="bg-black/30 text-[11px] uppercase tracking-[0.12em] text-white/56">
                            <tr>
                              <th className="px-3 py-2">Item</th>
                              <th className="px-3 py-2">Quantity</th>
                              <th className="px-3 py-2">Purchased</th>
                              <th className="px-3 py-2">Finished</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.items.map((item) => (
                              <tr key={item.id} className="border-t border-white/8">
                                <td className="px-3 py-2">
                                  <input
                                    value={item.name}
                                    onChange={(event) =>
                                      upsertShelfieItem(entry.id, item.id, "name", event.target.value)
                                    }
                                    className="w-44 rounded-md border border-white/12 bg-black/28 px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/35 focus:border-primary/35"
                                    placeholder="Eggs"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    value={item.quantity}
                                    onChange={(event) =>
                                      upsertShelfieItem(entry.id, item.id, "quantity", event.target.value)
                                    }
                                    className="w-36 rounded-md border border-white/12 bg-black/28 px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/35 focus:border-primary/35"
                                    placeholder="2 dozen"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={item.purchased}
                                    onChange={(event) =>
                                      upsertShelfieItem(entry.id, item.id, "purchased", event.target.checked)
                                    }
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={item.finished}
                                    onChange={(event) =>
                                      upsertShelfieItem(entry.id, item.id, "finished", event.target.checked)
                                    }
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <button
                        onClick={() =>
                          setShelfieEntries((prev) =>
                            prev.map((row) =>
                              row.id !== entry.id
                                ? row
                                : { ...row, items: [...row.items, createShelfieItemRow()] }
                            )
                          )
                        }
                        className="mt-2 rounded-md border border-white/14 bg-white/[0.06] px-2 py-1 text-[11px] text-white/78 transition hover:bg-white/[0.12]"
                      >
                        Add item row
                      </button>
                    </div>
                  ))}
                </div>
                {isShelfieLoading ? (
                  <p className="mt-3 text-xs text-white/62">Loading Shelfie memory...</p>
                ) : null}
              </section>
            ) : null}

            <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(99,102,241,0.16),rgba(8,10,18,0.94)_44%,rgba(14,165,233,0.10))] p-6 shadow-[0_22px_70px_rgb(0_0_0/42%)]">
              <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_320px]">
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/12 bg-black/25 p-3 shadow-[0_18px_44px_rgb(0_0_0/35%)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={agent.iconUrl} alt={agent.name} className="h-full w-full object-contain" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/70">
                        Dedicated Workspace
                      </p>
                      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                        {agent.name}
                      </h1>
                      <p className="mt-3 max-w-3xl text-base leading-7 text-white/66">
                        {detailContent?.descriptionLines?.join(" ") || agent.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {useCases.map((useCase) => (
                      <span
                        key={useCase}
                        className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-xs font-medium text-white/68"
                      >
                        {useCase}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/22 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/42">
                      <Sparkles className="h-4 w-4" />
                      Scope Lock
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/70">
                      Chats in this page can only call {agent.name}. Out-of-scope requests ask for clarification instead of falling back to another agent.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/22 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42">
                      Actions
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(getAgentCatalogEntry(agent.id)?.actions || []).slice(0, 6).map((action) => (
                        <span
                          key={action}
                          className="rounded-lg border border-primary/18 bg-primary/10 px-2 py-1 text-[11px] text-white/62"
                        >
                          {action.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/44">
                  Example prompts
                </h2>
                <div className="mt-4 grid gap-2">
                  {examples.map((prompt) => (
                    <button
                      key={prompt}
                      disabled={!isAccessible}
                      onClick={() =>
                        isRestaurantWorkspace
                          ? prepareRestaurantPrompt(prompt)
                          : void sendWorkspacePrompt(prompt, true)
                      }
                      className="rounded-xl border border-white/8 bg-black/20 px-4 py-3 text-left text-sm leading-6 text-white/74 transition hover:border-primary/30 hover:bg-primary/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                {workspaceNotes.map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-sm leading-6 text-white/68">{item}</p>
                  </div>
                ))}
              </div>
            </section>

            {isRestaurantWorkspace && isPromptEditorOpen ? (
              <section className="rounded-2xl border border-violet-400/24 bg-violet-500/8 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-100/90">
                      Edit Prompt Before Send
                    </h2>
                    <p className="mt-1 text-sm text-violet-100/74">
                      Edit quantities and details, then send the command when ready.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsPromptEditorOpen(false)}
                    className="rounded-lg border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/76 transition hover:bg-white/[0.12]"
                  >
                    Close
                  </button>
                </div>

                <textarea
                  value={promptEditorDraft}
                  onChange={(event) => setPromptEditorDraft(event.target.value)}
                  className="mt-3 h-24 w-full rounded-xl border border-white/10 bg-black/24 px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/35 focus:border-primary/35"
                  placeholder="Add 1 chicken biryani and 1 mango lassi to my order."
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    disabled={!promptEditorDraft.trim() || !isAccessible}
                    onClick={() => void sendEditedRestaurantPrompt(false)}
                    className="rounded-lg border border-primary/30 bg-primary/16 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary/24 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Send in current chat
                  </button>
                  <button
                    disabled={!promptEditorDraft.trim() || !isAccessible}
                    onClick={() => void sendEditedRestaurantPrompt(true)}
                    className="rounded-lg border border-amber-400/30 bg-amber-400/14 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Start new chat and send
                  </button>
                </div>
              </section>
            ) : null}

            {devikaActions.length ? (
              <AgentActionControlsSection
                actions={devikaActions}
                title="Devika controls"
                notesTitle="Runtime traits"
                notes={DEVIKA_RUNTIME_NOTES}
                quickFlowsTitle="Ops shortcuts"
                quickFlows={[
                  DEVIKA_ACTION_PROMPTS.agent_status,
                  DEVIKA_ACTION_PROMPTS.list_snapshots,
                  DEVIKA_ACTION_PROMPTS.token_estimate,
                  DEVIKA_ACTION_PROMPTS.repo_intake,
                  DEVIKA_ACTION_PROMPTS.browser_strategy,
                ]}
                isAccessible={isAccessible}
                sendWorkspacePrompt={sendWorkspacePrompt}
                formatActionLabel={formatActionLabel}
                formatFieldLabel={formatFieldLabel}
                actionPrompts={DEVIKA_ACTION_PROMPTS}
                requiredToneClassName="border-emerald-400/18 bg-emerald-400/10 text-emerald-100/88"
                sectionClassName="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]"
              />
            ) : null}

            {restaurantActions.length ? (
              <AgentActionControlsSection
                actions={restaurantActions}
                title="Restaurant controls"
                notesTitle="Workspace notes"
                notes={RESTAURANT_RUNTIME_NOTES}
                quickFlowsTitle="Quick flows"
                quickFlows={[
                  RESTAURANT_ACTION_PROMPTS.browse_menu,
                  RESTAURANT_ACTION_PROMPTS.get_recommendations,
                  RESTAURANT_ACTION_PROMPTS.get_order_summary,
                  RESTAURANT_ACTION_PROMPTS.get_session_analytics,
                  RESTAURANT_ACTION_PROMPTS.reset_session,
                  RESTAURANT_ACTION_PROMPTS.request_human_help,
                ]}
                isAccessible={isAccessible}
                sendWorkspacePrompt={sendWorkspacePrompt}
                prepareWorkspacePrompt={prepareRestaurantPrompt}
                formatActionLabel={formatActionLabel}
                formatFieldLabel={formatFieldLabel}
                actionPrompts={RESTAURANT_ACTION_PROMPTS}
                requiredToneClassName="border-amber-400/18 bg-amber-400/10 text-amber-100/88"
                sectionClassName="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]"
              />
            ) : null}

            {shelfieActions.length ? (
              <AgentActionControlsSection
                actions={shelfieActions}
                title="Shelfie controls"
                notesTitle="Workspace notes"
                notes={SHELFIE_RUNTIME_NOTES}
                quickFlowsTitle="Quick flows"
                quickFlows={[
                  SHELFIE_ACTION_PROMPTS.run_shelfie_grocery_agent,
                  SHELFIE_ACTION_PROMPTS.list_sessions,
                  SHELFIE_ACTION_PROMPTS.get_history,
                  SHELFIE_ACTION_PROMPTS.reset_session,
                  SHELFIE_ACTION_PROMPTS.list_capabilities,
                ]}
                isAccessible={isAccessible}
                sendWorkspacePrompt={sendWorkspacePrompt}
                formatActionLabel={formatActionLabel}
                formatFieldLabel={formatFieldLabel}
                actionPrompts={SHELFIE_ACTION_PROMPTS}
                requiredToneClassName="border-emerald-400/18 bg-emerald-400/10 text-emerald-100/88"
                sectionClassName="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]"
              />
            ) : null}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/8 bg-black/82 backdrop-blur-xl">
        <ChatInput />
      </div>
    </div>
  );
}
