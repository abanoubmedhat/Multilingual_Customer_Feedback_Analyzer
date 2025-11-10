# backend/models.py

from sqlalchemy import Column, Integer, String, DateTime, func
from database import Base

class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    original_text = Column(String, nullable=False)
    translated_text = Column(String, nullable=True)
    sentiment = Column(String, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())