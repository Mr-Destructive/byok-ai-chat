from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
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
from collections import defaultdict

# Import our separated database components
from database import engine, SessionLocal, create_tables, get_db, test_connection
from models import User, APIKey, Thread, Message, SharedLink

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24 * 7  # 7 days

# Handle encryption key properly
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
if not ENCRYPTION_KEY:
    ENCRYPTION_KEY = Fernet.generate_key()
    print("=" * 60)
    print("⚠️  WARNING: No ENCRYPTION_KEY environment variable found!")
    print("🔑 Generated new encryption key (SAVE THIS!):")
    print(f"   ENCRYPTION_KEY={ENCRYPTION_KEY.decode()}")
    print("=" * 60)
else:
    if isinstance(ENCRYPTION_KEY, str):
        ENCRYPTION_KEY = ENCRYPTION_KEY.encode()

# Encryption setup
fernet = Fernet(ENCRYPTION_KEY)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# In-memory cache for streaming state
STREAMING_CACHE = defaultdict(list)  # {stream_id: [chunks]}

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
    parent_message_id: Optional[str] = None
    branch_id: Optional[str] = None
    
    class Config:
        from_attributes = True

class ShareLinkCreate(BaseModel):
    expires_in_hours: Optional[int] = None

class ShareLinkResponse(BaseModel):
    link_id: str
    thread_id: str
    expires_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class ProviderResponse(BaseModel):
    id: str
    name: str

class ModelsByProviderResponse(BaseModel):
    provider: str
    models: List[str]

class ProvidersAndModelsResponse(BaseModel):
    providers: List[ProviderResponse]
    models_by_provider: Dict[str, List[str]]

class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None
    provider: str
    model_name: str
    stream: bool = True
    branch_id: Optional[str] = None
    resume_from_chunk: Optional[int] = None
    stream_id: Optional[str] = None

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

def list_providers():
    try:
        import litellm
        from litellm import models_by_provider
        all_providers = [p for p in models_by_provider.keys() if p != 'lepton']
        logger.info(f"Found {len(all_providers)} providers: {all_providers}")
        return [{"id": provider, "name": provider.replace('_', ' ').title()} for provider in all_providers]
    except Exception as e:
        logger.error(f"Error getting providers from LiteLLM: {e}", exc_info=True)
        return []

def get_models_by_provider(provider: str):
    from litellm import models_by_provider
    models = models_by_provider.get(provider, [])
    logger.info(f"Found {len(models)} models for provider {provider}")
    if isinstance(models, dict):
        models = list(models.keys()) if models else []
    return models

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
            logger.error("JWT payload missing 'sub' field")
            raise credentials_exception
    except InvalidTokenError as e:
        logger.error(f"Invalid JWT token: {e}")
        raise credentials_exception

    try:
        if db is None:
            logger.error("Database session is None")
            raise HTTPException(status_code=500, detail="Database session unavailable")
        
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            logger.error(f"User not found for ID: {user_id}")
            raise credentials_exception
        return user
    except Exception as e:
        logger.error(f"DB error in get_current_user: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error during authentication: {str(e)}")

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
    # Test database connection
    if not test_connection():
        logger.error("Failed to connect to Turso database")
        raise RuntimeError("Database connection failed")
    
    # Create tables
    create_tables()
    logger.info("Application startup complete")
    yield
    logger.info("Application shutdown")

app = FastAPI(
    title="BYOK Chat API",
    description="Bring Your Own Keys AI Chat Application Backend with Turso libSQL",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:8001",
        "http://127.0.0.1:8001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600
)

# Provider Endpoints
@app.get("/providers", response_model=List[ProviderResponse])
async def get_providers():
    providers = list_providers()
    return [ProviderResponse(id=p['id'], name=p['name']) for p in providers]

@app.get("/providers/{provider}/models")
async def get_provider_models(provider: str):
    models = get_models_by_provider(provider)
    return {"provider": provider, "models": models}

@app.get("/providers-and-models", response_model=ProvidersAndModelsResponse)
async def get_providers_and_models():
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
    try:
        db_user = db.query(User).filter(User.email == user.email).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
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
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        raise HTTPException(status_code=500, detail="Registration failed. Check server logs for details.")

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
    providers = list_providers()
    valid_providers = [p['id'] for p in providers]
    if api_key_data.provider not in valid_providers:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid provider. Must be one of: {', '.join(valid_providers)}"
        )
    
    valid_models = get_models_by_provider(api_key_data.provider)
    if api_key_data.model_name not in valid_models:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model for provider {api_key_data.provider}. Must be one of: {', '.join(valid_models)}"
        )
    
    encrypted_key = encrypt_api_key(api_key_data.api_key)
    existing_keys = db.query(APIKey).filter(
        APIKey.user_id == current_user.id,
        APIKey.provider == api_key_data.provider,
        APIKey.encrypted_key == encrypted_key,
        APIKey.is_active == True
    ).all()
    
    exact_match = db.query(APIKey).filter(
        APIKey.user_id == current_user.id,
        APIKey.provider == api_key_data.provider,
        APIKey.model_name == api_key_data.model_name,
        APIKey.encrypted_key == encrypted_key,
        APIKey.is_active == True
    ).first()
    
    if exact_match:
        raise HTTPException(
            status_code=400,
            detail=f"API key for {api_key_data.provider} {api_key_data.model_name} already exists"
        )
    
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
    
    response_data = APIKeyResponse(
        id=str(db_api_key.id),
        provider=db_api_key.provider,
        model_name=db_api_key.model_name,
        key_name=db_api_key.key_name,
        is_active=db_api_key.is_active,
        created_at=db_api_key.created_at
    )
    
    warning_message = None
    if existing_keys:
        existing_models = [key.model_name for key in existing_keys]
        warning_message = f"Note: This API key is already used for {api_key_data.provider} with model(s): {', '.join(existing_models)}"
    
    if warning_message:
        return {
            **response_data.dict(),
            "warning": warning_message
        }
    
    return response_data

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
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    thread = db.query(Thread).filter(
        Thread.id == thread_id,
        Thread.user_id == current_user.id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    # Define core columns that must exist
    columns = [
        Message.id,
        Message.thread_id,
        Message.role,
        Message.content,
        Message.created_at
    ]
    
    # Check if parent_message_id exists
    has_parent_column = True
    try:
        db.execute(sa.text("SELECT parent_message_id FROM messages LIMIT 1"))
        columns.append(Message.parent_message_id)
    except sa.exc.OperationalError:
        logger.warning("parent_message_id column not found in messages table")
        has_parent_column = False
    
    # Check if branch_id exists
    has_branch_column = True
    try:
        db.execute(sa.text("SELECT branch_id FROM messages LIMIT 1"))
        columns.append(Message.branch_id)
    except sa.exc.OperationalError:
        logger.warning("branch_id column not found in messages table")
        has_branch_column = False
    
    query = db.query(*columns).filter(Message.thread_id == thread_id)
    if has_branch_column and branch_id:
        query = query.filter(Message.branch_id == branch_id)
    elif has_branch_column:
        query = query.filter(Message.branch_id == None)
    
    messages = query.order_by(Message.created_at).all()
    
    def build_message_response(msg_tuple):
        idx = 0
        msg_dict = {
            "id": str(msg_tuple[idx]),
            "role": msg_tuple[idx + 2],
            "content": msg_tuple[idx + 3],
            "created_at": msg_tuple[idx + 4],
            "parent_message_id": None,
            "branch_id": None
        }
        idx += 5
        if has_parent_column:
            msg_dict["parent_message_id"] = str(msg_tuple[idx]) if msg_tuple[idx] else None
            idx += 1
        if has_branch_column:
            msg_dict["branch_id"] = str(msg_tuple[idx]) if msg_tuple[idx] else None
        return MessageResponse(**msg_dict)
    
    return [build_message_response(msg) for msg in messages]

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

@app.post("/threads/{thread_id}/branch/{message_id}", response_model=ThreadResponse)
async def create_branch(
    thread_id: str,
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    thread = db.query(Thread).filter(
        Thread.id == thread_id,
        Thread.user_id == current_user.id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    message = db.query(Message).filter(
        Message.id == message_id,
        Message.thread_id == thread_id
    ).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    branch_id = str(uuid.uuid4())
    
    # Check if columns exist
    has_parent_column = True
    try:
        db.execute(sa.text("SELECT parent_message_id FROM messages LIMIT 1"))
    except sa.exc.OperationalError:
        has_parent_column = False
    
    has_branch_column = True
    try:
        db.execute(sa.text("SELECT branch_id FROM messages LIMIT 1"))
    except sa.exc.OperationalError:
        has_branch_column = False
    
    # Copy messages up to the branch point
    query = db.query(Message).filter(
        Message.thread_id == thread_id,
        Message.created_at <= message.created_at
    )
    if has_branch_column:
        query = query.filter(Message.branch_id == None)
    
    messages = query.order_by(Message.created_at).all()
    
    for msg in messages:
        new_msg = Message(
            thread_id=thread_id,
            role=msg.role,
            content=msg.content,
            created_at=msg.created_at
        )
        if has_parent_column:
            new_msg.parent_message_id = msg.parent_message_id
        if has_branch_column:
            new_msg.branch_id = branch_id
        db.add(new_msg)
    
    db.commit()
    
    return ThreadResponse(
        id=str(thread.id),
        title=thread.title,
        provider=thread.provider,
        model_name=thread.model_name,
        created_at=thread.created_at,
        updated_at=thread.updated_at
    )

@app.post("/threads/{thread_id}/share", response_model=ShareLinkResponse)
async def create_share_link(
    thread_id: str,
    share_data: ShareLinkCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    thread = db.query(Thread).filter(
        Thread.id == thread_id,
        Thread.user_id == current_user.id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    link_id = str(uuid.uuid4())
    expires_at = None
    if share_data.expires_in_hours:
        expires_at = datetime.utcnow() + timedelta(hours=share_data.expires_in_hours)
    
    shared_link = SharedLink(
        thread_id=thread.id,
        user_id=current_user.id,
        link_id=link_id,
        expires_at=expires_at
    )
    
    db.add(shared_link)
    db.commit()
    db.refresh(shared_link)
    
    return ShareLinkResponse(
        link_id=shared_link.link_id,
        thread_id=str(shared_link.thread_id),
        expires_at=shared_link.expires_at,
        created_at=shared_link.created_at
    )

@app.get("/shared/{link_id}", response_model=List[MessageResponse])
async def get_shared_thread(
    link_id: str,
    branch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    shared_link = db.query(SharedLink).filter(SharedLink.link_id == link_id).first()
    
    if not shared_link:
        raise HTTPException(status_code=404, detail="Shared link not found")
    
    if shared_link.expires_at and shared_link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Shared link has expired")
    
    # Define core columns
    columns = [
        Message.id,
        Message.thread_id,
        Message.role,
        Message.content,
        Message.created_at
    ]
    
    # Check if parent_message_id exists
    has_parent_column = True
    try:
        db.execute(sa.text("SELECT parent_message_id FROM messages LIMIT 1"))
        columns.append(Message.parent_message_id)
    except sa.exc.OperationalError:
        has_parent_column = False
    
    # Check if branch_id exists
    has_branch_column = True
    try:
        db.execute(sa.text("SELECT branch_id FROM messages LIMIT 1"))
        columns.append(Message.branch_id)
    except sa.exc.OperationalError:
        has_branch_column = False
    
    query = db.query(*columns).filter(Message.thread_id == shared_link.thread_id)
    if has_branch_column and branch_id:
        query = query.filter(Message.branch_id == branch_id)
    elif has_branch_column:
        query = query.filter(Message.branch_id == None)
    
    messages = query.order_by(Message.created_at).all()
    
    def build_message_response(msg_tuple):
        idx = 0
        msg_dict = {
            "id": str(msg_tuple[idx]),
            "role": msg_tuple[idx + 2],
            "content": msg_tuple[idx + 3],
            "created_at": msg_tuple[idx + 4],
            "parent_message_id": None,
            "branch_id": None
        }
        idx += 5
        if has_parent_column:
            msg_dict["parent_message_id"] = str(msg_tuple[idx]) if msg_tuple[idx] else None
            idx += 1
        if has_branch_column:
            msg_dict["branch_id"] = str(msg_tuple[idx]) if msg_tuple[idx] else None
        return MessageResponse(**msg_dict)
    
    return [build_message_response(msg) for msg in messages]


from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import StreamingResponse
import json
import uuid
import asyncio
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
import sqlalchemy as sa
import logging

STREAMING_CACHE = {}  # Global cache for streaming responses

class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None
    provider: str
    model_name: str
    stream: bool = True
    branch_id: Optional[str] = None
    resume_from_chunk: Optional[int] = None
    stream_id: Optional[str] = None

@app.post("/chat")
async def chat(
    chat_request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Try exact provider+model match
    api_key_record = db.query(APIKey).filter(
        APIKey.user_id == current_user.id,
        APIKey.provider == chat_request.provider,
        APIKey.model_name == chat_request.model_name,
        APIKey.is_active == True
    ).first()

    # 2. Try provider-wide key (model_name == '*' or '')
    if not api_key_record:
        api_key_record = db.query(APIKey).filter(
            APIKey.user_id == current_user.id,
            APIKey.provider == chat_request.provider,
            APIKey.model_name.in_(['*', '']),
            APIKey.is_active == True
        ).first()

    # 3. Fallback: any active key for provider
    if not api_key_record:
        api_key_record = db.query(APIKey).filter(
            APIKey.user_id == current_user.id,
            APIKey.provider == chat_request.provider,
            APIKey.is_active == True
        ).first()

    if not api_key_record:
        raise HTTPException(
            status_code=400,
            detail=f"No active API key found for provider: {chat_request.provider}. Please add one in the API Keys tab."
        )

    api_key = decrypt_api_key(api_key_record.encrypted_key)
    
    if chat_request.thread_id:
        thread = db.query(Thread).filter(
            Thread.id == chat_request.thread_id,
            Thread.user_id == current_user.id
        ).first()
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")
    else:
        thread = Thread(
            user_id=current_user.id,
            title=chat_request.message[:50] + "..." if len(chat_request.message) > 50 else chat_request.message,
            provider=chat_request.provider,
            model_name=chat_request.model_name
        )
        db.add(thread)
        db.commit()
        db.refresh(thread)
    
    # Check if columns exist
    has_parent_column = True
    try:
        db.execute(sa.text("SELECT parent_message_id FROM messages LIMIT 1"))
    except sa.exc.OperationalError:
        has_parent_column = False
    
    has_branch_column = True
    try:
        db.execute(sa.text("SELECT branch_id FROM messages LIMIT 1"))
    except sa.exc.OperationalError:
        has_branch_column = False
    
    # Build user message dynamically
    user_message_kwargs = {
        "thread_id": thread.id,
        "role": "user",
        "content": chat_request.message,
        "created_at": datetime.utcnow(),
    }
    if has_parent_column and chat_request.branch_id and has_branch_column:
        last_message = db.query(Message).filter(
            Message.thread_id == thread.id,
            Message.branch_id == chat_request.branch_id,
            Message.created_at < datetime.utcnow()
        ).order_by(Message.created_at.desc()).first()
        if last_message:
            user_message_kwargs["parent_message_id"] = last_message.id
    if has_branch_column:
        user_message_kwargs["branch_id"] = chat_request.branch_id
    
    user_message = Message(**user_message_kwargs)
    db.add(user_message)
    db.commit()
    
    # Fetch conversation history
    columns = [
        Message.id,
        Message.thread_id,
        Message.role,
        Message.content,
        Message.created_at
    ]
    if has_parent_column:
        columns.append(Message.parent_message_id)
    if has_branch_column:
        columns.append(Message.branch_id)
    
    query = db.query(*columns).filter(Message.thread_id == thread.id)
    if has_branch_column and chat_request.branch_id:
        query = query.filter(Message.branch_id == chat_request.branch_id)
    elif has_branch_column:
        query = query.filter(Message.branch_id == None)
    
    messages = query.order_by(Message.created_at).all()
    conversation_history = [
        {"role": msg[2], "content": msg[3]}
        for msg in messages
    ]
    
    from litellm import completion
    
    async def generate_response():
        response_content = ""
        max_retries = 1
        retry_count = 0
        stream_id = chat_request.stream_id or str(uuid.uuid4())
        start_chunk = chat_request.resume_from_chunk or 0
        
        # Initialize cache for this stream_id
        if stream_id not in STREAMING_CACHE:
            STREAMING_CACHE[stream_id] = []
        
        def extract_content_from_chunk(chunk):
            if not chunk:
                logger.warning("Empty chunk received")
                return ""
            
            logger.debug(f"Chunk type: {type(chunk)}, Chunk: {chunk}")
            
            # Handle string
            if isinstance(chunk, str):
                return chunk
            
            # Handle dict
            if isinstance(chunk, dict):
                for key in ['content', 'text', 'message', 'delta']:
                    if key in chunk and chunk[key]:
                        if isinstance(chunk[key], str):
                            return chunk[key]
                        elif isinstance(chunk[key], dict) and 'content' in chunk[key]:
                            return chunk[key]['content'] or ""
            
            # Handle objects with .choices
            if hasattr(chunk, 'choices') and chunk.choices:
                choice = chunk.choices[0]
                if hasattr(choice, 'delta') and choice.delta:
                    if hasattr(choice.delta, 'content') and choice.delta.content:
                        return choice.delta.content
                elif hasattr(choice, 'message') and choice.message:
                    if hasattr(choice.message, 'content') and choice.message.content:
                        return choice.message.content
                elif hasattr(choice, 'text') and choice.text:
                    return choice.text
            
            # Handle objects with .content
                for key in ['content', 'text', 'message', 'delta']:
                    if key in chunk and chunk[key]:
                        if isinstance(chunk[key], str):
                            return chunk[key]
                        elif isinstance(chunk[key], dict) and 'content' in chunk[key]:
                            return chunk[key]['content'] or ""
            
            if hasattr(chunk, 'content'):
                content = getattr(chunk, 'content', None)
                if content:
                    return content
            
            # Handle LiteLLM CustomStreamWrapper and similar
            for method_name in ['text', 'read']:
                method = getattr(chunk, method_name, None)
                if callable(method):
                    try:
                        result = method()
                        # If coroutine, run it
                        if hasattr(result, '__await__'):
                            import asyncio
                            try:
                                loop = asyncio.get_event_loop()
                            except RuntimeError:
                                loop = asyncio.new_event_loop()
                                asyncio.set_event_loop(loop)
                            result = loop.run_until_complete(result)
                        if result:
                            return result
                    except Exception as e:
                        logger.warning(f"Failed to extract content via {method_name}(): {e}")
            # Try .complete_response (dict or string)
            if hasattr(chunk, 'complete_response'):
                complete = getattr(chunk, 'complete_response', None)
                if complete:
                    if isinstance(complete, dict):
                        for key in ['content', 'text', 'message', 'delta']:
                            if key in complete and complete[key]:
                                if isinstance(complete[key], str):
                                    return complete[key]
                                elif isinstance(complete[key], dict) and 'content' in complete[key]:
                                    return complete[key]['content'] or ""
                    elif isinstance(complete, str):
                        return complete
            # Try .chunks (list of dicts/strings)
            if hasattr(chunk, 'chunks'):
                chunks = getattr(chunk, 'chunks', None)
                if chunks and isinstance(chunks, list):
                    for c in chunks:
                        content = extract_content_from_chunk(c)
                        if content:
                            return content
            # Fallback: str(chunk) if not default object repr
            try:
                s = str(chunk)
                if s and not s.startswith('<'):
                    return s
            except Exception:
                pass
            logger.warning(f"Could not extract content from chunk: {chunk} (type: {type(chunk)}, dir: {dir(chunk)})")
            return ""
        
        def process_sync_generator_safe(generator):
            content_chunks = []
            chunk_count = 0
            max_chunks = 10000
            
            try:
                for chunk in generator:
                    chunk_count += 1
                    if chunk_count > max_chunks:
                        logger.warning(f"Hit max chunks limit ({max_chunks}), stopping iteration")
                        break
                        
                    content = extract_content_from_chunk(chunk)
                    if content:
                        content_chunks.append(content)
                        
                return content_chunks
            except Exception as e:
                logger.error(f"Error processing sync generator: {e}")
                return content_chunks
        
        # Check cache for resuming
        if start_chunk > 0 and stream_id in STREAMING_CACHE:
            cached_chunks = STREAMING_CACHE[stream_id][start_chunk:]
            for i, chunk in enumerate(cached_chunks):
                yield f"data: {json.dumps({'content': chunk, 'chunk_index': start_chunk + i, 'stream_id': stream_id})}\n\n"
                await asyncio.sleep(0.01)
            if cached_chunks:
                # Do not delete cache here to allow further resumes
                return
        
        content_chunks = []
        
        import types
        async def async_wrap_iter(sync_iter):
            for item in sync_iter:
                yield item
                await asyncio.sleep(0)

        error_msg = ""
        while retry_count < max_retries:
            try:
                logger.info(f"Attempt {retry_count + 1}: Making request to {chat_request.model_name}")

                completion_kwargs = {
                    'model': chat_request.model_name.split(":")[0],
                    'messages': conversation_history,
                    'api_key': api_key,
                    'stream': chat_request.stream,
                    'timeout': 60,
                }
                if chat_request.provider.lower() == 'cohere':
                    completion_kwargs.update({
                        'max_tokens': 4000,
                        'temperature': 0.7
                    })

                response = await asyncio.to_thread(completion, **completion_kwargs)
                logger.info(f"Got response, type: {type(response)}")

                if completion_kwargs.get('stream', False):
                    # Robustly handle both async and sync generators
                    if hasattr(response, '__aiter__'):
                        logger.info("Processing async generator")
                        try:
                            async for chunk in response:
                                content = extract_content_from_chunk(chunk)
                                if content:
                                    content_chunks.append(content)
                                    STREAMING_CACHE[stream_id].append(content)
                        except Exception as async_error:
                            logger.error(f"Async iteration failed: {async_error}")
                            # Try to process as sync generator via async wrapper
                            if isinstance(response, types.GeneratorType):
                                logger.info("Falling back to async-wrapped sync generator")
                                async for chunk in async_wrap_iter(response):
                                    content = extract_content_from_chunk(chunk)
                                    if content:
                                        content_chunks.append(content)
                                        STREAMING_CACHE[stream_id].append(content)
                            else:
                                logger.warning("Response is not a generator, treating as single chunk")
                                content = extract_content_from_chunk(response)
                                if content:
                                    content_chunks.append(content)
                                    STREAMING_CACHE[stream_id].append(content)
                    elif hasattr(response, '__iter__') and not isinstance(response, (str, bytes, dict)):
                        logger.info("Processing sync generator")
                        async for chunk in async_wrap_iter(response):
                            content = extract_content_from_chunk(chunk)
                            if content:
                                content_chunks.append(content)
                                STREAMING_CACHE[stream_id].append(content)
                    else:
                        logger.warning("Response is not a generator, treating as single chunk")
                        content = extract_content_from_chunk(response)
                        if content:
                            content_chunks.append(content)
                            STREAMING_CACHE[stream_id].append(content)
                else:
                    logger.info("Processing single streaming response")
                    content = extract_content_from_chunk(response)
                    if content:
                        content_chunks = [content]
                        STREAMING_CACHE[stream_id].append(content)
            except Exception as e:
                error_msg = str(e)
                logger.error(f"Attempt {retry_count} failed: {error_msg}")
            # Removed invalid else:
            logger.info("Processing non-streaming response")
            content = extract_content_from_chunk(response)
            if content:
                content_chunks = [content]
                STREAMING_CACHE[stream_id].append(content)

            if content_chunks:
                logger.info(f"Successfully got {len(content_chunks)} content chunks")
                break
            logger.warning("No content chunks extracted, will retry with non-streaming fallback")
            try:
                completion_kwargs['stream'] = False
                non_stream_response = await asyncio.to_thread(completion, **completion_kwargs)
                content = extract_content_from_chunk(non_stream_response)
                if content:
                    content_chunks = [content]
                    STREAMING_CACHE[stream_id].append(content)
                    logger.info("Successfully extracted content from non-streaming fallback")
                    break
                else:
                    logger.error("Non-streaming fallback also failed to extract content")
            except Exception as fallback_error:
                logger.error(f"Non-streaming fallback failed: {fallback_error}")
            retry_count += 1

        if retry_count >= max_retries:
            logger.error(f"All {max_retries} attempts failed")
            yield f"data: {json.dumps({'error': f'Request failed after {max_retries} attempts: {error_msg}', 'stream_id': stream_id})}\n\n"
            # Safe deletion
            if stream_id in STREAMING_CACHE:
                del STREAMING_CACHE[stream_id]
            return

        if content_chunks:
            for i, chunk_content in enumerate(content_chunks[start_chunk:], start=start_chunk):
                response_content += chunk_content
                yield f"data: {json.dumps({'content': chunk_content, 'chunk_index': i, 'stream_id': stream_id})}\n\n"
                if chat_request.stream and len(content_chunks) > 1:
                    await asyncio.sleep(0.01)
        else:
            yield f"data: {json.dumps({'error': 'No content received from AI provider after multiple attempts', 'stream_id': stream_id})}\n\n"
            # Safe deletion
            if stream_id in STREAMING_CACHE:
                del STREAMING_CACHE[stream_id]
            return

        
        if response_content.strip():
            try:
                # Build assistant message dynamically
                assistant_message_kwargs = {
                    "thread_id": thread.id,
                    "role": "assistant",
                    "content": response_content,
                    "created_at": datetime.utcnow(),
                }
                if has_branch_column:
                    assistant_message_kwargs["branch_id"] = chat_request.branch_id
                if has_parent_column:
                    assistant_message_kwargs["parent_message_id"] = user_message.id
                
                assistant_message = Message(**assistant_message_kwargs)
                db.add(assistant_message)
                thread.updated_at = datetime.utcnow()
                db.commit()
                db.refresh(assistant_message)
                logger.info(f"Saved response ({len(response_content)} chars) to thread {thread.id}")
            except Exception as db_error:
                logger.error(f"Database save failed: {db_error}")
        
        yield f"data: {json.dumps({'done': True, 'thread_id': str(thread.id), 'total_chunks': len(content_chunks), 'stream_id': stream_id})}\n\n"
        # Safe deletion
        if stream_id in STREAMING_CACHE:
            del STREAMING_CACHE[stream_id]
    
    if chat_request.stream:
        return StreamingResponse(
            generate_response(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "X-Accel-Buffering": "no",
            }
        )
    else:
        full_content = ""
        error_message = None
        thread_id = None
        total_chunks = 0
        stream_id = chat_request.stream_id or str(uuid.uuid4())
        
        try:
            async for chunk in generate_response():
                if chunk.startswith("data: "):
                    data = json.loads(chunk[6:])
                    if 'content' in data:
                        full_content += data['content']
                    elif 'error' in data:
                        error_message = data['error']
                    elif 'thread_id' in data:
                        thread_id = data['thread_id']
                    elif 'total_chunks' in data:
                        total_chunks = data['total_chunks']
                    elif 'stream_id' in data:
                        stream_id = data['stream_id']
        except Exception as e:
            logger.error(f"Error collecting non-streaming response: {e}")
            raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}")
        
        if error_message:
            raise HTTPException(status_code=500, detail=error_message)
        
        return {
            "content": full_content,
            "thread_id": thread_id or str(thread.id),
            "done": True,
            "total_chunks": total_chunks,
            "stream_id": stream_id
        }

# Health Check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.get("/v1/health")
async def health_check_v1():
    return {"status": "ok"}

