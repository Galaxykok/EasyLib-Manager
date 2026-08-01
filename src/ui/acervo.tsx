import { useState, useEffect, useMemo } from "react";
import type { ChangeEvent, FormEvent } from "react";
import * as XLSX from "xlsx";
import "./App.css";
import Sidebar from "./sidebar.tsx";

interface CadastroLivroForm {
    titulo: string;
    autor: string;
    numeroEdicao?: number | null;
    isbn?: string | null;
    editora?: string | null;
    unidade: number;
}

type ModalStep = "choice" | "form" | "import";

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

export default function Acervo() {
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [modalStep, setModalStep] = useState<ModalStep>("choice");
    const [linhasImportadas, setLinhasImportadas] = useState<Record<string, unknown>[]>([]);
    const [colunasImportadas, setColunasImportadas] = useState<string[]>([]);
    const [mapeamento, setMapeamento] = useState({ titulo: "", quantidade: "", autor: "", isbn: "", editora: "", numeroEdicao: "" });
    const [livroLista, setLivroLista] = useState<Livro[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [livro, setLivro] = useState("");
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [importando, setImportando] = useState(false);

    const [selectedLivro, setSelectedLivro] = useState<Livro | null>(null);

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

    const deleteLivro = async () => {
        const response = await window.electronAPI.deleteLivro(selectedLivro);
        if (response.success && response.data) {
            carregarLivros();
        } else {
            alert("Erro ao excluir aluno:");
            console.log(response.error);
        }
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const closeDetailsModal = (): void => {
        setSelectedLivro(null);
    };

    const carregarLivros = async () => {
        setIsLoading(true);
        if (livro !== "") {
            const response = await window.electronAPI.pesquisarLivro(livro);
            if (response.success && response.data) {
                setLivroLista(response.data);
            } else {
                console.error("Erro ao carregar livros:", response.error);
            }
            setIsLoading(false);
        } else {
            const response = await window.electronAPI.obterLivros();
            if (response.success && response.data) {
                setLivroLista(response.data);
            } else {
                console.error("Erro ao carregar livros:", response.error);
            }
            setIsLoading(false);
        }
    };

    useEffect(() => {
        window.electronAPI.obterLivros().then((response) => {
            if (response.success && response.data) {
                setLivroLista(response.data);
            } else {
                console.error("Erro ao carregar livros:", response.error);
            }
            setIsLoading(false);
        });
    }, []);

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
            carregarLivros();
        } else {
            console.error("Erro ao salvar:", response.error);
            alert("Erro ao cadastrar livro no banco de dados.");
        }
        console.log(
            `Adicionando ${quantidade} unidades ao estoque:`,
            novoLivro,
        );
        closeModal();
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
                alert(`Não foi possível ler a planilha: ${mensagem}`);
            }
        };

        reader.onerror = () => {
            const mensagem = reader.error?.message || "Falha ao acessar o arquivo selecionado.";
            window.electronAPI.registrarDebug("Leitura da planilha do acervo", mensagem);
            alert(mensagem);
        };
        reader.readAsBinaryString(file);
    };

    const handleConfirmarImportacao = async () => {
        if (livrosParaImportar.length === 0)
            return alert("Nenhum dado importado válido.");
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
                alert(`${livrosParaImportar.length} títulos importados. Estoque informado: ${quantidade}.`);
            } else {
                console.error("Erro ao salvar:", response.error);
                await window.electronAPI.registrarDebug(
                    "Importação do acervo",
                    response.error || "Erro ao cadastrar os livros importados.",
                    `Quantidade de exemplares processados: ${quantidade}`,
                );
                alert(`Erro na importação: ${response.error || "consulte a tela Debug para mais detalhes."}`);
            }
        } finally {
            setImportando(false);
        }
    };

    return (
        <div className="flex h-screen w-screen bg-[#eaf0f6] font-sans overflow-hidden relative">
            <Sidebar />

            <main className="flex-1 flex flex-col items-center p-8 xl:p-10 bg-[#eaf0f6] overflow-y-auto">
                <div className="w-full max-w-7xl flex flex-col min-h-full pb-2">
                    <div className="contents">
                        <header className="order-1 bg-gradient-to-r from-cyan-200 via-sky-100 to-blue-100 border border-cyan-300 rounded-3xl py-5 px-6 mb-5 shadow-[0_12px_30px_rgba(8,145,178,0.13)]">
                        <p className="text-xs font-semibold tracking-[0.18em] text-cyan-700 mb-1">CATÁLOGO</p>
                        <h1 className="text-4xl font-semibold text-slate-900 tracking-tight">
                            Acervo
                        </h1>
                        <p className="text-sm text-slate-600 mt-1">Consulte títulos, edições e a disponibilidade atual do estoque.</p>
                        </header>
                        <div className="order-3 w-full bg-slate-200/70 border border-slate-300 rounded-2xl p-3 min-h-[420px] flex flex-col gap-3 overflow-auto shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
                            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-xl border border-sky-200 bg-sky-100 px-4 py-3 shadow-sm">
                                <div>
                                    <h2 className="font-semibold text-slate-900">Livros encontrados</h2>
                                    <p className="text-xs text-slate-600">Selecione um registro para consultar todos os detalhes.</p>
                                </div>
                                <span className="rounded-full bg-cyan-700 px-3 py-1 text-xs font-bold text-white">{livroLista.length}</span>
                            </div>
                            {isLoading ? (
                                <div className="text-center text-gray-600 text-xl m-auto">
                                    Carregando livros...
                                </div>
                            ) : livroLista.length === 0 ? (
                                <div className="text-center text-gray-500 text-xl m-auto">
                                    Nenhum livro cadastrado.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {livroLista.map((livroItem) => (
                                        <div
                                            key={livroItem.id}
                                            onClick={() =>
                                                setSelectedLivro(livroItem)
                                            }
                                            className="grid grid-cols-[70px_minmax(0,1fr)_280px] gap-4 items-center bg-sky-50 border border-sky-200 p-4 rounded-xl shadow-sm hover:border-cyan-500 hover:bg-cyan-50 hover:shadow-md transition-all cursor-pointer"
                                        >
                                            <span className="w-fit font-mono text-xs font-semibold text-cyan-800 bg-cyan-50 border border-cyan-100 px-2.5 py-1.5 rounded-lg">
                                                {livroItem.id}
                                            </span>

                                            <div className="flex flex-col min-w-0">
                                                <span className="text-lg font-semibold text-slate-800 truncate">
                                                    {livroItem.titulo}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {livroItem.autor}
                                                </span>
                                            </div>

                                            <div className="flex flex-col items-end gap-1 min-w-0">
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
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="order-2 w-full flex items-end justify-between gap-4 mb-5 bg-cyan-100/80 border border-cyan-300 p-4 rounded-2xl shadow-[0_8px_24px_rgba(8,145,178,0.1)]">
                        <div className="flex min-w-0 flex-col gap-1.5">
                            <span className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-900">Localizar no acervo</span>
                            <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Pesquisar livro..."
                                value={livro}
                                className="w-80 px-4 py-2.5 border border-slate-400 rounded-xl bg-white text-slate-800 shadow-sm outline-none placeholder-slate-400 focus:border-cyan-700 focus:ring-4 focus:ring-cyan-200"
                                onChange={(e) => {
                                    setLivro(e.target.value);
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    carregarLivros();
                                }}
                                className="flex items-center justify-center bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer"
                                title="Pesquisar"
                            >
                                Pesquisar
                            </button>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer"
                        >
                            <span>+ Cadastrar Livro</span>
                        </button>
                    </div>
                </div>
            </main>

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

            {selectedLivro && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-sky-50 rounded-2xl p-8 w-full max-w-lg shadow-2xl border border-cyan-200 relative">
                        <h2 className="text-3xl font-semibold text-gray-800 mb-6 border-b pb-2">
                            Detalhes do Livro
                        </h2>

                        <div className="space-y-4 rounded-xl border border-sky-200 bg-sky-100/60 p-5 text-lg text-gray-700">
                            <div>
                                <span className="font-bold text-gray-500 block text-sm uppercase tracking-wider">
                                    ID do Registro
                                </span>
                                <span className="text-cyan-600 font-medium">
                                    {selectedLivro.id}
                                </span>
                            </div>
                            <div>
                                <span className="font-bold text-gray-500 block text-sm uppercase tracking-wider">
                                    Título
                                </span>
                                <span className="text-xl font-semibold text-gray-900">
                                    {selectedLivro.titulo}
                                </span>
                            </div>
                            <div>
                                <span className="font-bold text-gray-500 block text-sm uppercase tracking-wider">
                                    Autor
                                </span>
                                <span>{selectedLivro.autor}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="font-bold text-gray-500 block text-sm uppercase tracking-wider">
                                        Edição
                                    </span>
                                    <span>
                                        {selectedLivro.numeroEdicao
                                            ? `${selectedLivro.numeroEdicao}ª Edição`
                                            : "Não informada"}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-bold text-gray-500 block text-sm uppercase tracking-wider">
                                        Estoque total
                                    </span>
                                    <span>{selectedLivro.unidade} unidades</span>
                                </div>
                            </div>
                            <div>
                                <span className="font-bold text-gray-500 block text-sm uppercase tracking-wider">
                                    Disponíveis para empréstimo
                                </span>
                                <span>{selectedLivro.disponiveis} unidades</span>
                            </div>
                            <div>
                                <span className="font-bold text-gray-500 block text-sm uppercase tracking-wider">
                                    Editora
                                </span>
                                <span>
                                    {selectedLivro.editora || "Não informada"}
                                </span>
                            </div>
                            <div>
                                <span className="font-bold text-gray-500 block text-sm uppercase tracking-wider">
                                    ISBN
                                </span>
                                <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-sm">
                                    {selectedLivro.isbn || "Não informado"}
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-100">
                            <button
                                type="button"
                                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded shadow transition-colors cursor-pointer"
                                onClick={() => setShowDeleteModal(true)}
                            >
                                Excluir Livro
                            </button>
                            <button
                                type="button"
                                onClick={() => closeDetailsModal()}
                                className="px-5 py-2.5 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition-colors cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]">
                    <div className="bg-rose-50 rounded-2xl p-6 w-full max-w-md shadow-xl border border-rose-200">
                        <h2 className="text-2xl font-semibold text-red-600 mb-4">
                            Confirmar exclusão
                        </h2>

                        <p className="text-gray-600 mb-6">
                            Tem certeza que deseja deletar este empréstimo?
                        </p>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                            >
                                Cancelar
                            </button>

                            <button
                                onClick={() => {
                                    deleteLivro();
                                    setShowDeleteModal(false);
                                    closeDetailsModal();
                                }}
                                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded"
                            >
                                Deletar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
