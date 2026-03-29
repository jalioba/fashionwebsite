# AVISHU — Инструкция по запуску сервера

## 📋 Требования

- **Node.js** v18+ ([скачать](https://nodejs.org/))
- **npm** v9+ (идёт с Node.js)
- **Supabase** аккаунт ([supabase.com](https://supabase.com))

---

## 🚀 Быстрый старт (5 шагов)

### 1. Установить зависимости

```bash
npm install
```

### 2. Настроить Supabase

#### 2.1 Создать проект
1. Зайдите на [supabase.com](https://supabase.com) → **New Project**
2. Задайте имя (например, `avishu-crm`) и пароль для базы данных
3. Дождитесь создания проекта (~1 минута)

#### 2.2 Выполнить SQL-миграции
В Supabase Dashboard откройте **SQL Editor** и выполните SQL-файлы **в порядке нумерации**:

| # | Файл | Описание |
|---|------|----------|
| 1 | `supabase/001_schema.sql` | Создание таблиц (franchisees, products, workshops, orders, order_items, revenue_records) |
| 2 | `supabase/002_seed_data.sql` | Тестовые данные (франчайзи, товары, цеха, заказы за 90 дней) |
| 3 | `supabase/003_revenue_queries.sql` | Запросы доходов (для справки) |
| 4 | `supabase/004_dashboard_queries.sql` | Запросы дашборда (для справки) |
| 5 | `supabase/005_csv_export.sql` | Запросы для CSV-экспорта (для справки) |
| 6 | `supabase/006_rpc_functions.sql` | **RPC-функции** — обязательно! (get_revenue_by_period, get_kpi_summary и т.д.) |
| 7 | `supabase/007_user_profiles.sql` | **Профили пользователей** — с триггером авто-создания |

> ⚠️ **Важно**: Выполняйте файлы **строго по порядку**! Файл `007` зависит от `001` (таблица `franchisees`).

> 💡 **Tip**: Файлы `003`, `004`, `005` — это справочные запросы. Их можно пропустить, главное — `001`, `002`, `006`, `007`.

#### 2.3 Скопировать ключи
1. В Supabase Dashboard → **Settings** → **API**
2. Скопируйте:
   - **Project URL** (например, `https://abcdefgh.supabase.co`)
   - **anon public key** (начинается с `eyJ...`)
   - **service_role key** (начинается с `eyJ...`, секретный!)

### 3. Создать файл .env

Скопируйте `.env.example` в `.env` и вставьте ваши ключи:

```bash
copy .env.example .env
```

Отредактируйте `.env`:

```env
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...service_role_key
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...anon_key
PORT=3000
```

> ⚠️ **Никогда** не коммитьте `.env` в git! Файл `.env` уже в `.gitignore`.

### 4. Запустить сервер

```bash
# Режим разработки (с авто-перезагрузкой)
npm run dev

# Или обычный запуск
npm start
```

### 5. Открыть сайт

Перейдите в браузер: **http://localhost:3000**

---

## 📁 Структура проекта

```
AVISHU/SITE/
├── server/
│   └── index.js          ← Express сервер (API routes)
├── src/
│   ├── main.js           ← Курсор, навигация, утилиты
│   ├── other.js          ← 3D, Chart.js, AI mock, CSV
│   └── supabase.js       ← Клиентский Supabase Auth
├── supabase/
│   ├── 001_schema.sql    ← Схема базы данных
│   ├── 002_seed_data.sql ← Тестовые данные
│   ├── 003-005_*.sql     ← Справочные запросы
│   ├── 006_rpc_functions.sql ← RPC-функции для дашборда
│   └── 007_user_profiles.sql ← Профили + триггеры
├── styles/
│   ├── main.css          ← Основные стили
│   └── other.css         ← Дополнительные стили
├── home.html             ← Главная страница
├── registration.html     ← Вход / Регистрация
├── dashboards.html       ← Метрика (защищённая)
├── demo.html             ← 3D клиентский демо
├── app.html              ← Мобильное приложение
├── .env                  ← 🔒 Секретные ключи (не коммитить!)
├── .env.example          ← Шаблон .env
└── package.json
```

---

## 🔐 Как работает авторизация

```
┌──────────────┐    POST /api/auth/register    ┌──────────────┐
│   Браузер    │ ─────────────────────────────→ │   Express    │
│  (registration)│  { email, password, role }   │   Server     │
│              │ ←───────────────────────────── │              │
│              │    { token, user, role }       │              │
└──────┬───────┘                               └──────┬───────┘
       │                                              │
       │  localStorage:                               │ supabase.auth.admin.createUser()
       │  - avishu_token                              │ → creates auth.users row
       │  - avishu_role                               │ → trigger creates user_profiles row
       │  - avishu_user                               │
       │                                              ↓
       │                                       ┌──────────────┐
       │    GET /api/metrics/* (Bearer token)  │   Supabase   │
       │ ─────────────────────────────────────→│   Database   │
       │ ←─────────────────────────────────────│              │
       │    { data from RPC functions }        └──────────────┘
```

### Поток регистрации:
1. Пользователь заполняет форму на `registration.html`
2. Фронтенд отправляет `POST /api/auth/register` на сервер
3. Сервер создаёт пользователя через `supabase.auth.admin.createUser()`
4. Триггер `on_auth_user_created` автоматически создаёт запись в `user_profiles`
5. Сервер возвращает токен → фронтенд сохраняет в `localStorage`
6. Редирект на `dashboards.html` (франчайзи) или `demo.html` (клиент)

### Поток логина:
1. `POST /api/auth/login` → `supabase.auth.signInWithPassword()`
2. Обновляется `last_login_at` в `user_profiles`
3. Токен возвращается → сохраняется → редирект

### Защита страниц:
- `dashboards.html` при загрузке вызывает `isLoggedIn()`
- Если нет токена → редирект на `registration.html`
- API-запросы с невалидным токеном возвращают 401 → автоматический выход

---

## 🧪 Демо-режим

Если Supabase не настроен, сайт работает в **демо-режиме**:
- Кнопка "Демо-доступ" на странице входа
- Графики и KPI показывают mock-данные
- CSV скачивается из локальных данных
- Токен `demo_token` — принимается сервером для демо

---

## 🛠 Команды

| Команда | Описание |
|---------|----------|
| `npm start` | Запуск сервера (production) |
| `npm run dev` | Запуск с nodemon (auto-reload) |
| `npm run dev:ai` | Запуск Python AI-сервера (опционально) |
| `npm run dev:all` | Все сервисы параллельно |

---

## ❓ Troubleshooting

### Сервер не стартует
```
Error: Cannot find module 'dotenv'
```
→ Выполните `npm install`

### Supabase: Not configured
```
⚠  Создайте .env файл из .env.example и добавьте Supabase ключи
```
→ Скопируйте `.env.example` → `.env` и вставьте ключи

### 401 при API-запросах
- Проверьте что `SUPABASE_KEY` в `.env` — это **service_role** ключ
- Проверьте что пользователь зарегистрирован в Supabase Auth

### SQL-ошибки при выполнении миграций
- Убедитесь что выполняете файлы **в порядке нумерации**
- Если таблица уже существует — используйте `DROP TABLE ... CASCADE` перед повторным запуском
