import { useEffect, useMemo, useRef, useState } from "react";
import type {
    ChangeEvent,
    FormEvent,
    KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Sidebar from "./sidebar.tsx";

interface FormularioAluno {
    nome: string;
    serie: string;
    tipo: Aluno["tipo"];
}

interface FeedbackAlunos {
    tipo: "sucesso" | "erro";
    mensagem: string;
}

interface FeedbackHistorico {
    tipo: "sucesso" | "erro" | "info";
    mensagem: string;
}

type AbaEditor = "cadastro" | "historico";

const FORMULARIO_VAZIO: FormularioAluno = {
    nome: "",
    serie: "",
    tipo: "ALUNO",
};

const UM_DIA = 24 * 60 * 60 * 1000;
const FORMATADOR_DATA = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
});
const FORMATADOR_HORA = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
});
const SELETOR_ELEMENTOS_FOCAVEIS = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
].join(",");

const normalizarTexto = (valor: string) =>
    valor
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

const obterDiasRestantesBanimento = (aluno: Aluno) => {
    if (!aluno.banidoAte) return 0;

    const fim = new Date(aluno.banidoAte).getTime();
    if (!Number.isFinite(fim)) return 0;

    return Math.max(0, Math.ceil((fim - Date.now()) / UM_DIA));
};

const alunoCorrespondeBusca = (aluno: Aluno, busca: string) => {
    const termo = normalizarTexto(busca);
    if (!termo) return true;

    const tipo = aluno.tipo === "PROFESSOR" ? "professor" : "aluno";
    const serie = aluno.tipo === "ALUNO" ? aluno.serie : "";
    return normalizarTexto(`${aluno.id} ${aluno.nome} ${serie} ${tipo}`).includes(termo);
};

const formatarDataHoraHistorico = (valor: Date | string) => {
    const dataHora = new Date(valor);
    if (Number.isNaN(dataHora.getTime())) {
        return { data: "Data indisponível", hora: "--:--", iso: undefined };
    }

    return {
        data: FORMATADOR_DATA.format(dataHora),
        hora: FORMATADOR_HORA.format(dataHora),
        iso: dataHora.toISOString(),
    };
};

const obterApresentacaoStatus = (status: HistoricoEmprestimoLeitorItem["status"]) => {
    if (status === "DEVOLVIDO") {
        return { rotulo: "Devolvido", classe: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    }
    if (status === "ATRASADO") {
        return { rotulo: "Atrasado", classe: "border-red-200 bg-red-50 text-red-700" };
    }
    return { rotulo: "Em andamento", classe: "border-amber-200 bg-amber-50 text-amber-700" };
};

const controlarTecladoDialogo = (
    evento: ReactKeyboardEvent<HTMLDivElement>,
    fechar: () => void,
) => {
    if (evento.key === "Escape") {
        evento.preventDefault();
        fechar();
        return;
    }
    if (evento.key !== "Tab") return;

    const elementos = Array.from(
        evento.currentTarget.querySelectorAll<HTMLElement>(SELETOR_ELEMENTOS_FOCAVEIS),
    ).filter((elemento) => elemento.getClientRects().length > 0);

    if (elementos.length === 0) {
        evento.preventDefault();
        return;
    }

    const primeiro = elementos[0];
    const ultimo = elementos[elementos.length - 1];
    const ativo = document.activeElement;

    if (evento.shiftKey && (ativo === primeiro || !evento.currentTarget.contains(ativo))) {
        evento.preventDefault();
        ultimo.focus();
    } else if (!evento.shiftKey && (ativo === ultimo || !evento.currentTarget.contains(ativo))) {
        evento.preventDefault();
        primeiro.focus();
    }
};

export default function Alunos() {
    const [alunos, setAlunos] = useState<Aluno[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [busca, setBusca] = useState("");
    const [feedback, setFeedback] = useState<FeedbackAlunos | null>(null);

    const [modalCadastroAberto, setModalCadastroAberto] = useState(false);
    const [formCadastro, setFormCadastro] = useState<FormularioAluno>(FORMULARIO_VAZIO);
    const [erroCadastro, setErroCadastro] = useState("");
    const [salvandoCadastro, setSalvandoCadastro] = useState(false);

    const [alunoSelecionado, setAlunoSelecionado] = useState<Aluno | null>(null);
    const [abaEditor, setAbaEditor] = useState<AbaEditor>("cadastro");
    const [formEdicao, setFormEdicao] = useState<FormularioAluno>(FORMULARIO_VAZIO);
    const [erroEdicao, setErroEdicao] = useState("");
    const [salvandoEdicao, setSalvandoEdicao] = useState(false);
    const [diasBanimento, setDiasBanimento] = useState("7");
    const [motivoBanimento, setMotivoBanimento] = useState("");
    const [processandoBanimento, setProcessandoBanimento] = useState(false);
    const [confirmandoRemocaoBanimento, setConfirmandoRemocaoBanimento] = useState(false);
    const [historicoLeitor, setHistoricoLeitor] = useState<HistoricoEmprestimosLeitor | null>(null);
    const [carregandoHistorico, setCarregandoHistorico] = useState(false);
    const [erroHistorico, setErroHistorico] = useState("");
    const [exportandoHistorico, setExportandoHistorico] = useState(false);
    const [feedbackHistorico, setFeedbackHistorico] = useState<FeedbackHistorico | null>(null);
    const requisicaoHistoricoAtual = useRef(0);

    const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false);
    const [buscaExclusao, setBuscaExclusao] = useState("");
    const [idsSelecionados, setIdsSelecionados] = useState<number[]>([]);
    const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
    const [arquivando, setArquivando] = useState(false);
    const [erroExclusao, setErroExclusao] = useState("");

    const alunosAtivos = useMemo(
        () => alunos.filter((aluno) => aluno.ativo !== false),
        [alunos],
    );

    const alunosVisiveis = useMemo(
        () => alunosAtivos.filter((aluno) => alunoCorrespondeBusca(aluno, busca)),
        [alunosAtivos, busca],
    );

    const alunosVisiveisExclusao = useMemo(
        () => alunosAtivos.filter((aluno) => alunoCorrespondeBusca(aluno, buscaExclusao)),
        [alunosAtivos, buscaExclusao],
    );

    const idsSelecionadosSet = useMemo(() => new Set(idsSelecionados), [idsSelecionados]);

    const alunosSelecionadosExclusao = useMemo(
        () => alunosAtivos.filter((aluno) => idsSelecionadosSet.has(aluno.id)),
        [alunosAtivos, idsSelecionadosSet],
    );

    const carregarAlunos = async (exibirCarregamento = false) => {
        if (exibirCarregamento) setCarregando(true);

        try {
            const resposta = await window.electronAPI.obterAlunos();
            if (!resposta.success || !resposta.data) {
                setFeedback({
                    tipo: "erro",
                    mensagem: resposta.error || "Não foi possível carregar os alunos e professores.",
                });
                return null;
            }

            setAlunos(resposta.data);
            return resposta.data;
        } catch (erro) {
            console.error("Erro ao carregar alunos:", erro);
            setFeedback({
                tipo: "erro",
                mensagem: "Não foi possível carregar os alunos e professores.",
            });
            return null;
        } finally {
            if (exibirCarregamento) setCarregando(false);
        }
    };

    useEffect(() => {
        let telaAtiva = true;

        window.electronAPI.obterAlunos()
            .then((resposta) => {
                if (!telaAtiva) return;

                if (resposta.success && resposta.data) {
                    setAlunos(resposta.data);
                } else {
                    setFeedback({
                        tipo: "erro",
                        mensagem: resposta.error || "Não foi possível carregar os alunos e professores.",
                    });
                }
            })
            .catch((erro: unknown) => {
                if (!telaAtiva) return;
                console.error("Erro ao carregar alunos:", erro);
                setFeedback({
                    tipo: "erro",
                    mensagem: "Não foi possível carregar os alunos e professores.",
                });
            })
            .finally(() => {
                if (telaAtiva) setCarregando(false);
            });

        return () => {
            telaAtiva = false;
        };
    }, []);

    useEffect(() => {
        if (!feedback) return;
        const temporizador = window.setTimeout(() => setFeedback(null), 6500);
        return () => window.clearTimeout(temporizador);
    }, [feedback]);

    const atualizarFormulario = (
        evento: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
        definir: React.Dispatch<React.SetStateAction<FormularioAluno>>,
    ) => {
        const { name, value } = evento.target;
        definir((atual) => {
            if (name === "tipo") {
                const tipo = value as FormularioAluno["tipo"];
                return {
                    ...atual,
                    tipo,
                    serie: tipo === "PROFESSOR" ? "" : atual.serie,
                };
            }

            return { ...atual, [name]: value };
        });
    };

    const fecharCadastro = () => {
        if (salvandoCadastro) return;
        setModalCadastroAberto(false);
        setFormCadastro(FORMULARIO_VAZIO);
        setErroCadastro("");
    };

    const abrirEditor = (aluno: Aluno) => {
        requisicaoHistoricoAtual.current += 1;
        setAlunoSelecionado(aluno);
        setAbaEditor("cadastro");
        setFormEdicao({
            nome: aluno.nome,
            serie: aluno.tipo === "ALUNO" ? aluno.serie : "",
            tipo: aluno.tipo,
        });
        setErroEdicao("");
        setDiasBanimento("7");
        setMotivoBanimento("");
        setConfirmandoRemocaoBanimento(false);
        setHistoricoLeitor(null);
        setCarregandoHistorico(false);
        setErroHistorico("");
        setExportandoHistorico(false);
        setFeedbackHistorico(null);
    };

    const fecharEditor = () => {
        if (salvandoEdicao || processandoBanimento || exportandoHistorico) return;
        requisicaoHistoricoAtual.current += 1;
        setAlunoSelecionado(null);
        setAbaEditor("cadastro");
        setErroEdicao("");
        setConfirmandoRemocaoBanimento(false);
        setHistoricoLeitor(null);
        setCarregandoHistorico(false);
        setErroHistorico("");
        setFeedbackHistorico(null);
    };

    const carregarHistoricoLeitor = async (alunoId: number) => {
        const numeroRequisicao = requisicaoHistoricoAtual.current + 1;
        requisicaoHistoricoAtual.current = numeroRequisicao;
        setCarregandoHistorico(true);
        setErroHistorico("");
        setFeedbackHistorico(null);

        try {
            const resposta = await window.electronAPI.obterHistoricoLeitor(alunoId);
            if (requisicaoHistoricoAtual.current !== numeroRequisicao) return;

            if (!resposta.success || !resposta.data) {
                setHistoricoLeitor(null);
                setErroHistorico(resposta.error || "Não foi possível carregar o histórico de empréstimos.");
                return;
            }

            setHistoricoLeitor(resposta.data);
        } catch (erro) {
            if (requisicaoHistoricoAtual.current !== numeroRequisicao) return;
            console.error("Erro ao carregar histórico do leitor:", erro);
            setHistoricoLeitor(null);
            setErroHistorico("Não foi possível carregar o histórico de empréstimos.");
        } finally {
            if (requisicaoHistoricoAtual.current === numeroRequisicao) {
                setCarregandoHistorico(false);
            }
        }
    };

    const abrirHistorico = () => {
        if (!alunoSelecionado) return;
        setAbaEditor("historico");
        void carregarHistoricoLeitor(alunoSelecionado.id);
    };

    const handleExportarHistorico = async () => {
        if (!alunoSelecionado) return;

        setExportandoHistorico(true);
        setFeedbackHistorico(null);
        try {
            const resposta = await window.electronAPI.exportarHistoricoLeitor(alunoSelecionado.id);
            if (resposta.cancelado) {
                setFeedbackHistorico({ tipo: "info", mensagem: "Exportação cancelada." });
                return;
            }
            if (!resposta.success) {
                setFeedbackHistorico({
                    tipo: "erro",
                    mensagem: resposta.error || "Não foi possível exportar o histórico.",
                });
                return;
            }

            setFeedbackHistorico({
                tipo: "sucesso",
                mensagem: resposta.caminho
                    ? `Planilha salva em ${resposta.caminho}`
                    : "Planilha exportada com sucesso.",
            });
        } catch (erro) {
            console.error("Erro ao exportar histórico do leitor:", erro);
            setFeedbackHistorico({ tipo: "erro", mensagem: "Não foi possível exportar o histórico." });
        } finally {
            setExportandoHistorico(false);
        }
    };

    const handleCadastrar = async (evento: FormEvent<HTMLFormElement>) => {
        evento.preventDefault();
        setErroCadastro("");

        const nome = formCadastro.nome.trim();
        const serie = formCadastro.tipo === "ALUNO" ? formCadastro.serie.trim() : "";
        if (!nome) {
            setErroCadastro("Informe o nome.");
            return;
        }
        if (formCadastro.tipo === "ALUNO" && !serie) {
            setErroCadastro("Informe a série ou turma do aluno.");
            return;
        }

        setSalvandoCadastro(true);
        try {
            const resposta = await window.electronAPI.cadastrarAluno({
                nome,
                serie,
                tipo: formCadastro.tipo,
            });

            if (!resposta.success) {
                setErroCadastro(resposta.error || "Não foi possível cadastrar o registro.");
                return;
            }

            await carregarAlunos();
            fecharCadastro();
            setFeedback({
                tipo: "sucesso",
                mensagem: `${formCadastro.tipo === "PROFESSOR" ? "Professor" : "Aluno"} cadastrado com sucesso.`,
            });
        } catch (erro) {
            console.error("Erro ao cadastrar aluno ou professor:", erro);
            setErroCadastro("Não foi possível cadastrar o registro.");
        } finally {
            setSalvandoCadastro(false);
        }
    };

    const handleSalvarEdicao = async (evento: FormEvent<HTMLFormElement>) => {
        evento.preventDefault();
        if (!alunoSelecionado) return;

        setErroEdicao("");
        const nome = formEdicao.nome.trim();
        const serie = formEdicao.tipo === "ALUNO" ? formEdicao.serie.trim() : "";

        if (!nome) {
            setErroEdicao("Informe o nome.");
            return;
        }
        if (formEdicao.tipo === "ALUNO" && !serie) {
            setErroEdicao("Informe a série ou turma do aluno.");
            return;
        }

        setSalvandoEdicao(true);
        try {
            const dados: AlunoAtualizacao = {
                id: alunoSelecionado.id,
                nome,
                serie,
                tipo: formEdicao.tipo,
            };
            const resposta = await window.electronAPI.atualizarAluno(dados);

            if (!resposta.success) {
                setErroEdicao(resposta.error || "Não foi possível salvar as alterações.");
                return;
            }

            await carregarAlunos();
            requisicaoHistoricoAtual.current += 1;
            setHistoricoLeitor(null);
            setAlunoSelecionado(null);
            setFeedback({
                tipo: "sucesso",
                mensagem: "Cadastro atualizado com sucesso.",
            });
        } catch (erro) {
            console.error("Erro ao atualizar aluno ou professor:", erro);
            setErroEdicao("Não foi possível salvar as alterações.");
        } finally {
            setSalvandoEdicao(false);
        }
    };

    const handleAplicarBanimento = async () => {
        if (!alunoSelecionado) return;

        setErroEdicao("");
        const dias = Number(diasBanimento);
        const motivo = motivoBanimento.trim();
        if (!Number.isInteger(dias) || dias < 1 || dias > 3650) {
            setErroEdicao("Informe uma quantidade inteira entre 1 e 3650 dias.");
            return;
        }
        if (!motivo) {
            setErroEdicao("Informe o motivo do banimento.");
            return;
        }

        setProcessandoBanimento(true);
        try {
            const resposta = await window.electronAPI.aplicarBanimento({
                alunoId: alunoSelecionado.id,
                dias,
                motivo,
            });

            if (!resposta.success) {
                setErroEdicao(resposta.error || "Não foi possível aplicar o banimento.");
                return;
            }

            const listaAtualizada = await carregarAlunos();
            const atualizado = listaAtualizada?.find((aluno) => aluno.id === alunoSelecionado.id);
            if (atualizado) setAlunoSelecionado(atualizado);
            setMotivoBanimento("");
            setFeedback({
                tipo: "sucesso",
                mensagem: `Banimento aplicado por ${dias} ${dias === 1 ? "dia" : "dias"}.`,
            });
        } catch (erro) {
            console.error("Erro ao aplicar banimento:", erro);
            setErroEdicao("Não foi possível aplicar o banimento.");
        } finally {
            setProcessandoBanimento(false);
        }
    };

    const handleRemoverBanimento = async () => {
        if (!alunoSelecionado) return;

        setErroEdicao("");
        setProcessandoBanimento(true);
        try {
            const resposta = await window.electronAPI.removerBanimento({
                alunoId: alunoSelecionado.id,
                motivo: "Banimento removido manualmente na tela de alunos e professores.",
            });

            if (!resposta.success) {
                setErroEdicao(resposta.error || "Não foi possível remover o banimento.");
                return;
            }

            const listaAtualizada = await carregarAlunos();
            const atualizado = listaAtualizada?.find((aluno) => aluno.id === alunoSelecionado.id);
            if (atualizado) setAlunoSelecionado(atualizado);
            setConfirmandoRemocaoBanimento(false);
            setFeedback({ tipo: "sucesso", mensagem: "Banimento removido com sucesso." });
        } catch (erro) {
            console.error("Erro ao remover banimento:", erro);
            setErroEdicao("Não foi possível remover o banimento.");
        } finally {
            setProcessandoBanimento(false);
        }
    };

    const abrirExclusao = () => {
        setBuscaExclusao("");
        setIdsSelecionados([]);
        setConfirmandoExclusao(false);
        setErroExclusao("");
        setModalExclusaoAberto(true);
    };

    const fecharExclusao = () => {
        if (arquivando) return;
        setModalExclusaoAberto(false);
        setBuscaExclusao("");
        setIdsSelecionados([]);
        setConfirmandoExclusao(false);
        setErroExclusao("");
    };

    const alternarSelecao = (id: number) => {
        setIdsSelecionados((atuais) =>
            atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id],
        );
        setErroExclusao("");
    };

    const handleArquivarAlunos = async () => {
        if (idsSelecionados.length === 0) return;

        setErroExclusao("");
        setArquivando(true);
        try {
            const resposta = await window.electronAPI.arquivarAlunos(idsSelecionados);
            if (!resposta.success) {
                setErroExclusao(resposta.error || "Não foi possível arquivar os cadastros.");
                return;
            }

            const quantidade = resposta.quantidade ?? idsSelecionados.length;
            await carregarAlunos();
            fecharExclusao();
            setFeedback({
                tipo: "sucesso",
                mensagem: `${quantidade} ${quantidade === 1 ? "cadastro arquivado" : "cadastros arquivados"}. O histórico foi preservado.`,
            });
        } catch (erro) {
            console.error("Erro ao arquivar alunos e professores:", erro);
            setErroExclusao("Não foi possível arquivar os cadastros.");
        } finally {
            setArquivando(false);
        }
    };

    const diasRestantesSelecionado = alunoSelecionado
        ? obterDiasRestantesBanimento(alunoSelecionado)
        : 0;

    return (
        <div className="app-shell relative flex h-screen w-screen overflow-hidden font-sans">
            <Sidebar />

            <main className="app-main flex flex-1 flex-col items-center overflow-y-auto p-8 xl:p-10">
                <div className="flex min-h-full w-full max-w-7xl flex-col pb-2">
                    <div className="contents">
                        <header className="app-page-header order-1 mb-5 px-6 py-5">
                            <p className="app-eyebrow mb-1 text-xs font-semibold tracking-[0.18em] text-cyan-700">COMUNIDADE</p>
                            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Alunos / Professores</h1>
                            <p className="mt-1 text-sm text-slate-600">Atualize turmas, identifique impedimentos e mantenha os cadastros organizados.</p>
                        </header>

                        <section className="app-panel-muted order-3 flex min-h-[420px] w-full flex-col gap-3 overflow-auto rounded-xl p-3">
                            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-xl border border-sky-200 bg-sky-100 px-4 py-3 shadow-sm">
                                <div>
                                    <h2 className="font-semibold text-slate-900">Cadastros encontrados</h2>
                                    <p className="text-xs text-slate-600">Clique em um nome para editar os dados ou administrar o banimento.</p>
                                </div>
                                <span className="rounded-full bg-cyan-700 px-3 py-1 text-xs font-bold text-white">
                                    {alunosVisiveis.length}{busca ? ` de ${alunosAtivos.length}` : ""}
                                </span>
                            </div>

                            {carregando ? (
                                <div className="m-auto text-center text-xl text-gray-600">Carregando cadastros...</div>
                            ) : alunosVisiveis.length === 0 ? (
                                <div className="m-auto text-center text-xl text-gray-500">
                                    {busca ? "Nenhum cadastro encontrado para esta pesquisa." : "Nenhum aluno ou professor cadastrado."}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {alunosVisiveis.map((aluno) => {
                                        const diasRestantes = obterDiasRestantesBanimento(aluno);
                                        const banido = diasRestantes > 0;

                                        return (
                                            <button
                                                type="button"
                                                key={aluno.id}
                                                onClick={() => abrirEditor(aluno)}
                                                aria-label={`Editar cadastro de ${aluno.nome}`}
                                                className={`app-panel grid w-full grid-cols-[70px_minmax(0,1fr)_150px_180px] items-center gap-4 rounded-lg p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/60 ${
                                                    banido ? "border-red-300 hover:border-red-500" : "hover:border-cyan-500"
                                                }`}
                                            >
                                                <span className="w-fit rounded-lg border border-cyan-100 bg-cyan-50 px-2.5 py-1.5 font-mono text-xs font-semibold text-cyan-800">{aluno.id}</span>
                                                <span className="flex min-w-0 flex-col">
                                                    <span className={`truncate text-lg font-semibold ${banido ? "text-red-700" : "text-slate-800"}`}>{aluno.nome}</span>
                                                    {aluno.tipo === "ALUNO" && (
                                                        <span className="truncate text-sm text-slate-500">{aluno.serie || "Turma não informada"}</span>
                                                    )}
                                                </span>
                                                <span className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${
                                                    aluno.tipo === "PROFESSOR"
                                                        ? "bg-violet-100 text-violet-800"
                                                        : "bg-cyan-100 text-cyan-800"
                                                }`}>
                                                    {aluno.tipo === "PROFESSOR" ? "Professor" : "Aluno"}
                                                </span>
                                                <span className="justify-self-end">
                                                    {banido ? (
                                                        <span className="rounded-full bg-red-100 px-3 py-1.5 text-sm font-bold text-red-700">
                                                            Banido · {diasRestantes} {diasRestantes === 1 ? "dia" : "dias"}
                                                        </span>
                                                    ) : (
                                                        <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-800">Regular</span>
                                                    )}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </div>

                    <div className="app-search-panel order-2 mb-5 flex w-full items-end justify-between gap-4 rounded-xl p-4">
                        <div className="flex min-w-0 flex-col gap-1.5">
                            <label htmlFor="busca-alunos" className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-900">Localizar pessoa</label>
                            <div className="relative">
                                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400">
                                    <circle cx="11" cy="11" r="7" strokeWidth="2" />
                                    <path d="m16 16 4 4" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                <input
                                    id="busca-alunos"
                                    type="search"
                                    placeholder="Buscar por nome, turma ou tipo"
                                    value={busca}
                                    onChange={(evento) => setBusca(evento.target.value)}
                                    className="w-96 max-w-full rounded-xl border border-slate-400 bg-white py-2.5 pl-11 pr-10 text-slate-800 shadow-sm outline-none placeholder-slate-400 focus:border-cyan-700 focus:ring-4 focus:ring-cyan-200"
                                />
                                {busca && (
                                    <button type="button" onClick={() => setBusca("")} aria-label="Limpar pesquisa" className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">&times;</button>
                                )}
                            </div>
                            <span className="text-xs text-slate-600">A lista é filtrada enquanto você digita.</span>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <button type="button" onClick={abrirExclusao} className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-300/60">Exclusão de alunos</button>
                            <button type="button" onClick={() => setModalCadastroAberto(true)} className="rounded-xl bg-green-700 px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-green-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-300/60">+ Cadastrar pessoa</button>
                        </div>
                    </div>
                </div>
            </main>

            {feedback && (
                <div
                    role={feedback.tipo === "erro" ? "alert" : "status"}
                    aria-live={feedback.tipo === "erro" ? "assertive" : "polite"}
                    className={`fixed right-6 top-6 z-[100] flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 shadow-xl ${
                        feedback.tipo === "sucesso"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border-red-300 bg-red-50 text-red-800"
                    }`}
                >
                    <span className="mt-0.5 font-bold" aria-hidden="true">{feedback.tipo === "sucesso" ? "✓" : "!"}</span>
                    <span className="min-w-0 flex-1 text-sm font-medium">{feedback.mensagem}</span>
                    <button type="button" onClick={() => setFeedback(null)} aria-label="Fechar aviso" className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-lg opacity-70 hover:bg-black/5 hover:opacity-100">&times;</button>
                </div>
            )}

            {modalCadastroAberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm">
                    <div role="dialog" aria-modal="true" aria-labelledby="titulo-cadastro-pessoa" onKeyDown={(evento) => controlarTecladoDialogo(evento, fecharCadastro)} className="relative w-full max-w-xl rounded-2xl border border-cyan-200 bg-sky-50 p-8 shadow-2xl">
                        <button type="button" onClick={fecharCadastro} disabled={salvandoCadastro} aria-label="Fechar cadastro" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-2xl text-gray-500 hover:bg-sky-100 hover:text-gray-800 disabled:opacity-50">&times;</button>
                        <h2 id="titulo-cadastro-pessoa" className="mb-6 text-center text-3xl font-semibold text-gray-800">Cadastrar aluno ou professor</h2>

                        <form onSubmit={handleCadastrar} className="space-y-4">
                            <label className="flex flex-col gap-1" htmlFor="cadastro-tipo">
                                <span className="text-sm font-medium text-gray-700">Tipo de pessoa</span>
                                <select id="cadastro-tipo" name="tipo" autoFocus value={formCadastro.tipo} onChange={(evento) => atualizarFormulario(evento, setFormCadastro)} className="rounded-xl border border-slate-400 bg-white p-2.5 shadow-sm focus:border-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-200">
                                    <option value="ALUNO">Aluno</option>
                                    <option value="PROFESSOR">Professor</option>
                                </select>
                            </label>
                            <label className="flex flex-col gap-1" htmlFor="cadastro-nome">
                                <span className="text-sm font-medium text-gray-700">Nome completo</span>
                                <input id="cadastro-nome" required name="nome" value={formCadastro.nome} onChange={(evento) => atualizarFormulario(evento, setFormCadastro)} className="rounded-xl border border-slate-400 bg-white p-2.5 shadow-sm focus:border-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-200" />
                            </label>
                            {formCadastro.tipo === "ALUNO" && (
                                <label className="flex flex-col gap-1" htmlFor="cadastro-serie">
                                    <span className="text-sm font-medium text-gray-700">Série / turma</span>
                                    <input id="cadastro-serie" required name="serie" value={formCadastro.serie} onChange={(evento) => atualizarFormulario(evento, setFormCadastro)} placeholder="Ex.: 7º ano A" className="rounded-xl border border-slate-400 bg-white p-2.5 shadow-sm focus:border-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-200" />
                                </label>
                            )}

                            {erroCadastro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erroCadastro}</div>}

                            <div className="flex justify-end gap-3 border-t border-sky-200 pt-5">
                                <button type="button" onClick={fecharCadastro} disabled={salvandoCadastro} className="rounded-xl bg-gray-200 px-5 py-2.5 text-gray-700 hover:bg-gray-300 disabled:opacity-50">Cancelar</button>
                                <button type="submit" disabled={salvandoCadastro} className="rounded-xl bg-green-700 px-6 py-2.5 font-semibold text-white shadow-sm hover:bg-green-800 disabled:opacity-60">{salvandoCadastro ? "Cadastrando..." : "Cadastrar"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {alunoSelecionado && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm">
                    <div role="dialog" aria-modal="true" aria-labelledby="titulo-edicao-pessoa" onKeyDown={(evento) => controlarTecladoDialogo(evento, fecharEditor)} className="relative max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cyan-200 bg-sky-50 p-8 shadow-2xl">
                        <button type="button" onClick={fecharEditor} disabled={salvandoEdicao || processandoBanimento || exportandoHistorico} aria-label="Fechar edição" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-2xl text-gray-500 hover:bg-sky-100 hover:text-gray-800 disabled:opacity-50">&times;</button>
                        <div className="mb-6 pr-10">
                            <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">Cadastro #{alunoSelecionado.id}</p>
                            <h2 id="titulo-edicao-pessoa" className="truncate text-3xl font-semibold text-gray-900">{alunoSelecionado.nome}</h2>
                        </div>

                        <div role="tablist" aria-label="Informações do cadastro" className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-cyan-200 bg-cyan-50 p-1.5">
                            <button
                                type="button"
                                id="aba-cadastro-leitor"
                                role="tab"
                                aria-selected={abaEditor === "cadastro"}
                                aria-controls="painel-cadastro-leitor"
                                onClick={() => setAbaEditor("cadastro")}
                                className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/60 ${
                                    abaEditor === "cadastro"
                                        ? "bg-cyan-700 text-white shadow-sm"
                                        : "text-cyan-900 hover:bg-white"
                                }`}
                            >
                                Dados e banimento
                            </button>
                            <button
                                type="button"
                                id="aba-historico-leitor"
                                role="tab"
                                aria-selected={abaEditor === "historico"}
                                aria-controls="painel-historico-leitor"
                                onClick={abrirHistorico}
                                className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/60 ${
                                    abaEditor === "historico"
                                        ? "bg-cyan-700 text-white shadow-sm"
                                        : "text-cyan-900 hover:bg-white"
                                }`}
                            >
                                Histórico de empréstimos
                            </button>
                        </div>

                        {abaEditor === "cadastro" ? (
                            <form id="painel-cadastro-leitor" role="tabpanel" aria-labelledby="aba-cadastro-leitor" onSubmit={handleSalvarEdicao} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="flex flex-col gap-1" htmlFor="edicao-tipo">
                                    <span className="text-sm font-medium text-gray-700">Tipo de pessoa</span>
                                    <select id="edicao-tipo" name="tipo" disabled value={formEdicao.tipo} onChange={(evento) => atualizarFormulario(evento, setFormEdicao)} className="cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 p-2.5 text-slate-600 shadow-sm">
                                        <option value="ALUNO">Aluno</option>
                                        <option value="PROFESSOR">Professor</option>
                                    </select>
                                    <span className="text-xs font-normal text-slate-500">O tipo do cadastro não pode ser alterado.</span>
                                </label>
                                {formEdicao.tipo === "ALUNO" && (
                                    <label className="flex flex-col gap-1" htmlFor="edicao-serie">
                                        <span className="text-sm font-medium text-gray-700">Série / turma</span>
                                        <input id="edicao-serie" required name="serie" value={formEdicao.serie} onChange={(evento) => atualizarFormulario(evento, setFormEdicao)} className="rounded-xl border border-slate-400 bg-white p-2.5 shadow-sm focus:border-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-200" />
                                    </label>
                                )}
                            </div>
                            <label className="flex flex-col gap-1" htmlFor="edicao-nome">
                                <span className="text-sm font-medium text-gray-700">Nome completo</span>
                                <input id="edicao-nome" autoFocus required name="nome" value={formEdicao.nome} onChange={(evento) => atualizarFormulario(evento, setFormEdicao)} className="rounded-xl border border-slate-400 bg-white p-2.5 shadow-sm focus:border-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-200" />
                            </label>

                            <div className={`rounded-2xl border p-5 ${diasRestantesSelecionado > 0 ? "border-red-300 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
                                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h3 className={`text-lg font-semibold ${diasRestantesSelecionado > 0 ? "text-red-800" : "text-slate-900"}`}>Controle de banimento</h3>
                                        {diasRestantesSelecionado > 0 ? (
                                            <p className="mt-1 text-sm text-red-700">
                                                Banido por mais {diasRestantesSelecionado} {diasRestantesSelecionado === 1 ? "dia" : "dias"}.
                                                {alunoSelecionado.motivoBanimento ? ` Motivo: ${alunoSelecionado.motivoBanimento}` : ""}
                                            </p>
                                        ) : (
                                            <p className="mt-1 text-sm text-slate-600">Defina um período e registre o motivo do impedimento.</p>
                                        )}
                                    </div>

                                    {diasRestantesSelecionado > 0 && !confirmandoRemocaoBanimento && (
                                        <button type="button" disabled={processandoBanimento} onClick={() => setConfirmandoRemocaoBanimento(true)} className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">Remover banimento</button>
                                    )}
                                </div>

                                {confirmandoRemocaoBanimento ? (
                                    <div className="rounded-xl border border-red-300 bg-white p-4">
                                        <p className="font-semibold text-red-800">Liberar esta pessoa para novos empréstimos agora?</p>
                                        <p className="mt-1 text-sm text-slate-600">A remoção será registrada nas movimentações.</p>
                                        <div className="mt-4 flex justify-end gap-3">
                                            <button type="button" disabled={processandoBanimento} onClick={() => setConfirmandoRemocaoBanimento(false)} className="rounded-xl bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300 disabled:opacity-50">Manter banimento</button>
                                            <button type="button" disabled={processandoBanimento} onClick={handleRemoverBanimento} className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-60">{processandoBanimento ? "Removendo..." : "Sim, remover"}</button>
                                        </div>
                                    </div>
                                ) : diasRestantesSelecionado === 0 ? (
                                    <div className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                                        <label className="flex flex-col gap-1" htmlFor="dias-banimento">
                                            <span className="text-sm font-medium text-gray-700">Dias de impedimento</span>
                                            <input id="dias-banimento" type="number" min="1" max="3650" step="1" value={diasBanimento} onChange={(evento) => setDiasBanimento(evento.target.value)} className="rounded-xl border border-amber-300 bg-white p-2.5 shadow-sm focus:border-amber-600 focus:outline-none focus:ring-4 focus:ring-amber-200" />
                                        </label>
                                        <label className="flex flex-col gap-1" htmlFor="motivo-banimento">
                                            <span className="text-sm font-medium text-gray-700">Motivo</span>
                                            <input id="motivo-banimento" value={motivoBanimento} onChange={(evento) => setMotivoBanimento(evento.target.value)} placeholder="Descreva o motivo" className="rounded-xl border border-amber-300 bg-white p-2.5 shadow-sm focus:border-amber-600 focus:outline-none focus:ring-4 focus:ring-amber-200" />
                                        </label>
                                        <div className="sm:col-span-2 flex justify-end">
                                            <button type="button" disabled={processandoBanimento} onClick={handleAplicarBanimento} className="rounded-xl bg-amber-600 px-5 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-60">{processandoBanimento ? "Aplicando..." : "Aplicar banimento"}</button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            {erroEdicao && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erroEdicao}</div>}

                            <div className="flex justify-end gap-3 border-t border-sky-200 pt-5">
                                <button type="button" onClick={fecharEditor} disabled={salvandoEdicao || processandoBanimento} className="rounded-xl bg-gray-200 px-5 py-2.5 text-gray-700 hover:bg-gray-300 disabled:opacity-50">Cancelar</button>
                                <button type="submit" disabled={salvandoEdicao || processandoBanimento} className="rounded-xl bg-cyan-700 px-6 py-2.5 font-semibold text-white shadow-sm hover:bg-cyan-800 disabled:opacity-60">{salvandoEdicao ? "Salvando..." : "Salvar alterações"}</button>
                            </div>
                            </form>
                        ) : (
                            <section id="painel-historico-leitor" role="tabpanel" aria-labelledby="aba-historico-leitor" className="space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-200 bg-white px-4 py-3">
                                    <div>
                                        <h3 className="font-semibold text-slate-900">Livros emprestados</h3>
                                        <p className="mt-0.5 text-xs text-slate-600">
                                            {historicoLeitor
                                                ? `${historicoLeitor.itens.length} ${historicoLeitor.itens.length === 1 ? "registro encontrado" : "registros encontrados"}`
                                                : "Consulte todos os empréstimos deste cadastro."}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            disabled={carregandoHistorico || exportandoHistorico}
                                            onClick={() => void carregarHistoricoLeitor(alunoSelecionado.id)}
                                            className="rounded-lg border border-cyan-300 bg-white px-3.5 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-50 disabled:opacity-50"
                                        >
                                            Atualizar
                                        </button>
                                        <button
                                            type="button"
                                            disabled={carregandoHistorico || exportandoHistorico || !historicoLeitor?.itens.length}
                                            onClick={handleExportarHistorico}
                                            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
                                        >
                                            {exportandoHistorico ? "Exportando..." : "Exportar planilha"}
                                        </button>
                                    </div>
                                </div>

                                {feedbackHistorico && (
                                    <div
                                        role={feedbackHistorico.tipo === "erro" ? "alert" : "status"}
                                        aria-live={feedbackHistorico.tipo === "erro" ? "assertive" : "polite"}
                                        className={`break-words rounded-xl border px-4 py-3 text-sm font-medium ${
                                            feedbackHistorico.tipo === "sucesso"
                                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                : feedbackHistorico.tipo === "erro"
                                                    ? "border-red-200 bg-red-50 text-red-700"
                                                    : "border-slate-200 bg-slate-50 text-slate-700"
                                        }`}
                                    >
                                        {feedbackHistorico.mensagem}
                                    </div>
                                )}

                                <div className="max-h-[min(48vh,30rem)] overflow-y-auto overscroll-contain rounded-xl border border-sky-200 bg-slate-50 p-2 pr-1.5">
                                    {carregandoHistorico ? (
                                        <div role="status" className="flex min-h-52 items-center justify-center px-4 text-center text-sm font-medium text-slate-600">
                                            Carregando histórico de empréstimos...
                                        </div>
                                    ) : erroHistorico ? (
                                        <div className="flex min-h-52 flex-col items-center justify-center gap-4 px-4 text-center">
                                            <p role="alert" className="text-sm font-medium text-red-700">{erroHistorico}</p>
                                            <button type="button" onClick={() => void carregarHistoricoLeitor(alunoSelecionado.id)} className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                                                Tentar novamente
                                            </button>
                                        </div>
                                    ) : !historicoLeitor?.itens.length ? (
                                        <div className="flex min-h-52 flex-col items-center justify-center px-4 text-center">
                                            <div aria-hidden="true" className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-2xl text-cyan-700">○</div>
                                            <p className="font-semibold text-slate-800">Nenhum empréstimo registrado</p>
                                            <p className="mt-1 max-w-sm text-sm text-slate-500">Os livros emprestados para esta pessoa aparecerão aqui.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_104px_68px_126px] gap-3 px-3 pb-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-500 sm:grid">
                                                <span>Livro</span>
                                                <span>Data</span>
                                                <span>Hora</span>
                                                <span>Status</span>
                                            </div>
                                            {historicoLeitor.itens.map((item) => {
                                                const dataHora = formatarDataHoraHistorico(item.dataHoraEmprestimo);
                                                const status = obterApresentacaoStatus(item.status);
                                                return (
                                                    <article key={item.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_104px_68px_126px] sm:items-center">
                                                        <div className="min-w-0">
                                                            <h4 className="truncate font-semibold text-slate-900" title={item.livroTitulo}>{item.livroTitulo}</h4>
                                                            <p className="truncate text-xs text-slate-500" title={item.livroAutor}>{item.livroAutor || "Autor não informado"}</p>
                                                            <p className="mt-1 text-xs text-slate-600">
                                                                Quantidade: {item.quantidade}
                                                                {item.quantidadeDevolvida > 0 ? ` · Devolvida: ${item.quantidadeDevolvida}` : ""}
                                                                {item.quantidadePendente > 0 ? ` · Pendente: ${item.quantidadePendente}` : ""}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-medium text-slate-500 sm:hidden">Data: </span>
                                                            <time dateTime={dataHora.iso} className="text-sm font-semibold text-slate-700">{dataHora.data}</time>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-medium text-slate-500 sm:hidden">Hora: </span>
                                                            <span className="text-sm font-semibold text-slate-700">{dataHora.hora}</span>
                                                        </div>
                                                        <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-bold ${status.classe}`}>{status.rotulo}</span>
                                                    </article>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end border-t border-sky-200 pt-4">
                                    <button type="button" onClick={fecharEditor} disabled={exportandoHistorico} className="rounded-xl bg-gray-200 px-5 py-2.5 text-gray-700 hover:bg-gray-300 disabled:opacity-50">Fechar</button>
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            )}

            {modalExclusaoAberto && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm">
                    <div role="dialog" aria-modal="true" aria-labelledby="titulo-exclusao-alunos" onKeyDown={(evento) => controlarTecladoDialogo(evento, fecharExclusao)} className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-rose-200 bg-rose-50 p-7 shadow-2xl">
                        <div className="mb-5 flex items-start justify-between gap-4 border-b border-rose-200 pb-4">
                            <div>
                                <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-red-600">Gerenciar cadastros inativos</p>
                                <h2 id="titulo-exclusao-alunos" className="text-3xl font-semibold text-gray-900">{confirmandoExclusao ? "Confirmar exclusão" : "Exclusão de alunos"}</h2>
                            </div>
                            <button type="button" onClick={fecharExclusao} disabled={arquivando} aria-label="Fechar exclusão de alunos" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-2xl text-gray-500 hover:bg-red-100 hover:text-red-700 disabled:opacity-50">&times;</button>
                        </div>

                        {!confirmandoExclusao ? (
                            <>
                                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                                    <strong className="block">Os cadastros selecionados serão arquivados.</strong>
                                    Eles deixarão de aparecer nas pesquisas e nos novos empréstimos, mas todo o histórico de movimentações será preservado.
                                </div>

                                <label htmlFor="busca-exclusao-alunos" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-red-700">Pesquisar para selecionar</label>
                                <div className="relative mb-4">
                                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400">
                                        <circle cx="11" cy="11" r="7" strokeWidth="2" />
                                        <path d="m16 16 4 4" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                    <input id="busca-exclusao-alunos" type="search" autoFocus value={buscaExclusao} onChange={(evento) => setBuscaExclusao(evento.target.value)} placeholder="Buscar por nome, turma ou tipo" className="w-full rounded-xl border border-slate-400 bg-white py-2.5 pl-11 pr-4 text-slate-800 shadow-sm outline-none placeholder-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-200" />
                                </div>

                                <div className="mb-5 max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1">
                                    {alunosVisiveisExclusao.map((aluno) => {
                                        const selecionado = idsSelecionadosSet.has(aluno.id);
                                        const diasRestantes = obterDiasRestantesBanimento(aluno);
                                        return (
                                            <label key={aluno.id} className={`group flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${selecionado ? "border-red-400 bg-red-50 ring-2 ring-red-200" : "border-[var(--app-border)] bg-[var(--app-surface-raised)] hover:border-red-300"}`}>
                                                <input type="checkbox" className="peer sr-only" checked={selecionado} onChange={() => alternarSelecao(aluno.id)} />
                                                <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition peer-focus-visible:ring-4 peer-focus-visible:ring-red-300/60 ${selecionado ? "border-red-600 bg-red-600 text-white" : "border-slate-400 bg-white text-transparent group-hover:border-red-500"}`}>
                                                    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5"><path d="m4 10 3.5 3.5L16 5.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className={`block truncate font-semibold ${diasRestantes > 0 ? "text-red-700" : "text-slate-900"}`}>{aluno.nome}</span>
                                                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                                                        {aluno.tipo === "PROFESSOR" ? "Professor" : `Aluno${aluno.serie ? ` · ${aluno.serie}` : ""}`}
                                                    </span>
                                                </span>
                                                <span className="shrink-0 font-mono text-xs text-slate-500">#{aluno.id}</span>
                                            </label>
                                        );
                                    })}
                                    {alunosVisiveisExclusao.length === 0 && <div className="rounded-xl border border-dashed border-rose-300 bg-red-50 px-4 py-8 text-center text-sm text-slate-600">Nenhum cadastro encontrado para esta pesquisa.</div>}
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rose-200 pt-5">
                                    <span className="text-sm font-semibold text-slate-700">{idsSelecionados.length} {idsSelecionados.length === 1 ? "cadastro selecionado" : "cadastros selecionados"}</span>
                                    <div className="flex gap-3">
                                        <button type="button" onClick={fecharExclusao} className="rounded-xl bg-gray-200 px-5 py-2.5 text-gray-700 hover:bg-gray-300">Cancelar</button>
                                        <button type="button" disabled={idsSelecionados.length === 0} onClick={() => { setErroExclusao(""); setConfirmandoExclusao(true); }} className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50">Continuar</button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                                    <strong className="block text-lg">Arquivar {alunosSelecionadosExclusao.length} {alunosSelecionadosExclusao.length === 1 ? "cadastro" : "cadastros"}?</strong>
                                    Estas pessoas não estarão disponíveis para novos empréstimos. Os registros históricos não serão apagados.
                                </div>

                                <div className="mb-5 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-rose-200 bg-[var(--app-surface-raised)] p-3">
                                    {alunosSelecionadosExclusao.map((aluno) => (
                                        <div key={aluno.id} className="flex items-center justify-between gap-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2">
                                            <span className="min-w-0">
                                                <strong className="block truncate text-slate-900">{aluno.nome}</strong>
                                                <span className="text-xs text-slate-500">
                                                    {aluno.tipo === "PROFESSOR" ? "Professor" : `Aluno${aluno.serie ? ` · ${aluno.serie}` : ""}`}
                                                </span>
                                            </span>
                                            <span className="shrink-0 font-mono text-xs text-red-700">#{aluno.id}</span>
                                        </div>
                                    ))}
                                </div>

                                {erroExclusao && <div role="alert" className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erroExclusao}</div>}

                                <div className="flex justify-end gap-3 border-t border-rose-200 pt-5">
                                    <button type="button" autoFocus disabled={arquivando} onClick={() => { setErroExclusao(""); setConfirmandoExclusao(false); }} className="rounded-xl bg-gray-200 px-5 py-2.5 text-gray-700 hover:bg-gray-300 disabled:opacity-50">Voltar</button>
                                    <button type="button" disabled={arquivando} onClick={handleArquivarAlunos} className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60">{arquivando ? "Arquivando..." : `Arquivar ${alunosSelecionadosExclusao.length}`}</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
