import "dotenv/config";
import * as admin from "firebase-admin";
import { MARKETPLACE_AGENTS } from "../src/lib/agents/marketplace";

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountPath) {
    console.error("Missing FIREBASE_SERVICE_ACCOUNT_KEY in .env");
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
    });
}

const db = admin.firestore();

async function main() {
    console.log("Seeding marketplace agents collection...\n");

    for (const item of MARKETPLACE_AGENTS) {
        const { id, ...data } = item;
        await db.collection("agents").doc(id).set({
            ...data,
            createdAt: data.createdAt
                ? admin.firestore.Timestamp.fromDate(new Date(data.createdAt))
                : admin.firestore.FieldValue.serverTimestamp(),
            kind: item.kind,
        });
        console.log(`  - ${id} (${item.kind})`);
    }

    console.log(`\nSeeded ${MARKETPLACE_AGENTS.length} marketplace item(s).`);
}

main().catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
});
