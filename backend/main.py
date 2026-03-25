from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from typing import List
import os

from database import init_db, get_connection
from auth import hash_password, verify_password, create_access_token, decode_token
from models import *

app = FastAPI(title="Event Management System")
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Недействительный токен")
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный токен")
    
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (int(user_id),)).fetchone()
    
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")
    
    return dict(row)

def check_admin(user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуются права администратора")
    return user


@app.post("/api/auth/register", status_code=201)
def register(user: UserCreate):
    if len(user.password) < 6:
        raise HTTPException(status_code=400, detail="Пароль должен быть минимум 6 символов")
    
    hashed = hash_password(user.password)
    try:
        with get_connection() as conn:
            conn.execute(
                "INSERT INTO users (username, email, hashed_password) VALUES (?, ?, ?)",
                (user.username.strip(), user.email.lower().strip(), hashed)
            )
            conn.commit()
    except Exception:
        raise HTTPException(status_code=400, detail="Пользователь с таким логином или email уже существует")
    
    return {"ok": True, "message": "Регистрация успешна"}

@app.post("/api/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ?", (form.username,)
        ).fetchone()
    
    if not row or not verify_password(form.password, row["hashed_password"]):
        raise HTTPException(status_code=400, detail="Неверный логин или пароль")
    
    token = create_access_token({"sub": str(row["id"])})
    return {"access_token": token, "token_type": "bearer", "role": row["role"]}

@app.get("/api/me", response_model=UserResponse)
def me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        username=user["username"],
        email=user["email"],
        role=user["role"],
        created_at=user["created_at"]
    )


@app.get("/api/events", response_model=List[EventResponse])
def get_events(current_user: dict = Depends(get_current_user)):
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
    for event in events:
        event_dict = dict(event)
        result.append(EventResponse(
            **event_dict,
            is_registered=bool(event_dict.get("is_registered", 0)),
            can_register=event_dict["current_participants"] < event_dict["max_participants"]
        ))
    return result

@app.post("/api/events", status_code=201)
def create_event(event: EventCreate, admin: dict = Depends(check_admin)):
    with get_connection() as conn:
        try:
            cursor = conn.execute("""
                INSERT INTO events (title, description, event_type, date, location, max_participants, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (event.title, event.description, event.event_type, event.date, 
                  event.location, event.max_participants, admin["id"]))
            conn.commit()
            event_id = cursor.lastrowid
            return {"id": event_id, "ok": True}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/events/{event_id}", response_model=EventResponse)
def get_event(event_id: int, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        event = conn.execute("""
            SELECT e.*, 
                   CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END as is_registered
            FROM events e
            LEFT JOIN registrations r ON e.id = r.event_id 
                AND r.user_id = ? AND r.status = 'registered'
            WHERE e.id = ?
        """, (current_user["id"], event_id)).fetchone()
        
        if not event:
            raise HTTPException(status_code=404, detail="Мероприятие не найдено")
        
        event_dict = dict(event)
        return EventResponse(
            **event_dict,
            is_registered=bool(event_dict.get("is_registered", 0)),
            can_register=event_dict["current_participants"] < event_dict["max_participants"]
        )

@app.delete("/api/events/{event_id}")
def delete_event(event_id: int, admin: dict = Depends(check_admin)):
    with get_connection() as conn:
        # Удаляем все регистрации на это мероприятие
        conn.execute("DELETE FROM registrations WHERE event_id = ?", (event_id,))
        # Удаляем мероприятие
        conn.execute("DELETE FROM events WHERE id = ?", (event_id,))
        conn.commit()
    return {"ok": True}


@app.post("/api/registrations/{event_id}")
def register_for_event(event_id: int, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        # Проверяем существование мероприятия
        event = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        if not event:
            raise HTTPException(status_code=404, detail="Мероприятие не найдено")
        
        # Проверяем свободные места
        if event["current_participants"] >= event["max_participants"]:
            raise HTTPException(status_code=400, detail="Нет свободных мест")
        
        # Проверяем, не зарегистрирован ли уже пользователь
        existing = conn.execute("""
            SELECT * FROM registrations 
            WHERE user_id = ? AND event_id = ? AND status = 'registered'
        """, (current_user["id"], event_id)).fetchone()
        
        if existing:
            raise HTTPException(status_code=400, detail="Вы уже зарегистрированы на это мероприятие")
        
        # Регистрируем
        conn.execute("""
            INSERT INTO registrations (user_id, event_id) VALUES (?, ?)
        """, (current_user["id"], event_id))
        
        # Обновляем количество участников
        conn.execute("""
            UPDATE events SET current_participants = current_participants + 1
            WHERE id = ?
        """, (event_id,))
        
        conn.commit()
    
    return {"ok": True, "message": "Регистрация успешна"}

@app.delete("/api/registrations/{event_id}")
def cancel_registration(event_id: int, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        # Проверяем регистрацию
        registration = conn.execute("""
            SELECT * FROM registrations 
            WHERE user_id = ? AND event_id = ? AND status = 'registered'
        """, (current_user["id"], event_id)).fetchone()
        
        if not registration:
            raise HTTPException(status_code=404, detail="Регистрация не найдена")
        
        # Отменяем регистрацию
        conn.execute("""
            UPDATE registrations SET status = 'cancelled' 
            WHERE id = ?
        """, (registration["id"],))
        
        # Уменьшаем количество участников
        conn.execute("""
            UPDATE events SET current_participants = current_participants - 1
            WHERE id = ?
        """, (event_id,))
        
        conn.commit()
    
    return {"ok": True, "message": "Регистрация отменена"}

@app.get("/api/registrations/my", response_model=List[RegistrationResponse])
def get_my_registrations(current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        registrations = conn.execute("""
            SELECT r.*, e.title as event_title, e.date as event_date
            FROM registrations r
            JOIN events e ON r.event_id = e.id
            WHERE r.user_id = ? AND r.status = 'registered'
            ORDER BY r.registered_at DESC
        """, (current_user["id"],)).fetchall()
        
        return [RegistrationResponse(
            id=reg["id"],
            event_id=reg["event_id"],
            event_title=reg["event_title"],
            event_date=reg["event_date"],
            status=reg["status"],
            registered_at=reg["registered_at"]
        ) for reg in registrations]

@app.get("/api/events/{event_id}/participants")
def get_event_participants(event_id: int, admin: dict = Depends(check_admin)):
    with get_connection() as conn:
        participants = conn.execute("""
            SELECT u.id, u.username, u.email, r.registered_at
            FROM registrations r
            JOIN users u ON r.user_id = u.id
            WHERE r.event_id = ? AND r.status = 'registered'
            ORDER BY r.registered_at
        """, (event_id,)).fetchall()
        
        return [dict(p) for p in participants]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)