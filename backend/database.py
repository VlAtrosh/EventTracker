import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "events.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_connection() as conn:
        # Таблица пользователей
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
        
        # Таблица мероприятий
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
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (created_by) REFERENCES users (id)
            )
        """)
        
        # Таблица регистраций
        conn.execute("""
            CREATE TABLE IF NOT EXISTS registrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                event_id INTEGER NOT NULL,
                status TEXT DEFAULT 'registered',
                registered_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (event_id) REFERENCES events (id),
                UNIQUE(user_id, event_id)
            )
        """)
        
        # Создание администратора по умолчанию
        from auth import hash_password
        admin_password = hash_password("admin123")
        
        try:
            conn.execute("""
                INSERT INTO users (username, email, hashed_password, role)
                VALUES (?, ?, ?, ?)
            """, ("admin", "admin@example.com", admin_password, "admin"))
            conn.commit()
        except:
            pass  # Админ уже существует
        
        conn.commit()