"""
Authentication Service
Google OAuth 2.0 flow with JWT session management
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

import jwt
from pymongo import ReturnDocument

from db.connection import get_database
from services.google_auth_service import DEFAULT_GOOGLE_SCOPES, google_auth_service

logger = logging.getLogger(__name__)

GOOGLE_SCOPES = DEFAULT_GOOGLE_SCOPES

JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-jwt-key-change-this")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", 24))


class AuthService:
    """Handles Google OAuth and JWT session management."""

    def get_authorization_url(
        self,
        state: str = "random_state_string",
        redirect_uri: Optional[str] = None,
    ) -> str:
        """Generate Google OAuth authorization URL."""
        return google_auth_service.get_authorization_url(
            state=state,
            redirect_uri=redirect_uri,
            scopes=GOOGLE_SCOPES,
        )

    async def exchange_code_for_tokens(
        self,
        code: str,
        redirect_uri: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Exchange authorization code for access and refresh tokens."""
        return await google_auth_service.exchange_code_for_tokens(
            code=code,
            redirect_uri=redirect_uri,
        )

    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get user profile from Google."""
        return await google_auth_service.get_user_info(access_token)

    async def upsert_user(self, user_info: Dict, tokens: Dict) -> Dict[str, Any]:
        """Create or update user in MongoDB."""
        db = get_database()
        now = datetime.utcnow()
        existing_user = await db.users.find_one({"google_id": user_info["sub"]})
        refresh_token = tokens.get("refresh_token") or (existing_user or {}).get("refresh_token")

        user_data = {
            "google_id": user_info["sub"],
            "email": user_info["email"],
            "name": user_info.get("name", ""),
            "picture": user_info.get("picture", ""),
            "access_token": tokens.get("access_token"),
            "refresh_token": refresh_token,
            "token_expiry": now + timedelta(seconds=tokens.get("expires_in", 3600)),
            "updated_at": now,
        }

        result = await db.users.find_one_and_update(
            {"google_id": user_info["sub"]},
            {
                "$set": user_data,
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

        return {
            "id": str(result["_id"]) if result else user_data["google_id"],
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data["picture"],
            "google_id": user_data["google_id"],
        }

    def create_jwt_token(self, user_id: str, google_id: str, email: str) -> str:
        """Create a JWT access token."""
        payload = {
            "sub": user_id,
            "google_id": google_id,
            "email": email,
            "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
            "iat": datetime.utcnow(),
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    def verify_jwt_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode a JWT token."""
        try:
            return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            logger.warning("JWT token expired")
            return None
        except jwt.InvalidTokenError as exc:
            logger.warning("Invalid JWT token: %s", exc)
            return None

    async def get_user_tokens(self, user_id: str) -> Optional[Dict[str, str]]:
        """Get stored OAuth tokens for a user."""
        return await google_auth_service.get_user_tokens(user_id)

    async def refresh_access_token(self, refresh_token: str) -> Optional[Dict[str, Any]]:
        """Refresh expired access token."""
        return await google_auth_service.refresh_access_token(refresh_token)

    async def update_user_tokens(self, user_id: str, token_data: Dict[str, Any]) -> None:
        """Persist refreshed OAuth tokens for a user."""
        await google_auth_service.store_user_tokens(user_id, token_data)


auth_service = AuthService()
