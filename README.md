# FastAPI Production Starter

A production-ready FastAPI starter application with a ChatGPT-like web interface, proper structure, configuration management, error handling, and best practices.

## Features

- ✅ **ChatGPT-like Web Interface** - Beautiful, modern chat UI ready for your local model
- ✅ Clean project structure following FastAPI best practices
- ✅ Configuration management with environment variables
- ✅ Custom exception handling
- ✅ Structured logging
- ✅ CORS middleware
- ✅ Health check endpoints
- ✅ Chat API endpoint (ready for model integration)
- ✅ Example CRUD operations
- ✅ Pydantic schemas for validation
- ✅ Service layer for business logic
- ✅ Type hints throughout

## Project Structure

```
.
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application entry point
│   ├── api/
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py       # Main API router
│   │       └── endpoints/      # API endpoints
│   │           ├── __init__.py
│   │           ├── health.py
│   │           └── items.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py           # Configuration management
│   │   ├── exceptions.py       # Custom exceptions
│   │   └── logging.py          # Logging configuration
│   ├── models/
│   │   ├── __init__.py
│   │   └── item.py             # Data models
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── item.py             # Pydantic schemas
│   └── services/
│       ├── __init__.py
│       └── item_service.py     # Business logic
├── logs/                       # Application logs
├── .env.example               # Environment variables example
├── .gitignore
├── requirements.txt
└── README.md
```

## Quick Start

### For New Users

If you just cloned this repository and are setting it up for the first time, see **[SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)** for detailed step-by-step instructions.

### Quick Setup (For Experienced Users)

1. **Create and activate virtual environment:**
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # Mac/Linux:
   source venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install --upgrade pip
   pip install fastapi uvicorn[standard] pydantic pydantic-settings python-dotenv
   ```

3. **Run the application:**
   ```bash
   python run.py
   ```

4. **Open in browser:**
   - Chat Interface: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Optional: Environment Variables

Copy `env.example` to `.env` and customize settings if needed:
```bash
cp env.example .env
```

## Database (PostgreSQL)

1. Start Postgres:
```bash
docker compose up -d
```

2. Copy `env.example` to `.env` and keep/set:
```bash
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/cullen
```

## Chat Interface

The application includes a beautiful ChatGPT-like web interface accessible at the root URL (`http://localhost:8000`). Features include:

- Clean, modern design similar to ChatGPT
- Real-time conversation display
- Auto-resizing text input
- Typing indicators
- Smooth animations
- Responsive design

## API Endpoints

### Chat
- `POST /api/v1/chat` - Send a chat message (ready for model integration)

### Health Check
- `GET /health` - Health check endpoint
- `GET /api/v1/health` - Detailed health check

### Items (Example CRUD)
- `GET /api/v1/items` - Get all items (with pagination)
- `GET /api/v1/items/{item_id}` - Get a specific item
- `POST /api/v1/items` - Create a new item
- `PUT /api/v1/items/{item_id}` - Update an item
- `DELETE /api/v1/items/{item_id}` - Delete an item

## Development

### Adding New Endpoints

1. Create a new router file in `app/api/v1/endpoints/`
2. Define your schemas in `app/schemas/`
3. Create service logic in `app/services/`
4. Add the router to `app/api/v1/router.py`

### Adding Database Support

The app uses SQLAlchemy models in `app/models/` and reads the connection string from `DATABASE_URL`.

### Adding Authentication

1. Install `python-jose[cryptography]` and `passlib[bcrypt]`
2. Create authentication utilities in `app/core/security.py`
3. Add authentication dependencies
4. Protect routes with authentication decorators

## Production Deployment

### Environment Variables

Ensure all production environment variables are set:
- Strong `SECRET_KEY`
- Production `DATABASE_URL`
- Appropriate `CORS_ORIGINS`
- `DEBUG=False`

### Running in Production

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

Or using a process manager like systemd, supervisor, or Docker.

### Docker (Optional)

You can containerize the application:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Best Practices Included

- ✅ Separation of concerns (routers, services, models, schemas)
- ✅ Environment-based configuration
- ✅ Comprehensive error handling
- ✅ Request/response validation with Pydantic
- ✅ Type hints throughout
- ✅ Logging configuration
- ✅ CORS middleware
- ✅ Health check endpoints
- ✅ Clean project structure

## Integrating Your Local Model

To connect your local model to the chat interface, edit `app/api/v1/endpoints/chat.py`:

```python
@router.post("", response_model=ChatResponse, status_code=status.HTTP_200_OK)
async def chat(request: ChatRequest):
    # Replace this with your model logic
    response = await your_model.generate(request.message)
    return ChatResponse(response=response)
```

The chat endpoint is already set up and ready to receive messages. Just add your model inference logic!

## Next Steps

- **Connect your local model** to the chat endpoint
- Add database integration (SQLAlchemy, Alembic for migrations)
- Implement authentication and authorization (JWT tokens)
- Add unit and integration tests
- Set up CI/CD pipeline
- Add API rate limiting
- Implement caching
- Add monitoring and metrics
- Set up Docker and Docker Compose

## License

MIT

