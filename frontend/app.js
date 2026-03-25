const API_URL = 'http://localhost:8000/api';

let currentUser = null;

// DOM элементы
const pageAuth = document.getElementById('page-auth');
const pageApp = document.getElementById('page-app');
const mainContent = document.getElementById('main-content');
const userNameSpan = document.getElementById('user-name');
const userRoleSpan = document.getElementById('user-role');

// Вспомогательные функции
function setError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) element.textContent = message;
}

function clearMessages(...ids) {
    ids.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = '';
    });
}

function showLoading() {
    mainContent.innerHTML = '<div style="text-align: center; padding: 40px;">Загрузка...</div>';
}

async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });
    
    if (response.status === 401) {
        logout();
        return null;
    }
    
    return response;
}

// Авторизация
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    clearMessages('login-error');
    
    if (!username || !password) {
        setError('login-error', 'Заполните все поля');
        return;
    }
    
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            setError('login-error', data.detail || 'Ошибка входа');
            return;
        }
        
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('role', data.role);
        await loadApp();
    } catch (error) {
        setError('login-error', 'Ошибка соединения с сервером');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    
    clearMessages('reg-error', 'reg-success');
    
    if (!username || !email || !password) {
        setError('reg-error', 'Заполните все поля');
        return;
    }
    
    if (password.length < 6) {
        setError('reg-error', 'Пароль должен быть минимум 6 символов');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            setError('reg-error', data.detail || 'Ошибка регистрации');
            return;
        }
        
        setError('reg-success', '✅ Регистрация успешна! Теперь войдите в аккаунт.');
        setTimeout(() => {
            document.querySelector('[data-tab="login"]').click();
            document.getElementById('login-username').value = username;
        }, 1500);
    } catch (error) {
        setError('reg-error', 'Ошибка соединения с сервером');
    }
}

// Загрузка мероприятий
async function loadEvents() {
    showLoading();
    const response = await apiFetch('/events');
    
    if (!response || !response.ok) {
        mainContent.innerHTML = '<div style="text-align: center; padding: 40px;">Ошибка загрузки мероприятий</div>';
        return;
    }
    
    const events = await response.json();
    
    if (events.length === 0) {
        mainContent.innerHTML = '<div style="text-align: center; padding: 40px;">Нет доступных мероприятий</div>';
        return;
    }
    
    mainContent.innerHTML = `
        <div class="events-grid">
            ${events.map(event => `
                <div class="event-card">
                    <div class="event-title">${escapeHtml(event.title)}</div>
                    <span class="event-type">${getEventTypeName(event.event_type)}</span>
                    <div class="event-details">
                        <div>📅 ${formatDate(event.date)}</div>
                        <div>📍 ${escapeHtml(event.location)}</div>
                        <div>📝 ${escapeHtml(event.description.substring(0, 100))}${event.description.length > 100 ? '...' : ''}</div>
                    </div>
                    <div class="event-stats">
                        <div class="seats ${event.current_participants >= event.max_participants ? 'full' : ''}">
                            👥 ${event.current_participants}/${event.max_participants} мест
                        </div>
                        <div class="event-actions">
                            ${event.is_registered ? 
                                `<button onclick="cancelRegistration(${event.id})" class="btn btn-danger">Отменить</button>` :
                                (event.can_register ? 
                                    `<button onclick="registerForEvent(${event.id})" class="btn btn-primary">Записаться</button>` :
                                    `<button disabled class="btn btn-outline">Мест нет</button>`)
                            }
                            ${currentUser?.role === 'admin' ? 
                                `<button onclick="showParticipants(${event.id})" class="btn btn-outline">👥 Участники</button>` :
                                ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Загрузка моих мероприятий
async function loadMyEvents() {
    showLoading();
    const response = await apiFetch('/registrations/my');
    
    if (!response || !response.ok) {
        mainContent.innerHTML = '<div style="text-align: center; padding: 40px;">Ошибка загрузки мероприятий</div>';
        return;
    }
    
    const registrations = await response.json();
    
    if (registrations.length === 0) {
        mainContent.innerHTML = '<div style="text-align: center; padding: 40px;">Вы еще не зарегистрированы ни на одно мероприятие</div>';
        return;
    }
    
    mainContent.innerHTML = `
        <div class="events-grid">
            ${registrations.map(reg => `
                <div class="event-card">
                    <div class="event-title">${escapeHtml(reg.event_title)}</div>
                    <div class="event-details">
                        <div>📅 ${formatDate(reg.event_date)}</div>
                        <div>📝 Зарегистрирован: ${formatDate(reg.registered_at)}</div>
                    </div>
                    <div class="event-stats">
                        <div class="event-actions">
                            <button onclick="cancelRegistration(${reg.event_id})" class="btn btn-danger">Отменить запись</button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Форма создания мероприятия
function showCreateEventForm() {
    mainContent.innerHTML = `
        <div class="create-form">
            <h2>Создать мероприятие</h2>
            <form id="create-event-form">
                <div class="form-group">
                    <label>Название *</label>
                    <input type="text" id="event-title" required>
                </div>
                <div class="form-group">
                    <label>Описание</label>
                    <textarea id="event-description" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label>Тип мероприятия *</label>
                    <select id="event-type" required>
                        <option value="hackathon">Хакатон</option>
                        <option value="meeting">Встреча</option>
                        <option value="lecture">Лекция</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Дата и время *</label>
                    <input type="datetime-local" id="event-date" required>
                </div>
                <div class="form-group">
                    <label>Место проведения *</label>
                    <input type="text" id="event-location" required>
                </div>
                <div class="form-group">
                    <label>Максимальное количество участников *</label>
                    <input type="number" id="event-max-participants" min="1" value="10" required>
                </div>
                <button type="submit" class="btn btn-primary">Создать мероприятие</button>
            </form>
        </div>
    `;
    
    document.getElementById('create-event-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const eventData = {
            title: document.getElementById('event-title').value,
            description: document.getElementById('event-description').value,
            event_type: document.getElementById('event-type').value,
            date: document.getElementById('event-date').value,
            location: document.getElementById('event-location').value,
            max_participants: parseInt(document.getElementById('event-max-participants').value)
        };
        
        const response = await apiFetch('/events', {
            method: 'POST',
            body: JSON.stringify(eventData)
        });
        
        if (response && response.ok) {
            alert('Мероприятие создано успешно!');
            loadEvents();
            document.querySelector('[data-view="events"]').click();
        } else {
            const error = await response?.json();
            alert('Ошибка: ' + (error?.detail || 'Не удалось создать мероприятие'));
        }
    });
}

// Регистрация на мероприятие
async function registerForEvent(eventId) {
    const response = await apiFetch(`/registrations/${eventId}`, {
        method: 'POST'
    });
    
    if (response && response.ok) {
        alert('Вы успешно зарегистрировались!');
        loadEvents();
    } else {
        const error = await response?.json();
        alert('Ошибка: ' + (error?.detail || 'Не удалось зарегистрироваться'));
    }
}

// Отмена регистрации
async function cancelRegistration(eventId) {
    if (!confirm('Вы уверены, что хотите отменить регистрацию?')) return;
    
    const response = await apiFetch(`/registrations/${eventId}`, {
        method: 'DELETE'
    });
    
    if (response && response.ok) {
        alert('Регистрация отменена');
        const activeTab = document.querySelector('.nav-tab.active')?.dataset.view;
        if (activeTab === 'events') {
            loadEvents();
        } else if (activeTab === 'my') {
            loadMyEvents();
        }
    } else {
        const error = await response?.json();
        alert('Ошибка: ' + (error?.detail || 'Не удалось отменить регистрацию'));
    }
}

// Показать участников мероприятия
async function showParticipants(eventId) {
    const response = await apiFetch(`/events/${eventId}/participants`);
    
    if (response && response.ok) {
        const participants = await response.json();
        const event = await apiFetch(`/events/${eventId}`);
        const eventData = await event.json();
        
        if (participants.length === 0) {
            alert('На это мероприятие еще никто не зарегистрирован');
            return;
        }
        
        let message = `Участники мероприятия "${eventData.title}":\n\n`;
        participants.forEach((p, index) => {
            message += `${index + 1}. ${p.username} (${p.email})\n   Зарегистрирован: ${formatDate(p.registered_at)}\n`;
        });
        alert(message);
    }
}

// Вспомогательные функции
function getEventTypeName(type) {
    const types = {
        'hackathon': '🚀 Хакатон',
        'meeting': '👥 Встреча',
        'lecture': '📚 Лекция'
    };
    return types[type] || type;
}

function formatDate(dateStr) {
    if (!dateStr) return 'Дата не указана';
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Навигация
function setupNavigation() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const view = tab.dataset.view;
            if (view === 'events') {
                loadEvents();
            } else if (view === 'my') {
                loadMyEvents();
            } else if (view === 'create') {
                showCreateEventForm();
            }
        });
    });
}

// Загрузка основного приложения
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
    
    // Показываем кнопки для администратора
    if (currentUser.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    }
    
    pageAuth.classList.add('hidden');
    pageApp.classList.remove('hidden');
    
    setupNavigation();
    loadEvents();
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    currentUser = null;
    pageAuth.classList.remove('hidden');
    pageApp.classList.add('hidden');
    
    // Сбрасываем форму входа
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    clearMessages('login-error');
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Настройка табов авторизации
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabName = tab.dataset.tab;
            document.getElementById('login-form').classList.toggle('hidden', tabName !== 'login');
            document.getElementById('register-form').classList.toggle('hidden', tabName !== 'register');
        });
    });
    
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('logout-btn').addEventListener('click', logout);
    
    // Проверяем наличие токена
    if (localStorage.getItem('token')) {
        loadApp();
    }
});

// Делаем функции глобальными для доступа из HTML
window.registerForEvent = registerForEvent;
window.cancelRegistration = cancelRegistration;
window.showParticipants = showParticipants;