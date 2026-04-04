# Documentation Hub

Single source of docs for `ai-everyone`.

## Priority Docs (Current Architecture)

- `ec2/ec2_runtime_readme.md`  
  Detached EC2 runtime model, service list, base URL policy, quick deploy.
- `ec2/ec2_api_reference.md`  
  Public health/action/auth endpoints, OAuth ownership model, auth modes, smoke examples.
- `ec2/ec2_deployment_runbook.md`  
  End-to-end deployment SOP, env requirements, verification, troubleshooting.
- `AWS architecture.md`  
  High-level AWS/EC2 architecture and data/auth flow rationale.
- `agents_integration_checklist.md`  
  Checklist for adding a new agent across web app + EC2 runtime.
- `agents_api_endpoints.md`  
  Teams-specific endpoint contract.
- `todo_agent_architecture.md`  
  Todo agent data model and detached runtime deployment notes.

## Marketplace and Agent Product Docs

- `agents_marketplace_overview.md`
- `agents_install_flow.md`
- `agents_frontend_components.md`
- `agents_database_schema.md`
- `agents_trending_logic.md`

## Platform / Architecture Docs

- `architecture_dev_vs_prod.md`
- `api_vs_local_execution.md`
- `Pian_architecture.md`
- `production_plan.md`
- `implementation_plan.md`

## LLM / Pipeline Notes

- `agentic_model_integration.md`
- `chatbot_ui_chat_pipeline_analysis.md`
- `raw_json_vs_tag_based.md`

## Persona Memory Docs

- `persona_memory_architecture.md`
- `persona_memory_cost_analysis.md`
- `persona_memory_database_schema.md`
- `persona_memory_extraction_pipeline.md`
- `persona_memory_onboarding_survey.md`

## Infra / Misc Notes

- `docker_networking_guide.md`
- `AWS_Connection_error.md`
- `auth-card-color-mismatch.md`
- `database-architecture.txt`
- `navbar-search-button.txt`
- `sidebar-colapse-button.txt`
- `trpc.txt`
- `cost-measurs-for-memory-extration.md`

## Policy

- Keep EC2 operational docs only under `Documentation/ec2/`.
- Do not keep duplicate markdown docs under `EC2/`.
- Prefer `${AGENT_PUBLIC_BASE_URL}` over hardcoded public IP in docs.
