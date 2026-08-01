import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar.tsx";
import { chaveSerie, normalizarSerie } from "../shared/normalizacao.ts";

const formatarData = (valor: Date | string | null | undefined) =>
    valor ? new Date(valor).toLocaleDateString("pt-BR") : "Sem prazo";

const formatarDataHora = (valor: Date | string) =>
    new Date(valor).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

const classeCampo =
    "block w-full rounded-xl border border-slate-400 bg-white px-3.5 py-2.5 text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] outline-none transition placeholder:text-slate-400 focus:border-cyan-700 focus:ring-4 focus:ring-cyan-200";

const obterStatus = (status: Emprestimo["status"]) => {
    if (status === "ATRASADO") {
        return {
            rotulo: "Atrasado",
            classe: "border-red-200 bg-red-50 text-red-700",
            ponto: "bg-red-500",
        };
    }
    if (status === "DEVOLVIDO") {
        return {
            rotulo: "Devolvido",
            classe: "border-slate-200 bg-slate-100 text-slate-600",
            ponto: "bg-slate-400",
        };
    }
    return {
        rotulo: "Em aberto",
        classe: "border-emerald-200 bg-emerald-50 text-emerald-700",
        ponto: "bg-emerald-500",
    };
};

export default function Emprestimos() {
    const navigate = useNavigate();
    const [lista, setLista] = useState<Emprestimo[]>([]);
    const [livros, setLivros] = useState<Livro[]>([]);
    const [nome, setNome] = useState("");
    const [serie, setSerie] = useState("");
    const [tipo, setTipo] = useState<"ALUNO" | "PROFESSOR">("ALUNO");
    const [leitorId, setLeitorId] = useState<number | undefined>();
    const [sugestoes, setSugestoes] = useState<Aluno[]>([]);
    const [selecionados, setSelecionados] = useState<number[]>([]);
    const [estadosLivros, setEstadosLivros] = useState<Record<number, string>>({});
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
        const inicial = window.setTimeout(carregar, 0);
        return () => window.clearTimeout(inicial);
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
                estadosLivros,
                dataDevolucaoPrevista: prazo || null,
            });
            if (!resposta.success) {
                alert(`Erro ao registrar empréstimo: ${resposta.error}`);
                if (resposta.error?.includes("responsável pela biblioteca")) {
                    navigate("/configuracoes");
                }
                return;
            }
            const termo = resposta.data?.termo as TermoGerado | undefined;
            setNome("");
            setSerie("");
            setLeitorId(undefined);
            setSelecionados([]);
            setEstadosLivros({});
            setPrazo("");
            setSugestoes([]);
            await carregar();
            if (termo && window.confirm("Deseja imprimir o termo de responsabilidade?")) {
                navigate("/termo-impressao", { state: { termo } });
            }
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

    const visiveis = livros.filter((livro) =>
        `${livro.titulo} ${livro.autor} ${livro.isbn || ""}`
            .toLowerCase()
            .includes(busca.toLowerCase()),
    );
    const termoBuscaEmprestimos = buscaEmprestimos.trim();
    const emprestimosVisiveis = lista.filter((emprestimo) => {
        const correspondeAosDados = `${emprestimo.aluno.nome} ${emprestimo.aluno.serie} ${emprestimo.livro.titulo} ${emprestimo.livro.isbn || ""}`
            .toLocaleLowerCase("pt-BR")
            .includes(termoBuscaEmprestimos.toLocaleLowerCase("pt-BR"));
        const correspondeATurma = chaveSerie(emprestimo.aluno.serie).includes(chaveSerie(termoBuscaEmprestimos));
        return correspondeAosDados || correspondeATurma;
    });

    return (
        <div className="flex min-h-screen bg-[#eaf0f6]">
            <Sidebar />

            <main className="flex-1 overflow-y-auto p-8 xl:p-10">
                <div className="mx-auto max-w-6xl">
                    <header className="mb-7 rounded-3xl border border-cyan-300 bg-gradient-to-r from-cyan-200 via-sky-100 to-blue-100 p-6 shadow-[0_12px_30px_rgba(8,145,178,0.13)]">
                        <p className="mb-1 text-sm font-semibold tracking-[0.18em] text-cyan-700">CIRCULAÇÃO</p>
                        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Empréstimos</h1>
                        <p className="mt-2 text-slate-600">Registre retiradas, acompanhe prazos e gere termos de responsabilidade.</p>
                    </header>

                    <section className="mb-8 grid gap-6 lg:grid-cols-2">
                        <article className="rounded-2xl border border-cyan-300 bg-cyan-50 p-6 shadow-[0_8px_24px_rgba(8,145,178,0.1)]">
                            <div className="mb-5 flex items-center gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-100 font-bold text-cyan-800">1</span>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Identificação</p>
                                    <h2 className="text-xl font-semibold text-slate-900">Dados do leitor e prazo</h2>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <label className="col-span-2 text-sm font-semibold text-slate-700">
                                    Nome do leitor
                                    <input
                                        className={`${classeCampo} mt-1.5`}
                                        value={nome}
                                        placeholder="Digite para localizar um cadastro"
                                        onChange={(evento) => procurarLeitor(evento.target.value)}
                                    />
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Tipo
                                    <select
                                        className={`${classeCampo} mt-1.5`}
                                        value={tipo}
                                        onChange={(evento) => setTipo(evento.target.value as "ALUNO" | "PROFESSOR")}
                                    >
                                        <option value="ALUNO">Aluno</option>
                                        <option value="PROFESSOR">Professor</option>
                                    </select>
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Turma / identificação
                                    <input
                                        className={`${classeCampo} mt-1.5`}
                                        value={serie}
                                        placeholder="Ex.: 7º A"
                                        onChange={(evento) => setSerie(evento.target.value)}
                                        onBlur={() => setSerie(normalizarSerie(serie))}
                                    />
                                </label>
                                <label className="col-span-2 text-sm font-semibold text-slate-700">
                                    Data prevista <span className="font-normal text-slate-400">(opcional)</span>
                                    <input
                                        className={`${classeCampo} mt-1.5`}
                                        type="date"
                                        value={prazo}
                                        onChange={(evento) => setPrazo(evento.target.value)}
                                    />
                                    <span className="mt-2.5 flex flex-wrap gap-2">
                                        {[
                                            ["7dias", "1 semana"],
                                            ["15dias", "15 dias"],
                                            ["1mes", "1 mês"],
                                        ].map(([valor, rotulo]) => (
                                            <button
                                                type="button"
                                                key={valor}
                                                onClick={() => definirPrazo(valor as "7dias" | "15dias" | "1mes")}
                                                className="cursor-pointer rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 transition hover:border-cyan-300 hover:bg-cyan-100"
                                            >
                                                + {rotulo}
                                            </button>
                                        ))}
                                        {prazo && (
                                            <button
                                                type="button"
                                                onClick={() => setPrazo("")}
                                                className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                                            >
                                                Remover prazo
                                            </button>
                                        )}
                                    </span>
                                </label>
                            </div>

                            {sugestoes.length > 0 && (
                                <div className="mt-4 overflow-hidden rounded-xl border border-cyan-300 bg-cyan-100/70 shadow-sm">
                                    <p className="border-b border-cyan-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-900">
                                        Cadastros encontrados
                                    </p>
                                    <div className="divide-y divide-cyan-100">
                                        {sugestoes.map((leitor) => (
                                            <button
                                                type="button"
                                                key={leitor.id}
                                                onClick={() => selecionarLeitor(leitor)}
                                                className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-cyan-50"
                                            >
                                                <span className="font-medium text-slate-800">{leitor.nome}</span>
                                                <span className="text-xs text-slate-500">
                                                    {leitor.tipo === "PROFESSOR" ? "Professor" : leitor.serie || "Aluno"}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </article>

                        <article className="rounded-2xl border border-sky-300 bg-sky-50 p-6 shadow-[0_8px_24px_rgba(14,165,233,0.1)]">
                            <div className="mb-5 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-100 font-bold text-cyan-800">2</span>
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Acervo</p>
                                        <h2 className="text-xl font-semibold text-slate-900">Selecione os livros</h2>
                                    </div>
                                </div>
                                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                                    {selecionados.length} {selecionados.length === 1 ? "selecionado" : "selecionados"}
                                </span>
                            </div>

                            <div className="relative mb-3">
                                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400">
                                    <circle cx="11" cy="11" r="7" strokeWidth="2" />
                                    <path d="m16 16 4 4" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                <input
                                    className={`${classeCampo} pl-11`}
                                    placeholder="Buscar título, autor ou ISBN"
                                    value={busca}
                                    onChange={(evento) => setBusca(evento.target.value)}
                                />
                            </div>

                            <div className="max-h-64 space-y-2 overflow-auto pr-1">
                                {visiveis.map((livro) => {
                                    const selecionado = selecionados.includes(livro.id);
                                    return (
                                        <label
                                            key={livro.id}
                                            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                                                selecionado
                                                    ? "border-cyan-300 bg-cyan-50 shadow-sm"
                                                    : "border-sky-200 bg-white/80 hover:border-cyan-400 hover:bg-cyan-50"
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                className="mt-1 h-4 w-4 accent-cyan-700"
                                                checked={selecionado}
                                                onChange={() => {
                                                    setSelecionados((atuais) =>
                                                        selecionado
                                                            ? atuais.filter((id) => id !== livro.id)
                                                            : [...atuais, livro.id],
                                                    );
                                                    setEstadosLivros((atuais) => {
                                                        const novos = { ...atuais };
                                                        if (selecionado) delete novos[livro.id];
                                                        else novos[livro.id] = "";
                                                        return novos;
                                                    });
                                                }}
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-semibold text-slate-800">{livro.titulo}</span>
                                                <span className="mt-0.5 block text-xs text-slate-500">
                                                    {livro.autor || "Autor não informado"}{livro.isbn ? ` · ISBN ${livro.isbn}` : ""}
                                                </span>
                                            </span>
                                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                livro.disponiveis < 0
                                                    ? "bg-orange-100 text-orange-800"
                                                    : livro.disponiveis === 0
                                                      ? "bg-slate-100 text-slate-600"
                                                      : "bg-emerald-100 text-emerald-700"
                                            }`}>
                                                {livro.disponiveis} em estoque
                                            </span>
                                        </label>
                                    );
                                })}
                                {!carregando && visiveis.length === 0 && (
                                    <div className="rounded-xl border border-dashed border-sky-400 bg-sky-100/60 px-4 py-8 text-center text-sm text-slate-600">
                                        Nenhum livro encontrado para esta busca.
                                    </div>
                                )}
                            </div>

                            {selecionados.length > 0 && (
                                <div className="mt-5 space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/80 p-4">
                                    <div>
                                        <h3 className="font-semibold text-slate-900">Estado de conservação</h3>
                                        <p className="text-xs text-slate-500">Informe como cada livro está no momento da retirada.</p>
                                    </div>
                                    {selecionados.map((livroId) => {
                                        const livroSelecionado = livros.find((livro) => livro.id === livroId);
                                        if (!livroSelecionado) return null;
                                        return (
                                            <label key={livroId} className="block rounded-xl border border-indigo-200 bg-white/80 p-3 text-sm shadow-sm">
                                                <span className="font-semibold text-slate-800">{livroSelecionado.titulo}</span>
                                                <input
                                                    type="text"
                                                    value={estadosLivros[livroId] || ""}
                                                    onChange={(evento) => setEstadosLivros((atuais) => ({ ...atuais, [livroId]: evento.target.value }))}
                                                    placeholder="Descreva o estado do livro"
                                                    className={`${classeCampo} mt-2`}
                                                />
                                                <span className="mt-2 flex flex-wrap gap-1.5">
                                                    {["Novo", "Bom estado", "Marcas de uso", "Danificado"].map((estado) => (
                                                        <button
                                                            type="button"
                                                            key={estado}
                                                            onClick={() => setEstadosLivros((atuais) => ({ ...atuais, [livroId]: estado }))}
                                                            className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                                                                estadosLivros[livroId] === estado
                                                                    ? "border-cyan-600 bg-cyan-600 text-white"
                                                                    : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300"
                                                            }`}
                                                        >
                                                            {estado}
                                                        </button>
                                                    ))}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}

                            <button
                                type="button"
                                disabled={!nome.trim() || !selecionados.length || selecionados.some((id) => !estadosLivros[id]) || salvando}
                                onClick={salvar}
                                className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                            >
                                {salvando ? "Registrando..." : "Registrar empréstimo"}
                                {!salvando && <span aria-hidden="true">→</span>}
                            </button>
                        </article>
                    </section>

                    <section className="overflow-hidden rounded-2xl border border-slate-300 bg-slate-200/70 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
                        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-cyan-200 bg-cyan-100/80 p-6">
                            <div>
                                <div className="mb-1 flex items-center gap-2">
                                    <h2 className="text-2xl font-semibold text-slate-900">Empréstimos ativos</h2>
                                    <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-bold text-cyan-800">{lista.length}</span>
                                </div>
                                <p className="text-sm text-slate-500">Os empréstimos devolvidos ficam disponíveis somente nas exportações.</p>
                            </div>
                            <label className="w-full sm:w-96">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Pesquisar nos empréstimos</span>
                                <div className="relative">
                                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400">
                                        <circle cx="11" cy="11" r="7" strokeWidth="2" />
                                        <path d="m16 16 4 4" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                    <input
                                        type="search"
                                        value={buscaEmprestimos}
                                        onChange={(evento) => setBuscaEmprestimos(evento.target.value)}
                                        placeholder="Leitor, turma, livro ou ISBN"
                                        className={`${classeCampo} pl-11`}
                                    />
                                </div>
                            </label>
                        </header>

                        {carregando ? (
                            <div className="flex items-center gap-3 p-6 text-sm text-slate-500">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
                                Carregando empréstimos...
                            </div>
                        ) : (
                            <div className="space-y-3 bg-slate-200/70 p-4 sm:p-5">
                                {emprestimosVisiveis.map((emprestimo) => {
                                    const status = obterStatus(emprestimo.status);
                                    return (
                                        <article key={emprestimo.id} className="grid gap-4 rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm transition hover:border-cyan-500 hover:bg-cyan-50 hover:shadow-md md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                                            <div className="min-w-0">
                                                <div className="mb-3 flex flex-wrap items-start justify-between gap-2 md:justify-start">
                                                    <h3 className="truncate text-lg font-semibold text-slate-900">{emprestimo.livro.titulo}</h3>
                                                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${status.classe}`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${status.ponto}`} />
                                                        {status.rotulo}
                                                    </span>
                                                </div>
                                                <div className="grid gap-x-6 gap-y-3 rounded-xl border border-sky-200 bg-white/70 p-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                                                    <div>
                                                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Leitor</span>
                                                        <span className="font-medium text-slate-700">{emprestimo.aluno.nome}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Turma / tipo</span>
                                                        <span>{emprestimo.aluno.tipo === "PROFESSOR" ? "Professor" : emprestimo.aluno.serie || "Aluno"}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Retirada</span>
                                                        <span>{formatarDataHora(emprestimo.dataHoraEmprestimo)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Prazo</span>
                                                        <span className={emprestimo.status === "ATRASADO" ? "font-semibold text-red-700" : ""}>
                                                            {formatarData(emprestimo.dataDevolucaoPrevista)}
                                                        </span>
                                                    </div>
                                                </div>
                                                {emprestimo.estadoLivro && (
                                                    <p className="mt-3 text-xs text-slate-500">
                                                        <span className="font-semibold text-slate-600">Estado na retirada:</span> {emprestimo.estadoLivro}
                                                    </p>
                                                )}
                                            </div>
                                            {emprestimo.status !== "DEVOLVIDO" && (
                                                <button
                                                    type="button"
                                                    className="w-full cursor-pointer rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 md:w-auto"
                                                    onClick={() => devolver(emprestimo)}
                                                >
                                                    Confirmar devolução
                                                </button>
                                            )}
                                        </article>
                                    );
                                })}
                                {emprestimosVisiveis.length === 0 && (
                                    <div className="rounded-xl border border-dashed border-sky-400 bg-sky-100/70 px-6 py-10 text-center">
                                        <p className="font-medium text-slate-700">Nenhum empréstimo ativo encontrado.</p>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {buscaEmprestimos ? "Tente pesquisar por outro termo." : "Os novos empréstimos aparecerão aqui."}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}
