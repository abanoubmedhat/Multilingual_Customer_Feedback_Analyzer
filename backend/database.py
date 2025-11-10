# backend/database.py

import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

# Get the database URL from the environment variable we set in docker-compose.yml
DATABASE_URL = os.getenv("DATABASE_URL")

# Create an asynchronous engine. This is the entry point to our database.
engine = create_async_engine(DATABASE_URL)

# Create a session maker. This will be used to create new sessions for each request.
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

# Create a Base class. Our database models will inherit from this class.
Base = declarative_base()

# Dependency to get a DB session. This will be used in our API endpoints.
async def get_db():
    async with AsyncSessionLocal() as db:
        yield db