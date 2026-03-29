const cursorDot  = document.getElementById('cursorDot');
const cursorRing = document.getElementById('cursorRing');
let mx = 0, my = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
  mx = e.clientX;
  my = e.clientY;
});

function animateCursor() {
  cursorDot.style.left = mx + 'px';
  cursorDot.style.top  = my + 'px';
  rx += (mx - rx) * 0.15;
  ry += (my - ry) * 0.15;
  cursorRing.style.left = rx + 'px';
  cursorRing.style.top  = ry + 'px';
  requestAnimationFrame(animateCursor);
}
animateCursor();

let currentRole = null;

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');

document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  const navMap = {
    'home':        'nav-home',
    'demo-client': 'nav-demo',
    'metrics':     'nav-metrics',
    'app':         'nav-app',
  };
  const navEl = document.getElementById(navMap[name]);
  if (navEl) navEl.classList.add('active');

  window.scrollTo(0, 0);
  observeFadeElements();

if (name === 'demo-client') {
    if (typeof initThree === 'function') initThree();
  }
  if (name === 'metrics') {
    if (typeof initCharts === 'function') initCharts();
  }
}

function openModal() {
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

function loginAs(role) {
  currentRole = role;
  closeModal();

const demoLink    = document.getElementById('nav-demo');
  const metricsLink = document.getElementById('nav-metrics');
  if (demoLink)    demoLink.style.display    = role === 'client'      ? 'inline' : 'none';
  if (metricsLink) metricsLink.style.display = role === 'franchisee'  ? 'inline' : 'none';

  showPage(role === 'client' ? 'demo-client' : 'metrics');
}

document.getElementById('modal')?.addEventListener('click', e => {
  if (e.target === document.getElementById('modal')) closeModal();
});

function observeFadeElements() {
  const els = document.querySelectorAll('.fade-up');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.1 });
  els.forEach(el => observer.observe(el));
}
observeFadeElements();

function exportToCSV(data, filename = 'avishu_export.csv') {
  if (!data.length) return;
  const headers = Object.keys(data[0]).join(',');
  const rows    = data.map(row => Object.values(row).join(','));
  const csv     = [headers, ...rows].join('\n');
  const blob    = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link    = document.createElement('a');
  link.href     = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

function formatMoney(num) {
  if (num >= 1_000_000) return '₸ ' + (num / 1_000_000).toFixed(1) + 'М';
  if (num >= 1_000)     return '₸ ' + (num / 1_000).toFixed(0) + 'К';
  return '₸ ' + num;
}
