import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type LogDebug = {
    id: number;
    dataHora: string;
    origem: string;
    mensagem: string;
    detalhes?: string;
};

type TipoLimpeza = "movimentacoes" | "emprestimos" | "alunos" | "acervo";

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
    const [limpando, setLimpando] = useState<TipoLimpeza | null>(null);

    const atualizar = async () => {
        const resposta = await window.electronAPI.obterLogsDebug();
        if (resposta.success && resposta.data) setLogs(resposta.data);
        setCarregando(false);
    };

    useEffect(() => {
        atualizar();
        const intervalo = window.setInterval(atualizar, 2000);
        return () => window.clearInterval(intervalo);
    }, []);

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

    const limparDados = async (tipo: TipoLimpeza, titulo: string) => {
        const confirmou = window.confirm(
            `${titulo}?\n\nEsta ação apaga os registros selecionados e não pode ser desfeita.`,
        );
        if (!confirmou) return;

        setLimpando(tipo);
        try {
            const resposta = await window.electronAPI.limparDados(tipo);
            if (!resposta.success) {
                alert(resposta.error || "Não foi possível limpar os dados.");
                return;
            }
            setRetorno(`${resposta.quantidade || 0} registro(s) removido(s).`);
            await atualizar();
            window.setTimeout(() => setRetorno(""), 3000);
        } finally {
            setLimpando(null);
        }
    };

    return (
        <div className="flex min-h-screen bg-white font-sans">
            <aside className="w-64 p-6 border-r-8 border-gray-300">
                <nav className="flex flex-col gap-5 text-xl text-gray-800">
                    <Link to="/">Home</Link>
                    <Link to="/acervo">Acervo</Link>
                    <Link to="/emprestimos">Empréstimos</Link>
                    <Link to="/aluno">Alunos</Link>
                    <Link to="/exportacao">Exportação de dados</Link>
                    <Link className="font-semibold text-cyan-600" to="/debug">Debug</Link>
                    <Link to="/configuracoes">Configurações</Link>
                </nav>
            </aside>
            <main className="flex-1 p-8 overflow-y-auto flex flex-col">
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-4xl font-semibold mb-2">Debug</h1>
                        <p className="text-gray-600">Erros do sistema aparecem automaticamente nesta tela.</p>
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={atualizar} className="px-4 py-2 rounded bg-slate-200 hover:bg-slate-300 cursor-pointer">Atualizar</button>
                        <button type="button" onClick={copiar} className="px-4 py-2 rounded bg-cyan-700 hover:bg-cyan-800 text-white cursor-pointer">Copiar logs</button>
                        <button type="button" onClick={limpar} className="px-4 py-2 rounded bg-red-700 hover:bg-red-800 text-white cursor-pointer">Limpar</button>
                    </div>
                </div>
                {retorno && (
                    <div className="mb-4 rounded bg-emerald-100 text-emerald-800 px-4 py-2" role="status">
                        {retorno}
                    </div>
                )}
                <section className="h-[45vh] min-h-72 overflow-auto rounded-lg bg-slate-950 text-slate-100 p-4 font-mono">
                    {carregando ? (
                        <p className="text-slate-400">Carregando...</p>
                    ) : logs.length === 0 ? (
                        <p className="text-emerald-400">Nenhum erro registrado nesta execução.</p>
                    ) : (
                        <div className="space-y-4">
                            {logs.map((log) => (
                                <article key={log.id} className="border-l-4 border-red-500 bg-slate-900 p-4 rounded">
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

                <section className="mt-6 border-2 border-red-200 bg-red-50 rounded-lg p-5">
                    <h2 className="text-2xl font-semibold text-red-800">Manutenção do banco de dados</h2>
                    <p className="text-red-700 mt-1 mb-4">
                        Use somente quando quiser apagar uma categoria específica. Cada opção é independente.
                    </p>
                    <div className="grid md:grid-cols-2 gap-3">
                        {opcoesLimpeza.map((opcao) => (
                            <div key={opcao.tipo} className="bg-white border border-red-200 rounded p-4 flex items-center justify-between gap-4">
                                <div>
                                    <strong className="block text-gray-900">{opcao.titulo}</strong>
                                    <span className="text-sm text-gray-600">{opcao.descricao}</span>
                                </div>
                                <button
                                    type="button"
                                    disabled={limpando !== null}
                                    onClick={() => limparDados(opcao.tipo, opcao.titulo)}
                                    className="shrink-0 px-4 py-2 rounded bg-red-700 hover:bg-red-800 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {limpando === opcao.tipo ? "Limpando..." : "Limpar"}
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
