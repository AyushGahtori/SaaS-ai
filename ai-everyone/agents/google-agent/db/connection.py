"""
MongoDB Connection Manager
Handles async MongoDB connections using Motor
"""

import logging
import os

from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)


class Database:
    client: AsyncIOMotorClient = None
    db = None


db_instance = Database()


async def connect_to_mongo():
    """Create MongoDB connection."""
    mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB_NAME", "personal_ai_assistant")

    logger.info(f"Connecting to MongoDB: {mongo_url}")
    db_instance.client = AsyncIOMotorClient(mongo_url)
    db_instance.db = db_instance.client[db_name]

    await create_indexes()
    logger.info("? MongoDB connected successfully")


async def close_mongo_connection():
    """Close MongoDB connection."""
    if db_instance.client:
        db_instance.client.close()
        logger.info("MongoDB connection closed")


async def create_indexes():
    """Create necessary indexes for performance."""
    db = db_instance.db

    await db.users.create_index("google_id", unique=True)
    await db.users.create_index("email", unique=True)

    await db.chats.create_index("user_id")
    await db.chats.create_index("created_at")
    await db.chats.create_index([("title", "text")])

    await db.messages.create_index("chat_id")
    await db.messages.create_index("created_at")
    await db.messages.create_index([("content", "text")])

    await db.tasks.create_index("user_id")
    await db.tasks.create_index("status")
    await db.tasks.create_index("due_date")

    await db.notes.create_index("user_id")
    await db.notes.create_index("created_at")
    await db.notes.create_index("updated_at")
    await db.notes.create_index([("title", "text"), ("content", "text")])

    await db.agent_logs.create_index("user_id")
    await db.agent_logs.create_index("chat_id")
    await db.agent_logs.create_index("created_at")

    logger.info("? MongoDB indexes created")


def get_database():
    """Get database instance."""
    return db_instance.db
