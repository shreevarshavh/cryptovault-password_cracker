<<<<<<< HEAD
# 🔐 CryptoVault — Password Cracking Simulation Tool

An educational cybersecurity application that demonstrates how weak passwords
can be compromised using the **Backtracking algorithm**. Built with React
(frontend) and Flask + Socket.IO (backend).

---

## 🏗️ Project Structure

```
password-cracker/
├── backend/
│   ├── app.py              ← Flask + Socket.IO API
│   └── requirements.txt    ← Python dependencies
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── App.js          ← Main React component
    │   ├── App.css         ← Cyberpunk UI styles
    │   ├── index.js
    │   └── index.css
    └── package.json        ← Node dependencies
```

---

## ⚙️ Prerequisites

Make sure these are installed:

| Tool | Version | Check command |
|------|---------|---------------|
| Python | 3.8+ | `python --version` |
| pip | Latest | `pip --version` |
| Node.js | 16+ | `node --version` |
| npm | 8+ | `npm --version` |

---

## 🚀 How to Run

### Step 1 — Set up the Backend

Open **Terminal 1** and run:

```bash
# Navigate to backend folder
cd password-cracker/backend

# (Optional but recommended) Create a virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the backend server
python app.py
```

✅ Backend will run at: **http://localhost:5000**

---

### Step 2 — Set up the Frontend

Open **Terminal 2** and run:

```bash
# Navigate to frontend folder
cd password-cracker/frontend

# Install Node dependencies (takes 1-2 minutes first time)
npm install

# Start the React development server
npm start
```

✅ Frontend will open automatically at: **http://localhost:3000**

---

## 🧠 How the Algorithm Works

### Backtracking Approach

The backtracking algorithm works like a systematic guessing game:

```
BACKTRACK(current, target, charset):
  if current == target → FOUND! Return it.
  if len(current) >= len(target) → Too long, backtrack.
  
  for each char in charset:
    result = BACKTRACK(current + char, target, charset)
    if result != NULL → return it (propagate up)
  
  return NULL  ← backtrack: this branch exhausted
```

### Two Modes Available

1. **Recursive Mode** — Uses Python's call stack for DFS traversal
2. **Iterative Mode** — Uses an explicit stack data structure

### Time Complexity
- **O(|charset|^length)** in the worst case
- Example: `abc` with lowercase only → 26³ = 17,576 combinations

---

## 🎯 Features

- ⚡ **Real-time cracking visualization** via WebSocket (Socket.IO)
- 📊 **Live analytics**: attempts counter, time elapsed, progress bar
- 🖥️ **Terminal output** showing the algorithm's progression
- 🔍 **Password Analyzer** — estimates strength & crack time for any password
- 📈 **Complexity charts** — visualizes search space growth
- 🌊 **Matrix rain animation** — reacts to cracking state
- 🎭 **Glitch text effects** — cyberpunk aesthetic
- 🔁 **Recursive & Iterative** backtracking modes

---

## 🛡️ API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Check backend status |
| POST | `/api/crack/start` | Start a cracking session |
| POST | `/api/crack/stop` | Stop an active session |
| POST | `/api/analyze` | Analyze password strength |
| POST | `/api/complexity` | Get combination counts |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `progress` | Server → Client | Live attempt updates |
| `complete` | Server → Client | Session complete/found |

---

## ⚠️ Important Notes

- **Educational use only** — This is a simulation for learning
- Max password length is **6 characters** (to prevent infinite runtime in demo)
- The backend uses Python threading for non-blocking cracking
- Socket.IO ensures real-time updates without polling

---

## 🎓 Resume Talking Points

- **Algorithm**: Implemented Backtracking (DFS) with pruning for systematic search
- **Real-time**: WebSocket integration (Socket.IO) for live progress streaming
- **Full-stack**: React frontend + Flask REST API backend
- **Visualization**: Canvas-based Matrix rain, recharts data visualization
- **Security education**: Password strength analysis with entropy estimation

---

## 🧪 Test Cases to Try

| Password | Charset | Expected Attempts |
|----------|---------|-------------------|
| `a` | lowercase | 1 |
| `z` | lowercase | 26 |
| `abc` | lowercase | ~730 |
| `123` | digits | ~111 |
| `aZ1` | all | Varies |

---

Built with ❤️ for cybersecurity education.
=======
# cryptovault-password_cracker
>>>>>>> 0116ab7d053ec92ff83690f6272e9feb3babf149
