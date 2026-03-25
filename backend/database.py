import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "events.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_connection() as conn:
        # Пользователи
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        
        # Мероприятия
        conn.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                event_type TEXT NOT NULL,
                date TEXT NOT NULL,
                location TEXT NOT NULL,
                max_participants INTEGER NOT NULL,
                current_participants INTEGER DEFAULT 0,
                created_by INTEGER NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        
        # Регистрации
        conn.execute("""
            CREATE TABLE IF NOT EXISTS registrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                event_id INTEGER NOT NULL,
                status TEXT DEFAULT 'registered',
                registered_at TEXT DEFAULT (datetime('now')),
                UNIQUE(user_id, event_id)
            )
        """)
        
        # Создаем админа если нет
        from auth import hash_password
        try:
            conn.execute("""
                INSERT INTO users (username, email, hashed_password, role)
                VALUES (?, ?, ?, ?)
            """, ("admin", "admin@example.com", hash_password("admin123"), "admin"))
            conn.commit()
        except:
            pass
        
        conn.commit()