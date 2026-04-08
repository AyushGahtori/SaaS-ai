import asyncio
import json
import sys

sys.path.append(r"e:\SaaS-ai\ai-everyone\agents\shopgenie-agent")

from services.shopgenie_service import run_shopgenie
from api.server import shopgenie_action
from schemas import ShopGenieActionRequest


async def test_happy_path():
    result = await run_shopgenie(
        query="best wireless earbuds under 100 dollars",
        user_id="smoke-user",
        budget="100 dollars",
        recipient_email=None,
        send_email=False,
    )
    assert result["status"] in {"success", "partial_success"}
    assert result["type"] == "shopgenie_result"
    payload = result.get("result") or {}
    assert payload.get("bestProduct")
    print("HAPPY_PATH:")
    print(json.dumps({
        "status": result.get("status"),
        "bestProduct": payload.get("bestProduct"),
        "emailSent": payload.get("emailSent"),
        "youtubeReview": payload.get("youtubeReview"),
    }, indent=2))


async def test_failure_path():
    response = await shopgenie_action(ShopGenieActionRequest(action="invalid_action", query="earbuds"))
    assert response.status == "failed"
    print("FAILURE_PATH:")
    print(json.dumps({"status": response.status, "error": response.error, "message": response.message}, indent=2))


async def main():
    await test_happy_path()
    await test_failure_path()
    print("SMOKE_TEST: PASS")


if __name__ == "__main__":
    asyncio.run(main())
