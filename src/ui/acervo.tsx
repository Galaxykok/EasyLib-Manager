import { useState, useEffect, useMemo, useRef } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import * as XLSX from "xlsx";
import Sidebar from "./sidebar.tsx";

interface CadastroLivroForm {
    titulo: string;
    autor: string;
    numeroEdicao?: number | null;
    isbn?: string | null;
    editora?: string | null;
    unidade: number;
}

interface EdicaoLivroForm {
    titulo: string;
    autor: string;
    isbn: string;
    numeroEdicao: string;
    editora: string;
    unidades: string;
}

interface FeedbackAcervo {
    tipo: "sucesso" | "erro";
    mensagem: string;
}

type ModalStep = "choice" | "form" | "import";

const LIMITE_INTEIRO_BANCO = 2_147_483_647;
const SELETOR_ELEMENTOS_FOCAVEIS = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
].join(",");

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

const normalizarCabecalho = (valor: string) =>
    valor
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

const encontrarColuna = (colunas: string[], nomes: string[]) =>
    colunas.find((coluna) =>
        nomes.map(normalizarCabecalho).includes(normalizarCabecalho(coluna)),
    ) || "";

const livroCorrespondeBusca = (livro: Livro, busca: string) => {
    const termo = normalizarCabecalho(busca);
    if (!termo) return true;

    return normalizarCabecalho(
        `${livro.titulo} ${livro.autor} ${livro.isbn || ""}`,
    ).includes(termo);
};

const criarFormularioEdicao = (livro: Livro): EdicaoLivroForm => ({
    titulo: livro.titulo,
    autor: livro.autor,
    isbn: livro.isbn || "",
    numeroEdicao: livro.numeroEdicao ? String(livro.numeroEdicao) : "",
    editora: livro.editora || "",
    unidades: String(livro.unidade),
});

export default function Acervo() {
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [modalStep, setModalStep] = useState<ModalStep>("choice");
    const [linhasImportadas, setLinhasImportadas] = useState<Record<string, unknown>[]>([]);
    const [colunasImportadas, setColunasImportadas] = useState<string[]>([]);
    const [mapeamento, setMapeamento] = useState({ titulo: "", quantidade: "", autor: "", isbn: "", editora: "", numeroEdicao: "" });
    const [livroLista, setLivroLista] = useState<Livro[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [livro, setLivro] = useState("");
    const [importando, setImportando] = useState(false);

    const [selectedLivro, setSelectedLivro] = useState<Livro | null>(null);
    const [formEdicao, setFormEdicao] = useState<EdicaoLivroForm | null>(null);
    const [salvandoEdicao, setSalvandoEdicao] = useState(false);
    const [erroEdicao, setErroEdicao] = useState("");

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [buscaExclusao, setBuscaExclusao] = useState("");
    const [idsSelecionadosExclusao, setIdsSelecionadosExclusao] = useState<number[]>([]);
    const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
    const [excluindoLivros, setExcluindoLivros] = useState(false);
    const [erroExclusao, setErroExclusao] = useState("");
    const [feedback, setFeedback] = useState<FeedbackAcervo | null>(null);
    const acionadorEdicaoRef = useRef<HTMLElement | null>(null);
    const acionadorExclusaoRef = useRef<HTMLElement | null>(null);

    const [formData, setFormData] = useState({
        titulo: "",
        autor: "",
        isbn: "",
        numeroEdicao: "",
        editora: "",
        unidades: "1",
    });

    const closeModal = (): void => {
        setIsModalOpen(false);
        setModalStep("choice");
        setFormData({
            titulo: "",
            autor: "",
            isbn: "",
            numeroEdicao: "",
            editora: "",
            unidades: "1",
        });
        setLinhasImportadas([]);
        setColunasImportadas([]);
        setMapeamento({ titulo: "", quantidade: "", autor: "", isbn: "", editora: "", numeroEdicao: "" });
    };

    const livrosParaImportar = useMemo(() => {
        if (!linhasImportadas.length || !mapeamento.titulo) {
            return [];
        }
        const valor = (linha: Record<string, unknown>, coluna: string) => coluna ? String(linha[coluna] ?? "").trim() : "";
        const itens: CadastroLivroForm[] = [];
        linhasImportadas.forEach((linha) => {
            const titulo = valor(linha, mapeamento.titulo);
            if (!titulo) return;
            const quantidadeInformada = mapeamento.quantidade
                ? Number(valor(linha, mapeamento.quantidade))
                : 0;
            const quantidade = Number.isFinite(quantidadeInformada)
                ? Math.floor(quantidadeInformada)
                : 0;
            itens.push({ titulo, autor: valor(linha, mapeamento.autor), isbn: valor(linha, mapeamento.isbn) || null, editora: valor(linha, mapeamento.editora) || null, numeroEdicao: Number(valor(linha, mapeamento.numeroEdicao)) || null, unidade: quantidade });
        });
        return itens;
    }, [linhasImportadas, mapeamento]);

    const livrosVisiveis = useMemo(
        () => livroLista.filter((livroItem) => livroCorrespondeBusca(livroItem, livro)),
        [livroLista, livro],
    );

    const livrosVisiveisExclusao = useMemo(
        () => livroLista.filter((livroItem) => livroCorrespondeBusca(livroItem, buscaExclusao)),
        [livroLista, buscaExclusao],
    );

    const idsSelecionadosSet = useMemo(
        () => new Set(idsSelecionadosExclusao),
        [idsSelecionadosExclusao],
    );

    const livrosSelecionadosExclusao = useMemo(
        () => livroLista.filter((livroItem) => idsSelecionadosSet.has(livroItem.id)),
        [livroLista, idsSelecionadosSet],
    );

    const exemplaresEmprestados = selectedLivro
        ? Math.max(0, selectedLivro.unidade - selectedLivro.disponiveis)
        : 0;

    const totalCopiasSelecionadasExclusao = livrosSelecionadosExclusao.reduce(
        (total, livroItem) => total + livroItem.unidade,
        0,
    );

    const titulosSelecionadosComEmprestimos = livrosSelecionadosExclusao.filter(
        (livroItem) => livroItem.unidade - livroItem.disponiveis > 0,
    ).length;

    const abrirEditorLivro = (livroItem: Livro): void => {
        acionadorEdicaoRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        setSelectedLivro(livroItem);
        setFormEdicao(criarFormularioEdicao(livroItem));
        setErroEdicao("");
    };

    const closeDetailsModal = (): void => {
        if (salvandoEdicao) return;
        setSelectedLivro(null);
        setFormEdicao(null);
        setErroEdicao("");
    };

    const handleEdicaoInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const { name, value } = e.target;
        setFormEdicao((anterior) => anterior ? { ...anterior, [name]: value } : anterior);
        setErroEdicao("");
    };

    const abrirModalExclusao = (): void => {
        acionadorExclusaoRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        setBuscaExclusao("");
        setIdsSelecionadosExclusao([]);
        setConfirmandoExclusao(false);
        setErroExclusao("");
        setIsDeleteModalOpen(true);
    };

    const fecharModalExclusao = (): void => {
        if (excluindoLivros) return;
        setIsDeleteModalOpen(false);
        setBuscaExclusao("");
        setIdsSelecionadosExclusao([]);
        setConfirmandoExclusao(false);
        setErroExclusao("");
    };

    const alternarLivroExclusao = (livroId: number): void => {
        setIdsSelecionadosExclusao((atuais) =>
            atuais.includes(livroId)
                ? atuais.filter((id) => id !== livroId)
                : [...atuais, livroId],
        );
        setErroExclusao("");
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const carregarLivros = async () => {
        setIsLoading(true);
        try {
            const response = await window.electronAPI.obterLivros();
            if (response.success && response.data) {
                setLivroLista(response.data);
            } else {
                console.error("Erro ao carregar livros:", response.error);
            }
        } catch (erro) {
            console.error("Erro ao carregar livros:", erro);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        window.electronAPI.obterLivros()
            .then((response) => {
                if (response.success && response.data) {
                    setLivroLista(response.data);
                } else {
                    console.error("Erro ao carregar livros:", response.error);
                }
            })
            .catch((erro) => console.error("Erro ao carregar livros:", erro))
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        if (selectedLivro || !acionadorEdicaoRef.current) return;
        const acionador = acionadorEdicaoRef.current;
        acionadorEdicaoRef.current = null;
        const frame = requestAnimationFrame(() => {
            if (document.activeElement === document.body && document.contains(acionador)) {
                acionador.focus();
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [selectedLivro]);

    useEffect(() => {
        if (isDeleteModalOpen || !acionadorExclusaoRef.current) return;
        const acionador = acionadorExclusaoRef.current;
        acionadorExclusaoRef.current = null;
        const frame = requestAnimationFrame(() => {
            if (document.activeElement === document.body && document.contains(acionador)) {
                acionador.focus();
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [isDeleteModalOpen]);

    useEffect(() => {
        if (!feedback) return;
        const temporizador = window.setTimeout(() => setFeedback(null), 5000);
        return () => window.clearTimeout(temporizador);
    }, [feedback]);

    const handleEdicaoSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedLivro || !formEdicao || salvandoEdicao) return;

        const titulo = formEdicao.titulo.trim();
        const totalInformado = Number(formEdicao.unidades);
        const numeroEdicao = formEdicao.numeroEdicao
            ? Number(formEdicao.numeroEdicao)
            : null;

        if (!titulo) {
            setErroEdicao("Informe o título do livro.");
            return;
        }
        if (!Number.isSafeInteger(totalInformado)
            || totalInformado < exemplaresEmprestados
            || totalInformado > LIMITE_INTEIRO_BANCO) {
            setErroEdicao(
                `O estoque total deve ser um número inteiro entre ${exemplaresEmprestados} e ${LIMITE_INTEIRO_BANCO.toLocaleString("pt-BR")}.`,
            );
            return;
        }
        if (numeroEdicao !== null && (!Number.isSafeInteger(numeroEdicao)
            || numeroEdicao < 1
            || numeroEdicao > LIMITE_INTEIRO_BANCO)) {
            setErroEdicao(
                `O número da edição deve ser um inteiro entre 1 e ${LIMITE_INTEIRO_BANCO.toLocaleString("pt-BR")}.`,
            );
            return;
        }

        setSalvandoEdicao(true);
        setErroEdicao("");
        try {
            const response = await window.electronAPI.atualizarLivro({
                id: selectedLivro.id,
                titulo,
                autor: formEdicao.autor.trim(),
                numeroEdicao,
                isbn: formEdicao.isbn.trim() || null,
                editora: formEdicao.editora.trim() || null,
                unidade: totalInformado,
            });

            if (!response.success) {
                setErroEdicao(response.error || "Não foi possível atualizar o livro.");
                return;
            }

            if (response.data) {
                setLivroLista((atuais) =>
                    atuais
                        .map((livroItem) => livroItem.id === response.data?.id ? response.data : livroItem)
                        .filter((livroItem): livroItem is Livro => Boolean(livroItem))
                        .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR")),
                );
            } else {
                await carregarLivros();
            }
            setSelectedLivro(null);
            setFormEdicao(null);
            setFeedback({ tipo: "sucesso", mensagem: "Livro atualizado com sucesso." });
        } catch (erro) {
            setErroEdicao(
                erro instanceof Error
                    ? erro.message
                    : "Não foi possível atualizar o livro.",
            );
        } finally {
            setSalvandoEdicao(false);
        }
    };

    const handleExcluirLivros = async (): Promise<void> => {
        if (idsSelecionadosExclusao.length === 0 || excluindoLivros) return;

        setExcluindoLivros(true);
        setErroExclusao("");
        try {
            const ids = [...idsSelecionadosExclusao];
            const response = await window.electronAPI.deleteLivros(ids);
            if (!response.success) {
                setErroExclusao(response.error || "Não foi possível excluir os livros selecionados.");
                return;
            }

            const idsExcluidos = new Set(ids);
            setLivroLista((atuais) => atuais.filter((livroItem) => !idsExcluidos.has(livroItem.id)));
            setIsDeleteModalOpen(false);
            setBuscaExclusao("");
            setIdsSelecionadosExclusao([]);
            setConfirmandoExclusao(false);
            const quantidade = response.quantidade ?? ids.length;
            setFeedback({
                tipo: "sucesso",
                mensagem: `${quantidade} ${quantidade === 1 ? "título foi excluído" : "títulos foram excluídos"} com sucesso.`,
            });
        } catch (erro) {
            setErroExclusao(
                erro instanceof Error
                    ? erro.message
                    : "Não foi possível excluir os livros selecionados.",
            );
        } finally {
            setExcluindoLivros(false);
        }
    };

    const handleCadastroSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const quantidadeInformada = Number(formData.unidades);
        const quantidade = Number.isFinite(quantidadeInformada)
            ? Math.floor(quantidadeInformada)
            : 0;
        const novoLivro: CadastroLivroForm = {
            titulo: formData.titulo,
            autor: formData.autor,
            isbn: formData.isbn || null,
            numeroEdicao: formData.numeroEdicao
                ? Number(formData.numeroEdicao)
                : null,
            editora: formData.editora || null,
            unidade: quantidade,
        };
        const response = await window.electronAPI.cadastrarLivro([novoLivro]);

        if (response.success) {
            console.log(
                "Livro cadastrado com sucesso no banco local:",
                response.data,
            );
            closeModal();
            await carregarLivros();
            setFeedback({ tipo: "sucesso", mensagem: "Livro cadastrado com sucesso." });
        } else {
            console.error("Erro ao salvar:", response.error);
            setFeedback({
                tipo: "erro",
                mensagem: response.error || "Erro ao cadastrar livro no banco de dados.",
            });
            return;
        }
        console.log(
            `Adicionando ${quantidade} unidades ao estoque:`,
            novoLivro,
        );
    };

    const handleExcelUpload = (e: ChangeEvent<HTMLInputElement>): void => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const data = event.target?.result;
            if (!data) return;

            try {
                const workbook = XLSX.read(data, { type: "binary" });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                if (!worksheet) throw new Error("A planilha não possui uma aba válida.");

                const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
                    worksheet,
                    { defval: "", blankrows: false },
                );
                if (!jsonData.length) throw new Error("A planilha está vazia.");

                const colunas = Object.keys(jsonData[0]);
                setLinhasImportadas(jsonData);
                setColunasImportadas(colunas);
                setMapeamento({
                    titulo: encontrarColuna(colunas, ["titulo", "nome", "livro", "nome do livro"]),
                    quantidade: encontrarColuna(colunas, [
                        "quantidade",
                        "qtd",
                        "unidade",
                        "unidades",
                        "copias",
                        "número de cópias",
                        "numero de copias",
                        "exemplares",
                        "número de exemplares",
                        "numero de exemplares",
                    ]),
                    autor: encontrarColuna(colunas, ["autor"]),
                    isbn: encontrarColuna(colunas, ["isbn"]),
                    editora: encontrarColuna(colunas, ["editora"]),
                    numeroEdicao: encontrarColuna(colunas, [
                        "edicao",
                        "edição",
                        "numero da edicao",
                        "número da edição",
                    ]),
                });
            } catch (erro) {
                const mensagem = erro instanceof Error ? erro.message : String(erro);
                window.electronAPI.registrarDebug(
                    "Leitura da planilha do acervo",
                    mensagem,
                    erro instanceof Error ? erro.stack : undefined,
                );
                setFeedback({ tipo: "erro", mensagem: `Não foi possível ler a planilha: ${mensagem}` });
            }
        };

        reader.onerror = () => {
            const mensagem = reader.error?.message || "Falha ao acessar o arquivo selecionado.";
            window.electronAPI.registrarDebug("Leitura da planilha do acervo", mensagem);
            setFeedback({ tipo: "erro", mensagem });
        };
        reader.readAsBinaryString(file);
    };

    const handleConfirmarImportacao = async () => {
        if (livrosParaImportar.length === 0) {
            setFeedback({ tipo: "erro", mensagem: "Nenhum dado importado válido." });
            return;
        }
        if (importando) return;
        const totalUnidades = livrosParaImportar.reduce(
            (total, livroImportado) => total + livroImportado.unidade,
            0,
        );
        setImportando(true);
        console.log(
            "Enviando coleção unitária para o Prisma:",
            livrosParaImportar,
        );
        try {
            const quantidade = totalUnidades;
            const response =
                await window.electronAPI.cadastrarLivro(livrosParaImportar);
            if (response.success) {
                closeModal();
                await carregarLivros();
                setFeedback({
                    tipo: "sucesso",
                    mensagem: `${livrosParaImportar.length} títulos importados. Estoque informado: ${quantidade}.`,
                });
            } else {
                console.error("Erro ao salvar:", response.error);
                await window.electronAPI.registrarDebug(
                    "Importação do acervo",
                    response.error || "Erro ao cadastrar os livros importados.",
                    `Quantidade de exemplares processados: ${quantidade}`,
                );
                setFeedback({
                    tipo: "erro",
                    mensagem: `Erro na importação: ${response.error || "consulte a tela Debug para mais detalhes."}`,
                });
            }
        } finally {
            setImportando(false);
        }
    };

    return (
        <div className="app-shell flex h-screen w-screen font-sans overflow-hidden relative">
            <Sidebar />

            <main className="app-main flex-1 flex flex-col items-center p-8 xl:p-10 overflow-y-auto">
                <div className="w-full max-w-7xl flex flex-col min-h-full pb-2">
                    <div className="contents">
                        <header className="app-page-header order-1 py-5 px-6 mb-5">
                        <p className="app-eyebrow text-xs font-semibold tracking-[0.18em] text-cyan-700 mb-1">CATÁLOGO</p>
                        <h1 className="text-4xl font-semibold text-slate-900 tracking-tight">
                            Acervo
                        </h1>
                        <p className="text-sm text-slate-600 mt-1">Consulte títulos, edições e a disponibilidade atual do estoque.</p>
                        </header>
                        <div className="app-panel-muted order-3 w-full rounded-xl p-3 min-h-[420px] flex flex-col gap-3 overflow-auto">
                            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-xl border border-sky-200 bg-sky-100 px-4 py-3 shadow-sm">
                                <div>
                                    <h2 className="font-semibold text-slate-900">Livros encontrados</h2>
                                    <p className="text-xs text-slate-600">Clique em um registro para editar os dados do livro.</p>
                                </div>
                                <span className="rounded-full bg-cyan-700 px-3 py-1 text-xs font-bold text-white">
                                    {livrosVisiveis.length}{livro ? ` de ${livroLista.length}` : ""}
                                </span>
                            </div>
                            {isLoading ? (
                                <div className="text-center text-gray-600 text-xl m-auto">
                                    Carregando livros...
                                </div>
                            ) : livrosVisiveis.length === 0 ? (
                                <div className="text-center text-gray-500 text-xl m-auto">
                                    {livro
                                        ? "Nenhum livro encontrado para esta pesquisa."
                                        : "Nenhum livro cadastrado."}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {livrosVisiveis.map((livroItem) => (
                                        <button
                                            type="button"
                                            key={livroItem.id}
                                            onClick={() => abrirEditorLivro(livroItem)}
                                            aria-label={`Editar ${livroItem.titulo}`}
                                            className="app-panel grid w-full grid-cols-[70px_minmax(0,1fr)_280px] gap-4 items-center p-4 rounded-lg text-left hover:border-cyan-500 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/60"
                                        >
                                            <span className="w-fit font-mono text-xs font-semibold text-cyan-800 bg-cyan-50 border border-cyan-100 px-2.5 py-1.5 rounded-lg">
                                                {livroItem.id}
                                            </span>

                                            <span className="flex flex-col min-w-0">
                                                <span className="text-lg font-semibold text-slate-800 truncate">
                                                    {livroItem.titulo}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {livroItem.autor || "Autor não informado"}
                                                </span>
                                            </span>

                                            <span className="flex flex-col items-end gap-1 min-w-0">
                                                {livroItem.numeroEdicao && (
                                                    <span className="bg-cyan-100 text-cyan-800 font-semibold px-3 py-1 rounded-full text-sm">
                                                        {livroItem.numeroEdicao}
                                                        ª Edição
                                                    </span>
                                                )}

                                                {livroItem.editora && (
                                                    <span className="text-sm text-gray-500">
                                                        {livroItem.editora}
                                                    </span>
                                                )}

                                                {livroItem.isbn && (
                                                    <span className="text-sm text-gray-500">
                                                        ISBN: {livroItem.isbn}
                                                    </span>
                                                )}

                                                <span className="text-sm text-gray-400">
                                                    Estoque disponível: {livroItem.disponiveis} · Total informado: {livroItem.unidade}
                                                </span>

                                                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                                    livroItem.disponiveis > 0
                                                        ? "bg-green-100 text-green-800"
                                                        : livroItem.disponiveis < 0
                                                          ? "bg-orange-100 text-orange-800"
                                                          : "bg-red-100 text-red-800"
                                                }`}>
                                                    {livroItem.disponiveis > 0
                                                        ? "DISPONÍVEL"
                                                        : livroItem.disponiveis < 0
                                                          ? "ESTOQUE NEGATIVO"
                                                        : "SEM ESTOQUE"}
                                                </span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="app-search-panel order-2 w-full flex items-end justify-between gap-4 mb-5 p-4 rounded-xl">
                        <div className="flex min-w-0 flex-col gap-1.5">
                            <label htmlFor="busca-acervo" className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-900">
                                Localizar no acervo
                            </label>
                            <div className="relative">
                                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400">
                                    <circle cx="11" cy="11" r="7" strokeWidth="2" />
                                    <path d="m16 16 4 4" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                <input
                                    id="busca-acervo"
                                    type="search"
                                    placeholder="Buscar por título, autor ou ISBN"
                                    value={livro}
                                    className="w-96 max-w-full rounded-xl border border-slate-400 bg-white py-2.5 pl-11 pr-10 text-slate-800 shadow-sm outline-none placeholder-slate-400 focus:border-cyan-700 focus:ring-4 focus:ring-cyan-200"
                                    onChange={(e) => setLivro(e.target.value)}
                                />
                                {livro && (
                                    <button
                                        type="button"
                                        onClick={() => setLivro("")}
                                        aria-label="Limpar pesquisa"
                                        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                                    >
                                        &times;
                                    </button>
                                )}
                            </div>
                            <span className="text-xs text-slate-600">A lista é filtrada enquanto você digita.</span>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={abrirModalExclusao}
                                className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-300/60"
                            >
                                Exclusão de livros
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer"
                            >
                                <span>+ Cadastrar Livro</span>
                            </button>
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
                    <span className="mt-0.5 font-bold" aria-hidden="true">
                        {feedback.tipo === "sucesso" ? "✓" : "!"}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium">{feedback.mensagem}</span>
                    <button
                        type="button"
                        onClick={() => setFeedback(null)}
                        aria-label="Fechar aviso"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-lg opacity-70 hover:bg-black/5 hover:opacity-100"
                    >
                        &times;
                    </button>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-sky-50 rounded-2xl p-8 w-full max-w-2xl shadow-2xl border border-cyan-200 relative">
                        <button
                            onClick={closeModal}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold focus:outline-none cursor-pointer"
                        >
                            &times;
                        </button>

                        {modalStep === "choice" && (
                            <div className="text-center py-6">
                                <h2 className="text-3xl font-semibold text-gray-800 mb-8">
                                    Adicionar Novo Livro
                                </h2>
                                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                                    <button
                                        onClick={() => setModalStep("form")}
                                        className="w-full sm:w-64 py-4 bg-green-700 hover:bg-green-800 text-white text-lg font-semibold rounded-xl transition-colors cursor-pointer shadow-sm"
                                    >
                                        Cadastrar Livro Manualmente
                                    </button>
                                    <button
                                        onClick={() => setModalStep("import")}
                                        className="w-full sm:w-64 py-4 bg-cyan-700 hover:bg-cyan-800 text-white text-lg font-semibold rounded-xl transition-colors cursor-pointer shadow-sm"
                                    >
                                        Importar tabela do acervo
                                    </button>
                                </div>
                            </div>
                        )}

                        {modalStep === "form" && (
                            <div>
                                <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">
                                    Cadastro de Livro
                                </h2>

                                <form
                                    onSubmit={handleCadastroSubmit}
                                    className="space-y-4"
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1 col-span-1 sm:col-span-2">
                                            <label className="text-sm font-medium text-gray-700">
                                                Título do Livro
                                            </label>
                                            <input
                                                required
                                                type="text"
                                                name="titulo"
                                                value={formData.titulo}
                                                onChange={handleInputChange}
                                                className="border border-slate-400 bg-white rounded-xl p-2.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-cyan-200 focus:border-cyan-700"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-sm font-medium text-gray-700">
                                                Autor do Livro
                                            </label>
                                            <input
                                                required
                                                type="text"
                                                name="autor"
                                                value={formData.autor}
                                                onChange={handleInputChange}
                                                className="border border-slate-400 bg-white rounded-xl p-2.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-cyan-200 focus:border-cyan-700"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-sm font-medium text-gray-700">
                                                ISBN (Opcional)
                                            </label>
                                            <input
                                                type="text"
                                                name="isbn"
                                                value={formData.isbn}
                                                onChange={handleInputChange}
                                                className="border border-slate-400 bg-white rounded-xl p-2.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-cyan-200 focus:border-cyan-700"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-sm font-medium text-gray-700">
                                                Número da Edição (Opcional)
                                            </label>
                                            <input
                                                type="number"
                                                name="numeroEdicao"
                                                value={formData.numeroEdicao}
                                                onChange={handleInputChange}
                                                className="border border-slate-400 bg-white rounded-xl p-2.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-cyan-200 focus:border-cyan-700"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-sm font-medium text-gray-700">
                                                Editora (Opcional)
                                            </label>
                                            <input
                                                type="text"
                                                name="editora"
                                                value={formData.editora}
                                                onChange={handleInputChange}
                                                className="border border-slate-400 bg-white rounded-xl p-2.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-cyan-200 focus:border-cyan-700"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1 col-span-1 sm:col-span-2">
                                            <label className="text-sm font-medium text-gray-700">
                                                Quantidade de cópias
                                            </label>
                                            <input
                                                required
                                                type="number"
                                                name="unidades"
                                                value={formData.unidades}
                                                onChange={handleInputChange}
                                                className="border border-slate-400 bg-white rounded-xl p-2.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-cyan-200 focus:border-cyan-700"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-4 justify-end mt-6 pt-4 border-t border-gray-100">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setModalStep("choice")
                                            }
                                            className="px-5 py-2.5 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition-colors cursor-pointer"
                                        >
                                            Voltar
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-6 py-2.5 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
                                        >
                                            Cadastrar Livros
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {modalStep === "import" && (
                            <div className="flex flex-col items-center py-4">
                                <h2 className="text-3xl font-semibold text-gray-800 mb-2 text-center">
                                    Importar Planilha do Acervo
                                </h2>
                                <p className="text-sm text-gray-500 mb-6 text-center">
                                    Cada linha representa um livro. O Excel deve conter:{" "}
                                    <b className="text-gray-700">
                                        título
                                    </b>
                                    . Autor, edição, ISBN, editora e quantidade de cópias são opcionais.
                                </p>

                                <div className="w-full flex flex-col items-center justify-center border-2 border-dashed border-cyan-400 rounded-xl p-8 bg-cyan-100/70 hover:bg-cyan-100 transition-colors relative group">
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={handleExcelUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className="text-center pointer-events-none">
                                        <span className="text-4xl block mb-2">
                                            📊
                                        </span>
                                        <p className="text-lg font-medium text-gray-700">
                                            Clique para selecionar ou arraste o
                                            arquivo
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Formatos suportados: .xlsx, .xls
                                        </p>
                                    </div>
                                </div>

                                {colunasImportadas.length > 0 && (
                                    <div className="mt-4 w-full border border-sky-300 rounded-xl p-4 bg-sky-100/70">
                                        <p className="font-semibold mb-1">Mapeie as colunas da sua planilha.</p>
                                        <p className="text-sm text-gray-600 mb-3">
                                            Somente Título é obrigatório. Campos sem uma coluna correspondente podem ficar em branco.
                                        </p>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            {([ ["titulo", "Título *"], ["quantidade", "Estoque (opcional)"], ["autor", "Autor"], ["isbn", "ISBN (diferencia títulos iguais)"], ["editora", "Editora"], ["numeroEdicao", "Edição"] ] as const).map(([campo, rotulo]) => <label key={campo} className="flex flex-col gap-1">{rotulo}<select value={mapeamento[campo]} onChange={(e) => setMapeamento((anterior) => ({ ...anterior, [campo]: e.target.value }))} className="border rounded p-2"><option value="">{campo === "titulo" ? "Selecione uma coluna" : "Deixar em branco"}</option>{colunasImportadas.map((coluna) => <option key={coluna} value={coluna}>{coluna}</option>)}</select></label>)}
                                        </div>
                                    </div>
                                )}

                                {livrosParaImportar.length > 0 && (
                                    <div className="mt-4 w-full bg-green-50 border border-green-200 text-green-800 p-4 rounded text-sm flex justify-between items-center">
                                        <span>
                                            Planilha: <b>{livrosParaImportar.length}</b> títulos ·
                                            Estoque total: <b>{livrosParaImportar.reduce((total, item) => total + item.unidade, 0)}</b> unidades
                                        </span>
                                    </div>
                                )}

                                <div className="w-full flex gap-4 justify-end mt-8 pt-4 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setModalStep("choice")}
                                        className="px-5 py-2.5 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition-colors cursor-pointer"
                                    >
                                        Voltar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmarImportacao}
                                        disabled={
                                            livrosParaImportar.length === 0 || importando
                                        }
                                        className={`px-6 py-2.5 text-white font-medium rounded shadow transition-colors ${
                                            livrosParaImportar.length > 0 && !importando
                                                ? "bg-blue-700 hover:bg-blue-800 cursor-pointer"
                                                : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                        }`}
                                    >
                                        {importando ? "Importando, aguarde..." : "Confirmar Importação"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {selectedLivro && formEdicao && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="titulo-editor-livro"
                        onKeyDown={(evento) => controlarTecladoDialogo(evento, closeDetailsModal)}
                        className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cyan-200 bg-sky-50 p-7 shadow-2xl"
                    >
                        <div className="mb-6 flex items-start justify-between gap-4 border-b border-sky-200 pb-4">
                            <div>
                                <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">
                                    Registro #{selectedLivro.id}
                                </p>
                                <h2 id="titulo-editor-livro" className="text-3xl font-semibold text-gray-800">
                                    Editar livro
                                </h2>
                                <p className="mt-1 text-sm text-slate-600">
                                    Atualize os dados bibliográficos e o estoque total deste título.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeDetailsModal}
                                disabled={salvandoEdicao}
                                aria-label="Fechar edição"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-2xl text-gray-500 transition-colors hover:bg-sky-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="mb-6 grid grid-cols-3 gap-3">
                            <div className="rounded-xl border border-sky-200 bg-sky-100/60 p-3">
                                <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Estoque atual</span>
                                <strong className="mt-1 block text-xl text-slate-900">{selectedLivro.unidade}</strong>
                            </div>
                            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                                <span className="block text-xs font-bold uppercase tracking-wider text-amber-700">Emprestados</span>
                                <strong className="mt-1 block text-xl text-amber-800">{exemplaresEmprestados}</strong>
                            </div>
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                                <span className="block text-xs font-bold uppercase tracking-wider text-emerald-700">Disponíveis agora</span>
                                <strong className="mt-1 block text-xl text-emerald-800">{selectedLivro.disponiveis}</strong>
                            </div>
                        </div>

                        <form onSubmit={handleEdicaoSubmit} className="space-y-5">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label className="flex flex-col gap-1 sm:col-span-2" htmlFor="edicao-titulo">
                                    <span className="text-sm font-medium text-gray-700">Título do livro</span>
                                    <input
                                        id="edicao-titulo"
                                        required
                                        autoFocus
                                        name="titulo"
                                        value={formEdicao.titulo}
                                        onChange={handleEdicaoInputChange}
                                        className="rounded-xl border border-slate-400 bg-white p-2.5 shadow-sm focus:border-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-200"
                                    />
                                </label>

                                <label className="flex flex-col gap-1" htmlFor="edicao-autor">
                                    <span className="text-sm font-medium text-gray-700">Autor</span>
                                    <input
                                        id="edicao-autor"
                                        name="autor"
                                        value={formEdicao.autor}
                                        onChange={handleEdicaoInputChange}
                                        className="rounded-xl border border-slate-400 bg-white p-2.5 shadow-sm focus:border-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-200"
                                    />
                                </label>

                                <label className="flex flex-col gap-1" htmlFor="edicao-isbn">
                                    <span className="text-sm font-medium text-gray-700">ISBN</span>
                                    <input
                                        id="edicao-isbn"
                                        name="isbn"
                                        value={formEdicao.isbn}
                                        onChange={handleEdicaoInputChange}
                                        className="rounded-xl border border-slate-400 bg-white p-2.5 shadow-sm focus:border-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-200"
                                    />
                                </label>

                                <label className="flex flex-col gap-1" htmlFor="edicao-numero">
                                    <span className="text-sm font-medium text-gray-700">Número da edição</span>
                                    <input
                                        id="edicao-numero"
                                        type="number"
                                        min="1"
                                        max={LIMITE_INTEIRO_BANCO}
                                        step="1"
                                        name="numeroEdicao"
                                        value={formEdicao.numeroEdicao}
                                        onChange={handleEdicaoInputChange}
                                        className="rounded-xl border border-slate-400 bg-white p-2.5 shadow-sm focus:border-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-200"
                                    />
                                </label>

                                <label className="flex flex-col gap-1" htmlFor="edicao-editora">
                                    <span className="text-sm font-medium text-gray-700">Editora</span>
                                    <input
                                        id="edicao-editora"
                                        name="editora"
                                        value={formEdicao.editora}
                                        onChange={handleEdicaoInputChange}
                                        className="rounded-xl border border-slate-400 bg-white p-2.5 shadow-sm focus:border-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-200"
                                    />
                                </label>

                                <label className="flex flex-col gap-1 sm:col-span-2" htmlFor="edicao-unidades">
                                    <span className="text-sm font-medium text-gray-700">Estoque total</span>
                                    <input
                                        id="edicao-unidades"
                                        required
                                        type="number"
                                        min={exemplaresEmprestados}
                                        max={LIMITE_INTEIRO_BANCO}
                                        step="1"
                                        name="unidades"
                                        value={formEdicao.unidades}
                                        onChange={handleEdicaoInputChange}
                                        aria-describedby="ajuda-estoque-edicao"
                                        className="rounded-xl border border-slate-400 bg-white p-2.5 shadow-sm focus:border-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-200"
                                    />
                                    <span id="ajuda-estoque-edicao" className="text-xs text-slate-600">
                                        {formEdicao.unidades !== "" && Number.isInteger(Number(formEdicao.unidades)) && Number(formEdicao.unidades) >= exemplaresEmprestados
                                            ? `Após salvar, ${Number(formEdicao.unidades) - exemplaresEmprestados} exemplar(es) ficará(ão) disponível(is).`
                                            : `O mínimo permitido é ${exemplaresEmprestados}, pois há exemplares emprestados.`}
                                    </span>
                                </label>
                            </div>

                            {erroEdicao && (
                                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                    {erroEdicao}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 border-t border-sky-200 pt-5">
                                <button
                                    type="button"
                                    onClick={closeDetailsModal}
                                    disabled={salvandoEdicao}
                                    className="rounded-xl bg-gray-200 px-5 py-2.5 text-gray-700 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={salvandoEdicao}
                                    className="rounded-xl bg-cyan-700 px-6 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {salvandoEdicao ? "Salvando..." : "Salvar alterações"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="titulo-exclusao-livros"
                        onKeyDown={(evento) => controlarTecladoDialogo(evento, fecharModalExclusao)}
                        className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-rose-200 bg-rose-50 p-7 shadow-2xl"
                    >
                        <div className="mb-5 flex items-start justify-between gap-4 border-b border-rose-200 pb-4">
                            <div>
                                <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-red-600">Área destrutiva</p>
                                <h2 id="titulo-exclusao-livros" className="text-3xl font-semibold text-gray-900">
                                    {confirmandoExclusao ? "Confirmar exclusão" : "Exclusão de livros"}
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={fecharModalExclusao}
                                disabled={excluindoLivros}
                                aria-label="Fechar exclusão de livros"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-2xl text-gray-500 transition-colors hover:bg-red-100 hover:text-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                &times;
                            </button>
                        </div>

                        {!confirmandoExclusao ? (
                            <>
                                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                                    <strong className="block">A exclusão remove o título inteiro.</strong>
                                    Cada item representa um título e todas as suas cópias. Para preservar o histórico, livros com empréstimos vinculados — inclusive já devolvidos — não podem ser excluídos.
                                </div>

                                <label htmlFor="busca-exclusao" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-red-700">
                                    Pesquisar para selecionar
                                </label>
                                <div className="relative mb-4">
                                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400">
                                        <circle cx="11" cy="11" r="7" strokeWidth="2" />
                                        <path d="m16 16 4 4" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                    <input
                                        id="busca-exclusao"
                                        type="search"
                                        autoFocus
                                        value={buscaExclusao}
                                        onChange={(e) => setBuscaExclusao(e.target.value)}
                                        placeholder="Buscar por título, autor ou ISBN"
                                        className="w-full rounded-xl border border-slate-400 bg-white py-2.5 pl-11 pr-4 text-slate-800 shadow-sm outline-none placeholder-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-200"
                                    />
                                </div>

                                <div className="mb-5 max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1">
                                    {livrosVisiveisExclusao.map((livroItem) => {
                                        const selecionado = idsSelecionadosSet.has(livroItem.id);
                                        const emprestados = Math.max(0, livroItem.unidade - livroItem.disponiveis);
                                        return (
                                            <label
                                                key={livroItem.id}
                                                className={`group flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                                                    selecionado
                                                        ? "border-red-400 bg-red-50 ring-2 ring-red-200"
                                                        : "border-[var(--app-border)] bg-[var(--app-surface-raised)] hover:border-red-300"
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="peer sr-only"
                                                    checked={selecionado}
                                                    onChange={() => alternarLivroExclusao(livroItem.id)}
                                                />
                                                <span
                                                    aria-hidden="true"
                                                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition peer-focus-visible:ring-4 peer-focus-visible:ring-red-300/60 ${
                                                        selecionado
                                                            ? "border-red-600 bg-red-600 text-white"
                                                            : "border-slate-400 bg-white text-transparent group-hover:border-red-500"
                                                    }`}
                                                >
                                                    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5">
                                                        <path d="m4 10 3.5 3.5L16 5.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate font-semibold text-slate-900">{livroItem.titulo}</span>
                                                    <span className="mt-0.5 block text-xs text-slate-500">
                                                        {livroItem.autor || "Autor não informado"}{livroItem.isbn ? ` · ISBN ${livroItem.isbn}` : ""}
                                                    </span>
                                                </span>
                                                <span className="shrink-0 text-right text-xs text-slate-600">
                                                    <strong className="block text-sm text-slate-800">{livroItem.unidade} cópia(s)</strong>
                                                    {emprestados > 0 ? `${emprestados} emprestada(s) agora` : "Nenhum empréstimo aberto"}
                                                </span>
                                            </label>
                                        );
                                    })}
                                    {livrosVisiveisExclusao.length === 0 && (
                                        <div className="rounded-xl border border-dashed border-rose-300 bg-red-50 px-4 py-8 text-center text-sm text-slate-600">
                                            Nenhum livro encontrado para esta pesquisa.
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rose-200 pt-5">
                                    <span className="text-sm font-semibold text-slate-700">
                                        {idsSelecionadosExclusao.length} {idsSelecionadosExclusao.length === 1 ? "título selecionado" : "títulos selecionados"}
                                    </span>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={fecharModalExclusao}
                                            className="rounded-xl bg-gray-200 px-5 py-2.5 text-gray-700 transition-colors hover:bg-gray-300"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            disabled={idsSelecionadosExclusao.length === 0}
                                            onClick={() => {
                                                setErroExclusao("");
                                                setConfirmandoExclusao(true);
                                            }}
                                            className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Continuar
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                                    <strong className="block text-lg">Esta ação não pode ser desfeita.</strong>
                                    Você excluirá {livrosSelecionadosExclusao.length} {livrosSelecionadosExclusao.length === 1 ? "título" : "títulos"}, incluindo todas as {totalCopiasSelecionadasExclusao} cópia(s) cadastradas.
                                </div>

                                <div className="mb-5 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-rose-200 bg-[var(--app-surface-raised)] p-3">
                                    {livrosSelecionadosExclusao.map((livroItem) => (
                                        <div key={livroItem.id} className="flex items-center justify-between gap-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2">
                                            <span className="min-w-0">
                                                <strong className="block truncate text-slate-900">{livroItem.titulo}</strong>
                                                <span className="text-xs text-slate-500">Registro #{livroItem.id}</span>
                                            </span>
                                            <span className="shrink-0 text-sm font-semibold text-red-700">{livroItem.unidade} cópia(s)</span>
                                        </div>
                                    ))}
                                </div>

                                {titulosSelecionadosComEmprestimos > 0 && (
                                    <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                        {titulosSelecionadosComEmprestimos} {titulosSelecionadosComEmprestimos === 1 ? "título possui" : "títulos possuem"} exemplares emprestados neste momento.
                                    </p>
                                )}

                                <p className="mb-5 text-sm text-slate-600">
                                    A operação é atômica: se qualquer título tiver empréstimos ou outro vínculo que impeça a exclusão, nenhum dos selecionados será removido.
                                </p>

                                {erroExclusao && (
                                    <div role="alert" className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                        {erroExclusao}
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 border-t border-rose-200 pt-5">
                                    <button
                                        type="button"
                                        autoFocus
                                        disabled={excluindoLivros}
                                        onClick={() => {
                                            setErroExclusao("");
                                            setConfirmandoExclusao(false);
                                        }}
                                        className="rounded-xl bg-gray-200 px-5 py-2.5 text-gray-700 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Voltar
                                    </button>
                                    <button
                                        type="button"
                                        disabled={excluindoLivros}
                                        onClick={handleExcluirLivros}
                                        className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {excluindoLivros
                                            ? "Excluindo..."
                                            : `Excluir ${livrosSelecionadosExclusao.length} ${livrosSelecionadosExclusao.length === 1 ? "título" : "títulos"}`}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
