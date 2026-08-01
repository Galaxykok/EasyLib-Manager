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
        <div className="flex min-h-screen bg-[#eaf0f6] font-sans">
            <Sidebar />

            <main className="flex-1 p-8 xl:p-10 overflow-y-auto">
                <div className="max-w-5xl mx-auto">
                <header className="relative overflow-hidden bg-gradient-to-r from-[#0f4c5c] via-cyan-700 to-sky-600 text-white rounded-3xl p-7 mb-7 shadow-[0_16px_40px_rgba(8,51,68,0.18)]">
                    <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/10" />
                    <div className="absolute right-24 -bottom-24 h-44 w-44 rounded-full bg-sky-300/15" />
                    <div className="relative">
                        <p className="text-xs font-semibold tracking-[0.18em] text-cyan-100 mb-2">PREFERÊNCIAS</p>
                        <h1 className="text-4xl font-semibold tracking-tight">Configurações</h1>
                        <p className="text-cyan-50/85 mt-2">Personalize termos, impressão e ferramentas do sistema.</p>
                    </div>
                </header>

                {carregando ? (
                    <div className="rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-8 text-cyan-900 shadow-sm">Carregando configurações...</div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid gap-5 lg:grid-cols-3">
                            <section className="rounded-2xl border-2 border-cyan-200 bg-cyan-50/90 p-6 shadow-sm transition-shadow hover:shadow-md">
                                <label className="flex h-full cursor-pointer items-start justify-between gap-5">
                                    <span>
                                        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 font-semibold text-cyan-700" aria-hidden="true">T</span>
                                        <strong className="block text-lg text-slate-900">Gerar termo de responsabilidade</strong>
                                        <span className="mt-1 block text-sm leading-relaxed text-slate-500">Ao registrar um empréstimo, o sistema oferecerá a impressão em duas vias.</span>
                                    </span>
                                    <span className="relative mt-1 shrink-0">
                                        <input
                                            type="checkbox"
                                            className="peer sr-only"
                                            checked={configuracao.termoResponsabilidadeAtivo}
                                            onChange={(evento) => setConfiguracao((atual) => ({ ...atual, termoResponsabilidadeAtivo: evento.target.checked }))}
                                        />
                                        <span className="block h-7 w-12 rounded-full bg-slate-300 shadow-inner transition-colors peer-checked:bg-cyan-600 peer-focus-visible:ring-4 peer-focus-visible:ring-cyan-200 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] peer-checked:after:translate-x-5" />
                                    </span>
                                </label>
                            </section>

                            <section className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/90 p-6 shadow-sm transition-shadow hover:shadow-md">
                                <label className="flex h-full cursor-pointer items-start justify-between gap-5">
                                    <span>
                                        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 font-mono text-sm font-bold text-indigo-700" aria-hidden="true">&lt;/&gt;</span>
                                        <strong className="block text-lg text-slate-900">Exibir painel de Debug</strong>
                                        <span className="mt-1 block text-sm leading-relaxed text-slate-500">Mostra ou oculta o acesso às ferramentas técnicas no menu lateral.</span>
                                    </span>
                                    <span className="relative mt-1 shrink-0">
                                        <input
                                            type="checkbox"
                                            className="peer sr-only"
                                            checked={configuracao.painelDebugAtivo}
                                            onChange={(evento) => setConfiguracao((atual) => ({ ...atual, painelDebugAtivo: evento.target.checked }))}
                                        />
                                        <span className="block h-7 w-12 rounded-full bg-slate-300 shadow-inner transition-colors peer-checked:bg-cyan-600 peer-focus-visible:ring-4 peer-focus-visible:ring-cyan-200 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] peer-checked:after:translate-x-5" />
                                    </span>
                                </label>
                            </section>

                            <section className="rounded-2xl border-2 border-slate-700 bg-slate-900 p-6 text-white shadow-sm transition-shadow hover:shadow-md">
                                <label className="flex h-full cursor-pointer items-start justify-between gap-5">
                                    <span>
                                        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-400/20 text-xl text-indigo-100" aria-hidden="true">☾</span>
                                        <strong className="block text-lg text-white">Modo noturno</strong>
                                        <span className="mt-1 block text-sm leading-relaxed text-slate-300">Escurece fundos e superfícies para reduzir o brilho e separar melhor os elementos.</span>
                                    </span>
                                    <span className="relative mt-1 shrink-0">
                                        <input
                                            type="checkbox"
                                            className="peer sr-only"
                                            checked={configuracao.modoEscuro}
                                            onChange={(evento) => {
                                                const modoEscuro = evento.target.checked;
                                                setConfiguracao((atual) => ({ ...atual, modoEscuro }));
                                                document.documentElement.dataset.theme = modoEscuro ? "dark" : "light";
                                            }}
                                        />
                                        <span className="block h-7 w-12 rounded-full bg-slate-600 shadow-inner transition-colors peer-checked:bg-cyan-500 peer-focus-visible:ring-4 peer-focus-visible:ring-cyan-300/30 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] peer-checked:after:translate-x-5" />
                                    </span>
                                </label>
                            </section>
                        </div>

                        <section className="rounded-2xl border-2 border-cyan-200 bg-cyan-50/80 p-6 shadow-sm">
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

                        <section className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/80 p-6 shadow-sm">
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

                        <section className="rounded-2xl border-2 border-amber-200 bg-amber-50/80 p-6 shadow-sm">
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

                        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-4 rounded-2xl border border-slate-700 bg-slate-900/95 px-5 py-4 text-white shadow-[0_12px_32px_rgba(15,23,42,0.24)] backdrop-blur">
                            <p className="hidden text-sm text-slate-300 sm:block">O tema muda na hora; salve para manter todas as alterações.</p>
                            <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={salvar}
                                disabled={salvando}
                                className="cursor-pointer rounded-xl bg-cyan-700 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
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
