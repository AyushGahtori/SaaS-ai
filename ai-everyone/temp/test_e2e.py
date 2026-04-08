import asyncio
import httpx
import json

async def test():
    payload = {
        "taskId": None,
        "userId": "test",
        "agentId": "dia-helper-agent",
        "action": "generate_diagram",
        "prompt": "I want a simple data flow diagram of youtube",
        "projectContext": "I want a simple data flow diagram of youtube",
        "diagramType": None,
        "fileKey": None,
        "currentMermaid": None,
        "editInstruction": None,
    }
    async with httpx.AsyncClient(timeout=90.0) as client:
        r = await client.post("http://13.126.69.108/diahelper/action", json=payload)
        print(f"Status: {r.status_code}")
        data = r.json()
        print(json.dumps(data, indent=2)[:2000])

asyncio.run(test())
