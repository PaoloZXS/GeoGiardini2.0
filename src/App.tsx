import { useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import ClientePage from "./pages/ClientePage";
import GiardinierePage from "./pages/GiardinierePage";
import FullCalendarPage from "./pages/FullCalendarPage";
import WeatherPage from "./pages/WeatherPage";

function clearStoredAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("loginRole");
  window.localStorage.removeItem("loginUsername");
  window.localStorage.removeItem("userId");
}

function App() {
  const [authenticatedRole, setAuthenticatedRole] = useState<
    "admin" | "giardiniere" | "cliente" | null
  >(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [pushNotification, setPushNotification] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setAuthResolved(true);
      return;
    }

    const hash = window.location.hash || "#/";
    if (hash === "#/" || hash === "#/geologin" || hash === "#/login" || hash === "#") {
      clearStoredAuth();
    }

    const stored = window.localStorage.getItem("loginRole");
    const storedUserId = window.localStorage.getItem("userId");

    if (stored === "admin") {
      setAuthenticatedRole("admin");
      setAuthResolved(true);
      return;
    }

    if (stored === "giardiniere" && storedUserId) {
      setAuthenticatedRole("giardiniere");
      setAuthResolved(true);
      return;
    }

    if (stored === "cliente" && storedUserId) {
      setAuthenticatedRole("cliente");
      setAuthResolved(true);
      return;
    }

    clearStoredAuth();
    setAuthenticatedRole(null);
    setAuthResolved(true);
  }, []);

  const handleLogout = () => {
    clearStoredAuth();
    setAuthenticatedRole(null);
    if (typeof window !== "undefined") {
      window.location.hash = "#/geologin";
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_RECEIVED") {
        setPushNotification("Nuova notifica ricevuta!");
        setTimeout(() => setPushNotification(null), 3000);
        window.localStorage.setItem("pushNotificationReceived", Date.now().toString());
        return;
      }
      if (event.data?.type === "NAVIGATE_TO") {
        const targetUrl = event.data?.targetUrl?.toString?.() ?? "";
        if (!targetUrl) return;
        try {
          const normalizedTarget = new URL(targetUrl, window.location.origin);
          const nextHash = normalizedTarget.hash || "#/";
          if (window.location.hash !== nextHash) {
            window.location.hash = nextHash;
          }
        } catch {
          // ignore
        }
      }
    };

    navigator.serviceWorker?.addEventListener("message", handleSwMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", handleSwMessage);
    };
  }, []);

  if (!authResolved) return null;

  const homeElement =
    authenticatedRole === "admin" ? (
      <Navigate to="/admin" replace />
    ) : authenticatedRole === "giardiniere" ? (
      <Navigate to="/giardiniere" replace />
    ) : authenticatedRole === "cliente" ? (
      <Navigate to="/cliente" replace />
    ) : (
      <LoginPage onLoginSuccess={(role) => setAuthenticatedRole(role)} />
    );

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={homeElement} />
        <Route path="/geologin" element={homeElement} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route
          path="/admin"
          element={
            authenticatedRole === "admin" ? (
              <AdminPage onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/admin/calendar"
          element={
            authenticatedRole === "admin" ? (
              <FullCalendarPage onBack={() => { window.location.hash = "#/admin"; }} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/admin/weather"
          element={
            authenticatedRole === "admin" ? (
              <WeatherPage onBack={() => { window.location.hash = "#/admin"; }} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/giardiniere"
          element={
            authenticatedRole === "giardiniere" ? (
              <GiardinierePage onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/cliente"
          element={
            authenticatedRole === "cliente" ? (
              <ClientePage onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {pushNotification && (
        <div className="push-toast">{pushNotification}</div>
      )}
    </HashRouter>
  );
}

export default App;
