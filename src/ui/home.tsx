import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./sidebar.tsx";

const formatarData = (valor: Date | string | null) =>
    valor ? new Date(valor).toLocaleDateString("pt-BR") : "Sem prazo";

export default function Home() {
    const [dashboard, setDashboard] = useState<Dashboard | null>(null);
    const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([]);
    const [responsavel, setResponsavel] = useState("Responsável");
    const [carregando, setCarregando] = useState(true);

    useEffect(() => {
        Promise.all([
            window.electronAPI.obterDashboard(),
            window.electronAPI.obterEmprestimo(),
            window.electronAPI.obterConfiguracao(),
        ]).then(([resumo, lista, configuracao]) => {
            if (resumo.success && resumo.data) setDashboard(resumo.data);
            if (lista.success && lista.data) setEmprestimos(lista.data);
            if (configuracao.success && configuracao.data?.responsavelBiblioteca.trim()) {
                setResponsavel(configuracao.data.responsavelBiblioteca.trim().split(/\s+/)[0]);
            }
            setCarregando(false);
        });
    }, []);

    const saudacao = useMemo(() => {
        const hora = new Date().getHours();
        if (hora < 12) return { texto: "Bom dia", icone: "☀️", gradiente: "from-[#0f4c5c] via-cyan-700 to-amber-400", detalhe: "Que seu dia comece com boas histórias." };
        if (hora < 18) return { texto: "Boa tarde", icone: "🌤️", gradiente: "from-[#0f4c5c] via-cyan-700 to-sky-500", detalhe: "Uma ótima tarde de leitura e organização." };
        return { texto: "Boa noite", icone: "🌙", gradiente: "from-slate-950 via-indigo-900 to-slate-700", detalhe: "Encerrando mais um dia de conhecimento." };
    }, []);

    const proximos = useMemo(() =>
        emprestimos
            .filter((emprestimo) => emprestimo.dataDevolucaoPrevista)
            .sort((a, b) => new Date(a.dataDevolucaoPrevista!).getTime() - new Date(b.dataDevolucaoPrevista!).getTime())
            .slice(0, 7),
    [emprestimos]);

    const estatisticas = [
        { rotulo: "Empréstimos no mês", valor: dashboard?.emprestimosMes ?? 0, detalhe: "registros neste mês", cor: "bg-cyan-100 text-cyan-800", borda: "border-t-cyan-500", icone: "↗" },
        { rotulo: "Empréstimos hoje", valor: dashboard?.emprestimosHoje ?? 0, detalhe: "movimentações hoje", cor: "bg-emerald-100 text-emerald-800", borda: "border-t-emerald-500", icone: "◷" },
        { rotulo: "Livro favorito", valor: dashboard?.livroFavorito?.nome || "Sem dados", detalhe: dashboard?.livroFavorito ? `${dashboard.livroFavorito.total} empréstimo(s)` : "neste mês", cor: "bg-violet-100 text-violet-800", borda: "border-t-violet-500", icone: "★" },
        { rotulo: "Série em destaque", valor: dashboard?.serieDestaque?.nome || "Sem dados", detalhe: dashboard?.serieDestaque ? `${dashboard.serieDestaque.total} empréstimo(s)` : "neste mês", cor: "bg-blue-100 text-blue-800", borda: "border-t-blue-500", icone: "◆" },
        { rotulo: "Leitor destaque", valor: dashboard?.alunoDestaque?.nome || "Sem dados", detalhe: dashboard?.alunoDestaque ? `${dashboard.alunoDestaque.total} empréstimo(s)` : "neste mês", cor: "bg-amber-100 text-amber-800", borda: "border-t-amber-500", icone: "♙" },
    ];

    return (
        <div className="flex min-h-screen bg-[#eaf0f6] text-slate-900">
            <Sidebar />
            <main className="flex-1 min-w-0 p-8 xl:p-10 overflow-y-auto">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-xs font-semibold tracking-[0.18em] text-cyan-800">VISÃO GERAL</p>
                            <h2 className="text-2xl font-semibold tracking-tight mt-1">Painel da biblioteca</h2>
                        </div>
                        <span className="px-3 py-1.5 rounded-full bg-cyan-100 border border-cyan-200 text-xs font-semibold text-cyan-900 shadow-sm">Dados deste mês</span>
                    </div>
                    <section className={`relative overflow-hidden bg-gradient-to-br ${saudacao.gradiente} border border-white/20 rounded-3xl p-7 mb-7 text-white shadow-[0_18px_45px_rgba(15,76,92,0.22)]`}>
                        <div className="absolute -right-10 -top-14 w-52 h-52 rounded-full bg-white/15" />
                        <div className="absolute right-32 -bottom-20 w-40 h-40 rounded-full bg-white/10" />
                        <div className="relative flex items-center justify-between gap-6">
                            <div>
                                <p className="text-sm font-medium text-white/70 mb-1 capitalize">
                                    {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                                </p>
                                <h1 className="text-4xl font-semibold tracking-tight">{saudacao.texto}, {responsavel}!</h1>
                                <p className="text-white/80 mt-2">{saudacao.detalhe}</p>
                            </div>
                            <span className="text-7xl drop-shadow-sm bg-white/10 border border-white/15 rounded-3xl w-28 h-28 flex items-center justify-center backdrop-blur-sm" aria-hidden="true">{saudacao.icone}</span>
                        </div>
                    </section>

                    <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-7">
                        {estatisticas.map((item) => (
                            <article key={item.rotulo} className={`bg-gradient-to-br from-sky-50 to-cyan-50/80 border border-sky-200 border-t-4 ${item.borda} rounded-2xl p-5 shadow-[0_7px_22px_rgba(14,116,144,0.09)] hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lg transition-all min-w-0`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-4 ${item.cor}`}>{item.icone}</div>
                                <p className="text-sm text-slate-500">{item.rotulo}</p>
                                <strong className="block text-xl mt-1 truncate" title={String(item.valor)}>{item.valor}</strong>
                                <span className="text-xs text-slate-400 mt-1 block">{item.detalhe}</span>
                            </article>
                        ))}
                    </div>

                    <div className="grid xl:grid-cols-[1fr_330px] gap-6">
                        <section className="bg-sky-50/80 border-2 border-sky-200 rounded-2xl shadow-[0_8px_24px_rgba(14,116,144,0.08)] overflow-hidden">
                            <header className="flex items-center justify-between px-6 py-5 border-b border-slate-700 bg-slate-800 text-white">
                                <div>
                                    <h2 className="text-xl font-semibold">Próximas devoluções</h2>
                                    <p className="text-sm text-slate-300">Acompanhe os prazos que precisam de atenção.</p>
                                </div>
                                <Link to="/emprestimos" className="text-sm font-semibold text-cyan-300 hover:text-cyan-100">Ver todos →</Link>
                            </header>
                            <div className="divide-y divide-sky-200">
                                {carregando ? (
                                    <p className="p-6 text-slate-500">Carregando painel...</p>
                                ) : proximos.length === 0 ? (
                                    <div className="p-10 text-center text-slate-500">
                                        <span className="text-3xl block mb-2">✓</span>
                                        Nenhuma devolução pendente com prazo definido.
                                    </div>
                                ) : proximos.map((emprestimo) => {
                                    const atrasado = emprestimo.status === "ATRASADO";
                                    return (
                                        <div key={emprestimo.id} className="flex items-center gap-4 px-6 py-4 hover:bg-cyan-100/70 transition-colors">
                                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${atrasado ? "bg-red-500" : "bg-amber-400"}`} />
                                            <div className="min-w-0 flex-1">
                                                <strong className="block truncate">{emprestimo.livro.titulo}</strong>
                                                <span className="text-sm text-slate-500">{emprestimo.aluno.nome} · {emprestimo.aluno.serie || "Sem turma"}</span>
                                            </div>
                                            <span className={`text-sm font-medium px-3 py-1.5 rounded-full ${atrasado ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                                                {atrasado ? "Atrasado · " : "Até "}{formatarData(emprestimo.dataDevolucaoPrevista)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        <aside className="space-y-4">
                            <article className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm">
                                <p className="text-slate-300 text-sm">Situação atual</p>
                                <div className="flex items-end justify-between mt-4">
                                    <div><strong className="text-4xl">{dashboard?.ativos ?? 0}</strong><span className="block text-sm text-slate-300">ativos</span></div>
                                    <div className="text-right"><strong className="text-3xl text-red-300">{dashboard?.atrasados ?? 0}</strong><span className="block text-sm text-slate-300">atrasados</span></div>
                                </div>
                            </article>
                            <Link to="/emprestimos" className="block bg-green-700 hover:bg-green-800 text-white rounded-2xl p-5 transition-colors shadow-sm">
                                <strong className="block text-lg">Novo empréstimo</strong>
                                <span className="text-sm text-green-100">Registrar livros e gerar termo →</span>
                            </Link>
                            <Link to="/acervo" className="block bg-cyan-700 border border-cyan-600 hover:bg-cyan-800 text-white rounded-2xl p-5 transition-colors shadow-sm">
                                <strong className="block text-lg">Consultar acervo</strong>
                                <span className="text-sm text-cyan-100">Pesquisar títulos e estoque →</span>
                            </Link>
                        </aside>
                    </div>
                </div>
            </main>
        </div>
    );
}
