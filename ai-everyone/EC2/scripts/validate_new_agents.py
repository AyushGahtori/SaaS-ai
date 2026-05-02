from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AGENTS = {
    "leadgen-agent": ["server.py", "main.py", "requirements.txt", ".env.example", "backend/app/agent/graph.py"],
    "marketing-agent": ["server.py", "main.py", "requirements.txt", ".env.example", "marketing-agent/backend/agents/marketing_agent.py"],
    "aria-podcast-agent": ["server.py", "main.py", "requirements.txt", ".env.example", "backend/app/agents/react_agent.py"],
    "pr-copilot-review-agent": ["server.py", "main.py", "requirements.txt", ".env.example", "pr_copilot/graph.py"],
    "pian-labs-alos-agent": ["server.py", "main.py", "requirements.txt", ".env.example", "README.md"],
}

ROUTES = {
    "leadgen-agent": "/leadgen/action",
    "marketing-agent": "/marketing/action",
    "aria-podcast-agent": "/aria/action",
    "pr-copilot-review-agent": "/pr-copilot/action",
    "pian-labs-alos-agent": "/alos/action",
}


def main() -> None:
    errors: list[str] = []
    for agent, required_files in AGENTS.items():
        agent_root = ROOT / "agents" / agent
        if not agent_root.exists():
            errors.append(f"Missing agent folder: {agent}")
            continue
        for rel in required_files:
            if not (agent_root / rel).exists():
                errors.append(f"Missing {agent}/{rel}")

    marketplace_path = ROOT / "marketplace" / "agents.json"
    marketplace = json.loads(marketplace_path.read_text())
    marketplace_ids = {item["id"]: item for item in marketplace}
    for agent, route in ROUTES.items():
        item = marketplace_ids.get(agent)
        if not item:
            errors.append(f"Marketplace missing {agent}")
            continue
        if item.get("route") != route:
            errors.append(f"Marketplace route mismatch for {agent}: {item.get('route')} != {route}")
        if not item.get("actions"):
            errors.append(f"Marketplace missing actions for {agent}")

    for path in [
        ROOT / ".env.example",
        ROOT / "deploy.sh",
        ROOT / "nginx" / "snippets" / "pian-new-agent-locations.conf",
    ]:
        if not path.exists():
            errors.append(f"Missing {path.relative_to(ROOT)}")

    if errors:
        raise SystemExit("\n".join(errors))
    print("EC2 new agent validation passed.")


if __name__ == "__main__":
    main()
