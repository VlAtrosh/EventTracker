# EventTracker

## Блок-Схема

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


<img width="1920" height="912" alt="Снимок экрана (1099)" src="https://github.com/user-attachments/assets/bd9fd77c-a4ea-46b5-924c-6fc3da62946c" />

<img width="1920" height="951" alt="Снимок экрана (1101)" src="https://github.com/user-attachments/assets/b60d8599-0a9f-46bf-899d-f532af060688" />

<img width="1920" height="1008" alt="Снимок экрана (1102)" src="https://github.com/user-attachments/assets/868b41f8-46ca-44f2-b66d-9cd87ac08156" />


