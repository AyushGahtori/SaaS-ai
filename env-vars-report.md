# SaaS-ai env variables report (keys/secrets only)

This file lists only env vars that look like API keys / secrets / tokens.

- Env files scanned: **56**
- Unique key/secret-like vars defined in env files: **33**
- Key/secret-like vars referenced in code/config: **27**
- Referenced but missing from env files: **3**

## All key/secret-like variables defined in env files

- `AGENT_OAUTH_SHARED_SECRET`
- `CANVA_CLIENT_SECRET`
- `DISCORD_CLIENT_SECRET`
- `DROPBOX_CLIENT_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `FMP_API_KEY`
- `FRESHDESK_API_KEY`
- `FRESHDESK_CLIENT_SECRET`
- `GEMINI_API_KEY`
- `GEMINI_MAX_OUTPUT_TOKENS`
- `GITHUB_CLIENT_SECRET`
- `GITLAB_CLIENT_SECRET`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_MAPS_API_KEY`
- `GREENHOUSE_API_KEY`
- `JIRA_CLIENT_SECRET`
- `JSEARCH_API_KEY`
- `JSEARCH_RAPIDAPI_KEY`
- `JWT_SECRET`
- `LINKEDIN_API_KEY`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_Primary_Client_Secret`
- `MICROSOFT_CLIENT_SECRET`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NOTION_CLIENT_SECRET`
- `OPENAI_API_KEY`
- `RAPIDAPI_KEY`
- `SERPAPI_API_KEY`
- `TAVILY_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `YOUTUBE_API_KEY`
- `ZOOM_CLIENT_SECRET`

## Referenced in code/config but missing from env files

- `AGENT_OAUTH_SECRET`
- `SECRETS_DIR`
- `STRATA_FMP_API_KEY`

## Key/secret-like variables by env file

### `ai-everyone/.env`

- `AGENT_OAUTH_SHARED_SECRET`
- `CANVA_CLIENT_SECRET`
- `DISCORD_CLIENT_SECRET`
- `DROPBOX_CLIENT_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `FRESHDESK_API_KEY`
- `GEMINI_API_KEY`
- `GITHUB_CLIENT_SECRET`
- `GITLAB_CLIENT_SECRET`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_MAPS_API_KEY`
- `GREENHOUSE_API_KEY`
- `JIRA_CLIENT_SECRET`
- `JWT_SECRET`
- `LINKEDIN_CLIENT_SECRET`
- `MICROSOFT_CLIENT_SECRET`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NOTION_CLIENT_SECRET`
- `OPENAI_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `ZOOM_CLIENT_SECRET`

### `ai-everyone/EC2/agents/canva-agent/.env.example`

- `AGENT_OAUTH_SHARED_SECRET`
- `CANVA_CLIENT_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_KEY`

### `ai-everyone/EC2/agents/career-switch-agent/.env`

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `GEMINI_API_KEY`
- `JSEARCH_API_KEY`
- `LINKEDIN_Primary_Client_Secret`
- `YOUTUBE_API_KEY`

### `ai-everyone/EC2/agents/career-switch-agent/.env.example`

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MAX_OUTPUT_TOKENS`
- `JSEARCH_API_KEY`
- `JSEARCH_RAPIDAPI_KEY`
- `LINKEDIN_API_KEY`
- `LINKEDIN_Primary_Client_Secret`
- `RAPIDAPI_KEY`
- `YOUTUBE_API_KEY`

### `ai-everyone/EC2/agents/dashboard-designer-agent/.env.example`

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `GEMINI_API_KEY`

### `ai-everyone/EC2/agents/day-planner-agent/.env.example`

- `FIREBASE_SERVICE_ACCOUNT_KEY`

### `ai-everyone/EC2/agents/dia-helper-agent/.env.example`

- `GEMINI_API_KEY`

### `ai-everyone/EC2/agents/discord-agent/.env.example`

- `AGENT_OAUTH_SHARED_SECRET`
- `DISCORD_CLIENT_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_KEY`

### `ai-everyone/EC2/agents/dropbox-agent/.env.example`

- `AGENT_OAUTH_SHARED_SECRET`
- `DROPBOX_CLIENT_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_KEY`

### `ai-everyone/EC2/agents/emergency-response-agent/.env.example`

- `GOOGLE_MAPS_API_KEY`

### `ai-everyone/EC2/agents/freshdesk-agent/.env.example`

- `FRESHDESK_API_KEY`

### `ai-everyone/EC2/agents/github-agent/.env`

- `AGENT_OAUTH_SHARED_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `GITHUB_CLIENT_SECRET`

### `ai-everyone/EC2/agents/github-agent/.env.example`

- `AGENT_OAUTH_SHARED_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `GITHUB_CLIENT_SECRET`

### `ai-everyone/EC2/agents/gitlab-agent/.env.example`

- `AGENT_OAUTH_SHARED_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `GITLAB_CLIENT_SECRET`

### `ai-everyone/EC2/agents/google-agent/.env.example`

- `AGENT_OAUTH_SHARED_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_CLIENT_SECRET`

### `ai-everyone/EC2/agents/greenhouse-agent/.env.example`

- `GREENHOUSE_API_KEY`

### `ai-everyone/EC2/agents/jira-agent/.env.example`

- `AGENT_OAUTH_SHARED_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `JIRA_CLIENT_SECRET`

### `ai-everyone/EC2/agents/linkedin-agent/.env.example`

- `AGENT_OAUTH_SHARED_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `LINKEDIN_CLIENT_SECRET`

### `ai-everyone/EC2/agents/maps-agent/.env`

- `GOOGLE_MAPS_API_KEY`

### `ai-everyone/EC2/agents/maps-agent/.env.example`

- `GOOGLE_MAPS_API_KEY`

### `ai-everyone/EC2/agents/notion-agent/.env.example`

- `AGENT_OAUTH_SHARED_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `NOTION_CLIENT_SECRET`

### `ai-everyone/EC2/agents/seo-agent/.env.example`

- `GEMINI_API_KEY`
- `SERPAPI_API_KEY`

### `ai-everyone/EC2/agents/shopgenie-agent/.env.example`

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_CLIENT_SECRET`
- `TAVILY_API_KEY`
- `YOUTUBE_API_KEY`

### `ai-everyone/EC2/agents/smart-gtm-agent/.env.example`

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `GEMINI_API_KEY`
- `TAVILY_API_KEY`

### `ai-everyone/EC2/agents/startup-fundraising-agent/.env.example`

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `GEMINI_API_KEY`

### `ai-everyone/EC2/agents/strata-agent/.env`

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `FMP_API_KEY`
- `GEMINI_API_KEY`

### `ai-everyone/EC2/agents/strata-agent/.env.example`

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `FMP_API_KEY`
- `GEMINI_API_KEY`

### `ai-everyone/EC2/agents/teams-agent/.env.example`

- `AGENT_OAUTH_SHARED_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `MICROSOFT_CLIENT_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

### `ai-everyone/EC2/agents/todo-agent/.env.example`

- `FIREBASE_SERVICE_ACCOUNT_KEY`

### `ai-everyone/EC2/agents/zoom-agent/.env.example`

- `AGENT_OAUTH_SHARED_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `ZOOM_CLIENT_SECRET`

### `ai-everyone/agents/canva-agent/.env.example`

- `CANVA_CLIENT_SECRET`

### `ai-everyone/agents/career-switch-agent/.env.example`

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MAX_OUTPUT_TOKENS`
- `JSEARCH_API_KEY`
- `JSEARCH_RAPIDAPI_KEY`
- `LINKEDIN_API_KEY`
- `LINKEDIN_Primary_Client_Secret`
- `RAPIDAPI_KEY`
- `YOUTUBE_API_KEY`

### `ai-everyone/agents/dashboard-designer-agent/.env.example`

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `GEMINI_API_KEY`

### `ai-everyone/agents/day-planner-agent/.env.example`

- `FIREBASE_SERVICE_ACCOUNT_KEY`

### `ai-everyone/agents/dia-helper-agent/.env.example`

- `GEMINI_API_KEY`

### `ai-everyone/agents/discord-agent/.env.example`

- `DISCORD_CLIENT_SECRET`

### `ai-everyone/agents/dropbox-agent/.env.example`

- `DROPBOX_CLIENT_SECRET`

### `ai-everyone/agents/emergency-response-agent/.env.example`

- `GOOGLE_MAPS_API_KEY`

### `ai-everyone/agents/freshdesk-agent/.env.example`

- `FRESHDESK_CLIENT_SECRET`

### `ai-everyone/agents/github-agent/.env.example`

- `GITHUB_CLIENT_SECRET`

### `ai-everyone/agents/gitlab-agent/.env.example`

- `GITLAB_CLIENT_SECRET`

### `ai-everyone/agents/google-agent/.env`

- `GEMINI_API_KEY`
- `GOOGLE_CLIENT_SECRET`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

### `ai-everyone/agents/greenhouse-agent/.env.example`

- `GREENHOUSE_API_KEY`

### `ai-everyone/agents/jira-agent/.env.example`

- `JIRA_CLIENT_SECRET`

### `ai-everyone/agents/linkedin-agent/.env.example`

- `LINKEDIN_CLIENT_SECRET`

### `ai-everyone/agents/maps-agent/.env.example`

- `GOOGLE_MAPS_API_KEY`

### `ai-everyone/agents/notion-agent/.env.example`

- `NOTION_CLIENT_SECRET`

### `ai-everyone/agents/seo-agent/.env.example`

- `GEMINI_API_KEY`
- `SERPAPI_API_KEY`

### `ai-everyone/agents/shopgenie-agent/.env.example`

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_CLIENT_SECRET`
- `TAVILY_API_KEY`
- `YOUTUBE_API_KEY`

### `ai-everyone/agents/smart-gtm-agent/.env.example`

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `GEMINI_API_KEY`
- `TAVILY_API_KEY`

### `ai-everyone/agents/startup-fundraising-agent/.env.example`

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `GEMINI_API_KEY`

### `ai-everyone/agents/strata-agent/.env`

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `FMP_API_KEY`
- `GEMINI_API_KEY`

### `ai-everyone/agents/strata-agent/.env.example`

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `FMP_API_KEY`
- `GEMINI_API_KEY`

### `ai-everyone/agents/teams-agent/.env`

- `MICROSOFT_CLIENT_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

### `ai-everyone/agents/teams-agent/.env.example`

- `MICROSOFT_CLIENT_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

### `ai-everyone/agents/zoom-agent/.env.example`

- `ZOOM_CLIENT_SECRET`

