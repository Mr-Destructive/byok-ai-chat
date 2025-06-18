import os
import sys
from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add the current directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models import Base, User, APIKey, Thread, Message
from config import settings

from passlib.context import CryptContext

# Create an instance of CryptContext, specifying bcrypt as the hashing scheme
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hashes a plain password."""
    return pwd_context.hash(password)

def init_db():
    # Create database engine and session
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Check if admin user already exists
        admin = db.query(User).filter(User.email == "admin@example.com").first()
        
        if not admin:
            # Create admin user
            admin = User(
                email="admin@example.com",
                hashed_password=get_password_hash("admin123"),
                full_name="Admin User",
                is_active=True,
                is_oauth_user=False,
                created_at=datetime.utcnow()
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            print(f"Created admin user with email: {admin.email}")
        
        # Create some test API keys
        api_keys = db.query(APIKey).filter(APIKey.user_id == admin.id).all()
        
        if not api_keys:
            # Create API keys for admin
            admin_openai_key = APIKey(
                user_id=admin.id,
                provider="openai",
                model_name="gpt-4",
                encrypted_key=os.urandom(24).hex(),  # In a real app, this would be encrypted
                key_name="Admin OpenAI Key",
                is_active=True,
                created_at=datetime.utcnow()
            )
            db.add(admin_openai_key)
            
            # Create another API key for admin (Anthropic)
            admin_anthropic_key = APIKey(
                user_id=admin.id,
                provider="anthropic",
                model_name="claude-2",
                encrypted_key=os.urandom(24).hex(),  # In a real app, this would be encrypted
                key_name="Admin Anthropic Key",
                is_active=True,
                created_at=datetime.utcnow()
            )
            db.add(admin_anthropic_key)
            
            db.commit()
            print("Created test API keys for admin user")
        
        # Create some test threads and messages
        threads = db.query(Thread).all()
        
        if not threads:
            # Create a thread for admin
            admin_thread = Thread(
                user_id=admin.id,
                title="Admin Test Thread",
                provider="openai",
                model_name="gpt-4",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(admin_thread)
            db.commit()
            db.refresh(admin_thread)
            
            # Add messages to admin thread
            admin_message1 = Message(
                thread_id=admin_thread.id,
                role="user",
                content="Hello, this is a test message from admin",
                created_at=datetime.utcnow() - timedelta(minutes=10)
            )
            db.add(admin_message1)
            
            admin_message2 = Message(
                thread_id=admin_thread.id,
                role="assistant",
                content="Hello! I'm an AI assistant. How can I help you today?",
                created_at=datetime.utcnow() - timedelta(minutes=9)
            )
            db.add(admin_message2)
            
            # Create another thread for admin
            admin_thread2 = Thread(
                user_id=admin.id,
                title="Anthropic Test Thread",
                provider="anthropic",
                model_name="claude-2",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(admin_thread2)
            db.commit()
            db.refresh(admin_thread2)
            
            # Add messages to second admin thread
            admin2_message1 = Message(
                thread_id=admin_thread2.id,
                role="user",
                content="Testing with Anthropic Claude",
                created_at=datetime.utcnow() - timedelta(minutes=5)
            )
            db.add(admin2_message1)
            
            admin2_message2 = Message(
                thread_id=admin_thread2.id,
                role="assistant",
                content="Hello! I'm Claude, an AI assistant created by Anthropic. How can I help you today?",
                created_at=datetime.utcnow() - timedelta(minutes=4)
            )
            db.add(admin2_message2)
            
            db.commit()
            print("Created test threads and messages for admin user")
        
        print("Database initialization completed successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"Error initializing database: {str(e)}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
