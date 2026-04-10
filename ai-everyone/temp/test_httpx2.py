import asyncio
import httpx
import json
import os

api_key = os.getenv("GEMINI_API_KEY", "").strip()
if not api_key:
    raise SystemExit("Set GEMINI_API_KEY before running this script.")

async def test_model(model):
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    body = {"contents": [{"role": "user", "parts": [{"text": "Say hello"}]}]}
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(f"{endpoint}?key={api_key}", json=body)
            print(f"{model}: status={response.status_code}")
            if response.status_code == 200:
                payload = response.json()
                candidates = payload.get("candidates") or []
                if candidates:
                    parts = (((candidates[0] or {}).get("content") or {}).get("parts")) or []
                    texts = [str(part.get("text") or "").strip() for part in parts if isinstance(part, dict)]
                    print(f"  -> {texts[0][:60] if texts else 'no text'}")
            else:
                print(f"  -> {response.text[:120]}")
    except Exception as e:
        print(f"{model}: Exception: {e}")

async def main():
    for m in ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"]:
        await test_model(m)

asyncio.run(main())
