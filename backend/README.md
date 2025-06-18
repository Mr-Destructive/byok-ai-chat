# BYOK Chat API Backend

A FastAPI-based backend for the BYOK (Bring Your Own Keys) Chat application, featuring OAuth authentication with Google and email/password login.

## Features

- 🔐 **Authentication**
  - Email/Password login and registration
  - Google OAuth 2.0 integration
  - JWT token-based authentication
  - Protected API endpoints

- 💬 **Chat Functionality**
  - Create and manage chat threads
  - Send and receive messages
  - Support for multiple AI providers (OpenAI, Anthropic, etc.)

- 🔑 **API Key Management**
  - Securely store and manage API keys for different AI providers
  - Associate API keys with user accounts

## Prerequisites

- Python 3.8+
- SQLite (for development) or PostgreSQL (for production)
- Google OAuth 2.0 credentials

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# App
SECRET_KEY=your-secret-key
ENCRYPTION_KEY=your-encryption-key

# Database
DATABASE_URL=sqlite:///./byok_chat.db  # For development
# DATABASE_URL=postgresql://user:password@localhost/dbname  # For production

# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# JWT
ACCESS_TOKEN_EXPIRE_MINUTES=1440  # 24 hours
REFRESH_TOKEN_EXPIRE_DAYS=7
```

## Setup and Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/byokchat.git
   cd byokchat/backend
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Initialize the database:
   ```bash
   python init_db.py
   ```

## Running the Application

### Development

```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

### Production

For production, use a production-grade ASGI server like Uvicorn with Gunicorn:

```bash
gunicorn -k uvicorn.workers.UvicornWorker -w 4 -k uvicorn.workers.UvicornWorker main:app
```

## API Documentation

Once the application is running, you can access the following:

- **Interactive API docs (Swagger UI)**: `http://localhost:8000/api/docs`
- **Alternative API docs (ReDoc)**: `http://localhost:8000/api/redoc`

## Authentication

### Email/Password Login

```http
POST /api/auth/login
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=yourpassword
```

### Google OAuth

1. Redirect users to: 
   ```
   GET /api/auth/google
   ```

2. After Google authentication, the user will be redirected to the callback URL with an authorization code.

3. Exchange the authorization code for an access token:
   ```http
   POST /api/auth/google/token
   Content-Type: application/json

   {
     "code": "authorization_code_from_google",
     "redirect_uri": "http://your-frontend.com/auth/google/callback"
   }
   ```

### Protected Routes

Include the JWT token in the Authorization header:
```
Authorization: Bearer your.jwt.token.here
```

## Testing

Run the test suite:

```bash
pytest test_oauth.py -v
```

## Deployment

### Docker

1. Build the Docker image:
   ```bash
   docker build -t byokchat-backend .
   ```

2. Run the container:
   ```bash
   docker run -d -p 8000:8000 --env-file .env byokchat-backend
   ```

### Cloud Providers

- **AWS**: Deploy to ECS or EKS
- **Google Cloud**: Deploy to Cloud Run or GKE
- **Azure**: Deploy to App Service or AKS

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SECRET_KEY` | Secret key for JWT token signing | Yes | - |
| `ENCRYPTION_KEY` | Key for encrypting sensitive data | Yes | - |
| `DATABASE_URL` | Database connection URL | Yes | - |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | For OAuth | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | For OAuth | - |
| `GOOGLE_REDIRECT_URI` | OAuth redirect URI | For OAuth | - |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT token expiration in minutes | No | 1440 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token expiration in days | No | 7 |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/)
- [SQLAlchemy](https://www.sqlalchemy.org/)
- [Google OAuth](https://developers.google.com/identity/protocols/oauth2)
- [JWT](https://jwt.io/)