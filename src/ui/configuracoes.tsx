import { useEffect, useRef, useState } from "react";
import Sidebar from "./sidebar.tsx";

const variaveis = [
    ["{{nome_aluno}}", "Nome do aluno"],
    ["{{serie_aluno}}", "Série / turma"],
    ["{{tipo_leitor}}", "Tipo de leitor"],
    ["{{data}}", "Data"],
    ["{{hora}}", "Hora"],
    ["{{data_devolucao}}", "Data de devolução"],
    ["{{responsavel_biblioteca}}", "Responsável"],
    ["{{livros}}", "Livros e estados"],
    ["{{estado_livros}}", "Estados dos livros"],
] as const;

type InterruptorProps = {
    ativo: boolean;
    aoAlterar: (ativo: boolean) => void;
    rotulo: string;
};

function Interruptor({ ativo, aoAlterar, rotulo }: InterruptorProps) {
    return (
        <span className="relative mt-1 shrink-0">
            <input
                type="checkbox"
                role="switch"
                className="peer sr-only"
                checked={ativo}
                aria-label={rotulo}
                onChange={(evento) => aoAlterar(evento.target.checked)}
            />
            <span
                aria-hidden="true"
                className={`switch-track block h-7 w-12 rounded-full shadow-inner ring-1 transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-cyan-300/50 ${
                    ativo
                        ? "bg-cyan-600 ring-cyan-400"
                        : "bg-[#64748b] ring-[#475569]"
                }`}
            >
                <span
                    className={`switch-thumb absolute left-1 top-1 h-5 w-5 rounded-full bg-[#ffffff] shadow-md transition-transform ${
                        ativo ? "translate-x-5" : "translate-x-0"
                    }`}
                />
            </span>
        </span>
    );
}

function IconeTermo() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
            <path d="M6 3h8l4 4v14H6V3Z" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M14 3v5h5M9 12h6M9 16h4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconeDebug() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
            <rect x="3" y="4" width="18" height="16" rx="2.5" strokeWidth="1.8" />
            <path d="m7.5 9 2.5 2-2.5 2M12.5 15h4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconeLua() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
            <path d="M20.2 15.1A8.5 8.5 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export default function Configuracoes() {
    const [configuracao, setConfiguracao] = useState<Configuracao>({
        termoResponsabilidadeAtivo: true,
        responsavelBiblioteca: "",
        modeloTermo: "",
        paresTermosPorFolha: 2,
        tipoFolha: "A4",
        painelDebugAtivo: true,
        modoEscuro: false,
    });
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [mensagem, setMensagem] = useState("");
    const editorRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        window.electronAPI.obterConfiguracao().then((resposta) => {
            if (resposta.success && resposta.data) setConfiguracao(resposta.data);
            else alert(resposta.error || "Não foi possível carregar as configurações.");
            setCarregando(false);
        });
    }, []);

    const inserirVariavel = (variavel: string) => {
        const editor = editorRef.current;
        const inicio = editor?.selectionStart ?? configuracao.modeloTermo.length;
        const fim = editor?.selectionEnd ?? inicio;
        setConfiguracao((atual) => ({
            ...atual,
            modeloTermo:
                atual.modeloTermo.slice(0, inicio) +
                variavel +
                atual.modeloTermo.slice(fim),
        }));
        window.setTimeout(() => {
            editor?.focus();
            editor?.setSelectionRange(inicio + variavel.length, inicio + variavel.length);
        });
    };

    const salvar = async () => {
        if (
            configuracao.termoResponsabilidadeAtivo &&
            !configuracao.responsavelBiblioteca.trim()
        ) {
            alert("Informe o nome do responsável pela biblioteca.");
            return;
        }
        setSalvando(true);
        const resposta = await window.electronAPI.salvarConfiguracao(configuracao);
        setSalvando(false);
        if (!resposta.success) {
            alert(resposta.error || "Não foi possível salvar as configurações.");
            return;
        }
        if (resposta.data) setConfiguracao(resposta.data);
        window.dispatchEvent(new Event("configuracao-atualizada"));
        setMensagem("Configurações salvas.");
        window.setTimeout(() => setMensagem(""), 3000);
    };

    return (
        <div className="app-shell flex min-h-screen font-sans">
            <Sidebar />

            <main className="app-main flex-1 p-8 xl:p-10 overflow-y-auto">
                <div className="max-w-5xl mx-auto">
                <header className="app-page-header p-7 mb-7">
                    <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/10" />
                    <div className="absolute right-24 -bottom-24 h-44 w-44 rounded-full bg-sky-300/15" />
                    <div className="relative">
                        <p className="app-eyebrow text-xs font-semibold tracking-[0.18em] text-cyan-700 mb-2">PREFERÊNCIAS</p>
                        <h1 className="text-4xl font-semibold tracking-tight">Configurações</h1>
                        <p className="text-cyan-50/85 mt-2">Personalize termos, impressão e ferramentas do sistema.</p>
                    </div>
                </header>

                {carregando ? (
                    <div className="rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-8 text-cyan-900 shadow-sm">Carregando configurações...</div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid gap-5 lg:grid-cols-3">
                            <section className="app-panel rounded-xl p-6 transition-colors">
                                <label className="flex h-full cursor-pointer items-start justify-between gap-5">
                                    <span>
                                        <span className="app-stat-icon mb-3 flex h-10 w-10 items-center justify-center rounded-lg" aria-hidden="true">
                                            <IconeTermo />
                                        </span>
                                        <strong className="block text-lg text-slate-900">Gerar termo de responsabilidade</strong>
                                        <span className="mt-1 block text-sm leading-relaxed text-slate-500">Ao registrar um empréstimo, o sistema oferecerá a impressão em duas vias.</span>
                                    </span>
                                    <Interruptor
                                        ativo={configuracao.termoResponsabilidadeAtivo}
                                        rotulo="Gerar termo de responsabilidade"
                                        aoAlterar={(ativo) => setConfiguracao((atual) => ({ ...atual, termoResponsabilidadeAtivo: ativo }))}
                                    />
                                </label>
                            </section>

                            <section className="app-panel rounded-xl p-6 transition-colors">
                                <label className="flex h-full cursor-pointer items-start justify-between gap-5">
                                    <span>
                                        <span className="app-stat-icon mb-3 flex h-10 w-10 items-center justify-center rounded-lg" aria-hidden="true">
                                            <IconeDebug />
                                        </span>
                                        <strong className="block text-lg text-slate-900">Exibir painel de Debug</strong>
                                        <span className="mt-1 block text-sm leading-relaxed text-slate-500">Mostra ou oculta o acesso às ferramentas técnicas no menu lateral.</span>
                                    </span>
                                    <Interruptor
                                        ativo={configuracao.painelDebugAtivo}
                                        rotulo="Exibir painel de Debug"
                                        aoAlterar={(ativo) => setConfiguracao((atual) => ({ ...atual, painelDebugAtivo: ativo }))}
                                    />
                                </label>
                            </section>

                            <section className="app-panel rounded-xl p-6 transition-colors">
                                <label className="flex h-full cursor-pointer items-start justify-between gap-5">
                                    <span>
                                        <span className="app-stat-icon mb-3 flex h-10 w-10 items-center justify-center rounded-lg" aria-hidden="true">
                                            <IconeLua />
                                        </span>
                                        <strong className="block text-lg text-slate-900">Modo noturno</strong>
                                        <span className="mt-1 block text-sm leading-relaxed text-slate-500">Escurece fundos e superfícies para reduzir o brilho e separar melhor os elementos.</span>
                                    </span>
                                    <Interruptor
                                        ativo={configuracao.modoEscuro}
                                        rotulo="Modo noturno"
                                        aoAlterar={(modoEscuro) => {
                                            setConfiguracao((atual) => ({ ...atual, modoEscuro }));
                                            document.documentElement.dataset.theme = modoEscuro ? "dark" : "light";
                                        }}
                                    />
                                </label>
                            </section>
                        </div>

                        <section className="app-panel rounded-xl p-6">
                            <div className="mb-5">
                                <p className="text-xs font-semibold tracking-[0.15em] text-cyan-700">IDENTIFICAÇÃO</p>
                                <h2 className="mt-1 text-xl font-semibold text-slate-900">Responsável pela biblioteca</h2>
                                <p className="mt-1 text-sm text-slate-500">Este nome será usado nos termos de responsabilidade.</p>
                            </div>
                            <label className="block text-sm font-semibold text-slate-700">
                                Nome completo
                                <input
                                    type="text"
                                    value={configuracao.responsavelBiblioteca}
                                    onChange={(evento) => setConfiguracao((atual) => ({ ...atual, responsavelBiblioteca: evento.target.value }))}
                                    placeholder="Nome completo"
                                    className="mt-2 block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                                />
                            </label>
                        </section>

                        <section className="app-panel rounded-xl p-6">
                            <div className="mb-5">
                                <p className="text-xs font-semibold tracking-[0.15em] text-cyan-700">IMPRESSÃO</p>
                                <h2 className="mt-1 text-xl font-semibold text-slate-900">Layout dos termos</h2>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <label className="text-sm font-semibold text-slate-700">
                                    Pares de termos por folha
                                    <select
                                        value={configuracao.paresTermosPorFolha}
                                        onChange={(evento) => setConfiguracao((atual) => ({ ...atual, paresTermosPorFolha: Number(evento.target.value) }))}
                                        className="mt-2 block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-normal text-slate-900 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                                    >
                                        <option value={1}>1 par — 2 termos por folha</option>
                                        <option value={2}>2 pares — 4 termos por folha</option>
                                        <option value={3}>3 pares — 6 termos por folha</option>
                                        <option value={4}>4 pares — 8 termos por folha</option>
                                    </select>
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Tipo de folha
                                    <select
                                        value={configuracao.tipoFolha}
                                        onChange={(evento) => setConfiguracao((atual) => ({ ...atual, tipoFolha: evento.target.value as Configuracao["tipoFolha"] }))}
                                        className="mt-2 block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-normal text-slate-900 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                                    >
                                        <option value="A4">A4 — 210 × 297 mm</option>
                                        <option value="CARTA">Carta — 216 × 279 mm</option>
                                        <option value="OFICIO">Ofício — 216 × 356 mm</option>
                                    </select>
                                </label>
                            </div>
                            <p className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-900">
                                O par atual será sempre posicionado no rodapé, permitindo reutilizar a parte inferior de uma folha já usada ou cortada.
                            </p>
                        </section>

                        <section className="app-panel rounded-xl p-6">
                            <p className="text-xs font-semibold tracking-[0.15em] text-cyan-700">CONTEÚDO</p>
                            <h2 className="mt-1 text-xl font-semibold text-slate-900">Modelo do termo</h2>
                            <p className="mb-4 mt-1 text-sm text-slate-500">Clique em uma variável para inseri-la na posição atual do cursor.</p>
                            <div className="mb-4 flex flex-wrap gap-2 rounded-xl border-2 border-amber-200 bg-white/75 p-3">
                                {variaveis.map(([variavel, rotulo]) => (
                                    <button
                                        type="button"
                                        key={variavel}
                                        onClick={() => inserirVariavel(variavel)}
                                        title={variavel}
                                        className="cursor-pointer rounded-lg border border-cyan-200 bg-white px-3 py-1.5 text-sm font-medium text-cyan-800 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50"
                                    >
                                        {rotulo}
                                    </button>
                                ))}
                            </div>
                            <textarea
                                ref={editorRef}
                                rows={18}
                                value={configuracao.modeloTermo}
                                onChange={(evento) => setConfiguracao((atual) => ({ ...atual, modeloTermo: evento.target.value }))}
                                className="w-full rounded-xl border border-slate-300 bg-slate-50 p-4 font-mono text-sm leading-relaxed text-slate-800 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                            />
                        </section>

                        <div className="app-panel sticky bottom-4 z-10 flex items-center justify-between gap-4 rounded-xl px-5 py-4">
                            <p className="hidden text-sm text-slate-500 sm:block">O tema muda na hora; salve para manter todas as alterações.</p>
                            <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={salvar}
                                disabled={salvando}
                                className="app-primary-action cursor-pointer rounded-lg px-6 py-3 font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {salvando ? "Salvando..." : "Salvar configurações"}
                            </button>
                            {mensagem && <span className="font-medium text-emerald-700" role="status">{mensagem}</span>}
                            </div>
                        </div>
                    </div>
                )}
                </div>
            </main>
        </div>
    );
}
