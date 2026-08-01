import { useState } from "react";
import * as XLSX from "xlsx";
import Sidebar from "./sidebar.tsx";

type Movimento = {
    id: number;
    tipo: string;
    descricao: string;
    criadoEm: string | Date;
    alunoNome?: string;
    livroTitulo?: string;
};

type DadosExportacao = {
    acervo: Livro[];
    ativos: Emprestimo[];
    atrasados: Emprestimo[];
    historico: Emprestimo[];
    movimentacoes: Movimento[];
};

type TipoExportacao = keyof DadosExportacao;

type OpcaoExportacao = {
    tipo: TipoExportacao;
    titulo: string;
    descricao: string;
    categoria: string;
    fundoIcone: string;
    corIcone: string;
    fundoCard: string;
};

const formatarData = (valor: string | Date | null | undefined) =>
    valor ? new Date(valor).toLocaleDateString("pt-BR") : "";

const rotulosStatus: Record<string, string> = {
    LIVRE: "Livre",
    EMPRESTADO: "Emprestado",
    ATIVO: "Ativo",
    ATRASADO: "Atrasado",
    DEVOLVIDO: "Devolvido",
};

const rotulosMovimentacao: Record<string, string> = {
    LIVRO_ADICIONADO: "Livro adicionado",
    EMPRESTIMO_CRIADO: "Empréstimo realizado",
    DEVOLUCAO: "Devolução",
    EMPRESTIMO_EXCLUIDO: "Empréstimo excluído",
};

const opcoes: OpcaoExportacao[] = [
    {
        tipo: "acervo",
        titulo: "Acervo atual",
        descricao: "Todos os títulos cadastrados, estoque e disponibilidade atual.",
        categoria: "Inventário",
        fundoIcone: "bg-cyan-100",
        corIcone: "text-cyan-800",
        fundoCard: "bg-cyan-50 border-cyan-200",
    },
    {
        tipo: "ativos",
        titulo: "Empréstimos ativos",
        descricao: "Empréstimos que permanecem em aberto no período selecionado.",
        categoria: "Circulação",
        fundoIcone: "bg-emerald-100",
        corIcone: "text-emerald-700",
        fundoCard: "bg-emerald-50 border-emerald-200",
    },
    {
        tipo: "historico",
        titulo: "Histórico de empréstimos",
        descricao: "Registro completo, incluindo empréstimos já devolvidos.",
        categoria: "Histórico",
        fundoIcone: "bg-indigo-100",
        corIcone: "text-indigo-700",
        fundoCard: "bg-indigo-50 border-indigo-200",
    },
    {
        tipo: "movimentacoes",
        titulo: "Movimentações",
        descricao: "Livros adicionados, retiradas, devoluções e exclusões.",
        categoria: "Auditoria",
        fundoIcone: "bg-amber-100",
        corIcone: "text-amber-800",
        fundoCard: "bg-amber-50 border-amber-200",
    },
    {
        tipo: "atrasados",
        titulo: "Empréstimos atrasados",
        descricao: "Empréstimos vencidos que precisam de acompanhamento.",
        categoria: "Pendências",
        fundoIcone: "bg-red-100",
        corIcone: "text-red-700",
        fundoCard: "bg-rose-50 border-rose-200",
    },
];

function IconeExportacao({ tipo }: { tipo: TipoExportacao }) {
    const classe = "h-6 w-6";

    if (tipo === "acervo") {
        return (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={classe}>
                <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17H7.5A2.5 2.5 0 0 0 5 21.5v-17Z" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M5 19.5A2.5 2.5 0 0 1 7.5 17H19M9 6h6" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
        );
    }
    if (tipo === "ativos") {
        return (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={classe}>
                <path d="M7 3h10v4H7zM6 5H4v16h16V5h-2" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="m8.5 14 2.3 2.3 4.8-5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }
    if (tipo === "historico") {
        return (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={classe}>
                <path d="M4.5 9A8 8 0 1 1 4 15M4.5 9V4.5M4.5 9H9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 7.5V12l3 2" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
        );
    }
    if (tipo === "movimentacoes") {
        return (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={classe}>
                <path d="M4 7h14m0 0-3-3m3 3-3 3M20 17H6m0 0 3 3m-3-3 3-3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={classe}>
            <path d="M10.2 4.2 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.8 4.2a2.1 2.1 0 0 0-3.6 0Z" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M12 9v4M12 16.5v.1" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

export default function Exportacao() {
    const [inicio, setInicio] = useState("");
    const [fim, setFim] = useState("");
    const [todoPeriodo, setTodoPeriodo] = useState(true);
    const [exportando, setExportando] = useState<TipoExportacao | null>(null);

    const exportar = async (tipo: TipoExportacao, nome: string) => {
        if (!todoPeriodo && !inicio && !fim) {
            alert("Informe ao menos uma data ou marque “Todo o período”.");
            return;
        }
        if (!todoPeriodo && inicio && fim && inicio > fim) {
            alert("A data inicial não pode ser posterior à data final.");
            return;
        }

        setExportando(tipo);
        try {
            const resposta = await window.electronAPI.obterExportacao(
                todoPeriodo ? undefined : inicio || undefined,
                todoPeriodo ? undefined : fim || undefined,
            );
            if (!resposta.success || !resposta.data) {
                alert(resposta.error || "Não foi possível gerar a planilha.");
                return;
            }

            const dados = resposta.data[tipo];
            const linhas =
                tipo === "acervo"
                    ? (dados as Livro[]).map((livro) => ({
                          ID: livro.id,
                          Título: livro.titulo,
                          Autor: livro.autor,
                          ISBN: livro.isbn || "",
                          Editora: livro.editora || "",
                          Edição: livro.numeroEdicao || "",
                          "Estoque total": livro.unidade,
                          Disponíveis: livro.disponiveis,
                          Emprestados: livro.unidade - livro.disponiveis,
                          Status: livro.disponiveis > 0
                              ? "Disponível"
                              : livro.disponiveis < 0
                                ? "Estoque negativo"
                                : "Sem estoque",
                      }))
                    : tipo === "movimentacoes"
                      ? (dados as Movimento[]).map((movimento) => ({
                            Data: formatarData(movimento.criadoEm),
                            Tipo: rotulosMovimentacao[movimento.tipo] || movimento.tipo,
                            Leitor: movimento.alunoNome || "",
                            Livro: movimento.livroTitulo || "",
                            Descrição: movimento.descricao,
                        }))
                      : (dados as Emprestimo[]).map((emprestimo) => ({
                            ID: emprestimo.id,
                            Leitor: emprestimo.aluno.nome,
                            Tipo: emprestimo.aluno.tipo === "PROFESSOR" ? "Professor" : "Aluno",
                            "Turma / identificação": emprestimo.aluno.serie,
                            Livro: emprestimo.livro.titulo,
                            ISBN: emprestimo.livro.isbn || "",
                            "Estoque total": emprestimo.livro.unidade,
                            "Disponíveis atualmente": emprestimo.livro.disponiveis,
                            "Data do empréstimo": formatarData(emprestimo.dataHoraEmprestimo),
                            "Devolução prevista": formatarData(emprestimo.dataDevolucaoPrevista),
                            "Estado no empréstimo": emprestimo.estadoLivro || "Não informado",
                            Status: rotulosStatus[emprestimo.status] || emprestimo.status,
                        }));

            const planilha = XLSX.utils.json_to_sheet(linhas);
            planilha["!cols"] = Object.keys(linhas[0] || { Resultado: "" }).map((coluna) => ({
                wch: Math.min(
                    60,
                    Math.max(
                        coluna.length + 2,
                        ...linhas.map((linha) => String((linha as Record<string, unknown>)[coluna] ?? "").length + 2),
                    ),
                ),
            }));
            const arquivo = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(arquivo, planilha, nome.slice(0, 31));
            const sufixo = todoPeriodo
                ? "todo-periodo"
                : `${inicio || "inicio"}-a-${fim || "hoje"}`;
            XLSX.writeFile(arquivo, `${nome.toLowerCase().replaceAll(" ", "-")}-${sufixo}.xlsx`);
        } catch (erro) {
            console.error("Erro ao exportar planilha:", erro);
            alert("Não foi possível gerar a planilha.");
        } finally {
            setExportando(null);
        }
    };

    return (
        <div className="flex min-h-screen bg-[#eaf0f6] font-sans">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-8 xl:p-10">
                <div className="mx-auto max-w-5xl">
                    <header className="mb-7 rounded-3xl border border-cyan-300 bg-gradient-to-r from-cyan-200 via-sky-100 to-blue-100 p-6 shadow-[0_12px_30px_rgba(8,145,178,0.13)]">
                        <p className="mb-1 text-sm font-semibold tracking-[0.18em] text-cyan-700">RELATÓRIOS</p>
                        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Exportação de dados</h1>
                        <p className="mt-2 text-slate-600">Escolha um período e baixe a planilha desejada no formato Excel.</p>
                    </header>

                    <section className="mb-8 overflow-hidden rounded-2xl border border-cyan-300 bg-cyan-50 shadow-[0_8px_24px_rgba(8,145,178,0.1)]">
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-200 bg-cyan-100/80 p-5 sm:p-6">
                            <div className="flex items-center gap-3">
                                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800">
                                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
                                        <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth="1.8" />
                                        <path d="M8 3v4M16 3v4M3 10h18" strokeWidth="1.8" strokeLinecap="round" />
                                    </svg>
                                </span>
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Período dos dados</h2>
                                    <p className="text-sm text-slate-500">Defina o intervalo que será incluído no arquivo.</p>
                                </div>
                            </div>
                            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-cyan-300 bg-white/80 px-4 py-2.5 shadow-sm">
                                <span className="text-sm font-semibold text-slate-700">Todo o período</span>
                                <input
                                    type="checkbox"
                                    className="peer sr-only"
                                    checked={todoPeriodo}
                                    onChange={(evento) => setTodoPeriodo(evento.target.checked)}
                                />
                                <span className="relative h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-cyan-700 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5" />
                            </label>
                        </div>

                        <div className="p-5 sm:p-6">
                            {!todoPeriodo ? (
                                <div className="flex flex-wrap gap-4">
                                    <label className="min-w-52 flex-1 text-sm font-semibold text-slate-700">
                                        Data inicial
                                        <input
                                            type="date"
                                            className="mt-1.5 block w-full rounded-xl border border-slate-400 bg-white px-3.5 py-2.5 shadow-sm outline-none transition focus:border-cyan-700 focus:ring-4 focus:ring-cyan-200"
                                            value={inicio}
                                            max={fim || undefined}
                                            onChange={(evento) => setInicio(evento.target.value)}
                                        />
                                    </label>
                                    <label className="min-w-52 flex-1 text-sm font-semibold text-slate-700">
                                        Data final
                                        <input
                                            type="date"
                                            className="mt-1.5 block w-full rounded-xl border border-slate-400 bg-white px-3.5 py-2.5 shadow-sm outline-none transition focus:border-cyan-700 focus:ring-4 focus:ring-cyan-200"
                                            value={fim}
                                            min={inicio || undefined}
                                            onChange={(evento) => setFim(evento.target.value)}
                                        />
                                    </label>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 rounded-xl bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-700 text-xs font-bold text-white">✓</span>
                                    A planilha reunirá todos os registros disponíveis no sistema.
                                </div>
                            )}
                            <p className="mt-4 text-sm leading-relaxed text-slate-500">
                                O período filtra empréstimos pela data de registro e movimentações pela data do evento. O acervo atual sempre representa a situação de hoje.
                            </p>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-slate-300 bg-slate-200/70 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                        <div>
                            <h2 className="text-2xl font-semibold text-slate-900">Planilhas disponíveis</h2>
                            <p className="mt-1 text-sm text-slate-500">Selecione um relatório para gerar o arquivo .xlsx.</p>
                        </div>
                        <span className="rounded-full border border-sky-200 bg-sky-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                            {opcoes.length} opções
                        </span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        {opcoes.map((opcao) => {
                            const gerando = exportando === opcao.tipo;
                            return (
                                <button
                                    key={opcao.tipo}
                                    type="button"
                                    disabled={exportando !== null}
                                    onClick={() => exportar(opcao.tipo, opcao.titulo)}
                                    className={`group flex min-h-56 cursor-pointer flex-col rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-500 hover:shadow-lg disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0 ${opcao.fundoCard}`}
                                >
                                    <div className="mb-5 flex items-start justify-between gap-4">
                                        <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${opcao.fundoIcone} ${opcao.corIcone}`}>
                                            {gerando ? (
                                                <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            ) : (
                                                <IconeExportacao tipo={opcao.tipo} />
                                            )}
                                        </span>
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                            {opcao.categoria}
                                        </span>
                                    </div>
                                    <strong className="text-xl font-semibold text-slate-900">
                                        {gerando ? "Gerando planilha..." : opcao.titulo}
                                    </strong>
                                    <span className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{opcao.descricao}</span>
                                    <span className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-semibold text-cyan-800">
                                        <span>{gerando ? "Preparando arquivo" : "Baixar planilha Excel"}</span>
                                        <span aria-hidden="true" className="text-lg transition-transform group-hover:translate-x-1">→</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
