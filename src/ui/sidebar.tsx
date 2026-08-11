import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "./assets/icon.png";

type Icone = "home" | "acervo" | "emprestimos" | "alunos" | "exportacao" | "debug" | "configuracoes" | "sobre";
const CHAVE_TEMA = "easylib-tema";

try {
    const temaSalvo = window.localStorage.getItem(CHAVE_TEMA);
    if (temaSalvo === "dark" || temaSalvo === "light") {
        document.documentElement.dataset.theme = temaSalvo;
    }
} catch {
    // O banco continua sendo a fonte principal caso o armazenamento local esteja indisponível.
}

function IconeMenu({ tipo }: { tipo: Icone }) {
    const caminhos: Record<Icone, ReactNode> = {
        home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/></>,
        acervo: <><path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2Z"/><path d="M7 4v16"/><path d="M10 8h6"/></>,
        emprestimos: <><path d="M7 7h12l-3-3"/><path d="m19 7-3 3"/><path d="M17 17H5l3 3"/><path d="m5 17 3-3"/></>,
        alunos: <><circle cx="12" cy="8" r="3"/><path d="M5 20c.6-4 3-6 7-6s6.4 2 7 6"/></>,
        exportacao: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
        debug: <><path d="m8 9-4 3 4 3"/><path d="m16 9 4 3-4 3"/><path d="m14 5-4 14"/></>,
        configuracoes: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
        sobre: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7h.01"/></>,
    };
    return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{caminhos[tipo]}</svg>;
}

function aplicarTema(modoEscuro: boolean) {
    const tema = modoEscuro ? "dark" : "light";
    document.documentElement.dataset.theme = tema;
    try {
        window.localStorage.setItem(CHAVE_TEMA, tema);
    } catch {
        // A preferência ainda permanece salva no banco de dados.
    }
}

export default function Sidebar() {
    const location = useLocation();
    const [debugAtivo, setDebugAtivo] = useState(true);

    useEffect(() => {
        const carregarConfiguracao = () => {
            window.electronAPI.obterConfiguracao().then((resposta) => {
                if (resposta.success && resposta.data) {
                    const configuracao = resposta.data as typeof resposta.data & { modoEscuro?: boolean };
                    setDebugAtivo(configuracao.painelDebugAtivo);
                    aplicarTema(Boolean(configuracao.modoEscuro));
                }
            });
        };

        carregarConfiguracao();
        window.addEventListener("configuracao-atualizada", carregarConfiguracao);
        return () => window.removeEventListener("configuracao-atualizada", carregarConfiguracao);
    }, []);

    const itens: Array<{ rota: string; texto: string; icone: Icone }> = [
        { rota: "/", texto: "Início", icone: "home" },
        { rota: "/acervo", texto: "Acervo", icone: "acervo" },
        { rota: "/emprestimos", texto: "Empréstimos", icone: "emprestimos" },
        { rota: "/aluno", texto: "Alunos / Professores", icone: "alunos" },
        { rota: "/exportacao", texto: "Exportação", icone: "exportacao" },
        ...(debugAtivo ? [{ rota: "/debug", texto: "Debug", icone: "debug" as Icone }] : []),
        { rota: "/configuracoes", texto: "Configurações", icone: "configuracoes" },
        { rota: "/sobre", texto: "Sobre", icone: "sobre" },
    ];

    return (
        <aside className="app-sidebar w-72 h-screen sticky top-0 flex-shrink-0 px-5 py-6 flex flex-col overflow-hidden relative">
            <div className="relative flex items-center gap-4 px-2 mb-9">
                <div className="brand-logo-tile w-16 h-16 rounded-2xl bg-white shadow-lg shadow-slate-950/20 ring-1 ring-white/50 flex items-center justify-center">
                    <img src={logo} alt="EasyLib Manager" className="w-14 h-14 object-contain" />
                </div>
                <div>
                    <strong className="block text-2xl text-white leading-tight tracking-tight">EasyLib</strong>
                    <span className="text-[11px] text-slate-300 tracking-[0.22em] font-medium">MANAGER</span>
                </div>
            </div>

            <p className="relative px-4 mb-2 text-[10px] font-semibold tracking-[0.18em] text-slate-400">NAVEGAÇÃO</p>
            <nav className="relative flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
                {itens.map((item) => {
                    const ativo = item.rota === "/"
                        ? location.pathname === "/"
                        : location.pathname.startsWith(item.rota);
                    return (
                        <Link
                            key={item.rota}
                            to={item.rota}
                            className={`app-nav-link group flex items-center gap-3 px-4 py-3 border transition-colors ${
                                ativo
                                    ? "app-nav-link-active bg-white text-slate-900 border-white font-semibold"
                                    : "text-slate-300 border-transparent hover:bg-white/10 hover:text-white hover:border-white/10"
                            }`}
                        >
                            <span className={ativo ? "text-cyan-700" : "text-slate-400 group-hover:text-slate-200"}><IconeMenu tipo={item.icone} /></span>
                            <span>{item.texto}</span>
                            {ativo && <span className="app-nav-marker ml-auto" />}
                        </Link>
                    );
                })}
            </nav>

            <div className="relative mt-auto mx-1 p-4 rounded-2xl bg-white/[0.07] border border-white/10 text-xs text-slate-300">
                <span className="flex items-center gap-2 font-medium text-white mb-1">
                    <span className="app-status-dot w-2 h-2 rounded-full bg-emerald-400" />
                    Sistema local ativo
                </span>
                Gestão simples para sua biblioteca
            </div>
        </aside>
    );
}
