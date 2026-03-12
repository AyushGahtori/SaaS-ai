// Seed script — Populates the Firestore "agents" collection with 8 sample agents.
// Run:  npx tsx scripts/seed-agents.ts
//
// Requires a .env file at the project root with the Firebase environment variables.

import "dotenv/config";
import * as admin from "firebase-admin";

// ---------------------------------------------------------------------------
// Firebase Admin setup
// ---------------------------------------------------------------------------
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountPath) {
    console.error("❌ Missing FIREBASE_SERVICE_ACCOUNT_KEY in .env");
    console.error("Please add the absolute path to your Firebase Service Account JSON file.");
    console.error("Example: FIREBASE_SERVICE_ACCOUNT_KEY=./serviceAccountKey.json");
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath)
    });
}

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Helper — generate a simple SVG data URI with an emoji
// ---------------------------------------------------------------------------
function emojiIcon(emoji: string, bgColor: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <rect width="128" height="128" rx="28" fill="${bgColor}"/>
    <text x="64" y="80" font-size="64" text-anchor="middle" dominant-baseline="central">${emoji}</text>
  </svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// ---------------------------------------------------------------------------
// Sample agents
// ---------------------------------------------------------------------------
const agents = [
    {
        id: "email-agent",
        name: "Email Assistant",
        description: "Compose, send, and manage emails automatically with smart templates and scheduling.",
        iconUrl: emojiIcon("📧", "#3B82F6"),
        category: "Communication",
        installCount: 1240,
        rating: 4.7,
        isFeatured: true,
        trendingScore: 87,
        tags: ["email", "automation", "productivity"],
    },
    {
        id: "whatsapp-agent",
        name: "WhatsApp Messenger",
        description: "Send and receive WhatsApp messages, manage contacts, and automate replies.",
        iconUrl: emojiIcon("💬", "#22C55E"),
        category: "Communication",
        installCount: 980,
        rating: 4.5,
        isFeatured: true,
        trendingScore: 74,
        tags: ["whatsapp", "messaging", "chat"],
    },
    {
        id: "meeting-scheduler",
        name: "Meeting Scheduler",
        description: "Find optimal time slots, send invites, and manage meetings across calendars.",
        iconUrl: emojiIcon("📅", "#A855F7"),
        category: "Productivity",
        installCount: 860,
        rating: 4.8,
        isFeatured: true,
        trendingScore: 92,
        tags: ["meetings", "scheduling", "calendar"],
    },
    {
        id: "calendar-agent",
        name: "Calendar Agent",
        description: "Sync, view, and manage your calendar events with smart conflict detection.",
        iconUrl: emojiIcon("🗓️", "#F59E0B"),
        category: "Productivity",
        installCount: 720,
        rating: 4.4,
        isFeatured: false,
        trendingScore: 58,
        tags: ["calendar", "events", "scheduling"],
    },
    {
        id: "document-analyzer",
        name: "Document Analyzer",
        description: "Extract insights, summarize content, and analyse documents using AI.",
        iconUrl: emojiIcon("📄", "#EF4444"),
        category: "Analytics",
        installCount: 1100,
        rating: 4.6,
        isFeatured: false,
        trendingScore: 65,
        tags: ["documents", "analysis", "summary"],
    },
    {
        id: "research-agent",
        name: "Research Agent",
        description: "Search the web, compile reports, and gather data for any research topic.",
        iconUrl: emojiIcon("🔬", "#06B6D4"),
        category: "Research",
        installCount: 1560,
        rating: 4.9,
        isFeatured: false,
        trendingScore: 95,
        tags: ["research", "web search", "reports"],
    },
    {
        id: "translation-agent",
        name: "Translation Agent",
        description: "Translate text between 50+ languages with context-aware accuracy.",
        iconUrl: emojiIcon("🌐", "#8B5CF6"),
        category: "Language",
        installCount: 640,
        rating: 4.3,
        isFeatured: false,
        trendingScore: 42,
        tags: ["translation", "language", "multilingual"],
    },
    {
        id: "code-assistant",
        name: "Code Assistant",
        description: "Write, review, debug, and refactor code across multiple programming languages.",
        iconUrl: emojiIcon("💻", "#10B981"),
        category: "Development",
        installCount: 1800,
        rating: 4.9,
        isFeatured: false,
        trendingScore: 98,
        tags: ["code", "development", "programming"],
    },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    console.log("🌱 Seeding agents collection...\n");

    for (const agent of agents) {
        const { id, ...data } = agent;
        await db.collection("agents").doc(id).set({
            ...data,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`  ✓ ${id} — ${agent.name}`);
    }

    console.log(`\n✅ Seeded ${agents.length} agents successfully.`);
    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});
