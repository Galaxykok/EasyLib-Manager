type StartupStatus = {
  estado: "carregando" | "pronto" | "erro";
  titulo: string;
  detalhe: string;
  tema?: "light" | "dark";
};

declare global {
  interface Window {
    startupAPI: {
      onStatus: (callback: (status: StartupStatus) => void) => void;
      tentarNovamente: () => void;
      fechar: () => void;
    };
  }
}

const parametros = new URLSearchParams(window.location.search);
document.documentElement.dataset.theme = parametros.get("theme") === "dark" ? "dark" : "light";

const splash = document.querySelector<HTMLElement>("#splash");
const status = document.querySelector<HTMLElement>("#status");
const detalhe = document.querySelector<HTMLElement>("#detail");
const tentarNovamente = document.querySelector<HTMLButtonElement>("#retry");
const fechar = document.querySelector<HTMLButtonElement>("#close");

window.startupAPI.onStatus((atualizacao) => {
  if (atualizacao.tema) document.documentElement.dataset.theme = atualizacao.tema;
  if (status) status.textContent = atualizacao.titulo;
  if (detalhe) detalhe.textContent = atualizacao.detalhe;
  splash?.classList.toggle("error", atualizacao.estado === "erro");
});

tentarNovamente?.addEventListener("click", () => window.startupAPI.tentarNovamente());
fechar?.addEventListener("click", () => window.startupAPI.fechar());

export {};
