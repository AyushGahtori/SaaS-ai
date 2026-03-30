/**
 * Firebase Cloud Functions — Task Runner.
 *
 * Triggers when a new agentTask document is created in Firestore.
 * Routes the task to the correct agent's FastAPI server, updates
 * the task status through its lifecycle (queued → running → success/failed).
 *
 * Deployed via: firebase deploy --only functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Cost control
setGlobalOptions({maxInstances: 10});

// ---------------------------------------------------------------------------
// Agent routing map — maps agentId to its API endpoint path.
// The base URL comes from the AGENT_SERVER_URL environment variable.
// ---------------------------------------------------------------------------

const AGENT_ROUTES = {
  "teams-agent": "/teams/action",
  "email-agent": "/email/action",
  "calendar-agent": "/calendar/action",
  "todo-agent": "/todo/action",
  "google-agent": "/google/action",
  "notion-agent": "/notion/action",
  "maps-agent": "/maps/action",
};

// ---------------------------------------------------------------------------
// Task Runner — triggered on agentTasks/{taskId} creation
// ---------------------------------------------------------------------------

exports.runAgentTask = onDocumentCreated(
    "agentTasks/{taskId}",
    async (event) => {
      const snapshot = event.data;
      if (!snapshot) {
        logger.error("No data in snapshot");
        return;
      }

      const task = snapshot.data();
      const taskId = event.params.taskId;
      const taskRef = db.collection("agentTasks").doc(taskId);

      logger.info(`[runAgentTask] Task ${taskId} created`, {
        agentId: task.agentId,
        action: task.agentInput?.action,
      });

      // ── 1. Validate agent exists ─────────────────────────────────────
      const agentRoute = AGENT_ROUTES[task.agentId];
      if (!agentRoute) {
        logger.error(`Unknown agent: ${task.agentId}`);
        await taskRef.update({
          status: "failed",
          agentOutput: {error: `Unknown agent: ${task.agentId}`},
          finishedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      const userSnap = await db.collection("users").doc(task.userId).get();
      const installedAgents = Array.isArray(userSnap.data()?.installedAgents) ?
        userSnap.data().installedAgents :
        [];

      if (!installedAgents.includes(task.agentId)) {
        await taskRef.update({
          status: "failed",
          agentOutput: {
            error: `Access denied. Agent ${task.agentId} is not installed for this user.`,
          },
          finishedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      // ── 2. Update status to "running" ────────────────────────────────
      await taskRef.update({
        status: "running",
        startedAt: FieldValue.serverTimestamp(),
      });

      // ── 3. Call the agent's FastAPI server ───────────────────────────
      let defaultHost = "http://13.206.83.175";

      let agentServerUrl = process.env.AGENT_SERVER_URL || defaultHost;
      if (task.agentId === "todo-agent" && process.env.TODO_AGENT_URL) agentServerUrl = process.env.TODO_AGENT_URL;
      if (task.agentId === "google-agent" && process.env.GOOGLE_AGENT_URL) agentServerUrl = process.env.GOOGLE_AGENT_URL;
      if (task.agentId === "notion-agent" && process.env.NOTION_AGENT_URL) agentServerUrl = process.env.NOTION_AGENT_URL;
      if (task.agentId === "maps-agent" && process.env.MAPS_AGENT_URL) agentServerUrl = process.env.MAPS_AGENT_URL;

      const agentUrl = `${agentServerUrl}${agentRoute}`;
      let providerConnection = {};
      if (["teams-agent", "email-agent", "calendar-agent"].includes(task.agentId)) {
        const snap = await db.collection("users").doc(task.userId).collection("providerConnections").doc("microsoft").get();
        if (snap.exists && snap.data()?.accessToken) {
          providerConnection = {
            access_token: snap.data().accessToken,
            refresh_token: snap.data().refreshToken || undefined,
          };
        }
      } else if (task.agentId === "google-agent") {
        const snap = await db.collection("users").doc(task.userId).collection("providerConnections").doc("google").get();
        if (snap.exists && snap.data()?.accessToken) {
          providerConnection = {
            access_token: snap.data().accessToken,
            refresh_token: snap.data().refreshToken || undefined,
          };
        }
      } else if (task.agentId === "notion-agent") {
        const snap = await db.collection("users").doc(task.userId).collection("providerConnections").doc("notion").get();
        if (snap.exists && snap.data()?.accessToken) {
          providerConnection = {
            access_token: snap.data().accessToken,
            refresh_token: snap.data().refreshToken || undefined,
          };
        }
      }

      if (
        ["teams-agent", "email-agent", "calendar-agent", "google-agent", "notion-agent"].includes(task.agentId) &&
        !providerConnection.access_token
      ) {
        await taskRef.update({
          status: "failed",
          agentOutput: {
            error: `Access denied. Provider connection for ${task.agentId} is missing.`,
          },
          finishedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      logger.info(`[runAgentTask] Calling agent at ${agentUrl}`);

      try {
        const response = await fetch(agentUrl, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            taskId: taskId,
            userId: task.userId,
            agentId: task.agentId,
            ...task.agentInput,
            ...providerConnection,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error(`[runAgentTask] Agent returned ${response.status}`, errorText);
          await taskRef.update({
            status: "failed",
            agentOutput: {
              error: `Agent returned status ${response.status}: ${errorText}`,
            },
            finishedAt: FieldValue.serverTimestamp(),
            retryCount: (task.retryCount || 0) + 1,
          });
          return;
        }

        const result = await response.json();
        logger.info(`[runAgentTask] Agent result`, result);

        // ── 4. Update task with result ────────────────────────────────
        if (result.status === "success" || result.status === "action_required") {
          await taskRef.update({
            status: result.status,
            agentOutput: result,
            finishedAt: result.status === "success" ? FieldValue.serverTimestamp() : null,
          });
        } else {
          await taskRef.update({
            status: "failed",
            agentOutput: result,
            finishedAt: FieldValue.serverTimestamp(),
            retryCount: (task.retryCount || 0) + 1,
          });
        }
      } catch (error) {
        logger.error(`[runAgentTask] Error calling agent`, error);

        const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
        const isConnectionError =
                errorMessage.includes("ECONNREFUSED") ||
                errorMessage.includes("fetch failed");

        await taskRef.update({
          status: "failed",
          agentOutput: {
            error: isConnectionError ?
                        `Cannot connect to agent server at ${agentServerUrl}. Is the agent running?` :
                        `Agent execution error: ${errorMessage}`,
          },
          finishedAt: FieldValue.serverTimestamp(),
          retryCount: (task.retryCount || 0) + 1,
        });
      }
    },
);
