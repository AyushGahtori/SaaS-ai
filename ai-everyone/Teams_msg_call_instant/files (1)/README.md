# AI Personal Assistant - Teams Integration

This project now uses two services together:

- Ollama (`qwen3.5:397b-cloud`) for intent extraction
- Microsoft Graph for searching your Microsoft 365 / Teams people by name

## What Changed

The terminal assistant no longer needs a hardcoded contacts list and no longer asks for an email first.

Current terminal flow:

1. You say `call nandini`
2. Ollama extracts the intent and target name
3. Microsoft Graph searches your Teams / Microsoft 365 directory
4. If one match is found, the assistant confirms and opens Teams
5. If multiple matches are found, the assistant asks you to choose
6. For messages, it asks for the message text only if it was missing

## Files

- `assistant_agent.py`
  Terminal assistant with Ollama parsing plus Microsoft Graph people lookup.
- `assistant_ui.jsx`
  Existing browser UI. It still uses the older local conversational flow and has not been upgraded to Graph-backed search.
- `requirements.txt`
  Python dependencies.

## Setup

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Make sure Ollama is running locally and has this model:

```bash
ollama list
```

Required model:

`qwen3.5:397b-cloud`

3. The repository is preconfigured with this Microsoft Entra app registration:

- Client ID: `a33c08ae-ae48-460c-a79c-d58098af1a03`
- Tenant ID: `41503967-0840-4715-9d4d-1741979db5d9`

If you want to override them, set these environment variables:

```bash
# Required
set GRAPH_CLIENT_ID=your_app_client_id

# Optional; defaults to organizations
set GRAPH_TENANT_ID=organizations
```

4. Grant delegated Microsoft Graph permissions for:

- `User.Read`
- `People.Read`
- `User.ReadBasic.All`

Depending on your tenant, `User.ReadBasic.All` may require admin consent.

5. Run the terminal assistant:

```bash
python assistant_agent.py
```

The first Graph lookup will start Microsoft device-code sign-in.

## Notes

- Teams calls and chats are still launched through Teams deep links.
- Graph is used only to resolve people by name to a Teams-usable identity.
- If multiple users match a short name like `Nandini`, the assistant will ask you which one you mean.
~Go to Microsoft Entra admin center -> App registrations -> your app a33c08ae-ae48-460c-a79c-d58098af1a03
~Open Authentication
~In Advanced settings, set Allow public client flows to Yes
~Save
~Then check API permissions and ensure these delegated permissions exist:
User.Read
People.Read
User.ReadBasic.All