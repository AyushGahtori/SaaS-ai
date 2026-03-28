"""
Reusable Google authentication and token lifecycle service.
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import httpx

from db.connection import get_database

logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

DEFAULT_GOOGLE_SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/contacts",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/tasks",
]

AUTH_REQUIRED_MESSAGE = "User needs to connect Google account"


class GoogleAuthRequiredError(RuntimeError):
    """Raised when Google API access requires the user to reconnect OAuth."""

    def __init__(self, message: str = AUTH_REQUIRED_MESSAGE):
        super().__init__(message)
        self.error = "AUTH_REQUIRED"
        self.message = message


class GoogleAuthService:
    """Handles Google OAuth URLs, token storage, and token refresh."""

    def get_authorization_url(
        self,
        state: str = "random_state_string",
        redirect_uri: Optional[str] = None,
        scopes: Optional[list[str]] = None,
    ) -> str:
        redirect_uri = redirect_uri or os.getenv(
            "GOOGLE_REDIRECT_URI",
            "http://localhost:8000/auth/callback",
        )
        params = {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(scopes or DEFAULT_GOOGLE_SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        logger.info("?? Google Auth: building authorization URL")
        return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    async def exchange_code_for_tokens(
        self,
        code: str,
        redirect_uri: Optional[str] = None,
    ) -> Dict[str, Any]:
        redirect_uri = redirect_uri or os.getenv(
            "GOOGLE_REDIRECT_URI",
            "http://localhost:8000/auth/callback",
        )
        logger.info("?? Google Auth: exchanging authorization code for tokens")
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                    "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                    "redirect_uri": redirect_uri,
                    "code": code,
                    "grant_type": "authorization_code",
                },
            )
            response.raise_for_status()
            return response.json()

    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        logger.info("?? Google Auth: fetching Google user profile")
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()

    async def get_user_tokens(self, user_id: str) -> Optional[Dict[str, Any]]:
        db = get_database()
        if db is None:
            logger.warning("?? Auth Error: MongoDB not connected while fetching Google tokens")
            return None

        user = await db.users.find_one({"google_id": user_id})
        if not user:
            return None

        return {
            "access_token": user.get("access_token", ""),
            "refresh_token": user.get("refresh_token", ""),
            "token_expiry": user.get("token_expiry"),
        }

    async def store_user_tokens(self, user_id: str, token_data: Dict[str, Any]) -> None:
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in")

        update_fields: Dict[str, Any] = {"updated_at": datetime.utcnow()}
        if access_token:
            update_fields["access_token"] = access_token
        if refresh_token:
            update_fields["refresh_token"] = refresh_token
        if expires_in:
            update_fields["token_expiry"] = datetime.utcnow() + timedelta(seconds=expires_in)

        db = get_database()
        if db is None:
            logger.warning("?? Auth Error: MongoDB not connected while storing Google tokens")
            return

        await db.users.update_one(
            {"google_id": user_id},
            {"$set": update_fields},
        )

    async def refresh_access_token(self, refresh_token: str) -> Optional[Dict[str, Any]]:
        if not refresh_token:
            return None

        logger.info("?? Google Auth: refreshing expired Google access token")
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    GOOGLE_TOKEN_URL,
                    data={
                        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                        "refresh_token": refresh_token,
                        "grant_type": "refresh_token",
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    if not data.get("refresh_token"):
                        data["refresh_token"] = refresh_token
                    return data
        except Exception as exc:
            logger.error("?? Auth Error: token refresh failed: %s", exc)
        return None

    async def ensure_valid_tokens(
        self,
        user_id: str,
        access_token: str = "",
        refresh_token: str = "",
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        stored_tokens = await self.get_user_tokens(user_id)
        stored_access_token = (stored_tokens or {}).get("access_token", "")
        stored_refresh_token = (stored_tokens or {}).get("refresh_token", "")
        token_expiry = (stored_tokens or {}).get("token_expiry")

        access_token = access_token or stored_access_token
        refresh_token = refresh_token or stored_refresh_token

        should_refresh = force_refresh or not access_token
        if token_expiry and token_expiry <= datetime.utcnow() + timedelta(minutes=2):
            should_refresh = True

        if should_refresh:
            if not refresh_token:
                logger.warning("?? Auth Error: missing refresh token for user %s", user_id)
                raise GoogleAuthRequiredError()

            refreshed = await self.refresh_access_token(refresh_token)
            if not refreshed or not refreshed.get("access_token"):
                logger.warning("?? Auth Error: refresh failed for user %s", user_id)
                raise GoogleAuthRequiredError()

            access_token = refreshed["access_token"]
            refresh_token = refreshed.get("refresh_token") or refresh_token
            refreshed["refresh_token"] = refresh_token
            await self.store_user_tokens(user_id, refreshed)
            token_expiry = datetime.utcnow() + timedelta(seconds=refreshed.get("expires_in", 3600))

        if not access_token:
            logger.warning("?? Auth Error: no Google access token available for user %s", user_id)
            raise GoogleAuthRequiredError()

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_expiry": token_expiry,
        }

    async def get_auth_headers(
        self,
        user_id: str,
        access_token: str = "",
        refresh_token: str = "",
        extra_headers: Optional[Dict[str, str]] = None,
        force_refresh: bool = False,
    ) -> Dict[str, str]:
        tokens = await self.ensure_valid_tokens(
            user_id=user_id,
            access_token=access_token,
            refresh_token=refresh_token,
            force_refresh=force_refresh,
        )

        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        if extra_headers:
            headers.update(extra_headers)
        return headers


google_auth_service = GoogleAuthService()
