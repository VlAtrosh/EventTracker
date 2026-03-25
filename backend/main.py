from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import List
import os

from database import init_db, get_connection
from auth import hash_password, verify_password, create_access_token, decode_token
from models import *

app = FastAPI(title="EventFlow")
init_db()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Неверный токен")
    
    user_id = payload.get("sub")
    with get_connection() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return dict(user)

def check_admin(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Нет прав")
    return user

@app.post("/api/auth/register")
async def register(user: UserCreate):
    """Регистрация нового пользователя"""
    print(f"Регистрация: {user.username}, {user.email}")
    
    if len(user.password) < 6:
        raise HTTPException(400, "Пароль должен быть минимум 6 символов")
    
    hashed = hash_password(user.password)
    try:
        with get_connection() as conn:
            conn.execute(
                "INSERT INTO users (username, email, hashed_password) VALUES (?, ?, ?)",
                (user.username, user.email, hashed)
            )
            conn.commit()
        return {"ok": True, "message": "Регистрация успешна"}
    except Exception as e:
        print(f"Ошибка: {e}")
        raise HTTPException(400, "Пользователь с таким логином или email уже существует")

@app.post("/api/auth/login")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    """Вход в систему"""
    with get_connection() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE username = ?", (form.username,)
        ).fetchone()
    
    if not user or not verify_password(form.password, user["hashed_password"]):
        raise HTTPException(400, "Неверный логин или пароль")
    
    token = create_access_token({"sub": str(user["id"])})
    return {"access_token": token, "token_type": "bearer", "role": user["role"]}

@app.get("/api/me")
async def get_me(user=Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        username=user["username"],
        email=user["email"],
        role=user["role"],
        created_at=user["created_at"]
    )

@app.get("/api/events")
async def get_events(current_user=Depends(get_current_user)):
    with get_connection() as conn:
        events = conn.execute("""
            SELECT e.*, 
                   CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END as is_registered
            FROM events e
            LEFT JOIN registrations r ON e.id = r.event_id 
                AND r.user_id = ? AND r.status = 'registered'
            ORDER BY e.date DESC
        """, (current_user["id"],)).fetchall()
    
    result = []
    for e in events:
        result.append(EventResponse(
            id=e["id"],
            title=e["title"],
            description=e["description"] or "",
            event_type=e["event_type"],
            date=e["date"],
            location=e["location"],
            max_participants=e["max_participants"],
            current_participants=e["current_participants"],
            created_by=e["created_by"],
            created_at=e["created_at"],
            is_registered=bool(e["is_registered"]),
            can_register=e["current_participants"] < e["max_participants"]
        ))
    return result

@app.post("/api/events")
async def create_event(event: EventCreate, admin=Depends(check_admin)):
    with get_connection() as conn:
        cursor = conn.execute("""
            INSERT INTO events (title, description, event_type, date, location, max_participants, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (event.title, event.description, event.event_type, event.date, 
              event.location, event.max_participants, admin["id"]))
        conn.commit()
        return {"id": cursor.lastrowid, "ok": True}

@app.post("/api/registrations/{event_id}")
async def register_event(event_id: int, current_user=Depends(get_current_user)):
    with get_connection() as conn:
        event = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        if not event:
            raise HTTPException(404, "Мероприятие не найдено")
        
        if event["current_participants"] >= event["max_participants"]:
            raise HTTPException(400, "Нет свободных мест")
        
        existing = conn.execute("""
            SELECT * FROM registrations 
            WHERE user_id = ? AND event_id = ? AND status = 'registered'
        """, (current_user["id"], event_id)).fetchone()
        
        if existing:
            raise HTTPException(400, "Вы уже зарегистрированы")
        
        conn.execute("INSERT INTO registrations (user_id, event_id) VALUES (?, ?)", 
                    (current_user["id"], event_id))
        conn.execute("UPDATE events SET current_participants = current_participants + 1 WHERE id = ?", 
                    (event_id,))
        conn.commit()
        
        return {"ok": True}

@app.delete("/api/registrations/{event_id}")
async def cancel_registration(event_id: int, current_user=Depends(get_current_user)):
    with get_connection() as conn:
        reg = conn.execute("""
            SELECT * FROM registrations 
            WHERE user_id = ? AND event_id = ? AND status = 'registered'
        """, (current_user["id"], event_id)).fetchone()
        
        if not reg:
            raise HTTPException(404, "Регистрация не найдена")
        
        conn.execute("UPDATE registrations SET status = 'cancelled' WHERE id = ?", (reg["id"],))
        conn.execute("UPDATE events SET current_participants = current_participants - 1 WHERE id = ?", 
                    (event_id,))
        conn.commit()
        
        return {"ok": True}

@app.get("/api/registrations/my")
async def my_registrations(current_user=Depends(get_current_user)):
    with get_connection() as conn:
        regs = conn.execute("""
            SELECT r.*, e.title as event_title, e.date as event_date
            FROM registrations r
            JOIN events e ON r.event_id = e.id
            WHERE r.user_id = ? AND r.status = 'registered'
        """, (current_user["id"],)).fetchall()
        
        return [RegistrationResponse(
            id=r["id"],
            event_id=r["event_id"],
            event_title=r["event_title"],
            event_date=r["event_date"],
            status=r["status"],
            registered_at=r["registered_at"]
        ) for r in regs]

@app.get("/api/events/{event_id}/participants")
async def get_participants(event_id: int, admin=Depends(check_admin)):
    with get_connection() as conn:
        participants = conn.execute("""
            SELECT u.username, u.email, r.registered_at
            FROM registrations r
            JOIN users u ON r.user_id = u.id
            WHERE r.event_id = ? AND r.status = 'registered'
        """, (event_id,)).fetchall()
        
        return [dict(p) for p in participants]

@app.get("/api/test")
async def test():
    return {"status": "ok", "message": "Сервер работает"}

frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")

# Корневой маршрут отдает index.html
@app.get("/")
async def root():
    index_path = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "Frontend not found"}

# Монтируем статические файлы (css, js) на /static
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
