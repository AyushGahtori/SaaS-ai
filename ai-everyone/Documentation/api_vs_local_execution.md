# Why App Executions Must Be API-Based (Not Local)

When integrating AI agents into a modern web application (like Pian), a common mistake is attempting to use local desktop automation tools (like PowerShell, AppleScript, or UI pathing) inside backend servers. 

This document explains why **all agent executions must rely on cloud APIs (like Microsoft Graph)** rather than local machine executions (like Outlook COM + PowerShell).

## The Core Problem: The Local vs. Cloud Divide

### 1. The Local Prototype ("The Sandbox")
When building a prototype on your personal laptop, you might write a Python script that uses `subprocess.call(["powershell..."])` or `win32com.client.Dispatch("Outlook.Application")`. 

This works because:
1. The script is running on Windows.
2. The Outlook app is installed on the same machine.
3. The script is running as your authenticated user profile.
4. It has access to your microphone and speakers (for speech-to-text / text-to-speech).

### 2. The Production Environment ("The Cloud")
Pian runs inside a **Docker container** locally, and will eventually be deployed to a cloud server like **Vercel**, **Google Cloud Run**, or **AWS ECS**.

These environments have none of the local dependencies:
1. **OS Mismatch**: Docker containers and cloud servers almost exclusively run **Linux (Ubuntu/Alpine)**, not Windows.
2. **Missing Software**: There is no Microsoft Office, Outlook, or Teams app installed on a Linux server.
3. **Headless Execution**: Servers do not have screens, mice, microphones, or speakers.
4. **Security Sandbox**: Cloud environments heavily restrict executing shell commands (like PowerShell) or creating COM objects for security reasons.

> [!WARNING]
> Attempting to run `New-Object -ComObject Outlook.Application` inside a Docker container or on Vercel will result in an immediate fatal crash, as neither the OS nor the application exists there.

---

## The Solution: REST APIs (e.g., Microsoft Graph)

To build software that works reliably in any environment (Docker, Cloud, Mac, Windows, Linux), agents must exclusively use **REST APIs HTTP requests**.

### How APIs Solve the Problem
Instead of telling the server to *"open the local Outlook app and search for Aaron,"* the server makes an HTTP web request to Microsoft's cloud servers: *"Here is my secure OAuth token. Please query the cloud directory for Aaron."*

| Feature | Local Execution (PowerShell/COM) | API Execution (Microsoft Graph) |
| :--- | :--- | :--- |
| **OS Requirement** | Windows Only | Any (Linux, Mac, Windows, Cloud) |
| **App Dependencies** | Requires Outlook/Teams installed | None (Requires 0 installed apps) |
| **Authentication** | Relies on currently logged-in desktop user | Standardized OAuth 2.0 Tokens |
| **Microphone/Speaker** | Relies on server hardware (breaks in cloud) | Handled purely by the Front-End Browser (Client side) |
| **Scalability** | Cannot scale (1 server = 1 desktop session) | Infinitely scalable (Millions of HTTP requests) |

---

## Example: The Teams Meeting Scheduler

During the development of Pian, we ported an experimental agent (`assistant.py`) into the robust backend agent `teams-agent.py`.

### ❌ The Old Approach (Local)
The original script used PowerShell to query the local Outlook database for email addresses, and used the Windows `System.Speech` DLL for voice outputs.

### ✅ The New Approach (API)
The ported `teams-agent.py`:
1. Uses the **Microsoft Graph API URL** (`https://graph.microsoft.com/v1.0/users`) to search the company directory for emails.
2. Returns deep-link URLs (`msteams://...` and `https://outlook.office.com/...`) back to the frontend.
3. Leaves **Speech and Audio** entirely to the frontend browser (`window.speechSynthesis`), since the browser is what the user is actually interacting with. 

## Best Practices for Future Agents
If you are adding a new agent to Pian, follow this rule:
> **If it requires you to open an app on your computer, use your mouse, or type in a terminal, it cannot be run by the backend server.** 

Always look for the **Developer REST API** for the service you want to integrate (e.g., Slack API, Google Calendar API, Microsoft Graph API).
