import asyncio
import httpx
import json
import os

api_key = os.getenv("GEMINI_API_KEY", "").strip()
if not api_key:
    raise SystemExit("Set GEMINI_API_KEY before running this script.")
model = "gemini-2.5-flash"
endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

body = {
    "contents": [
        {
            "role": "user",
            "parts": [{"text": "Say hello in one word"}],
        }
    ]
}

async def test():
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(f"{endpoint}?key={api_key}", json=body)
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text[:300]}")
            response.raise_for_status()
            payload = response.json()
            candidates = payload.get("candidates") or []
            if candidates:
                parts = (((candidates[0] or {}).get("content") or {}).get("parts")) or []
                texts = [str(part.get("text") or "").strip() for part in parts if isinstance(part, dict)]
                print(f"Text: {texts}")
            else:
                print("No candidates!")
    except Exception as e:
        print(f"Exception: {type(e).__name__}: {e}")

asyncio.run(test())
