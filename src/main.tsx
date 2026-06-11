import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// 🚀 GeoGiardini 2.0 - PWA per la gestione del verde

// Service Worker Registration
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => console.log("ServiceWorker registered"))
      .catch((err) => console.error("ServiceWorker registration failed:", err));
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
