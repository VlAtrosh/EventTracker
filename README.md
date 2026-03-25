# EventTracker

Блок-Схема

![Untitled (3)](https://github.com/user-attachments/assets/83ec3a87-d50a-4c43-bec2-f71a8b47e3b1)


```
EventFlow/
│
├── backend/                          # Бэкенд часть (FastAPI)
│   ├── main.py                       # Главный файл сервера (API эндпоинты)
│   ├── database.py                   # Работа с базой данных (SQLite)
│   ├── auth.py                       # Аутентификация (JWT, хеширование)
│   ├── models.py                     # Pydantic модели данных
│   ├── events.db                     # База данных SQLite (создается автоматически)
│   ├── requirements.txt              # Python зависимости
│
├── frontend/                         # Фронтенд часть (HTML/CSS/JS)
│   ├── index.html                    # Главная страница
│   ├── style.css                     # Стили оформления
│   └── app.js                        # Клиентская логика (API запросы)
```
