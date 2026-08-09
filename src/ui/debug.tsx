import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./sidebar.tsx";

type LogDebug = {
    id: number;
    dataHora: string;
    origem: string;
    mensagem: string;
    detalhes?: string;
};

type TipoLimpeza = "movimentacoes" | "emprestimos" | "alunos" | "acervo";

type ConfirmacaoLimpeza = {
    tipo: TipoLimpeza;
    titulo: string;
};

const opcoesLimpeza: Array<{
    tipo: TipoLimpeza;
    titulo: string;
    descricao: string;
}> = [
    {
        tipo: "movimentacoes",
        titulo: "Limpar movimentações",
        descricao: "Apaga os logs de livros adicionados, empréstimos, devoluções e exclusões.",
    },
    {
        tipo: "emprestimos",
        titulo: "Limpar empréstimos",
        descricao: "Apaga o histórico de empréstimos e marca todos os livros como livres.",
    },
    {
        tipo: "alunos",
        titulo: "Limpar alunos",
        descricao: "Apaga alunos e professores. Requer que os empréstimos tenham sido limpos.",
    },
    {
        tipo: "acervo",
        titulo: "Limpar acervo",
        descricao: "Apaga todos os exemplares. Requer que os empréstimos tenham sido limpos.",
    },
];

export default function Debug() {
    const [logs, setLogs] = useState<LogDebug[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [retorno, setRetorno] = useState("");
    const [erro, setErro] = useState("");
    const [limpando, setLimpando] = useState<TipoLimpeza | null>(null);
    const [confirmacaoLimpeza, setConfirmacaoLimpeza] = useState<ConfirmacaoLimpeza | null>(null);
    const [debugAtivo, setDebugAtivo] = useState<boolean | null>(null);

    const atualizar = async () => {
        const resposta = await window.electronAPI.obterLogsDebug();
        if (resposta.success && resposta.data) setLogs(resposta.data);
        setCarregando(false);
    };

    useEffect(() => {
        window.electronAPI.obterConfiguracao().then((resposta) => {
            setDebugAtivo(resposta.data?.painelDebugAtivo ?? true);
        });
    }, []);

    useEffect(() => {
        if (!debugAtivo) return;
        const inicial = window.setTimeout(atualizar, 0);
        const intervalo = window.setInterval(atualizar, 2000);
        return () => {
            window.clearTimeout(inicial);
            window.clearInterval(intervalo);
        };
    }, [debugAtivo]);

    const limpar = async () => {
        const resposta = await window.electronAPI.limparLogsDebug();
        if (resposta.success) {
            setLogs([]);
            setRetorno("Logs limpos.");
            window.setTimeout(() => setRetorno(""), 2500);
        }
    };

    const copiar = async () => {
        const resposta = await window.electronAPI.copiarLogsDebug();
        if (resposta.success) {
            setRetorno(
                resposta.quantidade
                    ? `${resposta.quantidade} log(s) copiado(s).`
                    : "Não há logs para copiar.",
            );
            window.setTimeout(() => setRetorno(""), 2500);
        }
    };

    const solicitarLimpeza = (tipo: TipoLimpeza, titulo: string) => {
        setErro("");
        setConfirmacaoLimpeza({ tipo, titulo });
    };

    const limparDados = async () => {
        if (!confirmacaoLimpeza) return;

        const { tipo } = confirmacaoLimpeza;

        setErro("");
        setRetorno("");
        setLimpando(tipo);
        try {
            const resposta = await window.electronAPI.limparDados(tipo);
            if (!resposta.success) {
                setErro(resposta.error || "Não foi possível limpar os dados.");
                return;
            }
            setRetorno(`${resposta.quantidade || 0} registro(s) removido(s).`);
            await atualizar();
            window.setTimeout(() => setRetorno(""), 3000);
        } catch (falha) {
            setErro(
                falha instanceof Error
                    ? falha.message
                    : "Não foi possível limpar os dados.",
            );
        } finally {
            setLimpando(null);
            setConfirmacaoLimpeza(null);
        }
    };

    if (debugAtivo === false) {
        return (
            <div className="app-shell flex min-h-screen">
                <Sidebar />
                <main className="app-main flex-1 flex items-center justify-center p-8">
                    <div className="app-panel max-w-lg rounded-xl p-8 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-cyan-50 text-cyan-700 flex items-center justify-center mx-auto mb-4 font-mono text-lg font-bold">&lt;/&gt;</div>
                        <h1 className="text-2xl font-semibold">Painel de Debug desativado</h1>
                        <p className="text-slate-500 mt-2 mb-5">Ative o painel nas Configurações para acessar logs e ferramentas técnicas.</p>
                        <Link to="/configuracoes" className="inline-block bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl px-5 py-2.5">Abrir Configurações</Link>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="app-shell flex min-h-screen font-sans">
            <Sidebar />
            <main className="app-main flex-1 p-8 xl:p-10 overflow-y-auto flex flex-col">
                <div className="max-w-6xl w-full mx-auto">
                <div className="app-page-header mb-6 flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="absolute -right-10 -top-20 h-52 w-52 rounded-full bg-cyan-400/10" />
                    <div className="relative">
                        <p className="app-eyebrow mb-2 text-xs font-semibold tracking-[0.18em] text-cyan-700">FERRAMENTAS TÉCNICAS</p>
                        <h1 className="text-4xl font-semibold tracking-tight">Painel de Debug</h1>
                        <p className="mt-2 text-slate-500">Erros do sistema aparecem automaticamente nesta tela.</p>
                    </div>
                    <div className="relative flex flex-wrap gap-2">
                        <button type="button" onClick={atualizar} className="app-panel-muted cursor-pointer rounded-lg px-4 py-2.5 font-medium text-slate-700 transition-colors">Atualizar</button>
                        <button type="button" onClick={copiar} className="app-primary-action cursor-pointer rounded-lg px-4 py-2.5 font-semibold transition-colors">Copiar logs</button>
                        <button type="button" onClick={limpar} className="cursor-pointer rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 font-medium text-red-700 transition-colors hover:bg-red-100">Limpar logs</button>
                    </div>
                </div>
                {retorno && (
                    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-medium text-emerald-800 shadow-sm" role="status">
                        {retorno}
                    </div>
                )}
                {erro && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-medium text-red-800 shadow-sm" role="alert">
                        {erro}
                    </div>
                )}
                <section className="h-[45vh] min-h-72 overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-5 font-mono text-slate-100 shadow-lg">
                    {carregando ? (
                        <p className="text-slate-400">Carregando...</p>
                    ) : logs.length === 0 ? (
                        <p className="text-emerald-400">Nenhum erro registrado nesta execução.</p>
                    ) : (
                        <div className="space-y-4">
                            {logs.map((log) => (
                                <article key={log.id} className="rounded-xl border border-slate-800 border-l-4 border-l-red-500 bg-slate-900 p-4">
                                    <div className="flex flex-wrap gap-x-3 text-sm text-slate-400 mb-2">
                                        <time>{new Date(log.dataHora).toLocaleString("pt-BR")}</time>
                                        <span>{log.origem}</span>
                                    </div>
                                    <p className="text-red-300 whitespace-pre-wrap break-words">{log.mensagem}</p>
                                    {log.detalhes && (
                                        <details className="mt-3">
                                            <summary className="cursor-pointer text-cyan-300">Ver detalhes técnicos</summary>
                                            <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-300">{log.detalhes}</pre>
                                        </details>
                                    )}
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-[0_8px_24px_rgba(180,83,9,0.08)]">
                    <div className="mb-5 flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-amber-100 font-bold text-amber-800" aria-hidden="true">!</div>
                        <div>
                            <p className="text-xs font-semibold tracking-[0.15em] text-slate-500">ZONA DE MANUTENÇÃO</p>
                            <h2 className="mt-1 text-2xl font-semibold text-slate-900">Manutenção do banco de dados</h2>
                            <p className="mt-1 text-sm leading-relaxed text-slate-500">
                                Use somente quando quiser apagar uma categoria específica. Cada opção é independente.
                            </p>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                        {opcoesLimpeza.map((opcao) => (
                            <div key={opcao.tipo} className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-white/70 p-4 shadow-sm transition hover:border-amber-400 hover:bg-amber-100/60">
                                <div>
                                    <strong className="block text-slate-900">{opcao.titulo}</strong>
                                    <span className="mt-1 block text-sm leading-relaxed text-slate-500">{opcao.descricao}</span>
                                </div>
                                <button
                                    type="button"
                                    disabled={limpando !== null}
                                    onClick={() => solicitarLimpeza(opcao.tipo, opcao.titulo)}
                                    className="shrink-0 cursor-pointer rounded-xl border border-red-200 bg-white px-4 py-2 font-semibold text-red-700 transition hover:border-red-700 hover:bg-red-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {limpando === opcao.tipo ? "Limpando..." : "Limpar"}
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
                </div>
            </main>
            {confirmacaoLimpeza && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
                    role="presentation"
                >
                    <section
                        aria-describedby="confirmacao-limpeza-descricao"
                        aria-labelledby="confirmacao-limpeza-titulo"
                        aria-modal="true"
                        className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-2xl"
                        role="dialog"
                    >
                        <div className="mb-5 flex items-start gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 font-bold text-red-700" aria-hidden="true">!</div>
                            <div>
                                <p className="text-xs font-semibold tracking-[0.15em] text-red-600">CONFIRMAR LIMPEZA</p>
                                <h2 id="confirmacao-limpeza-titulo" className="mt-1 text-xl font-semibold text-slate-900">
                                    {confirmacaoLimpeza.titulo}?
                                </h2>
                                <p id="confirmacao-limpeza-descricao" className="mt-2 text-sm leading-relaxed text-slate-600">
                                    Esta ação apaga os registros selecionados e não pode ser desfeita.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                disabled={limpando !== null}
                                onClick={() => setConfirmacaoLimpeza(null)}
                                className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                autoFocus
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={limpando !== null}
                                onClick={limparDados}
                                className="cursor-pointer rounded-xl bg-red-700 px-4 py-2.5 font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {limpando ? "Limpando..." : "Sim, limpar"}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
