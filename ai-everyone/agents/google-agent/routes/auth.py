"""
Authentication Routes
Google OAuth 2.0 login flow
"""

import logging
import os
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse, JSONResponse
from services.auth_service import auth_service

logger = logging.getLogger(__name__)
router = APIRouter()

DEBUG_OAUTH_STATE = "debug_oauth"


def should_debug_callback(request: Request, state: str | None = None) -> bool:
    return (
        request.query_params.get("debug") == "1"
        or state == DEBUG_OAUTH_STATE
        or os.getenv("DEBUG", "false").lower() == "true"
    )


@router.get("/google")
async def google_login(request: Request):
    """Redirect user to Google OAuth consent screen."""
    state = DEBUG_OAUTH_STATE if request.query_params.get("debug") == "1" else "random_state_string"
    callback_url = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/callback")
    auth_url = auth_service.get_authorization_url(state=state, redirect_uri=callback_url)
    logger.info("Starting Google OAuth with configured redirect URI: %s", callback_url)
    return RedirectResponse(url=auth_url)


@router.get("/callback")
async def google_callback(
    request: Request,
    code: str = None,
    error: str = None,
    state: str = None
):
    """
    Handle Google OAuth callback.
    Exchanges auth code for tokens and creates user session.
    """
    debug_callback = should_debug_callback(request, state)

    if error:
        if debug_callback:
            return JSONResponse(
                status_code=400,
                content={"error": error, "state": state, "code_received": bool(code)}
            )
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")

    if not code:
        if debug_callback:
            return JSONResponse(
                status_code=400,
                content={"error": "No authorization code received", "state": state}
            )
        raise HTTPException(status_code=400, detail="No authorization code received")

    try:
        callback_url = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/callback")
        logger.info("Handling Google OAuth callback for configured redirect URI: %s", callback_url)

        # Exchange code for tokens
        tokens = await auth_service.exchange_code_for_tokens(code, redirect_uri=callback_url)

        # Get user info from Google
        user_info = await auth_service.get_user_info(tokens["access_token"])

        # Upsert user in MongoDB
        user = await auth_service.upsert_user(user_info, tokens)

        logger.info("OAuth callback succeeded for %s", user.get("email", "unknown"))
        logger.info("OAuth token fields received: %s", sorted(tokens.keys()))

        if debug_callback:
            return JSONResponse(
                content={
                    "message": "OAuth callback succeeded",
                    "state": state,
                    "token_keys": sorted(tokens.keys()),
                    "user": user_info,
                }
            )

        # Create JWT session token
        jwt_token = auth_service.create_jwt_token(
            user_id=user["id"],
            google_id=user["google_id"],
            email=user["email"]
        )

        logger.info(f"✅ User logged in: {user['email']}")

        # Redirect to frontend with token
        frontend_url = f"/?token={jwt_token}&user={user['name']}&email={user['email']}&picture={user.get('picture', '')}"
        return RedirectResponse(url=frontend_url)

    except Exception as e:
        logger.error(f"OAuth callback error: {e}", exc_info=True)
        if debug_callback:
            return JSONResponse(
                status_code=500,
                content={
                    "error": str(e),
                    "state": state,
                    "code_received": bool(code),
                }
            )
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")


@router.post("/logout")
async def logout():
    """Logout endpoint (client-side token removal)."""
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_me(request: Request):
    """Get current user info from JWT token."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="No token provided")

    payload = auth_service.verify_jwt_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    return {"user": payload}
