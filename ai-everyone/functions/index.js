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
  // "email-agent": "/email/action",
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

      // ── 2. Update status to "running" ────────────────────────────────
      await taskRef.update({
        status: "running",
        startedAt: FieldValue.serverTimestamp(),
      });

      // ── 3. Call the agent's FastAPI server ───────────────────────────
      const agentServerUrl =
            process.env.AGENT_SERVER_URL || "http://host.docker.internal:8100";

      const agentUrl = `${agentServerUrl}${agentRoute}`;
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
        if (result.status === "success") {
          await taskRef.update({
            status: "success",
            agentOutput: result,
            finishedAt: FieldValue.serverTimestamp(),
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
