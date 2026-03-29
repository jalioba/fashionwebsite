# AVISHU — Web Platform

Веб-платформа швейной фабрики AVISHU. Хакатон-проект.

---

## Структура файлов

```
avishu/
│
├── home.html              Главная страница
├── registration.html      Страница входа / выбора роли
├── demo.html              Демо для клиентов (3D + AI качество)
├── dashboards.html        Метрика для франчайзи
├── app.html               Страница скачивания приложения
│
├── styles/
│   ├── main.css           Токены, reset, navbar, футер, анимации
│   └── other.css          Стили страниц: hero, demo, metrics, app, auth
│
├── src/
│   ├── main.js            Курсор, навигация, модал, утилиты
│   └── other.js           Three.js 3D, Chart.js, AI quality mock, CSV
│
├── public/
│   └── avishu.png         Логотип (скопируй сюда)
│
├── server/
│   └── index.js           Node.js + Express API сервер
│
├── ai/
│   └── main.py            Python FastAPI — AI inference service
│
├── react-app/
│   └── src/
│       ├── App.jsx                  React роутинг + AuthContext
│       ├── components/
│       │   └── index.jsx            Navbar, QualityChecker, RevenueChart
│       └── hooks/
│           └── index.js             useMetrics, useWorkshops, useQualityCheck
│
└── package.json           Node.js зависимости и скрипты
```

---

## Архитектура системы

```
  Браузер
       │
       ├── GET  /                    → home.html
       ├── GET  /demo.html           → demo.html (клиент)
       ├── GET  /dashboards.html     → dashboards.html (франчайзи)
       │
       └── API запросы ──────────────────────────────────────┐
                                                              │
                              Node.js Express (порт 3000)    │
                              server/index.js                 │
                                   │                          │
                    ┌──────────────┼──────────────┐           │
                    │              │              │           │
             Supabase DB    Python FastAPI   Static files ◄──┘
             (PostgreSQL)   ai/main.py       (HTML/CSS/JS)
             порт 5432      порт 8000
                                   │
                            Твои AI модели
                            (fabric_v2.pt и т.д.)
```

---

## Запуск

### 1. Установка зависимостей

```bash
npm install

pip install fastapi uvicorn pillow numpy python-multipart
```

### 2. Переменные окружения

Создай файл `.env` в корне:

```env
PORT=3000
SUPABASE_URL=https://xxxx.supabase.com
SUPABASE_KEY=your_service_role_key
```

### 3. Логотип

Скопируй `avishu.png` в папку `public/`:
```bash
cp /path/to/avishu.png public/avishu.png
```

### 4. Запуск

```bash
# Только HTML/CSS/JS (открой home.html в браузере напрямую)
# Никакого сервера не нужно для базового просмотра

# Или запусти Node.js сервер:
npm run dev

# Python AI сервис:
npm run dev:ai
# → http://localhost:8000/docs  (Swagger UI)

# Все сразу:
npm run dev:all
```

---

## Подключение своей AI модели

Открой `ai/main.py`, найди функцию `predict_quality()`:

```python
# ── REPLACE THIS BLOCK WITH REAL MODEL INFERENCE ──────
# img  = load_image(image)
# pred = model.predict(preprocess(img))
# ──────────────────────────────────────────────────────
```

Замени на свой код:

```python
img   = load_image(image)
arr   = your_preprocess(img)        # твоя предобработка
pred  = your_model.predict(arr)     # вызов модели
return QualityResult(
    score            = int(pred["score"] * 100),
    material_class   = pred["class"],
    weave_uniformity = int(pred["weave"] * 100),
    thread_density   = int(pred["density"] * 100),
    surface_defects  = pred["defects"],
    confidence       = float(pred["confidence"]),
    processing_ms    = elapsed,
)
```

---

## Supabase — таблицы

```sql
-- Записи дохода
CREATE TABLE revenue_records (
  id            BIGSERIAL PRIMARY KEY,
  date          DATE NOT NULL,
  amount        NUMERIC NOT NULL,
  workshop_id   INT,
  franchisee_id UUID REFERENCES auth.users(id)
);

-- Цеха
CREATE TABLE workshops (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  shift      TEXT,
  operators  INT,
  progress   INT DEFAULT 0,   -- 0-100
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Заказы
CREATE TABLE orders (
  id           BIGSERIAL PRIMARY KEY,
  total_amount NUMERIC,
  status       TEXT DEFAULT 'pending',
  created_at   TIMESTAMPTZ DEFAULT now(),
  user_id      UUID REFERENCES auth.users(id)
);
```

---

## Страницы и роли

| Страница          | Роль         | Файл               |
|-------------------|--------------|--------------------|
| Главная           | Все          | `home.html`        |
| Вход              | Все          | `registration.html`|
| Демо              | Клиент       | `demo.html`        |
| Метрика           | Франчайзи    | `dashboards.html`  |
| Приложение        | Все          | `app.html`         |

---

## API Endpoints

| Метод | Путь                       | Описание                        |
|-------|----------------------------|---------------------------------|
| POST  | `/api/auth/login`          | Вход через Supabase Auth        |
| POST  | `/api/auth/logout`         | Выход                           |
| GET   | `/api/metrics/revenue`     | Данные дохода по периоду        |
| GET   | `/api/metrics/kpi`         | KPI карточки                    |
| GET   | `/api/metrics/workshops`   | Прогресс цехов                  |
| GET   | `/api/metrics/export-csv`  | Скачать CSV                     |
| POST  | `/api/ai/quality-check`    | AI анализ ткани (→ Python)      |
| POST  | `/api/ai/analyze-texture`  | Классификация текстуры (→ Python)|
| GET   | `/health` (Python port)    | Статус AI сервиса               |

---

## Стек

- **Frontend**: HTML5 / CSS3 / Vanilla JS + React 18
- **3D**: Three.js r128
- **Charts**: Chart.js 4
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **AI Service**: Python FastAPI + Uvicorn
- **Auth**: Supabase Auth (JWT)
