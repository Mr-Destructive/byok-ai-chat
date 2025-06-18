import os
import logging
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from models import Base, User

logger = logging.getLogger(__name__)

# Database configuration for PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

# Create the SQLAlchemy engine for PostgreSQL
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Ensure connections are valid before use
    pool_size=5,        # Adjust pool size as needed
    max_overflow=10     # Allow extra connections if needed
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_tables():
    """Create all database tables"""
    try:
        Base.metadata.create_all(bind=engine, checkfirst=True)
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
    """Test database connection"""
    try:
        with Session(engine) as session:
            stmt = select(User)
            result = session.execute(stmt)
            result.fetchall()  # Force execution
            logger.info("Database connection successful")
            return True
    except Exception as e:
        logger.error(f"Database connection failed: {str(e)}", exc_info=True)
        return False
