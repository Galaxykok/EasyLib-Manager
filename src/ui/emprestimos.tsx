import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const formatarData = (valor: Date | string | null | undefined) =>
    valor ? new Date(valor).toLocaleDateString("pt-BR") : "Sem prazo";

export default function Emprestimos() {
    const [lista, setLista] = useState<Emprestimo[]>([]);
    const [livros, setLivros] = useState<Livro[]>([]);
    const [nome, setNome] = useState("");
    const [serie, setSerie] = useState("");
    const [tipo, setTipo] = useState<"ALUNO" | "PROFESSOR">("ALUNO");
    const [leitorId, setLeitorId] = useState<number | undefined>();
    const [sugestoes, setSugestoes] = useState<Aluno[]>([]);
    const [selecionados, setSelecionados] = useState<number[]>([]);
    const [prazo, setPrazo] = useState("");
    const [busca, setBusca] = useState("");
    const [buscaEmprestimos, setBuscaEmprestimos] = useState("");
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);

    const carregar = async () => {
        setCarregando(true);
        const [emprestimos, acervo] = await Promise.all([
            window.electronAPI.obterEmprestimo(),
            window.electronAPI.obterLivros(),
        ]);
        if (emprestimos.success && emprestimos.data) setLista(emprestimos.data);
        else if (!emprestimos.success) alert(`Erro ao carregar empréstimos: ${emprestimos.error}`);
        if (acervo.success && acervo.data) setLivros(acervo.data);
        else if (!acervo.success) alert(`Erro ao carregar o acervo: ${acervo.error}`);
        setCarregando(false);
    };

    useEffect(() => {
        carregar();
    }, []);

    const procurarLeitor = async (valor: string) => {
        setNome(valor);
        setLeitorId(undefined);
        if (valor.trim().length < 2) {
            setSugestoes([]);
            return;
        }
        const resposta = await window.electronAPI.pesquisarAluno(valor);
        setSugestoes(resposta.data || []);
    };

    const selecionarLeitor = (leitor: Aluno) => {
        setLeitorId(leitor.id);
        setNome(leitor.nome);
        setSerie(leitor.serie);
        setTipo(leitor.tipo);
        setSugestoes([]);
    };

    const salvar = async () => {
        if (!nome.trim() || selecionados.length === 0 || salvando) return;
        setSalvando(true);
        try {
            const resposta = await window.electronAPI.cadastrarEmprestimo({
                leitor: { id: leitorId, nome, serie, tipo },
                livros: selecionados,
                dataDevolucaoPrevista: prazo || null,
            });
            if (!resposta.success) {
                alert(`Erro ao registrar empréstimo: ${resposta.error}`);
                return;
            }
            setNome("");
            setSerie("");
            setLeitorId(undefined);
            setSelecionados([]);
            setPrazo("");
            setSugestoes([]);
            await carregar();
        } finally {
            setSalvando(false);
        }
    };

    const devolver = async (emprestimo: Emprestimo) => {
        const resposta = await window.electronAPI.confirmarDevolucao(emprestimo);
        if (!resposta.success) {
            alert(`Erro ao devolver livro: ${resposta.error}`);
            return;
        }
        await carregar();
    };

    const definirPrazo = (tipoPrazo: "7dias" | "15dias" | "1mes") => {
        const data = new Date();
        if (tipoPrazo === "1mes") {
            const diaOriginal = data.getDate();
            data.setDate(1);
            data.setMonth(data.getMonth() + 1);
            const ultimoDiaDoMes = new Date(
                data.getFullYear(),
                data.getMonth() + 1,
                0,
            ).getDate();
            data.setDate(Math.min(diaOriginal, ultimoDiaDoMes));
        } else {
            data.setDate(data.getDate() + (tipoPrazo === "7dias" ? 7 : 15));
        }
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, "0");
        const dia = String(data.getDate()).padStart(2, "0");
        setPrazo(`${ano}-${mes}-${dia}`);
    };

    const visiveis = livros.filter(
        (livro) =>
            `${livro.titulo} ${livro.autor} ${livro.isbn || ""}`
                .toLowerCase()
                .includes(busca.toLowerCase()),
    );
    const emprestimosVisiveis = lista.filter((emprestimo) =>
        `${emprestimo.aluno.nome} ${emprestimo.aluno.serie} ${emprestimo.livro.titulo} ${emprestimo.livro.isbn || ""}`
            .toLowerCase()
            .includes(buscaEmprestimos.trim().toLowerCase()),
    );

    return (
        <div className="flex min-h-screen bg-white">
            <aside className="w-64 p-6 border-r-8 border-gray-300">
                <nav className="flex flex-col gap-5 text-xl">
                    <Link to="/">Home</Link>
                    <Link to="/acervo">Acervo</Link>
                    <Link className="font-semibold text-cyan-600" to="/emprestimos">Empréstimos</Link>
                    <Link to="/aluno">Alunos</Link>
                    <Link to="/exportacao">Exportação de dados</Link>
                    <Link to="/debug">Debug</Link>
                </nav>
            </aside>

            <main className="flex-1 p-8 max-w-6xl overflow-y-auto">
                <h1 className="text-4xl font-semibold mb-6">Empréstimos</h1>
                <section className="grid lg:grid-cols-2 gap-6 mb-10">
                    <div className="p-5 rounded bg-slate-100">
                        <h2 className="text-xl font-semibold mb-4">Novo empréstimo</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="col-span-2">
                                Nome do leitor
                                <input
                                    className="block w-full border rounded p-2 bg-white"
                                    value={nome}
                                    onChange={(evento) => procurarLeitor(evento.target.value)}
                                />
                            </label>
                            <label>
                                Tipo
                                <select
                                    className="block w-full border rounded p-2 bg-white"
                                    value={tipo}
                                    onChange={(evento) => setTipo(evento.target.value as "ALUNO" | "PROFESSOR")}
                                >
                                    <option value="ALUNO">Aluno</option>
                                    <option value="PROFESSOR">Professor</option>
                                </select>
                            </label>
                            <label>
                                Turma / identificação
                                <input
                                    className="block w-full border rounded p-2 bg-white"
                                    value={serie}
                                    onChange={(evento) => setSerie(evento.target.value)}
                                />
                            </label>
                            <label className="col-span-2">
                                Data prevista (opcional)
                                <input
                                    className="block w-full border rounded p-2 bg-white"
                                    type="date"
                                    value={prazo}
                                    onChange={(evento) => setPrazo(evento.target.value)}
                                />
                                <span className="flex flex-wrap gap-2 mt-2">
                                    <button type="button" onClick={() => definirPrazo("7dias")} className="px-3 py-1 rounded bg-cyan-100 hover:bg-cyan-200 text-cyan-900 cursor-pointer">1 semana</button>
                                    <button type="button" onClick={() => definirPrazo("15dias")} className="px-3 py-1 rounded bg-cyan-100 hover:bg-cyan-200 text-cyan-900 cursor-pointer">15 dias</button>
                                    <button type="button" onClick={() => definirPrazo("1mes")} className="px-3 py-1 rounded bg-cyan-100 hover:bg-cyan-200 text-cyan-900 cursor-pointer">1 mês</button>
                                    {prazo && <button type="button" onClick={() => setPrazo("")} className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300 cursor-pointer">Sem prazo</button>}
                                </span>
                            </label>
                        </div>
                        {sugestoes.length > 0 && (
                            <div className="mt-3 bg-white border rounded p-2">
                                <p className="text-sm text-gray-600">Cadastros encontrados — clique para selecionar:</p>
                                {sugestoes.map((leitor) => (
                                    <button
                                        type="button"
                                        key={leitor.id}
                                        onClick={() => selecionarLeitor(leitor)}
                                        className="block text-left w-full hover:bg-slate-100 p-2 cursor-pointer"
                                    >
                                        {leitor.nome} · {leitor.tipo === "PROFESSOR" ? "Professor" : leitor.serie || "Aluno"}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-5 rounded border">
                        <h2 className="text-xl font-semibold mb-2">Exemplares ({selecionados.length})</h2>
                        <input
                            className="w-full border rounded p-2 mb-3"
                            placeholder="Buscar título, autor ou ISBN"
                            value={busca}
                            onChange={(evento) => setBusca(evento.target.value)}
                        />
                        <div className="max-h-60 overflow-auto space-y-1">
                            {visiveis.map((livro) => (
                                <label key={livro.id} className="flex gap-2 p-2 hover:bg-slate-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selecionados.includes(livro.id)}
                                        onChange={() =>
                                            setSelecionados((atuais) =>
                                                atuais.includes(livro.id)
                                                    ? atuais.filter((id) => id !== livro.id)
                                                    : [...atuais, livro.id],
                                            )
                                        }
                                    />
                                    <span>
                                        {livro.titulo}{" "}
                                        <small className="text-gray-500">
                                            — {livro.autor || "sem autor"} · estoque disponível:{" "}
                                            <span className={livro.disponiveis < 0 ? "text-orange-700 font-semibold" : ""}>
                                                {livro.disponiveis}
                                            </span>
                                            {livro.isbn ? `, ISBN ${livro.isbn}` : ""}
                                        </small>
                                    </span>
                                </label>
                            ))}
                            {!carregando && visiveis.length === 0 && (
                                <p className="text-gray-500 p-2">Nenhum exemplar disponível.</p>
                            )}
                        </div>
                        <button
                            type="button"
                            disabled={!nome.trim() || !selecionados.length || salvando}
                            onClick={salvar}
                            className="mt-4 bg-green-700 hover:bg-green-800 text-white rounded px-5 py-2 disabled:bg-gray-400 cursor-pointer disabled:cursor-not-allowed"
                        >
                            {salvando ? "Registrando..." : "Registrar empréstimo"}
                        </button>
                    </div>
                </section>

                <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                    <div>
                        <h2 className="text-2xl font-semibold">Empréstimos ativos</h2>
                        <p className="text-sm text-gray-500">Empréstimos devolvidos ficam disponíveis somente nas exportações.</p>
                    </div>
                    <label className="w-full sm:w-96">
                        <span className="text-sm text-gray-600">Pesquisar empréstimos ativos</span>
                        <input
                            type="search"
                            value={buscaEmprestimos}
                            onChange={(evento) => setBuscaEmprestimos(evento.target.value)}
                            placeholder="Leitor, turma, livro ou ISBN"
                            className="block w-full border rounded p-2"
                        />
                    </label>
                </div>
                {carregando ? (
                    <p className="text-gray-500">Carregando...</p>
                ) : (
                    <div className="space-y-2">
                        {emprestimosVisiveis.map((emprestimo) => (
                            <div key={emprestimo.id} className="border rounded p-3 flex flex-wrap gap-3 justify-between">
                                <span>
                                    <b>{emprestimo.livro.titulo}</b> — {emprestimo.aluno.nome}
                                    {" · "}Prazo: {formatarData(emprestimo.dataDevolucaoPrevista)}
                                </span>
                                <span className="flex gap-3">
                                    <em>{emprestimo.status}</em>
                                    {emprestimo.status !== "DEVOLVIDO" && (
                                        <button
                                            type="button"
                                            className="text-green-700 hover:underline cursor-pointer"
                                            onClick={() => devolver(emprestimo)}
                                        >
                                            Devolver
                                        </button>
                                    )}
                                </span>
                            </div>
                        ))}
                        {emprestimosVisiveis.length === 0 && (
                            <p className="text-gray-500 py-3">Nenhum empréstimo ativo encontrado.</p>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
