import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from "react-router-dom";
import App from './App.tsx'
import './App.css'

const temaInicial = new URLSearchParams(window.location.search).get("theme");
if (temaInicial === "dark" || temaInicial === "light") {
  document.documentElement.dataset.theme = temaInicial;
}

window.addEventListener("error", (evento) => {
  window.electronAPI?.registrarDebug(
    "Interface",
    evento.message || "Erro não tratado na interface",
    evento.error?.stack || `${evento.filename || ""}:${evento.lineno || ""}`,
  );
});

window.addEventListener("unhandledrejection", (evento) => {
  const motivo = evento.reason;
  window.electronAPI?.registrarDebug(
    "Interface",
    motivo instanceof Error ? motivo.message : "Promessa rejeitada sem tratamento",
    motivo instanceof Error ? motivo.stack : String(motivo),
  );
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
)
