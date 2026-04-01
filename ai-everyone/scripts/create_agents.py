import os

AGENTS = {
    "canva-agent": {"port": 8001, "env": "CANVA_CLIENT_ID=\nCANVA_CLIENT_SECRET="},
    "day-planner-agent": {"port": 8002, "env": "FIREBASE_SERVICE_ACCOUNT_KEY=./serviceAccountKey.json"},
    "discord-agent": {"port": 8003, "env": "DISCORD_CLIENT_ID=\nDISCORD_CLIENT_SECRET="},
    "dropbox-agent": {"port": 8004, "env": "DROPBOX_CLIENT_ID=\nDROPBOX_CLIENT_SECRET="},
    "freshdesk-agent": {"port": 8005, "env": "FRESHDESK_CLIENT_ID=\nFRESHDESK_CLIENT_SECRET="},
    "github-agent": {"port": 8006, "env": "GITHUB_CLIENT_ID=\nGITHUB_CLIENT_SECRET="},
    "gitlab-agent": {"port": 8007, "env": "GITLAB_CLIENT_ID=\nGITLAB_CLIENT_SECRET="},
    "greenhouse-agent": {"port": 8008, "env": "GREENHOUSE_API_KEY="},
    "jira-agent": {"port": 8009, "env": "JIRA_CLIENT_ID=\nJIRA_CLIENT_SECRET="},
    "linkedin-agent": {"port": 8010, "env": "LINKEDIN_CLIENT_ID=\nLINKEDIN_CLIENT_SECRET="},
    "zoom-agent": {"port": 8011, "env": "ZOOM_CLIENT_ID=\nZOOM_CLIENT_SECRET="}
}

SERVER_PY = '''"""
api/server.py
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict

logger = logging.getLogger(__name__)

app = FastAPI(title="{name} API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class AgentTaskRequest(BaseModel):
    taskId: str
    userId: str
    agentId: str
    action: str
    model_config = ConfigDict(extra='allow')

class AgentTaskResponse(BaseModel):
    status: str
    type: str | None = None
    error: str | None = None
    message: str | None = None
    tasks: list[dict] | None = None
    data: dict | None = None
    displayName: str | None = None

@app.post("/{route}/action", response_model=AgentTaskResponse)
def execute_action(req: AgentTaskRequest) -> AgentTaskResponse:
    try:
        # Placeholder for {name} logic
        return AgentTaskResponse(status="success", message="Executed action: "+req.action)
    except Exception as e:
        return AgentTaskResponse(status="failed", error=str(e))

@app.get("/health", tags=["System"])
def health():
    return {{"status": "healthy", "agent": "{name}"}}
'''

MAIN_PY = '''import os
import uvicorn
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "{port}"))
    print(f"🚀 Starting API on port {port}")
    uvicorn.run("api.server:app", host="0.0.0.0", port=port, reload=False)
'''

REQ_TXT = """fastapi>=0.111\nuvicorn[standard]>=0.30\npydantic>=2.7\npython-dotenv>=1.0\nrequests>=2.31\n"""

def main():
    base_dir = r"e:\\SaaS-ai\\ai-everyone\\agents"
    for agent, config in AGENTS.items():
        agent_dir = os.path.join(base_dir, agent)
        api_dir = os.path.join(agent_dir, "api")
        os.makedirs(api_dir, exist_ok=True)
        
        with open(os.path.join(agent_dir, "requirements.txt"), "w", encoding="utf-8") as f:
            f.write(REQ_TXT)
            
        with open(os.path.join(agent_dir, ".env.example"), "w", encoding="utf-8") as f:
            f.write(config["env"] + f"\nPORT={config['port']}")
            
        with open(os.path.join(agent_dir, "main.py"), "w", encoding="utf-8") as f:
            f.write(MAIN_PY.format(port=config["port"]))
            
        route = agent.replace('-agent', '').replace('_', '')
        name = route.capitalize() + " Agent"
        with open(os.path.join(api_dir, "server.py"), "w", encoding="utf-8") as f:
            f.write(SERVER_PY.format(route=route, name=name))
            
        print(f"Created {agent}")

if __name__ == "__main__":
    main()
