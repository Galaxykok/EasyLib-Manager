import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

const diasRestantesBanimento = (leitor: Pick<Aluno, "banidoAte">) => {
    if (!leitor.banidoAte) return 0;
    const diferenca = new Date(leitor.banidoAte).getTime() - Date.now();
    return Number.isFinite(diferenca) && diferenca > 0
        ? Math.max(1, Math.ceil(diferenca / (24 * 60 * 60 * 1000)))
        : 0;
};

const emprestimoAtrasado = (emprestimo: Emprestimo) => {
    if (emprestimo.status === "ATRASADO") return true;
    if (!emprestimo.dataDevolucaoPrevista) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return new Date(emprestimo.dataDevolucaoPrevista).getTime() < hoje.getTime();
};

type ConfirmacoesRegistro = Pick<
    EmprestimoEntrada,
    "confirmarMultiplosTitulos" | "confirmarEmprestimoPendente"
>;

type AvisoRegistro = {
    codigo: "CONFIRMAR_MULTIPLOS_TITULOS" | "CONFIRMAR_EMPRESTIMO_PENDENTE";
    mensagem: string;
    confirmacoes: ConfirmacoesRegistro;
};

type BanimentoPendente = {
    alunoId: number;
    diasRestantes: number;
    leitor: Aluno;
};

type DevolucaoPendente = {
    emprestimo: Emprestimo;
    quantidade: number;
    etapa: "quantidade" | "perguntaPunicao" | "dadosPunicao";
    diasPunicao: number;
    motivoPunicao: string;
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
    const [quantidades, setQuantidades] = useState<Record<number, number>>({});
    const [estadosLivros, setEstadosLivros] = useState<Record<number, string>>({});
    const [prazo, setPrazo] = useState("");
    const [busca, setBusca] = useState("");
    const [buscaEmprestimos, setBuscaEmprestimos] = useState("");
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [salvandoDevolucao, setSalvandoDevolucao] = useState(false);
    const [removendoBanimento, setRemovendoBanimento] = useState(false);
    const [termoDisponivel, setTermoDisponivel] = useState<TermoGerado | null>(null);
    const [avisoRegistro, setAvisoRegistro] = useState<AvisoRegistro | null>(null);
    const [banimentoPendente, setBanimentoPendente] = useState<BanimentoPendente | null>(null);
    const [devolucaoPendente, setDevolucaoPendente] = useState<DevolucaoPendente | null>(null);
    const [erroTela, setErroTela] = useState("");
    const [mensagemTela, setMensagemTela] = useState("");
    const mainRef = useRef<HTMLElement>(null);
    const listaLivrosRef = useRef<HTMLDivElement>(null);
    const posicaoScrollRef = useRef<number | null>(null);
    const buscaLeitorRef = useRef(0);

    const carregar = async () => {
        setCarregando(true);
        setErroTela("");
        try {
            const [emprestimos, acervo] = await Promise.all([
                window.electronAPI.obterEmprestimo(),
                window.electronAPI.obterLivros(),
            ]);
            const erros: string[] = [];
            if (emprestimos.success && emprestimos.data) setLista(emprestimos.data);
            else if (!emprestimos.success) erros.push(`Erro ao carregar empréstimos: ${emprestimos.error}`);
            if (acervo.success && acervo.data) setLivros(acervo.data);
            else if (!acervo.success) erros.push(`Erro ao carregar o acervo: ${acervo.error}`);
            if (erros.length > 0) setErroTela(erros.join(" "));
        } catch (erro) {
            setErroTela(
                erro instanceof Error
                    ? `Erro ao atualizar a tela: ${erro.message}`
                    : "Erro inesperado ao atualizar a tela.",
            );
        } finally {
            setCarregando(false);
        }
    };

    useEffect(() => {
        const inicial = window.setTimeout(carregar, 0);
        return () => window.clearTimeout(inicial);
    }, []);

    useEffect(() => {
        listaLivrosRef.current?.scrollTo({ top: 0 });
    }, [busca]);

    useLayoutEffect(() => {
        const posicao = posicaoScrollRef.current;
        const elemento = mainRef.current;
        if (posicao === null || !elemento) return;
        elemento.scrollTop = posicao;
        const quadro = window.requestAnimationFrame(() => {
            elemento.scrollTop = posicao;
            posicaoScrollRef.current = null;
        });
        return () => window.cancelAnimationFrame(quadro);
    }, [selecionados]);

    const ajustarTipo = (novoTipo: "ALUNO" | "PROFESSOR") => {
        setTipo(novoTipo);
        if (novoTipo === "ALUNO") {
            setQuantidades((atuais) => Object.fromEntries(
                Object.keys(atuais).map((id) => [Number(id), 1]),
            ));
        }
    };

    const preencherLeitor = (leitor: Aluno) => {
        setLeitorId(leitor.id);
        setNome(leitor.nome);
        setSerie(leitor.serie);
        ajustarTipo(leitor.tipo);
        setSugestoes([]);
    };

    const limparLeitor = () => {
        buscaLeitorRef.current += 1;
        setLeitorId(undefined);
        setNome("");
        setSerie("");
        ajustarTipo("ALUNO");
        setSugestoes([]);
    };

    const procurarLeitor = async (valor: string) => {
        setNome(valor);
        if (leitorId) {
            setSugestoes([]);
            return;
        }
        const identificadorBusca = ++buscaLeitorRef.current;
        if (valor.trim().length < 2) {
            setSugestoes([]);
            return;
        }
        try {
            const resposta = await window.electronAPI.pesquisarAluno(valor);
            if (identificadorBusca !== buscaLeitorRef.current) return;
            if (!resposta.success) {
                setSugestoes([]);
                setErroTela(`Erro ao localizar leitores: ${resposta.error}`);
                return;
            }
            setSugestoes(resposta.data || []);
        } catch (erro) {
            if (identificadorBusca !== buscaLeitorRef.current) return;
            setSugestoes([]);
            setErroTela(erro instanceof Error ? erro.message : "Não foi possível pesquisar os leitores.");
        }
    };

    const selecionarLeitor = (leitor: Aluno) => {
        setErroTela("");
        const diasRestantes = diasRestantesBanimento(leitor);
        if (diasRestantes > 0) {
            setSugestoes([]);
            setBanimentoPendente({ alunoId: leitor.id, diasRestantes, leitor });
            return;
        }
        preencherLeitor(leitor);
    };

    const removerBanimento = async () => {
        if (!banimentoPendente || removendoBanimento) return;
        setRemovendoBanimento(true);
        setErroTela("");
        try {
            const resposta = await window.electronAPI.removerBanimento({
                alunoId: banimentoPendente.alunoId,
                motivo: "Removido pelo bibliotecário durante a seleção para empréstimo",
            });
            if (!resposta.success) {
                setErroTela(`Erro ao remover o banimento: ${resposta.error}`);
                return;
            }
            preencherLeitor(resposta.data || {
                ...banimentoPendente.leitor,
                banidoAte: null,
                motivoBanimento: null,
            });
            setBanimentoPendente(null);
            setMensagemTela("Banimento removido. O leitor já pode realizar o empréstimo.");
        } catch (erro) {
            setErroTela(erro instanceof Error ? erro.message : "Não foi possível remover o banimento.");
        } finally {
            setRemovendoBanimento(false);
        }
    };

    const alternarLivro = (livro: Livro) => {
        const selecionado = selecionados.includes(livro.id);
        if (!selecionado && livro.disponiveis <= 0) return;
        posicaoScrollRef.current = mainRef.current?.scrollTop ?? null;
        setSelecionados((atuais) =>
            selecionado ? atuais.filter((id) => id !== livro.id) : [...atuais, livro.id],
        );
        setQuantidades((atuais) => {
            const novas = { ...atuais };
            if (selecionado) delete novas[livro.id];
            else novas[livro.id] = 1;
            return novas;
        });
        setEstadosLivros((atuais) => {
            const novos = { ...atuais };
            if (selecionado) delete novos[livro.id];
            else novos[livro.id] = "";
            return novos;
        });
    };

    const salvar = async (confirmacoes: ConfirmacoesRegistro = {}) => {
        if (!nome.trim() || selecionados.length === 0 || salvando) return;
        setTermoDisponivel(null);
        setErroTela("");
        setMensagemTela("");
        setSalvando(true);
        try {
            const resposta = await window.electronAPI.cadastrarEmprestimo({
                leitor: { id: leitorId, nome: nome.trim(), serie: normalizarSerie(serie), tipo },
                itens: selecionados.map((livroId) => ({
                    livroId,
                    quantidade: tipo === "ALUNO" ? 1 : quantidades[livroId] || 1,
                    estadoLivro: estadosLivros[livroId]?.trim() || "",
                })),
                dataDevolucaoPrevista: prazo || null,
                ...confirmacoes,
            });
            if (!resposta.success) {
                if (
                    resposta.codigo === "CONFIRMAR_MULTIPLOS_TITULOS"
                    || resposta.codigo === "CONFIRMAR_EMPRESTIMO_PENDENTE"
                ) {
                    setAvisoRegistro({
                        codigo: resposta.codigo,
                        mensagem: resposta.error || "Deseja prosseguir com este empréstimo?",
                        confirmacoes,
                    });
                    return;
                }
                if (resposta.codigo === "LEITOR_BANIDO" && resposta.alunoId) {
                    setBanimentoPendente({
                        alunoId: resposta.alunoId,
                        diasRestantes: resposta.diasRestantes || 1,
                        leitor: {
                            id: resposta.alunoId,
                            nome: nome.trim(),
                            serie: normalizarSerie(serie),
                            tipo,
                            ativo: true,
                            banidoAte: null,
                            motivoBanimento: null,
                        },
                    });
                    return;
                }
                setErroTela(`Erro ao registrar empréstimo: ${resposta.error}`);
                return;
            }

            const termo = resposta.data?.termo;
            setNome("");
            setSerie("");
            setTipo("ALUNO");
            setLeitorId(undefined);
            setSelecionados([]);
            setQuantidades({});
            setEstadosLivros({});
            setPrazo("");
            setSugestoes([]);
            setAvisoRegistro(null);
            setMensagemTela("Empréstimo registrado com sucesso.");
            if (termo) setTermoDisponivel(termo);
            await carregar();
        } catch (erro) {
            setErroTela(erro instanceof Error ? erro.message : "Não foi possível registrar o empréstimo.");
        } finally {
            setSalvando(false);
        }
    };

    const confirmarAvisoRegistro = () => {
        if (!avisoRegistro) return;
        const confirmacoes = {
            ...avisoRegistro.confirmacoes,
            ...(avisoRegistro.codigo === "CONFIRMAR_MULTIPLOS_TITULOS"
                ? { confirmarMultiplosTitulos: true }
                : { confirmarEmprestimoPendente: true }),
        };
        setAvisoRegistro(null);
        void salvar(confirmacoes);
    };

    const abrirDevolucao = (emprestimo: Emprestimo) => {
        const restante = Math.max(0, emprestimo.quantidade - emprestimo.quantidadeDevolvida);
        if (restante === 0) return;
        setErroTela("");
        setMensagemTela("");
        setDevolucaoPendente({
            emprestimo,
            quantidade: restante,
            etapa: "quantidade",
            diasPunicao: 1,
            motivoPunicao: "Devolução realizada após o prazo",
        });
    };

    const concluirDevolucao = async (aplicarPunicao: boolean) => {
        if (!devolucaoPendente || salvandoDevolucao) return;
        const restante = devolucaoPendente.emprestimo.quantidade
            - devolucaoPendente.emprestimo.quantidadeDevolvida;
        if (
            !Number.isSafeInteger(devolucaoPendente.quantidade)
            || devolucaoPendente.quantidade < 1
            || devolucaoPendente.quantidade > restante
        ) {
            setErroTela(`Informe uma quantidade entre 1 e ${restante}.`);
            return;
        }
        if (
            aplicarPunicao
            && (!Number.isSafeInteger(devolucaoPendente.diasPunicao)
                || devolucaoPendente.diasPunicao < 1
                || !devolucaoPendente.motivoPunicao.trim())
        ) {
            setErroTela("Informe a quantidade de dias e o motivo da punição.");
            return;
        }

        setSalvandoDevolucao(true);
        setErroTela("");
        try {
            const resposta = await window.electronAPI.confirmarDevolucao({
                id: devolucaoPendente.emprestimo.id,
                quantidade: devolucaoPendente.quantidade,
                punicao: aplicarPunicao
                    ? {
                        dias: devolucaoPendente.diasPunicao,
                        motivo: devolucaoPendente.motivoPunicao.trim(),
                    }
                    : null,
            });
            if (!resposta.success) {
                setErroTela(`Erro ao registrar a devolução: ${resposta.error}`);
                return;
            }
            const devolucaoCompleta = resposta.data?.devolucaoCompleta;
            setDevolucaoPendente(null);
            setMensagemTela(
                devolucaoCompleta
                    ? "Devolução concluída com sucesso."
                    : "Devolução parcial registrada com sucesso.",
            );
            await carregar();
        } catch (erro) {
            setErroTela(erro instanceof Error ? erro.message : "Não foi possível registrar a devolução.");
        } finally {
            setSalvandoDevolucao(false);
        }
    };

    const avancarDevolucao = () => {
        if (!devolucaoPendente) return;
        const restante = devolucaoPendente.emprestimo.quantidade
            - devolucaoPendente.emprestimo.quantidadeDevolvida;
        if (
            !Number.isSafeInteger(devolucaoPendente.quantidade)
            || devolucaoPendente.quantidade < 1
            || devolucaoPendente.quantidade > restante
        ) {
            setErroTela(`Informe uma quantidade entre 1 e ${restante}.`);
            return;
        }
        if (
            devolucaoPendente.emprestimo.aluno.tipo === "ALUNO"
            && emprestimoAtrasado(devolucaoPendente.emprestimo)
        ) {
            setDevolucaoPendente((atual) => atual ? { ...atual, etapa: "perguntaPunicao" } : atual);
            return;
        }
        void concluirDevolucao(false);
    };

    const definirPrazo = (tipoPrazo: "7dias" | "15dias" | "1mes") => {
        const data = new Date();
        if (tipoPrazo === "1mes") {
            const diaOriginal = data.getDate();
            data.setDate(1);
            data.setMonth(data.getMonth() + 1);
            const ultimoDiaDoMes = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
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
            .toLocaleLowerCase("pt-BR")
            .includes(busca.trim().toLocaleLowerCase("pt-BR")),
    );
    const termoBuscaEmprestimos = buscaEmprestimos.trim();
    const emprestimosVisiveis = lista.filter((emprestimo) => {
        const correspondeAosDados = `${emprestimo.aluno.nome} ${emprestimo.aluno.serie} ${emprestimo.livro.titulo} ${emprestimo.livro.isbn || ""}`
            .toLocaleLowerCase("pt-BR")
            .includes(termoBuscaEmprestimos.toLocaleLowerCase("pt-BR"));
        const correspondeATurma = chaveSerie(emprestimo.aluno.serie).includes(chaveSerie(termoBuscaEmprestimos));
        return correspondeAosDados || correspondeATurma;
    });
    const podeRegistrar = Boolean(
        nome.trim()
        && (tipo === "PROFESSOR" || serie.trim())
        && selecionados.length
        && !selecionados.some((id) => {
            const livro = livros.find((item) => item.id === id);
            const quantidade = tipo === "ALUNO" ? 1 : quantidades[id];
            return !estadosLivros[id]?.trim()
                || !livro
                || !Number.isSafeInteger(quantidade)
                || quantidade < 1
                || quantidade > livro.disponiveis;
        })
        && !salvando,
    );

    return (
        <div className="app-shell flex min-h-screen">
            <Sidebar />

            <main
                ref={mainRef}
                className="app-main flex-1 overflow-y-auto p-8 xl:p-10"
                style={{ overflowAnchor: "none" }}
            >
                <div className="mx-auto max-w-6xl">
                    <header className="app-page-header mb-7 p-6">
                        <p className="app-eyebrow mb-1 text-sm font-semibold tracking-[0.18em] text-cyan-700">CIRCULAÇÃO</p>
                        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Empréstimos</h1>
                        <p className="mt-2 text-slate-600">Registre retiradas, acompanhe prazos e gere termos de responsabilidade para alunos.</p>
                    </header>

                    {erroTela && (
                        <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                            <span>{erroTela}</span>
                            <span className="flex shrink-0 items-center gap-2">
                                {erroTela.includes("responsável pela biblioteca") && (
                                    <button
                                        type="button"
                                        onClick={() => navigate("/configuracoes")}
                                        className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
                                    >
                                        Abrir configurações
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setErroTela("")}
                                    aria-label="Fechar aviso de erro"
                                    className="flex h-6 w-6 items-center justify-center rounded text-lg opacity-70 hover:bg-red-100 hover:opacity-100"
                                >
                                    &times;
                                </button>
                            </span>
                        </div>
                    )}

                    {mensagemTela && (
                        <div role="status" className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                            <span>{mensagemTela}</span>
                            <button
                                type="button"
                                onClick={() => setMensagemTela("")}
                                aria-label="Fechar confirmação"
                                className="flex h-6 w-6 items-center justify-center rounded text-lg opacity-70 hover:bg-emerald-100 hover:opacity-100"
                            >
                                &times;
                            </button>
                        </div>
                    )}

                    <section className="mb-8 grid gap-6 lg:grid-cols-2">
                        <article className="app-panel rounded-xl p-6">
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
                                        autoComplete="off"
                                        onChange={(evento) => void procurarLeitor(evento.target.value)}
                                    />
                                </label>

                                {leitorId && (
                                    <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-xs text-cyan-900">
                                        <span>
                                            <strong>Cadastro selecionado.</strong> Alterações em nome, tipo ou turma serão salvas com o empréstimo.
                                        </span>
                                        <button
                                            type="button"
                                            onClick={limparLeitor}
                                            className="rounded-lg border border-cyan-300 bg-white px-2.5 py-1 font-semibold text-cyan-800 hover:bg-cyan-100"
                                        >
                                            Trocar leitor
                                        </button>
                                    </div>
                                )}

                                <label className="text-sm font-semibold text-slate-700">
                                    Tipo
                                    <select
                                        className={`${classeCampo} mt-1.5`}
                                        value={tipo}
                                        onChange={(evento) => ajustarTipo(evento.target.value as "ALUNO" | "PROFESSOR")}
                                    >
                                        <option value="ALUNO">Aluno</option>
                                        <option value="PROFESSOR">Professor</option>
                                    </select>
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Turma / identificação {tipo === "ALUNO" && <span className="font-normal text-red-600">(obrigatória)</span>}
                                    <input
                                        className={`${classeCampo} mt-1.5`}
                                        value={serie}
                                        required={tipo === "ALUNO"}
                                        placeholder={tipo === "PROFESSOR" ? "Ex.: História" : "Ex.: 7º A"}
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
                                        {sugestoes.map((leitor) => {
                                            const banido = diasRestantesBanimento(leitor) > 0;
                                            return (
                                                <button
                                                    type="button"
                                                    key={leitor.id}
                                                    onClick={() => selecionarLeitor(leitor)}
                                                    className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-cyan-50"
                                                >
                                                    <span className={`font-medium ${banido ? "text-red-700" : "text-slate-800"}`}>
                                                        {leitor.nome}
                                                    </span>
                                                    <span className={`text-xs ${banido ? "font-semibold text-red-600" : "text-slate-500"}`}>
                                                        {banido
                                                            ? `Banido por mais ${diasRestantesBanimento(leitor)} dia(s)`
                                                            : leitor.tipo === "PROFESSOR" ? "Professor" : leitor.serie || "Aluno"}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </article>

                        <article className="app-panel rounded-xl p-6">
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

                            <div
                                ref={listaLivrosRef}
                                className="max-h-72 space-y-2 overflow-auto overscroll-contain p-1"
                                style={{ overflowAnchor: "none" }}
                            >
                                {visiveis.map((livro) => {
                                    const selecionado = selecionados.includes(livro.id);
                                    const indisponivel = !selecionado && livro.disponiveis <= 0;
                                    return (
                                        <button
                                            type="button"
                                            role="checkbox"
                                            aria-checked={selecionado}
                                            disabled={indisponivel}
                                            key={livro.id}
                                            onClick={() => alternarLivro(livro)}
                                            className={`group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                                                selecionado
                                                    ? "app-selected-option cursor-pointer border-cyan-300"
                                                    : indisponivel
                                                      ? "cursor-not-allowed border-[var(--app-border)] bg-[var(--app-surface-raised)] opacity-55"
                                                      : "cursor-pointer border-[var(--app-border)] bg-[var(--app-surface-raised)] hover:border-cyan-400 hover:shadow-md hover:ring-1 hover:ring-cyan-400/30"
                                            }`}
                                        >
                                            <span
                                                aria-hidden="true"
                                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition group-focus-visible:ring-4 group-focus-visible:ring-cyan-300/60 ${
                                                    selecionado
                                                        ? "border-white bg-white text-cyan-700 shadow-sm"
                                                        : "border-slate-400 bg-[var(--app-surface)] text-transparent group-hover:border-cyan-500"
                                                }`}
                                            >
                                                <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5">
                                                    <path d="m4 10 3.5 3.5L16 5.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className={`block truncate font-semibold ${selecionado ? "text-white" : "text-slate-800"}`}>{livro.titulo}</span>
                                                <span className={`mt-0.5 block text-xs ${selecionado ? "text-cyan-100" : "text-slate-500"}`}>
                                                    {livro.autor || "Autor não informado"}{livro.isbn ? ` · ISBN ${livro.isbn}` : ""}
                                                </span>
                                            </span>
                                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                selecionado
                                                    ? "bg-white/15 text-white ring-1 ring-white/25"
                                                    : livro.disponiveis <= 0
                                                      ? "bg-slate-100 text-slate-600"
                                                      : "bg-emerald-100 text-emerald-700"
                                            }`}>
                                                {Math.max(0, livro.disponiveis)} em estoque
                                            </span>
                                        </button>
                                    );
                                })}
                                {!carregando && visiveis.length === 0 && (
                                    <div className="rounded-xl border border-dashed border-sky-400 bg-sky-100/60 px-4 py-8 text-center text-sm text-slate-600">
                                        Nenhum livro encontrado para esta busca.
                                    </div>
                                )}
                            </div>

                            {selecionados.length > 0 && (
                                <div
                                    className="mt-5 space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/80 p-4"
                                    style={{ overflowAnchor: "none" }}
                                >
                                    <div>
                                        <h3 className="font-semibold text-slate-900">Detalhes da retirada</h3>
                                        <p className="text-xs text-slate-500">
                                            {tipo === "PROFESSOR"
                                                ? "Defina a quantidade e o estado de cada título."
                                                : "Alunos retiram uma unidade de cada título. Informe o estado dos livros."}
                                        </p>
                                    </div>
                                    {selecionados.map((livroId) => {
                                        const livroSelecionado = livros.find((livro) => livro.id === livroId);
                                        if (!livroSelecionado) return null;
                                        return (
                                            <div key={livroId} className="rounded-xl border border-indigo-200 bg-[var(--app-surface-raised)] p-3 text-sm shadow-sm">
                                                <div className="flex flex-wrap items-end justify-between gap-3">
                                                    <div>
                                                        <span className="font-semibold text-slate-800">{livroSelecionado.titulo}</span>
                                                        <span className="mt-0.5 block text-xs text-slate-500">{livroSelecionado.disponiveis} unidade(s) disponível(is)</span>
                                                    </div>
                                                    {tipo === "PROFESSOR" ? (
                                                        <label className="w-32 text-xs font-semibold text-slate-600">
                                                            Quantidade
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                max={livroSelecionado.disponiveis}
                                                                step={1}
                                                                value={quantidades[livroId] || 1}
                                                                onChange={(evento) => {
                                                                    const valor = Math.trunc(Number(evento.target.value));
                                                                    setQuantidades((atuais) => ({
                                                                        ...atuais,
                                                                        [livroId]: Math.min(
                                                                            livroSelecionado.disponiveis,
                                                                            Math.max(1, Number.isFinite(valor) ? valor : 1),
                                                                        ),
                                                                    }));
                                                                }}
                                                                className={`${classeCampo} mt-1 py-2`}
                                                            />
                                                        </label>
                                                    ) : (
                                                        <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">1 unidade</span>
                                                    )}
                                                </div>
                                                <label className="mt-3 block font-semibold text-slate-700">
                                                    Estado de conservação
                                                    <input
                                                        type="text"
                                                        value={estadosLivros[livroId] || ""}
                                                        onChange={(evento) => setEstadosLivros((atuais) => ({ ...atuais, [livroId]: evento.target.value }))}
                                                        placeholder="Descreva o estado do livro"
                                                        className={`${classeCampo} mt-1.5`}
                                                    />
                                                </label>
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
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <button
                                type="button"
                                disabled={!podeRegistrar}
                                onClick={() => void salvar()}
                                className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3 font-semibold transition-all ${
                                    podeRegistrar
                                        ? "app-primary-action cursor-pointer border-cyan-500 text-white"
                                        : "cursor-not-allowed border-[var(--app-border)] bg-[var(--app-surface-raised)] text-slate-500 opacity-70 shadow-none"
                                }`}
                            >
                                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth="2">
                                    <path d="M5 4.5h10.5A2.5 2.5 0 0 1 18 7v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5Z" strokeLinejoin="round" />
                                    <path d="M5 17a2.5 2.5 0 0 1 2.5-2.5H18M14.5 7.5v4m-2-2h4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                {salvando ? "Registrando..." : "Registrar empréstimo"}
                            </button>
                        </article>
                    </section>

                    <section className="app-panel-muted overflow-hidden rounded-xl">
                        <header className="app-search-panel flex flex-wrap items-end justify-between gap-5 border-x-0 border-t-0 p-6">
                            <div>
                                <div className="mb-1 flex items-center gap-2">
                                    <h2 className="text-2xl font-semibold text-slate-900">Empréstimos ativos</h2>
                                    <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-bold text-cyan-800">{lista.length}</span>
                                </div>
                                <p className="text-sm text-slate-500">Devoluções podem ser registradas por título e por quantidade.</p>
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
                                    const restante = Math.max(0, emprestimo.quantidade - emprestimo.quantidadeDevolvida);
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
                                                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                                                    <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-cyan-800">Retiradas: {emprestimo.quantidade}</span>
                                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">Devolvidas: {emprestimo.quantidadeDevolvida}</span>
                                                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">Restantes: {restante}</span>
                                                </div>
                                                {emprestimo.estadoLivro && (
                                                    <p className="mt-3 text-xs text-slate-500">
                                                        <span className="font-semibold text-slate-600">Estado na retirada:</span> {emprestimo.estadoLivro}
                                                    </p>
                                                )}
                                            </div>
                                            {restante > 0 && (
                                                <button
                                                    type="button"
                                                    className="w-full cursor-pointer rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 md:w-auto"
                                                    onClick={() => abrirDevolucao(emprestimo)}
                                                >
                                                    Registrar devolução
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

            {avisoRegistro && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
                    <section role="dialog" aria-modal="true" aria-labelledby="titulo-aviso-emprestimo" className="app-panel w-full max-w-md rounded-2xl p-6 shadow-2xl">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Confirmação necessária</p>
                        <h2 id="titulo-aviso-emprestimo" className="mt-1 text-xl font-semibold text-slate-900">Confirmar empréstimo</h2>
                        <p className="mt-3 leading-relaxed text-slate-600">{avisoRegistro.mensagem}</p>
                        <div className="mt-6 flex justify-end gap-2">
                            <button type="button" onClick={() => setAvisoRegistro(null)} className="rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-300">
                                Não, voltar
                            </button>
                            <button type="button" onClick={confirmarAvisoRegistro} className="app-primary-action rounded-xl px-4 py-2.5 text-sm font-semibold text-white">
                                Sim, prosseguir
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {banimentoPendente && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
                    <section role="dialog" aria-modal="true" aria-labelledby="titulo-banimento-emprestimo" className="app-panel w-full max-w-md rounded-2xl p-6 shadow-2xl">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-700">Leitor impedido</p>
                        <h2 id="titulo-banimento-emprestimo" className="mt-1 text-xl font-semibold text-slate-900">Banimento ativo</h2>
                        <p className="mt-3 leading-relaxed text-slate-600">
                            Esse aluno está banido por mais {banimentoPendente.diasRestantes} dia(s), deseja remover o banimento?
                        </p>
                        {banimentoPendente.leitor.motivoBanimento && (
                            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                                <strong>Motivo:</strong> {banimentoPendente.leitor.motivoBanimento}
                            </p>
                        )}
                        {erroTela && (
                            <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
                                {erroTela}
                            </p>
                        )}
                        <div className="mt-6 flex justify-end gap-2">
                            <button type="button" disabled={removendoBanimento} onClick={() => setBanimentoPendente(null)} className="rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-300">
                                Manter banimento
                            </button>
                            <button type="button" disabled={removendoBanimento} onClick={() => void removerBanimento()} className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60">
                                {removendoBanimento ? "Removendo..." : "Sim, remover banimento"}
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {devolucaoPendente && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
                    <section role="dialog" aria-modal="true" aria-labelledby="titulo-devolucao" className="app-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Devolução</p>
                        <h2 id="titulo-devolucao" className="mt-1 text-xl font-semibold text-slate-900">
                            {devolucaoPendente.emprestimo.livro.titulo}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">Leitor: {devolucaoPendente.emprestimo.aluno.nome}</p>
                        {erroTela && (
                            <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
                                {erroTela}
                            </p>
                        )}

                        {devolucaoPendente.etapa === "quantidade" && (
                            <div className="mt-5">
                                <label className="block text-sm font-semibold text-slate-700">
                                    Quantidade devolvida agora
                                    <input
                                        type="number"
                                        min={1}
                                        max={devolucaoPendente.emprestimo.quantidade - devolucaoPendente.emprestimo.quantidadeDevolvida}
                                        step={1}
                                        value={devolucaoPendente.quantidade}
                                        onChange={(evento) => {
                                            setErroTela("");
                                            setDevolucaoPendente((atual) => atual ? {
                                                ...atual,
                                                quantidade: Math.trunc(Number(evento.target.value)),
                                            } : atual);
                                        }}
                                        className={`${classeCampo} mt-1.5`}
                                    />
                                </label>
                                <p className="mt-2 text-xs text-slate-500">
                                    Restam {devolucaoPendente.emprestimo.quantidade - devolucaoPendente.emprestimo.quantidadeDevolvida} unidade(s) deste título.
                                </p>
                                <div className="mt-6 flex justify-end gap-2">
                                    <button type="button" onClick={() => setDevolucaoPendente(null)} className="rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-300">Cancelar</button>
                                    <button type="button" disabled={salvandoDevolucao} onClick={avancarDevolucao} className="app-primary-action rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                                        {devolucaoPendente.emprestimo.aluno.tipo === "ALUNO" && emprestimoAtrasado(devolucaoPendente.emprestimo)
                                            ? "Continuar"
                                            : salvandoDevolucao ? "Salvando..." : "Confirmar devolução"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {devolucaoPendente.etapa === "perguntaPunicao" && (
                            <div className="mt-5">
                                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
                                    Este livro está atrasado. Deseja aplicar uma punição ao aluno?
                                </div>
                                <div className="mt-6 flex flex-wrap justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setDevolucaoPendente((atual) => atual ? { ...atual, etapa: "quantidade" } : atual)}
                                        className="rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-300"
                                    >
                                        Voltar
                                    </button>
                                    <button
                                        type="button"
                                        disabled={salvandoDevolucao}
                                        onClick={() => void concluirDevolucao(false)}
                                        className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                                    >
                                        {salvandoDevolucao ? "Salvando..." : "Não aplicar"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDevolucaoPendente((atual) => atual ? { ...atual, etapa: "dadosPunicao" } : atual)}
                                        className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800"
                                    >
                                        Sim, aplicar punição
                                    </button>
                                </div>
                            </div>
                        )}

                        {devolucaoPendente.etapa === "dadosPunicao" && (
                            <div className="mt-5 space-y-4">
                                <label className="block text-sm font-semibold text-slate-700">
                                    Dias sem poder realizar empréstimos
                                    <input
                                        type="number"
                                        min={1}
                                        max={3650}
                                        step={1}
                                        value={devolucaoPendente.diasPunicao}
                                        onChange={(evento) => {
                                            setErroTela("");
                                            setDevolucaoPendente((atual) => atual ? {
                                                ...atual,
                                                diasPunicao: Math.trunc(Number(evento.target.value)),
                                            } : atual);
                                        }}
                                        className={`${classeCampo} mt-1.5`}
                                    />
                                </label>
                                <label className="block text-sm font-semibold text-slate-700">
                                    Motivo da punição
                                    <textarea
                                        rows={3}
                                        value={devolucaoPendente.motivoPunicao}
                                        onChange={(evento) => {
                                            setErroTela("");
                                            setDevolucaoPendente((atual) => atual ? {
                                                ...atual,
                                                motivoPunicao: evento.target.value,
                                            } : atual);
                                        }}
                                        className={`${classeCampo} mt-1.5 resize-none`}
                                    />
                                </label>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        disabled={salvandoDevolucao}
                                        onClick={() => setDevolucaoPendente((atual) => atual ? { ...atual, etapa: "perguntaPunicao" } : atual)}
                                        className="rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-300"
                                    >
                                        Voltar
                                    </button>
                                    <button
                                        type="button"
                                        disabled={salvandoDevolucao}
                                        onClick={() => void concluirDevolucao(true)}
                                        className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                                    >
                                        {salvandoDevolucao ? "Salvando..." : "Aplicar e concluir"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            )}

            {termoDisponivel && (
                <section
                    role="dialog"
                    aria-modal="false"
                    aria-live="polite"
                    aria-labelledby="titulo-termo-disponivel"
                    className="app-panel fixed bottom-6 right-6 z-[100] w-[min(30rem,calc(100vw-3rem))] rounded-2xl border-2 border-emerald-300 p-5 shadow-2xl"
                >
                    <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" strokeWidth="2.2">
                                <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Empréstimo registrado</p>
                            <h2 id="titulo-termo-disponivel" className="mt-1 text-xl font-semibold text-slate-900">
                                Termo de responsabilidade pronto
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                O termo de {termoDisponivel.nomeAluno} foi gerado. Abra a visualização para conferir e imprimir as duas vias.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setTermoDisponivel(null)}
                            aria-label="Fechar aviso do termo"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        >
                            &times;
                        </button>
                    </div>
                    <div className="mt-5 flex justify-end gap-2 border-t border-emerald-200 pt-4">
                        <button
                            type="button"
                            onClick={() => setTermoDisponivel(null)}
                            className="rounded-xl bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-300"
                        >
                            Agora não
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const termo = termoDisponivel;
                                navigate("/termo-impressao", { state: { termo } });
                            }}
                            className="app-primary-action rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                        >
                            Abrir termo para impressão
                        </button>
                    </div>
                </section>
            )}
        </div>
    );
}
