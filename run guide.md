# Running the Health-Mate Application

## 1. Backend (FastAPI)

The backend is built with FastAPI and requires Python. The virtual environment (`venv`) is located in the project root.

### Steps to Run:

1.  **Open a Terminal** and navigate to the project root:
    ```bash
    cd /Users/sainacomputer/Desktop/8thsem/cuty-main
    ```

2.  **Activate the Virtual Environment** (Must be done from the project root):
    ```bash
    source venv/bin/activate
    ```

3.  **Navigate to the Backend Directory**:
    ```bash
    cd backend_fastapi
    ```

4.  **Install Dependencies** (only needed first time or after changes):
    ```bash
    pip install -r requirements.txt
    ```

5.  **Start the Server**:
    ```bash
    `uvicorn main:app --reload`
    ```

- **API URL**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **API Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

> **Troubleshooting:**
> - If `source venv/bin/activate` fails, verify you are in the directory `/Users/sainacomputer/Desktop/8thsem/cuty-main`.
> - The backend connects to MongoDB and Redis. Ensure these services are running or accessible.

### Run on a Different Port
To run the backend on a specific port (e.g., 8080):
```bash
uvicorn main:app --reload --port 8080
```

---

## 2. Frontend (React + Vite)

The frontend is built with React and Vite.

### Steps to Run:

1.  **Open a New Terminal Tab** and navigate to the frontend directory:
    ```bash
    cd /Users/sainacomputer/Desktop/8thsem/cuty-main/frontend
    ```

2.  **Install Dependencies** (only needed first time or after changes):
    ```bash
    npm install
    ```

3.  **Start the Development Server**:
    ```bash
    npm run dev
    ```

- **Application URL**: [http://localhost:5173](http://localhost:5173)

### Run on a Different Port
To run the frontend on a specific port (e.g., 3000):
```bash
npm run dev -- --port 3000
```

---

## 3. Managing Ports (Kill Process)

If a port is already in use (e.g., "Address already in use"), you can find and kill the process using it.

### Find Process ID (PID)
Check what is running on a port (e.g., 8000):
```bash
lsof -i :8000
```
This will show an output like:
```text
COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
python3 12345 user    3u  IPv4 0x12345678      0t0  TCP localhost:8000 (LISTEN)
```
Note the **PID** (second column, e.g., `12345`).

### Kill Process
Kill the process using its PID:
```bash
kill -9 <PID>
```
*Replace `<PID>` with the actual number (e.g., `kill -9 12345`).*

### Alternative (One Command)
You can also use `npx kill-port` to kill a port quickly:
```bash
npx kill-port 8000
```
