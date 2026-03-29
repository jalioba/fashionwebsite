
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../App";

/**
 * Fetches KPI and revenue data for the dashboard.
 * Falls back to mock data if token is missing.
 *
 * @param {string} period - '7d' | '30d' | '90d' | '1y'
 */
export function useMetrics(period = "7d") {
  const { token } = useAuth();
  const [kpi,     setKpi]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const MOCK_KPI = {
    "7d":  { revenue: "₸ 4.2М",  orders: "1 284", avg: "₸ 3 270", load: "78%" },
    "30d": { revenue: "₸ 10.5М", orders: "4 820", avg: "₸ 2 800", load: "82%" },
    "90d": { revenue: "₸ 28.7М", orders: "12 400",avg: "₸ 3 100", load: "75%" },
    "1y":  { revenue: "₸ 128М",  orders: "48 200",avg: "₸ 2 950", load: "80%" },
  };

  useEffect(() => {
    if (!token) {
      setKpi(MOCK_KPI[period] || MOCK_KPI["7d"]);
      return;
    }
    setLoading(true);
    fetch(`/api/metrics/kpi?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setKpi({
          revenue: "₸ " + (data.revenue / 1_000_000).toFixed(1) + "М",
          orders:  data.orders.toLocaleString(),
          avg:     "₸ " + data.avg_order.toLocaleString(),
          load:    "—",
        });
      })
      .catch(err => {
        setError(err.message);
        setKpi(MOCK_KPI[period]);
      })
      .finally(() => setLoading(false));
  }, [period, token]);

  return { kpi, loading, error };
}



export function useWorkshops() {
  const { token } = useAuth();
  const [workshops, setWorkshops] = useState([]);

  const MOCK_WORKSHOPS = [
    { id: 1, name: "Цех №1 — Крой",            shift: "Смена A",   operators: 24, progress: 92 },
    { id: 2, name: "Цех №2 — Шитьё",           shift: "Смена A/B", operators: 48, progress: 78 },
    { id: 3, name: "Цех №3 — Отделка",         shift: "Смена B",   operators: 18, progress: 65 },
    { id: 4, name: "Цех №4 — Контроль",        shift: "Смена A",   operators: 12, progress: 88 },
    { id: 5, name: "Цех №5 — Упаковка",        shift: "Смена B",   operators: 10, progress: 55 },
    { id: 6, name: "Цех №6 — Склад",           shift: "24/7",      operators:  8, progress: 71 },
  ];

  useEffect(() => {
    if (!token) { setWorkshops(MOCK_WORKSHOPS); return; }
    fetch("/api/metrics/workshops", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(json => setWorkshops(json.data || MOCK_WORKSHOPS))
      .catch(() => setWorkshops(MOCK_WORKSHOPS));
  }, [token]);

  return { workshops };
}



export function useQualityCheck() {
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const analyze = useCallback(async (file) => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const form = new FormData();
    form.append("image", file);

    try {
      const res  = await fetch("/api/ai/quality-check", { method: "POST", body: form });
      if (!res.ok) throw new Error("Server error " + res.status);
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, analyze };
}


export function useCSVDownload() {
  const { token } = useAuth();

  const download = useCallback(async (from, to) => {
    if (token) {
      const url = `/api/metrics/export-csv?from=${from}&to=${to}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `avishu_revenue_${from}_${to}.csv`;
      a.click();
    } else {
      // Client-side mock CSV
      const rows = [
        "Дата,Сумма (₸),Цех",
        "2025-01-01,480000,1",
        "2025-01-02,620000,2",
      ];
      const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "avishu_revenue_demo.csv";
      a.click();
    }
  }, [token]);

  return { download };
}
