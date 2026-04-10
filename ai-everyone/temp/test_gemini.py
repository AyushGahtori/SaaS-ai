import urllib.request
import json
import os

api_key = os.getenv("GEMINI_API_KEY", "").strip()
if not api_key:
    raise SystemExit("Set GEMINI_API_KEY before running this script.")

# Test with gemini-2.5-pro (the default in diagram_service.py)
for model in ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    body = json.dumps({"contents": [{"role": "user", "parts": [{"text": "Say hello"}]}]}).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    try:
        r = urllib.request.urlopen(req, timeout=15)
        data = json.loads(r.read())
        text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        print(f"{model}: OK -> {text[:50]}")
    except Exception as e:
        print(f"{model}: FAILED -> {e}")
