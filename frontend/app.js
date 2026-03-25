const API = 'http://localhost:8000/api';

let currentUser = null;

// DOM элементы
const pageAuth = document.getElementById('page-auth');
const pageApp = document.getElementById('page-app');
const mainContent = document.getElementById('main-content');
const userNameSpan = document.getElementById('user-name');
const userRoleSpan = document.getElementById('user-role');

async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(API + endpoint, {
        ...options,
        headers
    });
    
    if (response.status === 401) {
        logout();
        return null;
    }
    
    return response;
}

function formatDate(dateStr) {
    if (!dateStr) return 'Дата не указана';
    try {
        const date = new Date(dateStr);
        return date.toLocaleString('ru-RU');
    } catch {
        return dateStr;
    }
}

function getTypeName(type) {
    const types = {
        'hackathon': '🚀 Хакатон',
        'meeting': '👥 Встреча',
        'lecture': '📚 Лекция'
    };
    return types[type] || type;
}

// ============ ПЕРЕКЛЮЧЕНИЕ ТАБОВ ============
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const tabName = tab.dataset.tab;
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        
        if (tabName === 'login') {
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
        } else {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
        }
    });
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    
    const errorDiv = document.getElementById('reg-error');
    const successDiv = document.getElementById('reg-success');
    
    errorDiv.textContent = '';
    successDiv.textContent = '';
    
    if (!username || !email || !password) {
        errorDiv.textContent = 'Заполните все поля';
        return;
    }
    
    if (password.length < 6) {
        errorDiv.textContent = 'Пароль должен быть минимум 6 символов';
        return;
    }
    
    try {
        const response = await fetch(API + '/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            successDiv.textContent = '✅ Регистрация успешна! Теперь войдите.';
            document.getElementById('reg-username').value = '';
            document.getElementById('reg-email').value = '';
            document.getElementById('reg-password').value = '';
            
            setTimeout(() => {
                document.querySelector('[data-tab="login"]').click();
                document.getElementById('login-username').value = username;
            }, 1500);
        } else {
            errorDiv.textContent = data.detail || 'Ошибка регистрации';
        }
    } catch (error) {
        errorDiv.textContent = 'Ошибка соединения с сервером';
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = '';
    
    if (!username || !password) {
        errorDiv.textContent = 'Заполните все поля';
        return;
    }
    
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    try {
        const response = await fetch(API + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('role', data.role);
            await loadApp();
        } else {
            errorDiv.textContent = data.detail || 'Неверный логин или пароль';
        }
    } catch (error) {
        errorDiv.textContent = 'Ошибка соединения с сервером';
    }
});

async function loadEvents() {
    mainContent.innerHTML = '<div style="text-align: center; padding: 40px;">⏳ Загрузка...</div>';
    
    const response = await apiFetch('/events');
    if (!response || !response.ok) {
        mainContent.innerHTML = '<div style="text-align: center; padding: 40px;">❌ Ошибка загрузки мероприятий</div>';
        return;
    }
    
    const events = await response.json();
    
    if (events.length === 0) {
        mainContent.innerHTML = '<div style="text-align: center; padding: 40px;">📭 Нет доступных мероприятий</div>';
        return;
    }
    
    mainContent.innerHTML = `
        <div class="events-grid">
            ${events.map(event => `
                <div class="event-card">
                    <h3>${event.title}</h3>
                    <p><strong>${getTypeName(event.event_type)}</strong></p>
                    <p>📍 ${event.location}</p>
                    <p>📅 ${formatDate(event.date)}</p>
                    <p>👥 ${event.current_participants}/${event.max_participants} мест</p>
                    <p>📝 ${event.description ? event.description.substring(0, 100) : 'Описание отсутствует'}</p>
                    <div style="margin-top: 15px;">
                        ${event.is_registered ? 
                            `<button onclick="cancelRegistration(${event.id})" style="background: #dc3545;">❌ Отменить запись</button>` :
                            (event.can_register ? 
                                `<button onclick="registerForEvent(${event.id})" style="background: #28a745;">✅ Записаться</button>` :
                                `<button disabled style="background: #6c757d;">⚠️ Мест нет</button>`)
                        }
                        ${currentUser && currentUser.role === 'admin' ? 
                            `<button onclick="showParticipants(${event.id})" style="background: #17a2b8; margin-top: 10px;">👥 Список участников</button>` : ''
                        }
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function loadMyEvents() {
    mainContent.innerHTML = '<div style="text-align: center; padding: 40px;">⏳ Загрузка...</div>';
    
    const response = await apiFetch('/registrations/my');
    if (!response || !response.ok) {
        mainContent.innerHTML = '<div style="text-align: center; padding: 40px;">❌ Ошибка загрузки</div>';
        return;
    }
    
    const registrations = await response.json();
    
    if (registrations.length === 0) {
        mainContent.innerHTML = '<div style="text-align: center; padding: 40px;">📭 Вы не зарегистрированы ни на одно мероприятие</div>';
        return;
    }
    
    mainContent.innerHTML = `
        <div class="events-grid">
            ${registrations.map(reg => `
                <div class="event-card">
                    <h3>${reg.event_title}</h3>
                    <p>📅 ${formatDate(reg.event_date)}</p>
                    <p>📝 Зарегистрирован: ${formatDate(reg.registered_at)}</p>
                    <button onclick="cancelRegistration(${reg.event_id})" style="background: #dc3545; margin-top: 15px;">❌ Отменить запись</button>
                </div>
            `).join('')}
        </div>
    `;
}


function showCreateForm() {
    mainContent.innerHTML = `
        <div class="create-form">
            <h2>➕ Создать новое мероприятие</h2>
            <input type="text" id="title" placeholder="Название мероприятия *" required>
            <textarea id="desc" placeholder="Описание" rows="3"></textarea>
            <select id="type">
                <option value="hackathon">🚀 Хакатон</option>
                <option value="meeting">👥 Встреча</option>
                <option value="lecture">📚 Лекция</option>
            </select>
            <input type="datetime-local" id="date" required>
            <input type="text" id="location" placeholder="Место проведения *" required>
            <input type="number" id="max" placeholder="Максимум участников" min="1" value="10" required>
            <button onclick="createNewEvent()" style="background: #28a745;">✅ Создать мероприятие</button>
        </div>
    `;
}

async function createNewEvent() {
    const title = document.getElementById('title').value;
    const date = document.getElementById('date').value;
    const location = document.getElementById('location').value;
    
    if (!title || !date || !location) {
        alert('Заполните обязательные поля (название, дата, место)');
        return;
    }
    
    const eventData = {
        title: title,
        description: document.getElementById('desc').value,
        event_type: document.getElementById('type').value,
        date: date,
        location: location,
        max_participants: parseInt(document.getElementById('max').value)
    };
    
    const response = await apiFetch('/events', {
        method: 'POST',
        body: JSON.stringify(eventData)
    });
    
    if (response && response.ok) {
        alert('✅ Мероприятие создано успешно!');
        loadEvents();
        document.querySelector('[data-view="events"]').click();
    } else {
        const error = await response?.json();
        alert('❌ Ошибка: ' + (error?.detail || 'Не удалось создать мероприятие'));
    }
}

window.registerForEvent = async (eventId) => {
    const response = await apiFetch(`/registrations/${eventId}`, {
        method: 'POST'
    });
    
    if (response && response.ok) {
        alert('✅ Вы успешно зарегистрировались!');
        loadEvents();
    } else {
        const error = await response?.json();
        alert('❌ Ошибка: ' + (error?.detail || 'Не удалось зарегистрироваться'));
    }
};


window.cancelRegistration = async (eventId) => {
    if (!confirm('Вы уверены, что хотите отменить регистрацию?')) return;
    
    const response = await apiFetch(`/registrations/${eventId}`, {
        method: 'DELETE'
    });
    
    if (response && response.ok) {
        alert('✅ Регистрация отменена');
        const activeTab = document.querySelector('.nav-tab.active');
        if (activeTab && activeTab.dataset.view === 'my') {
            loadMyEvents();
        } else {
            loadEvents();
        }
    } else {
        const error = await response?.json();
        alert('❌ Ошибка: ' + (error?.detail || 'Не удалось отменить регистрацию'));
    }
};


window.showParticipants = async (eventId) => {
    const response = await apiFetch(`/events/${eventId}/participants`);
    
    if (response && response.ok) {
        const participants = await response.json();
        const eventRes = await apiFetch(`/events/${eventId}`);
        const event = await eventRes.json();
        
        if (participants.length === 0) {
            alert('На это мероприятие еще никто не зарегистрирован');
            return;
        }
        
        let message = `👥 Участники мероприятия "${event.title}":\n\n`;
        participants.forEach((p, i) => {
            message += `${i + 1}. ${p.username} (${p.email})\n   📅 Зарегистрирован: ${formatDate(p.registered_at)}\n`;
        });
        alert(message);
    }
};


async function loadApp() {
    const token = localStorage.getItem('token');
    if (!token) {
        logout();
        return;
    }
    
    const response = await apiFetch('/me');
    if (!response || !response.ok) {
        logout();
        return;
    }
    
    currentUser = await response.json();
    userNameSpan.textContent = currentUser.username;
    userRoleSpan.textContent = currentUser.role === 'admin' ? 'Администратор' : 'Участник';
    
    // Показываем кнопки админа
    if (currentUser.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'inline-block';
        });
    }
    
    pageAuth.style.display = 'none';
    pageApp.style.display = 'block';
    
    // Навигация
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const view = tab.dataset.view;
            if (view === 'events') loadEvents();
            else if (view === 'my') loadMyEvents();
            else if (view === 'create') showCreateForm();
        });
    });
    
    loadEvents();
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    currentUser = null;
    pageAuth.style.display = 'flex';
    pageApp.style.display = 'none';
    
    const loginUsername = document.getElementById('login-username');
    const loginPassword = document.getElementById('login-password');
    if (loginUsername) loginUsername.value = '';
    if (loginPassword) loginPassword.value = '';
    
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) errorDiv.textContent = '';
}

document.getElementById('logout-btn').addEventListener('click', logout);

// Добавляем функцию в глобальную область
window.createNewEvent = createNewEvent;

if (localStorage.getItem('token')) {
    loadApp();
}
