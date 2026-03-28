"""
Authentication Dependencies
FastAPI dependency injection for protected routes
"""

from typing import Dict, Any, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from services.auth_service import auth_service
from services.google_auth_service import GoogleAuthRequiredError, google_auth_service

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Dict[str, Any]:
    """
    Dependency to get the current authenticated user.
    Raises 401 if not authenticated.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = auth_service.verify_jwt_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


async def get_current_user_with_tokens(
    current_user: Dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get current user along with their OAuth tokens when available."""
    try:
        tokens = await google_auth_service.ensure_valid_tokens(current_user["google_id"])
    except GoogleAuthRequiredError:
        tokens = {"access_token": "", "refresh_token": ""}

    return {
        **current_user,
        "access_token": tokens.get("access_token", ""),
        "refresh_token": tokens.get("refresh_token", ""),
    }


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[Dict[str, Any]]:
    """Optional auth - doesn't raise if not authenticated."""
    if not credentials:
        return None
    return auth_service.verify_jwt_token(credentials.credentials)
