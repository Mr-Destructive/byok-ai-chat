import os
import logging
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from models import Base, User

logger = logging.getLogger(__name__)

# Database configuration for Turso
TURSO_DATABASE_URL = os.getenv("TURSO_DATABASE_URL")
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN")

if not TURSO_DATABASE_URL:
    raise ValueError("TURSO_DATABASE_URL environment variable is required")

if not TURSO_AUTH_TOKEN:
    raise ValueError("TURSO_AUTH_TOKEN environment variable is required")

# Create the libSQL connection string
# Use 'libsql://' scheme and include authToken as a query parameter
connection_string = f"sqlite+{TURSO_DATABASE_URL}?secure=true"

# Create engine with libSQL driver
engine = create_engine(
    connection_string,
    connect_args={
        "auth_token": TURSO_AUTH_TOKEN
    },
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_tables():
    """Create all database tables"""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_connection():
    """Test the database connection"""
    try:
        with Session(engine) as session:
            stmt = select(User)
            session.execute(stmt)
            logger.info("Database connection successful")
            return True
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return False