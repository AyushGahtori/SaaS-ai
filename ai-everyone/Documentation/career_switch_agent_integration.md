# Career Switch Agent Integration

## Overview
The Career Switch Agent is an AI-powered career transition planning tool integrated into the Pian platform. It uses O*NET database, live job market data, and an LLM to generate personalized career roadmaps with skill gap analysis.

## Architecture Overview
- **Primary Entry Point**: Local development app or EC2 detached runtime
- **Port (Local)**: 8022
- **Port (EC2)**: 8022
- **API Endpoint**: `/career-switch/action`
- **Health Check**: `/health` or `/career-switch/health`

## Features
- **Career Profile Analysis**: Accepts current role, target role, skills, experience, and education
- **Skill Gap Computation**: Identifies missing and matching skills using O*NET database
- **Job Market Insights**: Fetches real job listings from JSearch, Adzuna, and LinkedIn
- **Personalized Roadmap**: AI-generated roadmap with phases, goals, and resources
- **Project Recommendations**: Suggested projects to build portfolio
- **Job Application Strategy**: Tailored application tips and timing guidance

## Input Schema
```json
{
  "action": "generate_plan",
  "current_role": "Data Analyst",
  "target_role": "Machine Learning Engineer",
  "skills": ["python", "sql", "excel", "statistics"],
  "experience_years": 2,
  "education": "B.Tech"
}
```

## Output Schema
Returns a structured career plan with:
- `career_summary`: Text overview of the transition
- `skill_gap_breakdown`: Core, supporting, and optional skills
- `market_insights`: Companies, technologies, demand level
- `roadmap`: Phases with timeline, goals, resources
- `project_recommendations`: Portfolio projects
- `job_application_strategy`: Start date, target roles, tips
- `final_advice`: Overall guidance

## Local Development Setup

### Prerequisites
- MongoDB (for O*NET role database)
- Ollama (for LLM, default: gemma3:27b-cloud)
- Python 3.9+
- Optional: JSearch API, Adzuna API, LinkedIn Jobs API, YouTube API

### Installation
```bash
cd ai-everyone/agents/career-switch-agent
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API credentials
```

### Running Locally
```bash
python main.py
# Server starts on http://localhost:8022
```

### Health Check
```bash
curl http://localhost:8022/health
```

## EC2 Deployment

### Pre-Deployment
1. Ensure career-switch-agent files are in `EC2/agents/career-switch-agent/`
2. Service file exists at: `EC2/systemd/career-switch-agent.service`
3. Nginx routes configured in: `EC2/nginx/sites-available/agents`
4. Deploy script includes agent in `AGENT_DIRS` and health checks

### Deployment Steps
```bash
ssh -i "C:\Users\Ayush\Downloads\agent-key.pem" ubuntu@13.206.83.175
cd /home/ubuntu/app
git pull
sudo ./deploy.sh
```

### Post-Deployment Verification
```bash
# Check service status
systemctl is-active career-switch-agent

# Local health check
curl http://localhost:8022/health

# Public health check
curl "http://13.206.83.175/career-switch/health"

# Action endpoint smoke test
curl -X POST "http://13.206.83.175/career-switch/action" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate_plan",
    "current_role": "Data Analyst",
    "target_role": "Machine Learning Engineer",
    "skills": ["python", "sql"],
    "experience_years": 2,
    "education": "B.Tech"
  }'
```

## Environment Variables

### Required (for development/testing)
- `PORT`: Service port (default: 8022)
- `MONGO_URI`: MongoDB connection string (e.g., `mongodb://localhost:27017/`)
- `MONGO_DB`: Database name (default: `career_agent`)
- `MONGO_COLLECTION`: Collection name (default: `roles`)

### Optional (for full functionality)
- `JSEARCH_API_KEY`: RapidAPI key for job search
- `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`: Adzuna job API credentials
- `LINKEDIN_API_KEY`: LinkedIn Jobs API credentials
- `YOUTUBE_API_KEY`: YouTube API for skill learning links
- `OLLAMA_BASE_URL`: Ollama server URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL`: LLM model name (default: `gemma3:27b-cloud`)

## Integration Points

### 1. Catalog (`src/lib/agents/catalog.ts`)
Agent is registered with:
- ID: `career-switch-agent`
- Category: `career`
- Provider: `internal`
- Actions: `generate_plan`
- Tags: career, planning, skills, roadmap, transition

### 2. Marketplace (`src/lib/agents/marketplace.ts`)
Metadata includes:
- Custom icon with cyan-blue gradient
- 2800+ install count
- 4.8 rating
- 715 trending score

### 3. Orchestration (`src/lib/firestore-tasks.server.ts`)
- Route: `/career-switch/action`
- ENV var: `CAREER_SWITCH_AGENT_URL`
- Health endpoint: `/health` or `/career-switch/health`

### 4. UI Rendering (`src/modules/chat/ui/components/agent-task-message.tsx`)
- Result type: `career_plan`
- Renderer: `CareerPlanResultCard` component
- Displays: Skill breakdown, roadmap, projects, market insights, strategy, advice

## Dependencies

### Core
- FastAPI: Web framework
- Pydantic: Request/response validation
- Uvicorn: ASGI server
- pymongo: MongoDB driver

### Optional (for full pipeline)
- ollama: LLM client
- httpx: HTTP requests for APIs
- python-dotenv: Environment configuration

## Testing

### Unit Test (Minimal)
```bash
curl -X POST http://localhost:8022/career-switch/action \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate_plan",
    "current_role": "Data Analyst",
    "target_role": "Software Engineer",
    "skills": ["python", "sql"],
    "experience_years": 2,
    "education": "B.Tech"
  }'
```

### Output Validation
- Status: "success"
- Type: "career_plan"
- Result contains all required fields (career_summary, skill_gap_breakdown, market_insights, roadmap, project_recommendations, job_application_strategy, final_advice)
- Fallback mode gracefully handles missing dependencies

## Troubleshooting

### MongoDB Not Reachable
- Check MongoDB is running: `mongosh --eval "db.adminCommand('ping')"`
- Verify `MONGO_URI` in `.env`
- Falls back to structured response (see below)

### Ollama Model Not Found
- Ensure model is installed: `ollama pull gemma3:27b-cloud`
- Check `OLLAMA_BASE_URL` points to running Ollama server
- Falls back to structured response with warning

### External API Failures
- If JSearch/Adzuna/LinkedIn fail, job market data is empty but plan is still generated
- Falls back to structured response

### Graceful Fallback
When dependencies are unavailable, the agent returns a well-structured response with:
- Error explanation in `career_summary`
- Empty skill gap and market insights
- Generic investigation roadmap
- Portfolio foundation project suggestion
- Helpful troubleshooting tips

This ensures the user always receives a complete, actionable response even when external services fail.

## File Structure

### Local
```
agents/career-switch-agent/
├── main.py            # Entry point launcher
├── server.py          # FastAPI server with action endpoint
├── requirements.txt   # Python dependencies
├── .env.example       # Configuration template
└── api/              # Source logic (migrated from career-switch-data)
    ├── config.py
    ├── database.py
    ├── models.py
    ├── skill_gap.py
    ├── llm_engine.py
    ├── routes.py
    ├── adzuna.py
    ├── jsearch.py
    ├── linkedin.py
    └── youtube.py
```

### EC2
```
EC2/agents/career-switch-agent/
├── main.py            # Entry point launcher
├── server.py          # FastAPI server (identical to local)
├── requirements.txt   # Python dependencies
├── .env.example       # Configuration template
└── (all source files copied from api/)

EC2/systemd/
└── career-switch-agent.service  # Systemd service file

EC2/nginx/sites-available/
└── agents  # Updated with upstream & location blocks
```

## Notes

- The agent is **non-OAuth**: No additional user authorization required beyond platform login
- The agent is **CPU/LLM-intensive**: Roadmap generation may take 10-30 seconds depending on LLM model and system load
- High **Nginx timeout**: Set to 300s for LLM inference
- **Self-contained EC2 deployment**: No imports from main app, fully independent
- **Graceful degradation**: Works without MongoDB, APIs, or Ollama with fallback responses

## Future Enhancements

- Add O*NET API integration to replace MongoDB dependency
- Implement caching for job market data
- Support for multiple language preference in roadmaps
- Export roadmap to PDF/calendar format
- Integration with LinkedIn profile auto-fill
