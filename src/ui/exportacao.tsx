import { useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";

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

    const opcoes: Array<[TipoExportacao, string, string]> = [
        ["acervo", "Acervo atual", "Todos os exemplares cadastrados e seus status atuais."],
        ["ativos", "Empréstimos ativos", "Empréstimos em aberto dentro do período selecionado."],
        ["historico", "Histórico de empréstimos", "Todos os empréstimos, incluindo os já devolvidos."],
        ["movimentacoes", "Movimentações", "Livros adicionados, empréstimos, devoluções e exclusões."],
        ["atrasados", "Empréstimos atrasados", "Empréstimos vencidos dentro do período selecionado."],
    ];

    return (
        <div className="flex min-h-screen bg-white font-sans">
            <aside className="w-64 p-6 border-r-8 border-gray-300">
                <nav className="flex flex-col gap-5 text-xl text-gray-800">
                    <Link to="/">Home</Link>
                    <Link to="/acervo">Acervo</Link>
                    <Link to="/emprestimos">Empréstimos</Link>
                    <Link to="/aluno">Alunos</Link>
                    <Link className="font-semibold text-cyan-600" to="/exportacao">
                        Exportação de dados
                    </Link>
                    <Link to="/debug">Debug</Link>
                </nav>
            </aside>
            <main className="flex-1 p-10 max-w-5xl">
                <h1 className="text-4xl font-semibold mb-3">Exportação de dados</h1>
                <p className="text-gray-600 mb-8">
                    Escolha um período e baixe a planilha desejada no formato Excel.
                </p>

                <section className="p-5 bg-slate-100 rounded-lg mb-8">
                    <label className="flex items-center gap-2 mb-4">
                        <input
                            type="checkbox"
                            checked={todoPeriodo}
                            onChange={(evento) => setTodoPeriodo(evento.target.checked)}
                        />
                        Todo o período
                    </label>
                    {!todoPeriodo && (
                        <div className="flex flex-wrap gap-4">
                            <label>
                                Data inicial
                                <input
                                    type="date"
                                    className="block border rounded p-2 mt-1 bg-white"
                                    value={inicio}
                                    max={fim || undefined}
                                    onChange={(evento) => setInicio(evento.target.value)}
                                />
                            </label>
                            <label>
                                Data final
                                <input
                                    type="date"
                                    className="block border rounded p-2 mt-1 bg-white"
                                    value={fim}
                                    min={inicio || undefined}
                                    onChange={(evento) => setFim(evento.target.value)}
                                />
                            </label>
                        </div>
                    )}
                    <p className="text-sm text-gray-500 mt-4">
                        O período filtra empréstimos pela data de registro e movimentações pela data do evento.
                        O acervo atual sempre representa a situação de hoje.
                    </p>
                </section>

                <div className="grid md:grid-cols-2 gap-4">
                    {opcoes.map(([tipo, titulo, texto]) => (
                        <button
                            key={tipo}
                            disabled={exportando !== null}
                            onClick={() => exportar(tipo, titulo)}
                            className="text-left p-5 border rounded-lg hover:border-green-700 hover:bg-green-50 disabled:opacity-50"
                        >
                            <strong className="text-xl block">
                                {exportando === tipo ? "Gerando planilha..." : titulo}
                            </strong>
                            <span className="text-gray-600">{texto}</span>
                        </button>
                    ))}
                </div>
            </main>
        </div>
    );
}
