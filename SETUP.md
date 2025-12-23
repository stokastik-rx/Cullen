# Virtual Environment Setup Guide

## Windows Setup

### Option 1: Using the setup script (Easiest)
```bash
setup_venv.bat
```

### Option 2: Manual setup
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
venv\Scripts\activate

# Upgrade pip
python -m pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
```

## Linux/Mac Setup

### Option 1: Using the setup script (Easiest)
```bash
chmod +x setup_venv.sh
./setup_venv.sh
```

### Option 2: Manual setup
```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
python -m pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
```

## After Setup

### Activate the virtual environment

**Windows:**
```bash
venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

You'll know it's activated when you see `(venv)` at the start of your command prompt.

### Run the application
```bash
python run.py
```

### Deactivate the virtual environment
```bash
deactivate
```

## Troubleshooting

### If you get "python is not recognized"
- Make sure Python is installed and in your PATH
- Try using `python3` instead of `python` on Linux/Mac
- On Windows, you may need to use `py` instead

### If the virtual environment already exists
If you need to recreate it:
```bash
# Delete the old one
rmdir /s venv        # Windows
rm -rf venv          # Linux/Mac

# Then run setup again
```

### Verify installation
After setup, verify everything is installed:
```bash
pip list
```

You should see `fastapi`, `uvicorn`, `pydantic`, etc. in the list.

