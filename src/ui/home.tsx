import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./sidebar.tsx";

const formatarData = (valor: Date | string | null) =>
    valor ? new Date(valor).toLocaleDateString("pt-BR") : "Sem prazo";

type SituacaoPrazo = "em-dia" | "na-semana" | "atrasado";

const obterLimitesSemanaAtual = () => {
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const diasDesdeSegunda = (inicioHoje.getDay() + 6) % 7;
    const inicioSemana = new Date(inicioHoje);
    inicioSemana.setDate(inicioSemana.getDate() - diasDesdeSegunda);
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(fimSemana.getDate() + 7);
    return { inicioHoje, inicioSemana, fimSemana };
};

const obterSituacaoPrazo = (emprestimo: Emprestimo): SituacaoPrazo => {
    const prazo = emprestimo.dataDevolucaoPrevista
        ? new Date(emprestimo.dataDevolucaoPrevista)
        : null;
    if (!prazo) return "em-dia";

    const dataPrazo = new Date(prazo.getFullYear(), prazo.getMonth(), prazo.getDate());
    const { inicioHoje, inicioSemana, fimSemana } = obterLimitesSemanaAtual();
    if (emprestimo.status === "ATRASADO" || dataPrazo < inicioHoje) return "atrasado";
    if (dataPrazo >= inicioSemana && dataPrazo < fimSemana) return "na-semana";
    return "em-dia";
};

const obterQuantidadeRestante = (emprestimo: Emprestimo) => {
    const registro = emprestimo as Emprestimo & {
        quantidade?: number;
        quantidadeDevolvida?: number;
    };
    if (registro.quantidade === undefined && registro.quantidadeDevolvida === undefined) return null;
    return Math.max(0, (registro.quantidade ?? 1) - (registro.quantidadeDevolvida ?? 0));
};

type TipoIconeEstatistica = "mes" | "hoje" | "livro" | "serie" | "leitor";
type TipoSaudacao = "manha" | "tarde" | "noite";

function IconeEstatistica({ tipo }: { tipo: TipoIconeEstatistica }) {
    const caminhos: Record<TipoIconeEstatistica, ReactNode> = {
        mes: <><path d="m4 16 5-5 4 4 7-8"/><path d="M15 7h5v5"/></>,
        hoje: <><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></>,
        livro: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4Z"/><path d="M5 20a3 3 0 0 1 3-3h11"/></>,
        serie: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m5 12 7 4 7-4M5 16l7 4 7-4"/></>,
        leitor: <><circle cx="12" cy="8" r="3"/><path d="M5 20c.6-4 3-6 7-6s6.4 2 7 6"/></>,
    };
    return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">{caminhos[tipo]}</svg>;
}

function IconeSaudacao({ tipo }: { tipo: TipoSaudacao }) {
    const caminhos: Record<TipoSaudacao, ReactNode> = {
        manha: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
        tarde: <><path d="M4 15h16M6 19h12"/><path d="M8 15a4 4 0 1 1 8 0"/><path d="M12 4v2M5.6 8.2 7 9.6M18.4 8.2 17 9.6"/></>,
        noite: <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"/>,
    };
    return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-9 w-9">{caminhos[tipo]}</svg>;
}

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
        if (hora < 12) return { texto: "Bom dia", tipo: "manha" as TipoSaudacao, classe: "app-welcome-morning", detalhe: "Que seu dia comece com boas histórias." };
        if (hora < 18) return { texto: "Boa tarde", tipo: "tarde" as TipoSaudacao, classe: "app-welcome-afternoon", detalhe: "Uma ótima tarde de leitura e organização." };
        return { texto: "Boa noite", tipo: "noite" as TipoSaudacao, classe: "app-welcome-night", detalhe: "Encerrando mais um dia de conhecimento." };
    }, []);

    const proximos = useMemo(() =>
        [...emprestimos]
            .filter((emprestimo) => emprestimo.dataDevolucaoPrevista && emprestimo.status !== "DEVOLVIDO")
            .sort((a, b) => new Date(a.dataDevolucaoPrevista!).getTime() - new Date(b.dataDevolucaoPrevista!).getTime()),
    [emprestimos]);

    const estatisticas = [
        { rotulo: "Empréstimos no mês", valor: dashboard?.emprestimosMes ?? 0, detalhe: "registros neste mês", icone: "mes" as TipoIconeEstatistica },
        { rotulo: "Empréstimos hoje", valor: dashboard?.emprestimosHoje ?? 0, detalhe: "movimentações hoje", icone: "hoje" as TipoIconeEstatistica },
        { rotulo: "Livro favorito", valor: dashboard?.livroFavorito?.nome || "Sem dados", detalhe: dashboard?.livroFavorito ? `${dashboard.livroFavorito.total} empréstimo(s)` : "neste mês", icone: "livro" as TipoIconeEstatistica },
        { rotulo: "Série em destaque", valor: dashboard?.serieDestaque?.nome || "Sem dados", detalhe: dashboard?.serieDestaque ? `${dashboard.serieDestaque.total} empréstimo(s)` : "neste mês", icone: "serie" as TipoIconeEstatistica },
        { rotulo: "Leitor destaque", valor: dashboard?.alunoDestaque?.nome || "Sem dados", detalhe: dashboard?.alunoDestaque ? `${dashboard.alunoDestaque.total} empréstimo(s)` : "neste mês", icone: "leitor" as TipoIconeEstatistica },
    ];

    return (
        <div className="app-shell flex min-h-screen text-slate-900">
            <Sidebar />
            <main className="app-main flex-1 min-w-0 p-8 xl:p-10 overflow-y-auto">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="app-eyebrow text-xs font-semibold tracking-[0.18em] text-cyan-800">VISÃO GERAL</p>
                            <h2 className="text-2xl font-semibold tracking-tight mt-1">Painel da biblioteca</h2>
                        </div>
                        <span className="px-3 py-1.5 rounded-full bg-cyan-100 border border-cyan-200 text-xs font-semibold text-cyan-900 shadow-sm">Dados deste mês</span>
                    </div>
                    <section className={`app-welcome ${saudacao.classe} p-7 mb-7 text-white`}>
                        <div className="flex items-center justify-between gap-6">
                            <div>
                                <p className="text-sm font-medium text-white/70 mb-1 capitalize">
                                    {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                                </p>
                                <h1 className="text-4xl font-semibold tracking-tight">{saudacao.texto}, {responsavel}!</h1>
                                <p className="text-white/80 mt-2">{saudacao.detalhe}</p>
                            </div>
                            <span className="app-welcome-icon" aria-hidden="true"><IconeSaudacao tipo={saudacao.tipo} /></span>
                        </div>
                    </section>

                    <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-7">
                        {estatisticas.map((item) => (
                            <article key={item.rotulo} className="app-stat-card p-5 transition-colors min-w-0">
                                <div className="app-stat-icon w-10 h-10 rounded-lg flex items-center justify-center mb-4"><IconeEstatistica tipo={item.icone} /></div>
                                <p className="text-sm text-slate-500">{item.rotulo}</p>
                                <strong className="block text-xl mt-1 truncate" title={String(item.valor)}>{item.valor}</strong>
                                <span className="text-xs text-slate-400 mt-1 block">{item.detalhe}</span>
                            </article>
                        ))}
                    </div>

                    <div className="grid xl:grid-cols-[1fr_330px] gap-6">
                        <section className="app-panel rounded-xl overflow-hidden">
                            <header className="flex items-center justify-between px-6 py-5 border-b border-slate-700 bg-slate-800 text-white">
                                <div>
                                    <h2 className="text-xl font-semibold">Próximas devoluções</h2>
                                    <p className="text-sm text-slate-300">Acompanhe os prazos que precisam de atenção.</p>
                                </div>
                                <Link to="/emprestimos" className="text-sm font-semibold text-cyan-300 hover:text-cyan-100">Ver todos →</Link>
                            </header>
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-sky-200 bg-sky-50 px-6 py-3 text-xs font-medium text-slate-600" aria-label="Legenda dos prazos">
                                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Empréstimo em dia</span>
                                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Devolução nesta semana</span>
                                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Devolução atrasada</span>
                            </div>
                            <div className="max-h-[28rem] divide-y divide-sky-200 overflow-y-auto overscroll-contain">
                                {carregando ? (
                                    <p className="p-6 text-slate-500">Carregando painel...</p>
                                ) : proximos.length === 0 ? (
                                    <div className="p-10 text-center text-slate-500">
                                        <span className="text-3xl block mb-2">✓</span>
                                        Nenhuma devolução pendente com prazo definido.
                                    </div>
                                ) : proximos.map((emprestimo) => {
                                    const situacao = obterSituacaoPrazo(emprestimo);
                                    const quantidadeRestante = obterQuantidadeRestante(emprestimo);
                                    const classesSituacao: Record<SituacaoPrazo, { bolinha: string; etiqueta: string; prefixo: string }> = {
                                        "em-dia": {
                                            bolinha: "bg-emerald-500",
                                            etiqueta: "bg-emerald-50 text-emerald-700",
                                            prefixo: "Até ",
                                        },
                                        "na-semana": {
                                            bolinha: "bg-amber-400",
                                            etiqueta: "bg-amber-50 text-amber-700",
                                            prefixo: "Nesta semana · ",
                                        },
                                        atrasado: {
                                            bolinha: "bg-red-500",
                                            etiqueta: "bg-red-50 text-red-700",
                                            prefixo: "Atrasado · ",
                                        },
                                    };
                                    const visual = classesSituacao[situacao];
                                    return (
                                        <div key={emprestimo.id} className="flex items-center gap-4 px-6 py-4 hover:bg-cyan-100/70 transition-colors">
                                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${visual.bolinha}`} />
                                            <div className="min-w-0 flex-1">
                                                <strong className="block truncate">{emprestimo.livro.titulo}</strong>
                                                <span className="text-sm text-slate-500">
                                                    {emprestimo.aluno.nome} · {emprestimo.aluno.tipo === "PROFESSOR" ? "Professor" : emprestimo.aluno.serie || "Sem turma"}
                                                    {quantidadeRestante !== null
                                                        ? ` · ${quantidadeRestante} ${quantidadeRestante === 1 ? "unidade pendente" : "unidades pendentes"}`
                                                        : ""}
                                                </span>
                                            </div>
                                            <span className={`whitespace-nowrap text-sm font-medium px-3 py-1.5 rounded-full ${visual.etiqueta}`}>
                                                {visual.prefixo}{formatarData(emprestimo.dataDevolucaoPrevista)}
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
                            <Link to="/emprestimos" className="app-primary-action app-card-action block text-white p-5 transition-colors">
                                <strong className="block text-lg">Novo empréstimo</strong>
                                <span className="text-sm text-green-100">Registrar livros e gerar termo →</span>
                            </Link>
                            <Link to="/acervo" className="app-card-action app-panel block p-5 transition-colors">
                                <strong className="block text-lg">Consultar acervo</strong>
                                <span className="text-sm text-slate-500">Pesquisar títulos e estoque →</span>
                            </Link>
                        </aside>
                    </div>
                </div>
            </main>
        </div>
    );
}
