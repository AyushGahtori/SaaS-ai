import asyncio
import httpx
import json

async def test():
    # Step 1: Generate
    payload = {
        "taskId": None,
        "userId": "test",
        "agentId": "dia-helper-agent",
        "action": "generate_diagram",
        "prompt": "create a data flow diagram for Netflix",
        "projectContext": "create a data flow diagram for Netflix",
        "diagramType": None,
        "fileKey": None,
        "currentMermaid": None,
        "editInstruction": None,
    }
    print("=== STEP 1: Generate Netflix diagram ===")
    async with httpx.AsyncClient(timeout=90.0) as client:
        r = await client.post("http://13.126.69.108/diahelper/action", json=payload)
        data = r.json()
        print(f"Status: {r.status_code}")
        result = data.get("result", {})
        mermaid_code = result.get("mermaid", "")
        print(f"Title: {result.get('title', 'N/A')}")
        print(f"Mermaid length: {len(mermaid_code)}")
        print(f"Mermaid start: {mermaid_code[:200]}")
        print(f"Summary: {result.get('summary', 'N/A')[:200]}")

    # Step 2: Update - add a database
    payload2 = {
        "taskId": None,
        "userId": "test",
        "agentId": "dia-helper-agent",
        "action": "update_diagram",
        "prompt": "add a database layer",
        "projectContext": "Netflix data flow diagram",
        "diagramType": None,
        "fileKey": None,
        "currentMermaid": mermaid_code,
        "editInstruction": "add a database layer",
    }
    print("\n=== STEP 2: Update - add database ===")
    async with httpx.AsyncClient(timeout=90.0) as client:
        r2 = await client.post("http://13.126.69.108/diahelper/action", json=payload2)
        data2 = r2.json()
        print(f"Status: {r2.status_code}")
        result2 = data2.get("result", {})
        mermaid2 = result2.get("mermaid", "")
        print(f"Title: {result2.get('title', 'N/A')}")
        print(f"Mermaid length: {len(mermaid2)}")
        print(f"Has 'database' or 'DB': {'database' in mermaid2.lower() or 'db' in mermaid2.lower()}")
        print(f"Mermaid start: {mermaid2[:300]}")

asyncio.run(test())
