import os
import shutil

AGENTS = {
    "canva-agent": 8001,
    "day-planner-agent": 8002,
    "discord-agent": 8003,
    "dropbox-agent": 8004,
    "freshdesk-agent": 8005,
    "github-agent": 8006,
    "gitlab-agent": 8007,
    "greenhouse-agent": 8008,
    "jira-agent": 8009,
    "linkedin-agent": 8010,
    "zoom-agent": 8011
}

def sync_agents():
    local_dir = r"e:\SaaS-ai\ai-everyone\agents"
    ec2_dir = r"e:\SaaS-ai\ai-everyone\EC2\agents"
    for agent in AGENTS:
        src = os.path.join(local_dir, agent)
        dst = os.path.join(ec2_dir, agent)
        if os.path.exists(dst):
            shutil.rmtree(dst)
        shutil.copytree(src, dst)

def create_systemd():
    systemd_dir = r"e:\SaaS-ai\ai-everyone\EC2\systemd"
    os.makedirs(systemd_dir, exist_ok=True)
    
    template = '''[Unit]
Description={name} FastAPI Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/app/agents/{agent}
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=-/home/ubuntu/app/agents/{agent}/.env
ExecStart=/home/ubuntu/app/agents/{agent}/venv/bin/uvicorn api.server:app --host 0.0.0.0 --port {port} --workers 1
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
'''

    for agent, port in AGENTS.items():
        name = agent.replace('-agent', '').capitalize().replace('_', ' ') + " Agent"
        content = template.format(agent=agent, port=port, name=name)
        with open(os.path.join(systemd_dir, f"{agent}.service"), "w", encoding="utf-8") as f:
            f.write(content)

def update_nginx():
    nginx_file = r"e:\SaaS-ai\ai-everyone\EC2\nginx\sites-available\agents"
    if not os.path.exists(nginx_file):
        return
        
    with open(nginx_file, "r", encoding="utf-8") as f:
        content = f.read()

    upstreams = ""
    locations = ""

    for agent, port in AGENTS.items():
        name = agent.replace('-agent', '').replace('_', '')
        upstream_name = f"{name}_agent_new"
        upstreams += f"upstream {upstream_name} {{\\n    server 127.0.0.1:{port};\\n    keepalive 16;\\n}}\\n\\n"
        
        locations += f"""    location = /{name}/action {{
        proxy_pass http://{upstream_name}/{name}/action;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }}
    
    location = /{name}/health {{
        proxy_pass http://{upstream_name}/health;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

"""
    # Insert new blocks into Nginx
    if "canva_agent_new" not in content:
         # insert at top for upstreams
         content = upstreams + content
         # insert before last }
         idx = content.rfind('}')
         content = content[:idx] + locations + content[idx:]
         
         with open(nginx_file, "w", encoding="utf-8") as f:
             f.write(content)

def main():
    sync_agents()
    print("Synced agents to EC2 directory.")
    create_systemd()
    print("Created systemd service files.")
    update_nginx()
    print("Updated nginx configuration.")

if __name__ == "__main__":
    main()
