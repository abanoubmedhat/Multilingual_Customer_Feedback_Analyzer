# backend/models.py

from sqlalchemy import Column, Integer, String, DateTime, Float, func, UniqueConstraint
from database import Base

class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    original_text = Column(String, nullable=False)
    translated_text = Column(String, nullable=True)
    sentiment = Column(String, index=True)
    product = Column(String, nullable=True, index=True)
    language = Column(String, nullable=True, index=True)
    language_confidence = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)
    __table_args__ = (
        UniqueConstraint('name', name='uq_product_name'),
    )


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)