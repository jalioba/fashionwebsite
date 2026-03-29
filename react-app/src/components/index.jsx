

import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App";

export default function Navbar() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <nav className="nav">
      <Link to="/" className="nav-logo">
        <img src="/avishu.png" alt="AVISHU" />
      </Link>
      <ul className="nav-links">
        <li><Link to="/">Главная</Link></li>
        {role === "client"      && <li><Link to="/demo">Демо</Link></li>}
        {role === "franchisee"  && <li><Link to="/dashboard">Метрика</Link></li>}
        <li><Link to="/app">Приложение</Link></li>
      </ul>
      {user
        ? <button className="btn-login" onClick={handleLogout}>Выйти</button>
        : <button className="btn-login" onClick={() => navigate("/login")}>Войти</button>
      }
    </nav>
  );
}


import { useState, useRef } from "react";

export default function QualityChecker() {
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [filename, setFilename] = useState(null);
  const fileRef = useRef();

  async function handleAnalyze() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setLoading(true);
    const form = new FormData();
    form.append("image", file);

    try {
      const res  = await fetch("/api/ai/quality-check", { method: "POST", body: form });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error("Quality check failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Upload zone */}
      <div
        className="upload-zone"
        onClick={() => fileRef.current.click()}
      >
        <input
          type="file"
          ref={fileRef}
          accept="image/*"
          style={{ display: "none" }}
          onChange={e => setFilename(e.target.files[0]?.name)}
        />
        <div className="upload-icon">⬆</div>
        <div className="upload-text">
          <strong>{filename || "Загрузите фото ткани"}</strong>
          JPG, PNG · до 10 МБ
        </div>
      </div>

      <button
        className="btn-analyze"
        onClick={handleAnalyze}
        disabled={loading}
      >
        {loading ? "Анализ..." : "Запустить анализ AI"}
      </button>

      {/* Result */}
      {result && (
        <div className="quality-result show">
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
            <div className="quality-score">{result.score}</div>
            <div className="quality-label">Индекс качества {result.mock && "(demo)"}</div>
          </div>
          <div className="quality-bar">
            <div className="quality-bar-fill" style={{ width: result.score + "%" }} />
          </div>
          <div className="quality-metrics">
            {[
              ["Равномерность плетения", result.metrics?.weave_uniformity + "%"],
              ["Плотность нитей",        result.metrics?.thread_density   + "%"],
              ["Дефекты поверхности",    result.metrics?.surface_defects === "none" ? "Не обнаружены" : "Минимальные"],
              ["Класс материала",        result.material_class],
            ].map(([name, val]) => (
              <div key={name} className="quality-metric">
                <span className="metric-name">{name}</span>
                <span className="metric-val">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}



import { useEffect, useRef, useState } from "react";
import { useAuth } from "../App";

const MOCK_DATA = {
  "7d":  { labels: ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"],  revenue: [480,620,540,780,650,420,310] },
  "30d": { labels: ["Нед 1","Нед 2","Нед 3","Нед 4"],       revenue: [2100,2800,2400,3200] },
  "90d": { labels: ["Янв","Фев","Мар"],                      revenue: [8500,9200,11000] },
  "1y":  { labels: ["Q1","Q2","Q3","Q4"],                    revenue: [28700,32000,29500,38200] },
};

export default function RevenueChart({ period = "7d" }) {
  const canvasRef = useRef();
  const chartRef  = useRef(null);
  const { token } = useAuth();
  const [data, setData] = useState(MOCK_DATA[period]);

  // Fetch real data from API
  useEffect(() => {
    if (!token) { setData(MOCK_DATA[period]); return; }
    fetch(`/api/metrics/revenue?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(json => {
        if (json.data?.length) {
          setData({
            labels:  json.data.map(r => r.date.slice(5)),   // MM-DD
            revenue: json.data.map(r => r.amount / 1000),   // → тыс ₸
          });
        }
      })
      .catch(() => setData(MOCK_DATA[period]));
  }, [period, token]);

  // Init / update Chart.js
  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return;
    const ctx = canvasRef.current.getContext("2d");

    if (chartRef.current) {
      chartRef.current.data.labels            = data.labels;
      chartRef.current.data.datasets[0].data = data.revenue;
      chartRef.current.update();
      return;
    }

    chartRef.current = new window.Chart(ctx, {
      type: "line",
      data: {
        labels: data.labels,
        datasets: [{
          label: "Доход (тыс ₸)",
          data:  data.revenue,
          borderColor:     "rgba(245,244,240,0.8)",
          backgroundColor: "rgba(245,244,240,0.04)",
          borderWidth: 1.5,
          pointRadius: 3,
          tension: 0.4,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "rgba(255,255,255,0.05)" } },
          y: { grid: { color: "rgba(255,255,255,0.05)" } },
        },
      },
    });
  }, [data]);

  return <canvas ref={canvasRef} height={200} />;
}
