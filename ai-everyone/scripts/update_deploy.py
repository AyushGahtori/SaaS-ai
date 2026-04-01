import os
import re

AGENTS = [
    "canva", "day-planner", "discord", "dropbox", "freshdesk",
    "github", "gitlab", "greenhouse", "jira", "linkedin", "zoom"
]

def update_deploy_sh():
    deploy_file = r"e:\\SaaS-ai\\ai-everyone\\EC2\\deploy.sh"
    with open(deploy_file, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add _DIR references
    if "CANVA_DIR=" not in content:
        dir_lines = ""
        setup_lines = ""
        systemd_lines = ""
        list_agents = ""
        
        for a in AGENTS:
            NAME = a.replace("-", "_").upper()
            dir_lines += f'{NAME}_DIR="${{APP_DIR}}/agents/{a}-agent"\\n'
            setup_lines += f'    setup_python_env "${{{NAME}_DIR}}"\\n'
            systemd_lines += f'    install -m 0644 "${{SYSTEMD_SRC_DIR}}/{a}-agent.service" /etc/systemd/system/{a}-agent.service\\n'
            list_agents += f'{a}-agent '

        content = content.replace('MAPS_DIR="${APP_DIR}/agents/maps-agent"\\n', f'MAPS_DIR="${{APP_DIR}}/agents/maps-agent"\\n{dir_lines}')
        content = content.replace('setup_python_env "${MAPS_DIR}"\\n', f'setup_python_env "${{MAPS_DIR}}"\\n{setup_lines}')
        content = content.replace('install -m 0644 "${SYSTEMD_SRC_DIR}/maps-agent.service" /etc/systemd/system/maps-agent.service\\n', 
                                  f'install -m 0644 "${{SYSTEMD_SRC_DIR}}/maps-agent.service" /etc/systemd/system/maps-agent.service\\n{systemd_lines}')
        
        content = content.replace('systemctl enable --now teams-agent todo-agent google-agent notion-agent maps-agent\\n',
                                  f'systemctl enable --now teams-agent todo-agent google-agent notion-agent maps-agent {list_agents}\\n')
        content = content.replace('systemctl restart teams-agent todo-agent google-agent notion-agent maps-agent\\n',
                                  f'systemctl restart teams-agent todo-agent google-agent notion-agent maps-agent {list_agents}\\n')

        # check require_dir block
        req_lines = ""
        for a in AGENTS:
            NAME = a.replace("-", "_").upper()
            req_lines += f'    require_dir "${{{NAME}_DIR}}"\\n'
        content = content.replace('require_dir "${MAPS_DIR}"\\n', f'require_dir "${{MAPS_DIR}}"\\n{req_lines}')

        # write back
        with open(deploy_file, "w", encoding="utf-8") as f:
            f.write(content)

def update_env():
    env_file = r"e:\\SaaS-ai\\ai-everyone\\.env"
    with open(env_file, "r", encoding="utf-8") as f:
        content = f.read()

    new_env = "\\n# ── New Integration Agents ────────────────────────────────\\n"
    for a in AGENTS:
        NAME = a.replace("-", "_").upper()
        if f"{NAME}_AGENT_URL" not in content:
            new_env += f"{NAME}_AGENT_URL=http://13.206.83.175\\n"
            
    if "# ── New Integration Agents ────────────────────────────────" not in content:
         content += new_env
         with open(env_file, "w", encoding="utf-8") as f:
             f.write(content)

if __name__ == "__main__":
    update_deploy_sh()
    update_env()
    print("Updated deploy.sh and .env successfully.")
