from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.types import TypeDecorator, CHAR
import sqlalchemy as sa
from passlib.context import CryptContext
import jwt
from jwt.exceptions import InvalidTokenError
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, AsyncGenerator
from pydantic import BaseModel, EmailStr, validator
from cryptography.fernet import Fernet
import httpx
import json
import asyncio
import uuid
import os
import logging
from contextlib import asynccontextmanager

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Handle encryption key properly
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
if not ENCRYPTION_KEY:
    # Generate a new key and print it for the user to save
    ENCRYPTION_KEY = Fernet.generate_key()
    print("=" * 60)
    print("⚠️  WARNING: No ENCRYPTION_KEY environment variable found!")
    print("🔑 Generated new encryption key (SAVE THIS!):")
    print(f"   ENCRYPTION_KEY={ENCRYPTION_KEY.decode()}")
    print("=" * 60)
else:
    # Convert string back to bytes if needed
    if isinstance(ENCRYPTION_KEY, str):
        ENCRYPTION_KEY = ENCRYPTION_KEY.encode()

# Database configuration - defaults to SQLite, can be overridden with env var
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./byok_chat.db")

# Database setup with SQLite-specific configuration
if DATABASE_URL.startswith("sqlite"):
    # SQLite specific settings
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False},  # Needed for SQLite
        echo=False  # Set to True for SQL debugging
    )
else:
    # PostgreSQL or other databases
    engine = create_engine(DATABASE_URL, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Encryption setup
fernet = Fernet(ENCRYPTION_KEY)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Custom UUID type that works with both SQLite and PostgreSQL
class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID type, otherwise uses CHAR(36) storing as stringified hex values.
    """
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

# Database Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    threads = relationship("Thread", back_populates="user", cascade="all, delete-orphan")

class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    provider = Column(String, nullable=False)  # openai, anthropic, google, etc.
    model_name = Column(String, nullable=False)  # gpt-4, claude-3, etc.
    encrypted_key = Column(Text, nullable=False)
    key_name = Column(String, nullable=False)  # user-defined name
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

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    thread_id = Column(GUID(), ForeignKey("threads.id"), nullable=False)
    role = Column(String, nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    thread = relationship("Thread", back_populates="messages")

# Pydantic Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class APIKeyCreate(BaseModel):
    provider: str
    model_name: str
    api_key: str
    key_name: str

class APIKeyResponse(BaseModel):
    id: str
    provider: str
    model_name: str
    key_name: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class ThreadCreate(BaseModel):
    title: str
    provider: str
    model_name: str

class ThreadResponse(BaseModel):
    id: str
    title: str
    provider: str
    model_name: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    content: str

class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None
    provider: str
    model_name: str
    stream: bool = True

# Provider and Model Response Models
class ProviderResponse(BaseModel):
    id: str
    name: str

class ModelsByProviderResponse(BaseModel):
    provider: str
    models: List[str]

class ProvidersAndModelsResponse(BaseModel):
    providers: List[ProviderResponse]
    models_by_provider: Dict[str, List[str]]

# Utility Functions
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def encrypt_api_key(api_key: str) -> str:
    return fernet.encrypt(api_key.encode()).decode()

def decrypt_api_key(encrypted_key: str) -> str:
    return fernet.decrypt(encrypted_key.encode()).decode()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def list_providers():
    """Get all available providers from LiteLLM"""
    try:
        from litellm import models_by_provider
        # Create a mapping of provider IDs to display names
        provider_names = {
            'openai': 'OpenAI',
            'anthropic': 'Anthropic',
            'google': 'Google',
            'cohere': 'Cohere',
            'huggingface': 'Hugging Face',
            'azure': 'Azure OpenAI',
            'bedrock': 'AWS Bedrock',
            'vertex_ai': 'Google Vertex AI',
            'palm': 'Google PaLM',
            'mistral': 'Mistral AI',
            'together_ai': 'Together AI',
            'openrouter': 'OpenRouter',
            'replicate': 'Replicate',
            'anyscale': 'Anyscale',
            'perplexity': 'Perplexity',
            'groq': 'Groq',
            'deepinfra': 'DeepInfra',
            'ai21': 'AI21 Labs',
            'nlp_cloud': 'NLP Cloud',
            'aleph_alpha': 'Aleph Alpha',
        }
        
        providers = []
        for provider_id in models_by_provider.keys():
            display_name = provider_names.get(provider_id, provider_id.title())
            providers.append({
                'id': provider_id,
                'name': display_name
            })
        
        return sorted(providers, key=lambda x: x['name'])
    except Exception as e:
        logger.error(f"Error getting providers: {e}")
        # Fallback to basic providers if LiteLLM fails
        return [
            {'id': 'openai', 'name': 'OpenAI'},
            {'id': 'anthropic', 'name': 'Anthropic'},
            {'id': 'google', 'name': 'Google'},
            {'id': 'cohere', 'name': 'Cohere'},
        ]

def get_models_by_provider(provider: str):
    """Get models for a specific provider from LiteLLM"""
    try:
        from litellm import models_by_provider
        return models_by_provider.get(provider, [])
    except Exception as e:
        logger.error(f"Error getting models for provider {provider}: {e}")
        # Fallback models if LiteLLM fails
        fallback_models = {
            'openai': ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
            'anthropic': ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
            'google': ['gemini-pro', 'gemini-pro-vision'],
            'cohere': ['command', 'command-light'],
        }
        return fallback_models.get(provider, [])

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user

# AI Provider Integrations
class AIProviderClient:
    @staticmethod
    async def get_openai_response(api_key: str, model: str, messages: List[Dict], stream: bool = True):
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": model,
            "messages": messages,
            "stream": stream,
            "max_tokens": 4000
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            if stream:
                async with client.stream(
                    "POST",
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=data
                ) as response:
                    if response.status_code != 200:
                        raise HTTPException(status_code=response.status_code, detail="OpenAI API error")
                    
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            chunk = line[6:]
                            if chunk.strip() == "[DONE]":
                                break
                            try:
                                parsed = json.loads(chunk)
                                if "choices" in parsed and len(parsed["choices"]) > 0:
                                    delta = parsed["choices"][0].get("delta", {})
                                    if "content" in delta:
                                        yield delta["content"]
                            except json.JSONDecodeError:
                                continue
            else:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=data
                )
                if response.status_code != 200:
                    raise HTTPException(status_code=response.status_code, detail="OpenAI API error")
                
                result = response.json()
                yield result["choices"][0]["message"]["content"]

    @staticmethod
    async def get_anthropic_response(api_key: str, model: str, messages: List[Dict], stream: bool = True):
        headers = {
            "x-api-key": api_key,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01"
        }
        
        # Convert messages format for Anthropic
        system_message = ""
        formatted_messages = []
        
        for msg in messages:
            if msg["role"] == "system":
                system_message = msg["content"]
            else:
                formatted_messages.append(msg)
        
        data = {
            "model": model,
            "messages": formatted_messages,
            "max_tokens": 4000,
            "stream": stream
        }
        
        if system_message:
            data["system"] = system_message
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            if stream:
                async with client.stream(
                    "POST",
                    "https://api.anthropic.com/v1/messages",
                    headers=headers,
                    json=data
                ) as response:
                    if response.status_code != 200:
                        raise HTTPException(status_code=response.status_code, detail="Anthropic API error")
                    
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            chunk = line[6:]
                            try:
                                parsed = json.loads(chunk)
                                if parsed.get("type") == "content_block_delta":
                                    if "delta" in parsed and "text" in parsed["delta"]:
                                        yield parsed["delta"]["text"]
                            except json.JSONDecodeError:
                                continue
            else:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers=headers,
                    json=data
                )
                if response.status_code != 200:
                    raise HTTPException(status_code=response.status_code, detail="Anthropic API error")
                
                result = response.json()
                yield result["content"][0]["text"]

# App Initialization
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title="BYOK AI Chat API",
    description="Bring Your Own Keys AI Chat Application Backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# New endpoints for providers and models
@app.get("/providers", response_model=List[ProviderResponse])
async def get_providers():
    """Get all available AI providers"""
    providers = list_providers()
    return [ProviderResponse(id=p['id'], name=p['name']) for p in providers]

@app.get("/providers/{provider}/models")
async def get_provider_models(provider: str):
    """Get models for a specific provider"""
    models = get_models_by_provider(provider)
    return {"provider": provider, "models": models}

@app.get("/providers-and-models", response_model=ProvidersAndModelsResponse)
async def get_providers_and_models():
    """Get all providers and their models in one request"""
    providers = list_providers()
    models_by_provider = {}
    
    for provider in providers:
        provider_id = provider['id']
        models_by_provider[provider_id] = get_models_by_provider(provider_id)
    
    return ProvidersAndModelsResponse(
        providers=[ProviderResponse(id=p['id'], name=p['name']) for p in providers],
        models_by_provider=models_by_provider
    )

# Auth Endpoints
@app.post("/auth/register", response_model=UserResponse)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return UserResponse(
        id=str(db_user.id),
        email=db_user.email,
        is_active=db_user.is_active,
        created_at=db_user.created_at
    )

@app.post("/auth/login", response_model=Token)
async def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(db_user.id)}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        is_active=current_user.is_active,
        created_at=current_user.created_at
    )

# API Key Management
@app.post("/api-keys", response_model=APIKeyResponse)
async def create_api_key(
    api_key_data: APIKeyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validate provider
    providers = list_providers()
    valid_providers = [p['id'] for p in providers]
    if api_key_data.provider not in valid_providers:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid provider. Must be one of: {', '.join(valid_providers)}"
        )
    
    # Validate model for provider
    valid_models = get_models_by_provider(api_key_data.provider)
    if api_key_data.model_name not in valid_models:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model for provider {api_key_data.provider}. Must be one of: {', '.join(valid_models)}"
        )
    
    # Encrypt the API key
    encrypted_key = encrypt_api_key(api_key_data.api_key)
    
    db_api_key = APIKey(
        user_id=current_user.id,
        provider=api_key_data.provider,
        model_name=api_key_data.model_name,
        encrypted_key=encrypted_key,
        key_name=api_key_data.key_name
    )
    
    db.add(db_api_key)
    db.commit()
    db.refresh(db_api_key)
    
    return APIKeyResponse(
        id=str(db_api_key.id),
        provider=db_api_key.provider,
        model_name=db_api_key.model_name,
        key_name=db_api_key.key_name,
        is_active=db_api_key.is_active,
        created_at=db_api_key.created_at
    )

@app.get("/api-keys", response_model=List[APIKeyResponse])
async def get_api_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    api_keys = db.query(APIKey).filter(APIKey.user_id == current_user.id).all()
    return [
        APIKeyResponse(
            id=str(key.id),
            provider=key.provider,
            model_name=key.model_name,
            key_name=key.key_name,
            is_active=key.is_active,
            created_at=key.created_at
        )
        for key in api_keys
    ]

@app.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    api_key = db.query(APIKey).filter(
        APIKey.id == key_id,
        APIKey.user_id == current_user.id
    ).first()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    db.delete(api_key)
    db.commit()
    
    return {"message": "API key deleted successfully"}

# Thread Management
@app.post("/threads", response_model=ThreadResponse)
async def create_thread(
    thread_data: ThreadCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_thread = Thread(
        user_id=current_user.id,
        title=thread_data.title,
        provider=thread_data.provider,
        model_name=thread_data.model_name
    )
    
    db.add(db_thread)
    db.commit()
    db.refresh(db_thread)
    
    return ThreadResponse(
        id=str(db_thread.id),
        title=db_thread.title,
        provider=db_thread.provider,
        model_name=db_thread.model_name,
        created_at=db_thread.created_at,
        updated_at=db_thread.updated_at
    )

@app.get("/threads", response_model=List[ThreadResponse])
async def get_threads(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    threads = db.query(Thread).filter(Thread.user_id == current_user.id).order_by(Thread.updated_at.desc()).all()
    return [
        ThreadResponse(
            id=str(thread.id),
            title=thread.title,
            provider=thread.provider,
            model_name=thread.model_name,
            created_at=thread.created_at,
            updated_at=thread.updated_at
        )
        for thread in threads
    ]

@app.get("/threads/{thread_id}/messages", response_model=List[MessageResponse])
async def get_thread_messages(
    thread_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify thread belongs to user
    thread = db.query(Thread).filter(
        Thread.id == thread_id,
        Thread.user_id == current_user.id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    messages = db.query(Message).filter(Message.thread_id == thread_id).order_by(Message.created_at).all()
    return [
        MessageResponse(
            id=str(msg.id),
            role=msg.role,
            content=msg.content,
            created_at=msg.created_at
        )
        for msg in messages
    ]

@app.delete("/threads/{thread_id}")
async def delete_thread(
    thread_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    thread = db.query(Thread).filter(
        Thread.id == thread_id,
        Thread.user_id == current_user.id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    db.delete(thread)
    db.commit()
    
    return {"message": "Thread deleted successfully"}

# Chat Endpoint
@app.post("/chat")
async def chat(
    chat_request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get the appropriate API key
    api_key_record = db.query(APIKey).filter(
        APIKey.user_id == current_user.id,
        APIKey.provider == chat_request.provider,
        APIKey.model_name == chat_request.model_name,
        APIKey.is_active == True
    ).first()
    
    if not api_key_record:
        raise HTTPException(
            status_code=400,
            detail=f"No active API key found for {chat_request.provider} {chat_request.model_name}"
        )
    
    # Decrypt API key
    api_key = decrypt_api_key(api_key_record.encrypted_key)
    
    # Get or create thread
    if chat_request.thread_id:
        thread = db.query(Thread).filter(
            Thread.id == chat_request.thread_id,
            Thread.user_id == current_user.id
        ).first()
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")
    else:
        # Create new thread
        thread = Thread(
            user_id=current_user.id,
            title=chat_request.message[:50] + "..." if len(chat_request.message) > 50 else chat_request.message,
            provider=chat_request.provider,
            model_name=chat_request.model_name
        )
        db.add(thread)
        db.commit()
        db.refresh(thread)
    
    # Save user message
    user_message = Message(
        thread_id=thread.id,
        role="user",
        content=chat_request.message
    )
    db.add(user_message)
    db.commit()
    
    # Get conversation history
    messages = db.query(Message).filter(Message.thread_id == thread.id).order_by(Message.created_at).all()
    conversation_history = [
        {"role": msg.role, "content": msg.content}
        for msg in messages
    ]
    
    from litellm import completion
    from collections.abc import AsyncIterator, Iterator

    async def generate_response():
        try:
            response_content = ""
            
            # Check if provider supports streaming properly
            provider_supports_async_streaming = chat_request.provider.lower() in ['openai', 'anthropic']
            should_stream = chat_request.stream and provider_supports_async_streaming
            
            if should_stream:
                # For streaming responses with providers that support async streaming
                response = completion(
                    model=chat_request.model_name,
                    messages=conversation_history,
                    api_key=api_key,
                    stream=True,
                )
                
                # Handle async streaming
                async for chunk in response:
                    chunk_content = ""
                    if hasattr(chunk, 'choices') and chunk.choices and len(chunk.choices) > 0:
                        choice = chunk.choices[0]
                        if hasattr(choice, 'delta') and hasattr(choice.delta, 'content') and choice.delta.content:
                            chunk_content = choice.delta.content
                            response_content += chunk_content
                            yield f"data: {json.dumps({'content': chunk_content})}\n\n"
            else:
                # For non-streaming responses or providers with streaming issues
                response = completion(
                    model=chat_request.model_name,
                    messages=conversation_history,
                    api_key=api_key,
                    stream=False,
                )
                
                # Handle non-streaming response
                if hasattr(response, 'choices') and response.choices and len(response.choices) > 0:
                    choice = response.choices[0]
                    if hasattr(choice, 'message') and hasattr(choice.message, 'content'):
                        response_content = choice.message.content
                    elif hasattr(choice, 'text'):
                        response_content = choice.text
                elif hasattr(response, 'text'):
                    response_content = response.text
                else:
                    response_content = str(response)
                
                # If user requested streaming but provider doesn't support it, 
                # simulate streaming by yielding the complete response
                if chat_request.stream and not provider_supports_async_streaming:
                    # Simulate streaming by breaking response into chunks
                    chunk_size = 50
                    for i in range(0, len(response_content), chunk_size):
                        chunk = response_content[i:i+chunk_size]
                        yield f"data: {json.dumps({'content': chunk})}\n\n"
                        await asyncio.sleep(0.05)  # Small delay to simulate streaming

            # Save assistant message
            assistant_message = Message(
                thread_id=thread.id,
                role="assistant",
                content=response_content
            )
            db.add(assistant_message)

            # Update thread timestamp
            thread.updated_at = datetime.utcnow()
            db.commit()

            if chat_request.stream:
                yield f"data: {json.dumps({'done': True, 'thread_id': str(thread.id)})}\n\n"
            else:
                yield json.dumps({
                    'content': response_content,
                    'done': True,
                    'thread_id': str(thread.id)
                })

        except Exception as e:
            logger.error(f"Error in chat generation: {str(e)}")
            logger.exception("Full traceback:")
            if chat_request.stream:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            else:
                yield json.dumps({'error': str(e)})
    
    if chat_request.stream:
        return StreamingResponse(
            generate_response(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            }
        )
    else:
        async for response in generate_response():
            return json.loads(response)

# Health Check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

if __name__ == "__main__":
    import uvicorn
    import sys
    
    # Check if user wants to generate keys
    if len(sys.argv) > 1 and sys.argv[1] == "generate-keys":
        print("🔐 Generating keys for BYOK Chat Backend:")
        print("=" * 50)
        print(f"SECRET_KEY={os.urandom(32).hex()}")
        print(f"ENCRYPTION_KEY={Fernet.generate_key().decode()}")
        print("=" * 50)
        print("💡 Copy these to your .env file or environment variables")
        exit(0)
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
