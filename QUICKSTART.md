# Quick Start Guide

## Running the Application on Localhost

### Step 1: Install Dependencies

First, make sure you have Python 3.8+ installed. Then install the required packages:

```bash
pip install -r requirements.txt
```

Or if you're using a virtual environment (recommended):

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Run the Application

**Option A: Using the run script (easiest)**
```bash
python run.py
```

**Option B: Using uvicorn directly**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Option C: Using uvicorn with auto-reload**
```bash
uvicorn app.main:app --reload
```

### Step 3: Open in Browser

Once the server is running, you'll see output like:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

Open your browser and go to:
- **Chat Interface**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

### Troubleshooting

**Port already in use?**
- Change the port in `env.example` (copy to `.env`) or use:
  ```bash
  uvicorn app.main:app --reload --port 8001
  ```

**Module not found errors?**
- Make sure you're in the project root directory
- Ensure all dependencies are installed: `pip install -r requirements.txt`

**Static files not loading?**
- Make sure the `static/` folder exists with `index.html`, `styles.css`, and `script.js`

### Stopping the Server

Press `CTRL+C` in the terminal where the server is running.

