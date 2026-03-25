const API = 'http://localhost:8000/api';

let currentUser = null;

const pageAuth = document.getElementById('page-auth');
const pageApp = document.getElementById('page-app');
const mainContent = document.getElementById('main-content');
const userNameSpan = document.getElementById('user-name');
const userRoleSpan = document.getElementById('user-role');

async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const res = await fetch(API + endpoint, { ...options, headers });
    if (res.status === 401) logout();
    return res;
}

// Регистрация
document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    
    const res = await fetch(API + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
    });
    
    const data = await res.json();
    if (res.ok) {
        alert('Регистрация успешна! Теперь войдите');
        document.querySelector('[data-tab="login"]').click();
    } else {
        alert(data.detail);
    }
});

// Вход
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    const res = await fetch(API + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
    });
    
    const data = await res.json();
    if (res.ok) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('role', data.role);
        loadApp();
    } else {
        alert(data.detail);
    }
});

// Загрузка мероприятий
async function loadEvents() {
    const res = await apiFetch('/events');
    const events = await res.json();
    
    mainContent.innerHTML = `
        <div class="events-grid">
            ${events.map(e => `
                <div class="event-card">
                    <h3>${e.title}</h3>
                    <p>${e.event_type} | ${e.location}</p>
                    <p>📅 ${new Date(e.date).toLocaleString()}</p>
                    <p>👥 ${e.current_participants}/${e.max_participants} мест</p>
                    ${e.is_registered ? 
                        `<button onclick="cancelReg(${e.id})" class="btn-danger">Отменить</button>` :
                        `<button onclick="register(${e.id})" class="btn-primary">Записаться</button>`
                    }
                    ${currentUser?.role === 'admin' ? 
                        `<button onclick="showParts(${e.id})" class="btn-outline">Участники</button>` : ''
                    }
                </div>
            `).join('')}
        </div>
    `;
}

// Мои мероприятия
async function loadMyEvents() {
    const res = await apiFetch('/registrations/my');
    const regs = await res.json();
    
    mainContent.innerHTML = `
        <div class="events-grid">
            ${regs.map(r => `
                <div class="event-card">
                    <h3>${r.event_title}</h3>
                    <p>📅 ${new Date(r.event_date).toLocaleString()}</p>
                    <button onclick="cancelReg(${r.event_id})" class="btn-danger">Отменить</button>
                </div>
            `).join('')}
        </div>
    `;
}

// Создание мероприятия
function showCreateForm() {
    mainContent.innerHTML = `
        <div class="create-form">
            <h2>Создать мероприятие</h2>
            <input id="title" placeholder="Название">
            <textarea id="desc" placeholder="Описание"></textarea>
            <select id="type">
                <option value="hackathon">Хакатон</option>
                <option value="meeting">Встреча</option>
                <option value="lecture">Лекция</option>
            </select>
            <input id="date" type="datetime-local">
            <input id="location" placeholder="Место">
            <input id="max" type="number" placeholder="Макс. участников">
            <button onclick="createEvent()" class="btn-primary">Создать</button>
        </div>
    `;
}

async function createEvent() {
    const data = {
        title: document.getElementById('title').value,
        description: document.getElementById('desc').value,
        event_type: document.getElementById('type').value,
        date: document.getElementById('date').value,
        location: document.getElementById('location').value,
        max_participants: parseInt(document.getElementById('max').value)
    };
    
    const res = await apiFetch('/events', { method: 'POST', body: JSON.stringify(data) });
    if (res.ok) {
        alert('Мероприятие создано');
        loadEvents();
        document.querySelector('[data-view="events"]').click();
    } else {
        alert('Ошибка');
    }
}

window.register = async (id) => {
    const res = await apiFetch(`/registrations/${id}`, { method: 'POST' });
    if (res.ok) {
        alert('Зарегистрированы!');
        loadEvents();
    } else {
        alert('Ошибка');
    }
};

window.cancelReg = async (id) => {
    if (!confirm('Отменить регистрацию?')) return;
    const res = await apiFetch(`/registrations/${id}`, { method: 'DELETE' });
    if (res.ok) {
        alert('Отменено');
        const active = document.querySelector('.nav-tab.active')?.dataset.view;
        if (active === 'events') loadEvents();
        else loadMyEvents();
    }
};

window.showParts = async (id) => {
    const res = await apiFetch(`/events/${id}/participants`);
    const parts = await res.json();
    if (parts.length === 0) {
        alert('Нет участников');
        return;
    }
    let msg = 'Участники:\n';
    parts.forEach(p => msg += `${p.username} (${p.email})\n`);
    alert(msg);
};

async function loadApp() {
    const res = await apiFetch('/me');
    if (!res.ok) { logout(); return; }
    
    currentUser = await res.json();
    userNameSpan.textContent = currentUser.username;
    userRoleSpan.textContent = currentUser.role === 'admin' ? 'Админ' : 'Участник';
    
    if (currentUser.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    }
    
    pageAuth.classList.add('hidden');
    pageApp.classList.remove('hidden');
    
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            if (tab.dataset.view === 'events') loadEvents();
            if (tab.dataset.view === 'my') loadMyEvents();
            if (tab.dataset.view === 'create') showCreateForm();
        };
    });
    
    loadEvents();
}

function logout() {
    localStorage.clear();
    pageAuth.classList.remove('hidden');
    pageApp.classList.add('hidden');
}

// Запуск
if (localStorage.getItem('token')) {
    loadApp();
}