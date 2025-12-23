# Setup Instructions for New Users

This guide will help you set up and run the FastAPI chat application on your local machine.

## Prerequisites

1. **Python 3.8 or higher** must be installed
   - Check if Python is installed: Open terminal/command prompt and type `python --version`
   - If not installed, download from [python.org](https://www.python.org/downloads/)
   - **Important**: During installation, check "Add Python to PATH"

2. **VS Code** (already installed)

3. **Git** (for cloning the repository)
   - Check if Git is installed: Open terminal and type `git --version`
   - If not installed, download from [git-scm.com](https://git-scm.com/downloads)

## Step-by-Step Setup

### Step 1: Clone the Repository

1. Open VS Code
2. Open the terminal in VS Code:
   - **Windows/Linux**: Press `Ctrl + ~` (backtick)
   - **Mac**: Press `Cmd + ~`
3. Navigate to where you want to save the project (optional):
   ```bash
   cd Desktop
   ```
4. Clone the repository:
   ```bash
   git clone <repository-url>
   ```
   Replace `<repository-url>` with the actual repository URL
5. Navigate into the project folder:
   ```bash
   cd Cullen
   ```

### Step 2: Open the Project in VS Code

1. In VS Code, go to **File → Open Folder**
2. Select the `Cullen` folder you just cloned
3. Click "Select Folder"

### Step 3: Set Up Python Virtual Environment (Recommended)

**Why?** Virtual environments keep project dependencies isolated from other Python projects.

#### Windows:
```bash
python -m venv venv
venv\Scripts\activate
```

#### Mac/Linux:
```bash
python3 -m venv venv
source venv/bin/activate
```

**You'll know it's activated when you see `(venv)` at the start of your terminal prompt.**

### Step 4: Install Dependencies

With the virtual environment activated, install the required packages:

```bash
pip install --upgrade pip
pip install fastapi uvicorn[standard] pydantic pydantic-settings python-dotenv
```

Or if you have a `requirements.txt` file:

```bash
pip install -r requirements.txt
```

### Step 5: Run the Application

You have two options:

#### Option A: Using the run script (Easiest)
```bash
python run.py
```

#### Option B: Using uvicorn directly
```bash
uvicorn app.main:app --reload
```

You should see output like:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Application startup complete.
```

### Step 6: Access the Application

1. Open your web browser
2. Navigate to: **http://localhost:8000**
3. You should see the chat interface!

## Troubleshooting

### "python is not recognized" or "python: command not found"
- **Windows**: Make sure Python was added to PATH during installation. Try `py` instead of `python`
- **Mac/Linux**: Try `python3` instead of `python`

### "ModuleNotFoundError" or "No module named..."
- Make sure you activated the virtual environment (you should see `(venv)` in your terminal)
- Run `pip install -r requirements.txt` again

### Port 8000 is already in use
- Stop any other application using port 8000
- Or run on a different port: `uvicorn app.main:app --reload --port 8001`
- Then access at `http://localhost:8001`

### Can't see the chat interface
- Make sure the server is running (check terminal for "Uvicorn running" message)
- Try refreshing the browser
- Check that you're going to `http://localhost:8000` (not `https://`)

## Stopping the Server

To stop the server, press `Ctrl + C` in the terminal where it's running.

## Next Steps

- The chat interface is ready to use
- All chats are saved locally in your browser
- To connect a local AI model, edit `app/api/v1/endpoints/chat.py`

## Getting Help

If you encounter issues:
1. Check that all prerequisites are installed
2. Make sure the virtual environment is activated
3. Verify all dependencies are installed (`pip list`)
4. Check the terminal for error messages

