let threeInitialized = false;
let scene, camera, renderer, mannequin;
let currentColor = 0xf5f4f0;

function initThree() {
  if (threeInitialized) return;
  threeInitialized = true;

  const canvas    = document.getElementById('three-canvas');
  const container = canvas.parentElement;

scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);
  scene.fog = new THREE.Fog(0x111111, 8, 20);

camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 1.2, 4.5);

renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(3, 6, 4);
  key.castShadow = true;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8888ff, 0.3);
  fill.position.set(-4, 2, -2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.4);
  rim.position.set(0, 4, -5);
  scene.add(rim);

const grid = new THREE.GridHelper(10, 20, 0x222222, 0x1a1a1a);
  grid.position.y = -1.6;
  scene.add(grid);

buildMannequin();

let isDragging = false, prevX = 0, prevY = 0;
  let rotY = 0, rotX = 0.1;

  canvas.addEventListener('mousedown', e => {
    isDragging = true;
    prevX = e.clientX;
    prevY = e.clientY;
  });
  document.addEventListener('mouseup', () => { isDragging = false; });
  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    rotY += (e.clientX - prevX) * 0.008;
    rotX += (e.clientY - prevY) * 0.004;
    rotX = Math.max(-0.4, Math.min(0.6, rotX));
    prevX = e.clientX;
    prevY = e.clientY;
    if (mannequin) {
      mannequin.rotation.y = rotY;
      mannequin.rotation.x = rotX;
    }
  });
  canvas.addEventListener('wheel', e => {
    camera.position.z = Math.max(2, Math.min(8, camera.position.z + e.deltaY * 0.005));
  });

(function animate() {
    requestAnimationFrame(animate);
    if (mannequin && !isDragging) mannequin.rotation.y += 0.003;
    renderer.render(scene, camera);
  })();

window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}

function buildMannequin() {
  if (mannequin) scene.remove(mannequin);
  mannequin = new THREE.Group();

  const clothMat = new THREE.MeshStandardMaterial({ color: currentColor, roughness: 0.6, metalness: 0.1 });
  const skinMat  = new THREE.MeshStandardMaterial({ color: 0xd4c4b0, roughness: 0.8 });
  const shoeMat  = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });

  const add = (geo, mat, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mannequin.add(mesh);
    return mesh;
  };

add(new THREE.CylinderGeometry(0.28, 0.22, 0.70, 16), clothMat, 0,  0.35, 0); 
  add(new THREE.CylinderGeometry(0.30, 0.28, 0.35, 16), clothMat, 0,  0.87, 0); 
  add(new THREE.SphereGeometry(0.18, 16, 16),            skinMat,  0,  1.28, 0); 
  add(new THREE.CylinderGeometry(0.07, 0.09, 0.16, 12), skinMat,  0,  1.12, 0); 
  add(new THREE.CylinderGeometry(0.25, 0.26, 0.28, 16), clothMat, 0, -0.12, 0); 

[-1, 1].forEach(side => {
    add(new THREE.SphereGeometry(0.10, 12, 12),            clothMat, side * 0.38,  0.92, 0);
    add(new THREE.CylinderGeometry(0.07, 0.065, 0.36, 12), clothMat, side * 0.46,  0.66, 0);
    add(new THREE.CylinderGeometry(0.055, 0.05, 0.32, 12), skinMat,  side * 0.46,  0.32, 0);
    add(new THREE.CylinderGeometry(0.11, 0.10, 0.50, 12),  clothMat, side * 0.13, -0.56, 0);
    add(new THREE.CylinderGeometry(0.085, 0.078, 0.48, 12),skinMat,  side * 0.13, -1.06, 0);
    add(new THREE.BoxGeometry(0.10, 0.06, 0.20),           shoeMat,  side * 0.13, -1.33, 0.04);
  });

  mannequin.position.y = 0.05;
  scene.add(mannequin);
}

function selectColor(el, hex) {
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  currentColor = hex;
  if (!mannequin) return;
  mannequin.traverse(child => {
    if (child.isMesh && child.material.roughness === 0.6) {
      child.material.color.setHex(hex);
    }
  });
}

function selectClothing(el, type) {
  document.querySelectorAll('.clothing-item').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');
  buildMannequin(); 
}

function handleUpload(input) {
  if (!input.files[0]) return;
  const zone = document.getElementById('uploadZone');
  zone.style.borderColor = 'var(--gray-300)';
  zone.querySelector('.upload-text').innerHTML =
    `<strong>${input.files[0].name}</strong>Файл загружен`;
}

async function analyzeQuality() {
  const btn = document.querySelector('.btn-analyze');
  btn.textContent = 'Анализ...';
  btn.disabled = true;

await new Promise(r => setTimeout(r, 1200));

  const score = Math.floor(Math.random() * 20) + 75;
  const metrics = [
    { name: 'Равномерность плетения', val: Math.floor(Math.random() * 15 + 80) + '%' },
    { name: 'Плотность нитей',        val: Math.floor(Math.random() * 15 + 78) + '%' },
    { name: 'Дефекты поверхности',    val: score > 85 ? 'Не обнаружены' : 'Минимальные' },
    { name: 'Класс материала',        val: score >= 90 ? 'A+' : score >= 80 ? 'A' : 'B+' },
  ];

  const result = document.getElementById('qualityResult');
  result.classList.add('show');
  document.getElementById('qualityScore').textContent = score;

const metricsEl = document.getElementById('qualityMetrics');
  metricsEl.innerHTML = metrics.map(m =>
    `<div class="quality-metric">
       <span class="metric-name">${m.name}</span>
       <span class="metric-val">${m.val}</span>
     </div>`
  ).join('');

setTimeout(() => {
    document.getElementById('qualityFill').style.width = score + '%';
  }, 100);

  btn.textContent = 'Запустить анализ AI';
  btn.disabled = false;
}

let revenueChart, ordersChart, chartsInitialized = false;

function getAuthToken() {
  return localStorage.getItem('avishu_token') || '';
}

function authHeaders() {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function apiFetch(url) {
  try {
    const resp = await fetch(url, { headers: authHeaders() });
    if (resp.status === 401) {
      console.warn('[API] 401 Unauthorized — redirecting to login');
      localStorage.removeItem('avishu_token');
      localStorage.removeItem('avishu_role');
      localStorage.removeItem('avishu_user');
      window.location.href = 'registration.html';
      return null;
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.warn(`[API] ${url} failed, using MOCK_DATA:`, err.message);
    return null;
  }
}

const MOCK_DATA = {
  '7d': {
    labels:  ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'],
    revenue: [480, 620, 540, 780, 650, 420, 310],
    label:   '— 7 дней',
    kpi: { revenue: '₸ 4.2М', orders: '1 284', avg: '₸ 3 270', load: '78%',
           revenue_change: 12.4, orders_change: 8.1 },
  },
  '30d': {
    labels:  ['Нед 1','Нед 2','Нед 3','Нед 4'],
    revenue: [2100, 2800, 2400, 3200],
    label:   '— 30 дней',
    kpi: { revenue: '₸ 10.5М', orders: '4 820', avg: '₸ 2 800', load: '82%',
           revenue_change: 15.2, orders_change: 10.3 },
  },
  '90d': {
    labels:  ['Янв','Фев','Мар'],
    revenue: [8500, 9200, 11000],
    label:   '— 3 месяца',
    kpi: { revenue: '₸ 28.7М', orders: '12 400', avg: '₸ 3 100', load: '75%',
           revenue_change: 9.8, orders_change: 7.5 },
  },
  '1y': {
    labels:  ['Q1','Q2','Q3','Q4'],
    revenue: [28700, 32000, 29500, 38200],
    label:   '— Год',
    kpi: { revenue: '₸ 128М', orders: '48 200', avg: '₸ 2 950', load: '80%',
           revenue_change: 18.6, orders_change: 14.2 },
  },
};

const PERIOD_LABELS = {
  '7d':  '— 7 дней',
  '30d': '— 30 дней',
  '90d': '— 3 месяца',
  '1y':  '— Год',
};

async function fetchRevenue(period, from, to) {
  const params = new URLSearchParams();
  if (period) params.set('period', period);
  if (from)   params.set('from', from);
  if (to)     params.set('to', to);

  const data = await apiFetch(`/api/metrics/revenue?${params}`);
  if (data && data.labels && data.revenue) {
    return { labels: data.labels, revenue: data.revenue };
  }
  
  const mock = MOCK_DATA[period || '7d'];
  return { labels: mock.labels, revenue: mock.revenue };
}

async function fetchKPI(period) {
  const data = await apiFetch(`/api/metrics/kpi?period=${period || '7d'}`);
  if (data && data.revenue) {
    return data;
  }
  
  return MOCK_DATA[period || '7d'].kpi;
}

async function fetchOrderStructure() {
  const data = await apiFetch('/api/metrics/order-structure?period_days=30');
  if (data && data.labels && data.values) {
    return { labels: data.labels, values: data.values };
  }
  
  return {
    labels: ['Рубашки','Куртки','Брюки','Платья','Другое'],
    values: [38, 22, 18, 14, 8],
  };
}

function updateKPICards(kpi) {
  document.getElementById('kpiRevenue').textContent = kpi.revenue;
  document.getElementById('kpiOrders').textContent  = kpi.orders;
  document.getElementById('kpiAvg').textContent     = kpi.avg;
  document.getElementById('kpiLoad').textContent    = kpi.load;

const revenueChange = document.querySelector('#kpiRevenue')
    ?.closest('.kpi-card')?.querySelector('.kpi-change');
  if (revenueChange && kpi.revenue_change !== undefined) {
    const pct = Number(kpi.revenue_change);
    revenueChange.className = `kpi-change ${pct >= 0 ? 'up' : 'down'}`;
    revenueChange.textContent = `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)}% vs прошлый`;
  }

  const ordersChange = document.querySelector('#kpiOrders')
    ?.closest('.kpi-card')?.querySelector('.kpi-change');
  if (ordersChange && kpi.orders_change !== undefined) {
    const pct = Number(kpi.orders_change);
    ordersChange.className = `kpi-change ${pct >= 0 ? 'up' : 'down'}`;
    ordersChange.textContent = `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)}%`;
  }
}

async function initCharts() {
  if (chartsInitialized) return;
  chartsInitialized = true;

Chart.defaults.color      = 'rgba(245,244,240,0.7)';
  Chart.defaults.borderColor = 'rgba(245,244,240,0.15)';

const [revenueData, kpiData, orderData] = await Promise.all([
    fetchRevenue('7d'),
    fetchKPI('7d'),
    fetchOrderStructure(),
  ]);

updateKPICards(kpiData);

const rCtx = document.getElementById('revenueChart').getContext('2d');
  revenueChart = new Chart(rCtx, {
    type: 'line',
    data: {
      labels: revenueData.labels,
      datasets: [{
        label: 'Доход (тыс ₸)',
        data: revenueData.revenue,
        borderColor: 'rgba(245,244,240,0.8)',
        backgroundColor: 'rgba(245,244,240,0.04)',
        borderWidth: 1.5,
        pointRadius: 3,
        pointBackgroundColor: '#f5f4f0',
        tension: 0.4,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1 },
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { font: { size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { font: { size: 11 } } },
      },
    },
  });

const oCtx = document.getElementById('ordersChart').getContext('2d');
  ordersChart = new Chart(oCtx, {
    type: 'doughnut',
    data: {
      labels: orderData.labels,
      datasets: [{
        data: orderData.values,
        backgroundColor: [
          'rgba(245,244,240,0.9)',
          'rgba(200,198,192,0.7)',
          'rgba(160,156,148,0.6)',
          'rgba(110,107,100,0.6)',
          'rgba(60,59,55,0.6)',
        ],
        borderColor: '#0a0a0a',
        borderWidth: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 12 } },
        tooltip: { backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1 },
      },
    },
  });
}

async function setPeriod(btn, period) {
  document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

document.getElementById('chartPeriodLabel').textContent = PERIOD_LABELS[period] || '';

const [revenueData, kpiData] = await Promise.all([
    fetchRevenue(period),
    fetchKPI(period),
  ]);

updateKPICards(kpiData);

if (revenueChart) {
    revenueChart.data.labels            = revenueData.labels;
    revenueChart.data.datasets[0].data = revenueData.revenue;
    revenueChart.update();
  }
}

async function applyDates() {
  const from  = document.getElementById('dateFrom').value;
  const to    = document.getElementById('dateTo').value;
  if (!from || !to) return;

const revenueData = await fetchRevenue(null, from, to);

  if (revenueChart) {
    revenueChart.data.labels            = revenueData.labels;
    revenueChart.data.datasets[0].data = revenueData.revenue;
    revenueChart.update();
    document.getElementById('chartPeriodLabel').textContent = `— ${from} → ${to}`;
  }
}

function downloadCSV(type = 'revenue') {
  const token = getAuthToken();
  const from  = document.getElementById('dateFrom')?.value || '2025-01-01';
  const to    = document.getElementById('dateTo')?.value || new Date().toISOString().split('T')[0];

  if (token) {
    
    const url = `/api/metrics/export-csv?from=${from}&to=${to}&type=${type}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `avishu_${type}_${from}_${to}.csv`;

fetch(url, { headers: authHeaders() })
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(err => {
        console.warn('[CSV] Server download failed, using local fallback:', err.message);
        downloadCSVLocal();
      });
  } else {
    
    downloadCSVLocal();
  }
}

function downloadCSVLocal() {
  const activePeriod = document.querySelector('.period-tab.active')?.dataset?.period || '7d';
  const d = MOCK_DATA[activePeriod] || MOCK_DATA['7d'];

  const rows = d.labels.map((label, i) => ({
    'Период':         label,
    'Доход (тыс ₸)': d.revenue[i],
  }));

  exportToCSV(rows, `avishu_revenue_${activePeriod}.csv`);
}
