import os

AGENTS = {
    'canva-agent':       ('8001', 'Canva Agent'),
    'day-planner-agent': ('8002', 'Day Planner Agent'),
    'discord-agent':     ('8003', 'Discord Agent'),
    'dropbox-agent':     ('8004', 'Dropbox Agent'),
    'freshdesk-agent':   ('8005', 'Freshdesk Agent'),
    'github-agent':      ('8006', 'GitHub Agent'),
    'gitlab-agent':      ('8007', 'GitLab Agent'),
    'greenhouse-agent':  ('8008', 'Greenhouse Agent'),
    'jira-agent':        ('8009', 'Jira Agent'),
    'linkedin-agent':    ('8010', 'LinkedIn Agent'),
    'zoom-agent':        ('8011', 'Zoom Agent'),
    'strata-agent':      ('8012', 'Strata Agent'),
}

base = r'e:\SaaS-ai\ai-everyone\agents'

for agent, (port, name) in AGENTS.items():
    agent_dir = os.path.join(base, agent)

    server_py = f'''"""
server.py — {name} root entry-point.
Mirrors the teams-agent/server.py pattern.

Run with:
    python server.py
Or directly:
    uvicorn api.server:app --host 0.0.0.0 --port {port}
"""
import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from api.server import app  # noqa: F401 — re-exports the FastAPI app

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "{port}"))
    print(f"Starting {name} on port {{port}}")
    uvicorn.run("api.server:app", host="0.0.0.0", port=port, reload=False)
'''

    main_py = f'''"""
main.py — {name} launcher (kept for backward-compat with deploy.sh).
Delegates to api/server.py FastAPI app.
"""
import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "{port}"))
    print(f"Starting {name} on port {{port}}")
    uvicorn.run("api.server:app", host="0.0.0.0", port=port, reload=False)
'''

    with open(os.path.join(agent_dir, 'server.py'), 'w', encoding='utf-8') as f:
        f.write(server_py)

    with open(os.path.join(agent_dir, 'main.py'), 'w', encoding='utf-8') as f:
        f.write(main_py)

    print(f'OK: {agent}')
