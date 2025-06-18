from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.types import TypeDecorator, CHAR
import sqlalchemy as sa
from datetime import datetime
import uuid

Base = declarative_base()

# Custom UUID type for cross-database compatibility
class GUID(TypeDecorator):
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(sa.dialects.postgresql.UUID())
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return str(value)
        else:
            if not isinstance(value, uuid.UUID):
                return str(uuid.UUID(value))
            else:
                return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if not isinstance(value, uuid.UUID):
                return uuid.UUID(value)
            return value

class User(Base):
    __tablename__ = "users"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    threads = relationship("Thread", back_populates="user", cascade="all, delete-orphan")
    shared_links = relationship("SharedLink", back_populates="user", cascade="all, delete-orphan")

class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    provider = Column(String, nullable=False)
    model_name = Column(String, nullable=False)
    encrypted_key = Column(Text, nullable=False)
    key_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="api_keys")

class Thread(Base):
    __tablename__ = "threads"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    provider = Column(String, nullable=False)
    model_name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="threads")
    messages = relationship("Message", back_populates="thread", cascade="all, delete-orphan")
    shared_links = relationship("SharedLink", back_populates="thread", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    thread_id = Column(GUID(), ForeignKey("threads.id"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    parent_message_id = Column(GUID(), ForeignKey("messages.id"), nullable=True)  # For branching
    branch_id = Column(GUID(), nullable=True)  # Unique ID for each branch
    
    thread = relationship("Thread", back_populates="messages")
    parent_message = relationship("Message", remote_side=[id], backref="child_messages")

class SharedLink(Base):
    __tablename__ = "shared_links"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    thread_id = Column(GUID(), ForeignKey("threads.id"), nullable=False)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    link_id = Column(String, unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    thread = relationship("Thread", back_populates="shared_links")
    user = relationship("User", back_populates="shared_links")