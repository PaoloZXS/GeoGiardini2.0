import { useMemo, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";

interface WeatherPageProps {
  onBack: () => void;
}

const LAT = 44.9132;
const LON = 8.6146;
const CITY = "Alessandria";
const API_URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=Europe/Rome`;

const ICONS: Record<number, string> = {
  0: "sunny",
  1: "sunny",
  2: "partly_cloudy_day",
  3: "cloudy",
  45: "foggy",
  48: "foggy",
  51: "rainy",
  53: "rainy",
  55: "rainy",
  61: "rainy",
  63: "rainy",
  65: "rainy",
  71: "weather_snowy",
  73: "weather_snowy",
  75: "weather_snowy",
  80: "rainy",
  81: "rainy",
  82: "rainy",
  95: "thunderstorm",
  96: "thunderstorm",
  99: "thunderstorm"
};

function getWeekDays(offset: number) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offset * 7);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function generateYearMeteo(year: number) {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const map = new Map<string, { icon: string; tMin: number; tMax: number; precip: number }>();
  const yearStart = new Date(year, 0, 1);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = formatDateKey(d);
    const dayOfYear = Math.floor(
      (d.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const seed = (year * 365 + dayOfYear) * 7 + d.getMonth() * 3;
    const wmoCodes = [0, 0, 1, 2, 3, 45, 51, 61, 80, 95];
    const wmo = wmoCodes[Math.abs(seed) % wmoCodes.length];
    const icon = ICONS[wmo] || "partly_cloudy_day";
    const baseTemp = 5 + (d.getMonth() % 12) * 2.5 + (Math.abs(seed * 3) % 10);
    const tMin = Math.round((baseTemp - 4 + (Math.abs(seed) % 5)) * 10) / 10;
    const tMax = Math.round((baseTemp + 6 + (Math.abs(seed * 2) % 6)) * 10) / 10;
    const precip = Math.round((Math.abs(seed) % 15) * 10) / 10;
    map.set(key, { icon, tMin, tMax, precip });
  }
  return map;
}

// Cache per anni già generati
const meteoCache = new Map<number, Map<string, { icon: string; tMin: number; tMax: number; precip: number }>>();

function getMeteoForYear(year: number) {
  if (!meteoCache.has(year)) {
    meteoCache.set(year, generateYearMeteo(year));
  }
  return meteoCache.get(year)!;
}

export default function WeatherPage({ onBack }: WeatherPageProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState<"week" | "chart" | "monthly">("week");
  const [chartType, setChartType] = useState<"weekly" | "monthly">("weekly");
  const [chartOffset, setChartOffset] = useState(0);
  const today = new Date();

  const weekDays = getWeekDays(weekOffset);
  const todayKey = formatDateKey(new Date());

  // Chart data: weekly con offset
  const chartData = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday + chartOffset * 7);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    // Raccogli tutti gli anni necessari
    const years = new Set(days.map((d) => d.getFullYear()));
    const combined = new Map<string, { icon: string; tMin: number; tMax: number; precip: number }>();
    for (const y of years) {
      const m = getMeteoForYear(y);
      for (const [k, v] of m) combined.set(k, v);
    }
    return days.map((day) => {
      const key = formatDateKey(day);
      const m = combined.get(key);
      return {
        label: day.toLocaleDateString("it-IT", { weekday: "short" }),
        tMax: m?.tMax ?? 0,
        tMin: m?.tMin ?? 0,
        precip: m?.precip ?? 0
      };
    });
  }, [chartOffset]);

  // Chart data: monthly con offset
  const chartMonthlyData = useMemo(() => {
    const year = today.getFullYear() + chartOffset;
    const meteo = getMeteoForYear(year);
    const data: { label: string; tMaxAvg: number; tMinAvg: number; precip: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(year, m, 1);
      const monthEnd = new Date(year, m + 1, 0);
      let sumTMax = 0, sumTMin = 0, sumPrecip = 0, days = 0;
      for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        const key = formatDateKey(d);
        const met = meteo.get(key);
        if (met) {
          sumTMax += met.tMax;
          sumTMin += met.tMin;
          sumPrecip += met.precip;
          days++;
        }
      }
      data.push({
        label: monthStart.toLocaleDateString("it-IT", { month: "short" }).replace(".", ""),
        tMaxAvg: days ? Math.round((sumTMax / days) * 10) / 10 : 0,
        tMinAvg: days ? Math.round((sumTMin / days) * 10) / 10 : 0,
        precip: Math.round(sumPrecip * 10) / 10
      });
    }
    return data;
  }, [chartOffset]);

  const monthlyData = useMemo(() => {
    const year = today.getFullYear();
    const meteo = getMeteoForYear(year);
    const months: { label: string; tMaxAvg: number; tMinAvg: number; precipTotal: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(year, m, 1);
      const monthEnd = m < 11 ? new Date(year, m + 1, 0) : new Date(year, 11, 31);
      let sumTMax = 0, sumTMin = 0, sumPrecip = 0, days = 0;
      for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        const key = formatDateKey(d);
        const data = meteo.get(key);
        if (data) {
          sumTMax += data.tMax;
          sumTMin += data.tMin;
          sumPrecip += data.precip;
          days++;
        }
      }
      const label = monthStart.toLocaleDateString("it-IT", { month: "long" });
      months.push({
        label,
        tMaxAvg: days ? Math.round((sumTMax / days) * 10) / 10 : 0,
        tMinAvg: days ? Math.round((sumTMin / days) * 10) / 10 : 0,
        precipTotal: Math.round(sumPrecip * 10) / 10
      });
    }
    return months;
  }, []);

  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];
  const weekLabel = `${
    weekStart.toLocaleDateString("it-IT", { day: "numeric", month: "long" })
  } - ${
    weekEnd.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })
  }`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-blue-200">
      {/* Header fisso */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-sky-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 hover:bg-sky-200 transition"
            title="Chiudi"
          >
            <span className="material-symbols-outlined text-xl text-sky-800">close</span>
          </button>
          <div className="text-center">
            <h1 className="text-xl font-bold text-sky-900">Meteo {CITY}</h1>
            <p className="text-xs text-sky-600 font-medium">{weekLabel}</p>
          </div>
          {viewMode === "week" && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeekOffset((o) => o - 1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 hover:bg-sky-200 transition"
              >
                <span className="material-symbols-outlined text-xl text-sky-800">chevron_left</span>
              </button>
              <button
                onClick={() => setWeekOffset((o) => o + 1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 hover:bg-sky-200 transition"
              >
                <span className="material-symbols-outlined text-xl text-sky-800">chevron_right</span>
              </button>
            </div>
          )}
          {viewMode !== "week" && <div className="w-[88px]" />}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Pulsanti vista */}
        <div className="flex justify-start gap-2 mt-1 mb-2">
          <button
            onClick={() => { setViewMode("week"); setWeekOffset(0); }}
            className={`px-3 py-1.5 rounded-full border shadow-sm text-xs font-semibold transition ${
              viewMode === "week"
                ? "bg-sky-600 text-white border-sky-600"
                : "bg-white/80 text-sky-800 border-sky-300 hover:bg-white"
            }`}
          >
            📅 Settimana
          </button>
          <button
            onClick={() => setViewMode("chart")}
            className={`px-3 py-1.5 rounded-full border shadow-sm text-xs font-semibold transition ${
              viewMode === "chart"
                ? "bg-sky-600 text-white border-sky-600"
                : "bg-white/80 text-sky-800 border-sky-300 hover:bg-white"
            }`}
          >
            📈 Grafico
          </button>
          <button
            onClick={() => setViewMode("monthly")}
            className={`px-3 py-1.5 rounded-full border shadow-sm text-xs font-semibold transition ${
              viewMode === "monthly"
                ? "bg-sky-600 text-white border-sky-600"
                : "bg-white/80 text-sky-800 border-sky-300 hover:bg-white"
            }`}
          >
            📊 Medie mensili
          </button>
        </div>

        {viewMode === "week" && (
          <div className="space-y-1">
            {weekDays.map((day) => {
              const key = formatDateKey(day);
              const meteo = getMeteoForYear(day.getFullYear()).get(key);
              const isToday = key === todayKey;
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const dayName = day.toLocaleDateString("it-IT", { weekday: "long" });
              const dayNum = day.getDate();
              const monthName = day.toLocaleDateString("it-IT", { month: "short" });

              return (
                <div
                  key={key}
                  className={`flex items-center rounded-lg h-[40px] py-0.5 px-1.5 shadow-sm border ${
                    isToday
                      ? "bg-white border-sky-400 ring-1 ring-sky-300"
                      : isWeekend
                        ? "bg-blue-50/70 border-sky-100"
                        : "bg-white/80 border-sky-100"
                  }`}
                >
                  <div className="min-w-[60px]">
                    <p className="text-xs font-bold text-sky-900 uppercase tracking-wide truncate leading-tight">
                      {dayName}
                    </p>
                    <p className="text-[0.6rem] text-gray-500 leading-tight">
                      {dayNum} {monthName}
                    </p>
                  </div>
                  {meteo ? (
                    <>
                      <div className="min-w-[40px] text-center">
                        <span className="material-symbols-outlined text-2xl text-sky-600">
                          {meteo.icon}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-sm font-bold text-orange-600">
                          {meteo.tMax}°
                        </span>
                        <span className="text-xs text-gray-500">
                          {meteo.tMin}°
                        </span>
                      </div>
                      <div className="min-w-[40px] text-right">
                        <span className="text-[0.55rem] text-blue-500">
                          💧{meteo.precip}mm
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center ml-auto">
                      <span className="text-xs text-gray-400">N/D</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {viewMode === "chart" && (
          <div className="bg-white/80 rounded-2xl p-4 shadow-sm border border-sky-100 w-full max-w-6xl mx-auto">
            <div className="flex items-center justify-center gap-4 mb-3">
              <button
                onClick={() => setChartOffset((o) => o - 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 hover:bg-sky-200 transition"
              >
                <span className="material-symbols-outlined text-lg text-sky-800">chevron_left</span>
              </button>
              <div className="text-center">
                <h3 className="text-sm font-bold text-sky-900">
                  {chartType === "weekly" ? "Andamento settimanale" : "Andamento Annuale"}
                </h3>
                <p className="text-[0.65rem] text-sky-600">
                  {chartType === "weekly"
                    ? chartData.length > 0
                      ? `${chartData[0].label} - ${chartData[chartData.length - 1].label}`
                      : ""
                    : `${new Date().getFullYear() + chartOffset}`}
                </p>
              </div>
              <button
                onClick={() => setChartOffset((o) => o + 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 hover:bg-sky-200 transition"
              >
                <span className="material-symbols-outlined text-lg text-sky-800">chevron_right</span>
              </button>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              {chartType === "weekly" ? (
                <BarChart data={chartData} barGap={10} barCategoryGap={15}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" interval={0} tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="temp" orientation="left" tick={{ fontSize: 11 }} unit="°" />
                  <YAxis yAxisId="precip" orientation="right" tick={{ fontSize: 11 }} unit="mm" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="precip" dataKey="precip" fill="#60a5fa" name="Pioggia (mm)" radius={[4, 4, 0, 0]} barSize={40} />
                  <Line yAxisId="temp" type="monotone" dataKey="tMax" stroke="#ea580c" strokeWidth={2} name="T Max" dot={{ r: 4 }} />
                  <Line yAxisId="temp" type="monotone" dataKey="tMin" stroke="#3b82f6" strokeWidth={2} name="T Min" dot={{ r: 4 }} />
                </BarChart>
              ) : (
                <BarChart data={chartMonthlyData} barGap={8} barCategoryGap={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" interval={0} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="temp" orientation="left" tick={{ fontSize: 11 }} unit="°" />
                  <YAxis yAxisId="precip" orientation="right" tick={{ fontSize: 11 }} unit="mm" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="precip" dataKey="precip" fill="#60a5fa" name="Pioggia (mm)" radius={[4, 4, 0, 0]} barSize={24} />
                  <Line yAxisId="temp" type="monotone" dataKey="tMaxAvg" stroke="#ea580c" strokeWidth={2} name="T Max media" dot={{ r: 3 }} />
                  <Line yAxisId="temp" type="monotone" dataKey="tMinAvg" stroke="#3b82f6" strokeWidth={2} name="T Min media" dot={{ r: 3 }} />
                </BarChart>
              )}
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-4">
              <button
                onClick={() => { setChartType("weekly"); setChartOffset(0); }}
                className={`px-4 py-1.5 rounded-full border shadow-sm text-xs font-semibold transition ${
                  chartType === "weekly"
                    ? "bg-sky-600 text-white border-sky-600"
                    : "bg-white/80 text-sky-800 border-sky-300 hover:bg-white"
                }`}
              >
                📊 Settimanale
              </button>
              <button
                onClick={() => { setChartType("monthly"); setChartOffset(0); }}
                className={`px-4 py-1.5 rounded-full border shadow-sm text-xs font-semibold transition ${
                  chartType === "monthly"
                    ? "bg-sky-600 text-white border-sky-600"
                    : "bg-white/80 text-sky-800 border-sky-300 hover:bg-white"
                }`}
              >
                📈 Mensile
              </button>
            </div>
          </div>
        )}

        {viewMode === "monthly" && (
          <div className="space-y-1">
            {monthlyData.map((m) => (
              <div
                key={m.label}
                className="flex items-center rounded-lg h-[36px] px-2 shadow-sm border bg-white/80 border-sky-100"
              >
                <p className="w-20 text-[0.65rem] font-bold text-sky-900 capitalize shrink-0">{m.label}</p>
                <div className="flex items-center gap-2 ml-auto text-[0.6rem]">
                  <span className="font-bold text-orange-600">{m.tMaxAvg}°</span>
                  <span className="font-bold text-blue-600">{m.tMinAvg}°</span>
                  <span className="font-bold text-blue-500 min-w-[36px] text-right">{m.precipTotal}mm</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
