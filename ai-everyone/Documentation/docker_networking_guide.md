# Docker Networking Guide — Localhost vs Host.Docker.Internal

This guide explains how the Pian Parent LLM (Next.js) communicates with its specialized Python Agents within a Dockerized environment.

---

## 🏎 Quick Comparison

| URL | Target Location | When to Use |
|-----|----------------|-------------|
| **`http://localhost:8200`** | **Same Container** | Use when both Next.js and the Python Agent are running inside the *same* Docker container. |
| **`http://host.docker.internal:8200`** | **Host Machine (Windows)** | Use when Next.js is inside a container, but the Python Agent is running directly on your Windows desktop. |

---

## 1. Using `localhost`
When you use `docker exec -it Pian bash` and then run `python main.py`, the agent starts **inside the same environment** as the Next.js server. 

In this scenario:
- Both processes share the same local network interface.
- They talk to each other directly without touching the host machine's external network.
- **Next.js URL**: `http://localhost:<PORT>`

> [!NOTE]
> This is why we updated `firestore-tasks.server.ts` to use `localhost`—it ensures high-speed, direct communication between the frontend and your agents within the `Pian` container.

---

## 2. Using `host.docker.internal`
In some setups, you might want to run your Python agents on your Windows machine while keeping Next.js inside Docker. 

In this scenario:
- From inside the Docker container, `localhost` refers to the container itself (where nothing is listening on 8200).
- `host.docker.internal` acts as a "bridge" that allows the container to talk back to your primary Windows OS.
- **Next.js URL**: `http://host.docker.internal:<PORT>`

---

## 🛠 Troubleshooting Connection Errors

### Error: "Cannot connect to agent server"
If you see this error, check the following:

1. **Is the Server Running?**
   - Ensure you ran `python main.py` for the To-Do agent or `python server.py` for the Teams agent.
   - Look for the line: `Uvicorn running on http://0.0.0.0:8200`.

2. **Is it the Correct Port?**
   - **Teams Agent**: Port 8100
   - **To-Do Agent**: Port 8200

3. **Are you in the same Container?**
   - If you started the Python script in a terminal that is *not* inside the Docker container (`docker exec`), you may need to switch back to `host.docker.internal`.

4. **Environment Variables**
   - You can override these defaults at any time by adding `TODO_AGENT_URL` or `TEAMS_AGENT_URL` to your `.env` file in the root directory.
