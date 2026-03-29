require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app  = express();
const PORT = process.env.PORT || 3000;

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL  || 'https://placeholder.supabase.co',
  process.env.SUPABASE_KEY  || 'placeholder_key'
);

const SUPABASE_URL      = process.env.SUPABASE_URL      || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const originalSend = res.send.bind(res);
  res.send = function(body) {
    if (typeof body === 'string' && body.includes('</head>') && body.includes('<!DOCTYPE html>')) {
      const metaTags = `
    <meta name="supabase-url" content="${SUPABASE_URL}">
    <meta name="supabase-anon" content="${SUPABASE_ANON_KEY}">`;
      body = body.replace('</head>', metaTags + '\n</head>');
    }
    return originalSend(body);
  };
  next();
});

app.get('/*.html', (req, res, next) => {
  const filePath = path.join(__dirname, '..', req.path);
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return next();
    res.send(data);
  });
});

app.use(express.static(path.join(__dirname, '..'), {
  dotfiles: 'deny',
  index: false,
  extensions: []
}));

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Не авторизован — токен отсутствует' });

  if (token === 'demo_token') {
    req.user = { id: 'demo-user', email: 'demo@avishu.kz', role: 'franchisee' };
    return next();
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Неверный токен авторизации' });

    req.user = user;
    next();
  } catch (err) {
    console.error('[Auth] Error verifying token:', err.message);
    return res.status(500).json({ error: 'Ошибка проверки авторизации' });
  }
}

app.get('/', (req, res) => {
  const filePath = path.join(__dirname, '..', 'home.html');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(404).json({ error: 'home.html not found' });
    res.send(data);
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl:  SUPABASE_URL,
    supabaseAnon: SUPABASE_ANON_KEY,
  });
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, role = 'client', displayName } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
  }

  try {
    
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, 
      user_metadata: {
        role,
        display_name: displayName || email.split('@')[0],
        registration_method: 'email',
      },
    });

    if (error) {
      console.error('[Auth] Register error:', error.message);
      if (error.message.includes('already registered')) {
        return res.status(409).json({ error: 'Пользователь с таким email уже зарегистрирован' });
      }
      return res.status(400).json({ error: error.message });
    }

const { data: loginData, error: loginError } = await supabaseAdmin.auth.signInWithPassword({
      email, password,
    });

    if (loginError) {
      
      return res.status(201).json({
        success: true,
        user: data.user,
        message: 'Аккаунт создан. Войдите с вашими данными.',
      });
    }

    res.status(201).json({
      success: true,
      token:        loginData.session.access_token,
      refreshToken: loginData.session.refresh_token,
      user:         loginData.user,
      role:         role,
    });

  } catch (err) {
    console.error('[Auth] Register exception:', err);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (error) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const role = data.user.user_metadata?.role || 'client';

try {
      await supabaseAdmin.rpc('update_last_login', { user_id: data.user.id });
    } catch (e) {
      console.warn('[Auth] Failed to update last_login_at:', e?.message || e);
    }

    res.json({
      token:        data.session.access_token,
      refreshToken: data.session.refresh_token,
      user:         data.user,
      role:         role,
    });

  } catch (err) {
    console.error('[Auth] Login exception:', err);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  if (req.user.id === 'demo-user') {
    return res.json({
      id: 'demo-user',
      email: 'demo@avishu.kz',
      display_name: 'Демо-пользователь',
      role: 'franchisee',
      registration_method: 'demo',
    });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Профиль не найден' });
    }

    res.json(data);

  } catch (err) {
    console.error('[Auth] Get profile exception:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/auth/logout', async (req, res) => {

res.json({ success: true, message: 'Выход выполнен' });
});

app.get('/api/metrics/revenue', requireAuth, async (req, res) => {
  const { from, to, period = '7d' } = req.query;

  try {
    const { data, error } = await supabaseAdmin.rpc('get_revenue_by_period', {
      period_type: period,
      date_from:   from || null,
      date_to:     to   || null,
    });

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      labels:  data.map(r => r.label),
      revenue: data.map(r => Number(r.revenue_thousands)),
      period,
    });

  } catch (err) {
    console.error('[Metrics] Revenue error:', err);
    res.status(500).json({ error: 'Ошибка загрузки данных дохода' });
  }
});

app.get('/api/metrics/kpi', requireAuth, async (req, res) => {
  const { period = '7d' } = req.query;

  try {
    const { data, error } = await supabaseAdmin.rpc('get_kpi_summary', {
      period_type: period,
    });

    if (error) return res.status(500).json({ error: error.message });

    const row = data[0] || {};

    const formatCurrency = (val) => {
      const num = Number(val) || 0;
      if (num >= 1_000_000) return `₸ ${(num / 1_000_000).toFixed(1)}М`;
      if (num >= 1_000)     return `₸ ${(num / 1_000).toFixed(0)}К`;
      return `₸ ${num}`;
    };

    const formatNumber = (val) => {
      const num = Number(val) || 0;
      return num.toLocaleString('ru-RU');
    };

    res.json({
      revenue:        formatCurrency(row.total_revenue),
      revenue_change: Number(row.revenue_change_pct) || 0,
      orders:         formatNumber(row.completed_orders),
      orders_change:  Number(row.orders_change_pct) || 0,
      avg:            `₸ ${formatNumber(row.avg_check)}`,
      load:           `${row.avg_workshop_load || 0}%`,
      period,
    });

  } catch (err) {
    console.error('[Metrics] KPI error:', err);
    res.status(500).json({ error: 'Ошибка загрузки KPI' });
  }
});

app.get('/api/metrics/order-structure', requireAuth, async (req, res) => {
  const { period_days = 30 } = req.query;

  try {
    const { data, error } = await supabaseAdmin.rpc('get_order_structure', {
      period_days: Number(period_days),
    });

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      labels:      data.map(r => r.product_name),
      values:      data.map(r => Number(r.percentage)),
      items_count: data.map(r => Number(r.items_count)),
    });

  } catch (err) {
    console.error('[Metrics] Order structure error:', err);
    res.status(500).json({ error: 'Ошибка загрузки структуры заказов' });
  }
});

app.get('/api/metrics/workshops', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_workshop_progress');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });

  } catch (err) {
    console.error('[Metrics] Workshops error:', err);
    res.status(500).json({ error: 'Ошибка загрузки данных цехов' });
  }
});

app.get('/api/metrics/export-csv', requireAuth, async (req, res) => {
  const { from = '2025-01-01', to, type = 'revenue' } = req.query;
  const endDate = to || new Date().toISOString().split('T')[0];

  try {
    let data, error, header, rows, filename;

    if (type === 'orders') {
      ({ data, error } = await supabaseAdmin.rpc('export_orders_csv', {
        date_from: from,
        date_to:   endDate,
      }));

      if (error) return res.status(500).json({ error: error.message });

      header  = 'Дата,Франчайзи,Товар,Кол-во,Цена за ед. (₸),Сумма позиции (₸),Итого заказ (₸),Статус\n';
      rows    = data.map(r =>
        `${r.order_date},${r.franchisee},${r.product},${r.quantity},${r.unit_price},${r.line_total},${r.order_total},${r.status}`
      ).join('\n');
      filename = `avishu_orders_${from}_${endDate}.csv`;

    } else {
      ({ data, error } = await supabaseAdmin.rpc('export_revenue_csv', {
        date_from: from,
        date_to:   endDate,
      }));

      if (error) return res.status(500).json({ error: error.message });

      header  = 'Дата,Сумма (₸),Цех,Франчайзи\n';
      rows    = data.map(r =>
        `${r.record_date},${r.amount},${r.workshop},${r.franchisee}`
      ).join('\n');
      filename = `avishu_revenue_${from}_${endDate}.csv`;
    }

    const csv = '\uFEFF' + header + rows; 

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);

  } catch (err) {
    console.error('[CSV] Export error:', err);
    res.status(500).json({ error: 'Ошибка при экспорте CSV' });
  }
});

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.post('/api/ai/quality-check', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл изображения обязателен' });

  try {
    const FormData = require('form-data');
    const fetch    = require('node-fetch');
    const form     = new FormData();
    form.append('image', req.file.buffer, {
      filename:    req.file.originalname,
      contentType: req.file.mimetype,
    });

    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const response = await fetch(`${aiUrl}/predict`, {
      method:  'POST',
      body:    form,
      headers: form.getHeaders(),
    });

    if (!response.ok) throw new Error('AI service error: ' + response.status);
    const result = await response.json();
    res.json(result);

  } catch (err) {
    
    console.warn('[AI Proxy] Python service unavailable, returning mock:', err.message);
    const score = Math.floor(Math.random() * 20) + 75;
    res.json({
      score,
      mock: true,
      metrics: {
        weave_uniformity: Math.floor(Math.random() * 15 + 80),
        thread_density:   Math.floor(Math.random() * 15 + 78),
        surface_defects:  score > 85 ? 'none' : 'minimal',
        material_class:   score >= 90 ? 'A+' : score >= 80 ? 'A' : 'B+',
      },
    });
  }
});

app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  const hasConfig = SUPABASE_URL && SUPABASE_URL !== 'https://placeholder.supabase.co';
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   AVISHU Server running                  ║
  ║   http://localhost:${PORT}                  ║
  ║   Supabase: ${hasConfig ? '✓ Connected' : '✗ Not configured'}             ║
  ╚══════════════════════════════════════════╝

  ${!hasConfig ? '⚠  Создайте .env файл из .env.example и добавьте Supabase ключи\n' : ''}
  Routes:
    POST /api/auth/register    — Регистрация
    POST /api/auth/login       — Вход
    GET  /api/auth/me          — Текущий профиль
    GET  /api/metrics/revenue  — Доходы (Chart.js)
    GET  /api/metrics/kpi      — KPI-карточки
    GET  /api/metrics/export-csv — Скачать CSV
  `);
});

module.exports = app;
