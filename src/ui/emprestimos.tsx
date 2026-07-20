import { useState, useEffect } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import "./App.css";
import { StatusEmprestimo } from "./enum.ts";

interface CadastroEmprestimoForm {
    alunoId: string;
    livroId: string;
    dataDevolucaoPrevista: "";
}

const statusStyles: Record<StatusEmprestimo, string> = {
    [StatusEmprestimo.ATIVO]: "bg-blue-100 text-green-800",
    [StatusEmprestimo.DEVOLVIDO]: "bg-green-100 text-blue-800",
    [StatusEmprestimo.ATRASADO]: "bg-red-100 text-red-800",
};

export default function Emprestimos() {
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [emprestimoLista, setEmprestimoLista] = useState<Emprestimo[]>([]);
    const [aluno, setAluno] = useState("");
    const [livro, setLivro] = useState("");
    const [selectedEmprestimo, setSelectedEmprestimo] =
        useState<Emprestimo | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);

    const [formData, setFormData] = useState<CadastroEmprestimoForm>({
        alunoId: "",
        livroId: "",
        dataDevolucaoPrevista: "",
    });

    const closeModal = (): void => {
        setIsModalOpen(false);
        setFormData({ alunoId: "", livroId: "", dataDevolucaoPrevista: "" });
    };

    const handleInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const closeDetailsModal = (): void => {
        setSelectedEmprestimo(null);
    };

    const carregarEmprestimos = async () => {
        setIsLoading(true);
        if (aluno !== "" || livro !== "") {
            const response =
                await window.electronAPI.pesquisarEmprestimos({aluno, livro});
            if (response.success && response.data) {
                setEmprestimoLista(response.data);
            } else {
                console.error("Erro ao carregar alunos:", response.error);
            }
            setIsLoading(false);
        } else {
            const response = await window.electronAPI.obterEmprestimo();
            if (response.success && response.data) {
                setEmprestimoLista(response.data);
            } else {
                console.error("Erro ao carregar alunos:", response.error);
            }
            setIsLoading(false);
        }
    };

    const deleteEmprestimo = async () => {
        const response =
            await window.electronAPI.deleteEmprestimo(selectedEmprestimo);

        if (response.success && response.data) {
            carregarEmprestimos();
        } else {
            alert("Erro ao excluir aluno:");
            console.log(response.error);
        }
    };

    const confirmarDevolução = async () => {
        const response = await window.electronAPI.confirmarDevolucao(selectedEmprestimo)
        if (response.success && response.data){
            carregarEmprestimos();
        } else {
            alert("Erro ao devolver livro no sistema")
            console.log(response.error)
        }
    }

    useEffect(() => {
        carregarEmprestimos();
    }, []);

    const handleCadastroSubmit = async (
        e: FormEvent<HTMLFormElement>,
    ): Promise<void> => {
        e.preventDefault();

        const dataConvertida = new Date(
            `${formData.dataDevolucaoPrevista}T12:00:00`,
        );

        if (isNaN(dataConvertida.getTime()) || dataConvertida < new Date()) {
            alert("Por favor, insira uma data de devolução válida.");
            return;
        }

        const dadosParaEnviar = {
            aluno: Number(formData.alunoId),
            livro: Number(formData.livroId),
            dataDevolucaoPrevista: dataConvertida,
        };

        try {
            const response =
                await window.electronAPI.cadastrarEmprestimo(dadosParaEnviar);

            if (response.success) {
                console.log(
                    "Empréstimo cadastrado com sucesso:",
                    response.data,
                );
                closeModal();
                carregarEmprestimos();
            } else {
                console.error("Erro ao salvar:", response.error);
                alert("Erro ao cadastrar empréstimo no banco de dados.");
            }
        } catch (error) {
            console.error("Erro na comunicação com a API:", error);
            alert("Erro interno ao processar o empréstimo.");
        }
    };

    return (
        <div className="flex h-screen w-screen bg-white font-sans overflow-hidden relative">
            <aside className="w-64 flex flex-col pt-16 relative bg-white flex-shrink-0">
                <div className="absolute right-0 top-0 bottom-0 w-2 bg-gray-300" />
                <nav className="flex flex-col gap-6 pl-6 z-10">
                    <Link
                        to="/"
                        className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9"
                    >
                        <span>Home</span>
                    </Link>

                    <Link
                        to="/acervo"
                        className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9"
                    >
                        <span>Acervo</span>
                    </Link>

                    <Link
                        to="/emprestimos"
                        className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer"
                    >
                        <span className="w-6 h-6 bg-cyan-400 block" />
                        <span>Empréstimos</span>
                    </Link>

                    <Link
                        to="/aluno"
                        className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9"
                    >
                        <span>Alunos</span>
                    </Link>
                </nav>
            </aside>

            <main className="flex-1 flex flex-col items-center pt-8 px-12 bg-white overflow-y-auto">
                <div className="w-full max-w-7xl flex flex-col h-full justify-between pb-8">
                    <div>
                        <h1 className="text-7xl font-normal text-center text-black mb-8 tracking-wide">
                            Empréstimos
                        </h1>

                        <div className="w-full bg-[#DCE2F4] border border-gray-600 rounded-md p-6 h-[60vh] flex flex-col gap-4 overflow-auto shadow-sm">
                            {isLoading ? (
                                <div className="text-center text-gray-600 text-xl m-auto">
                                    Carregando empréstimos...
                                </div>
                            ) : emprestimoLista.length === 0 ? (
                                <div className="text-center text-gray-500 text-xl m-auto">
                                    Nenhum empréstimo encontrado.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {emprestimoLista.map((emprestimo) => {
                                        return (
                                            <div
                                                key={emprestimo.id}
                                                onClick={() =>
                                                    setSelectedEmprestimo(
                                                        emprestimo,
                                                    )
                                                }
                                                className="flex justify-between items-center bg-white border border-gray-300 p-4 rounded shadow-sm hover:border-gray-400 transition-all cursor-pointer"
                                            >
                                                <div className="flex flex-col flex-1">
                                                    <span className="text-xl font-medium text-gray-800">
                                                        {emprestimo.aluno.nome}
                                                    </span>

                                                    <span className="text-sm text-gray-500">
                                                        {
                                                            emprestimo.livro
                                                                .titulo
                                                        }
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <span className="bg-cyan-100 text-cyan-800 font-semibold px-3 py-1 rounded-full text-sm">
                                                        {new Date(
                                                            emprestimo.dataDevolucaoPrevista,
                                                        ).toLocaleDateString(
                                                            "pt-BR",
                                                        )}
                                                    </span>

                                                    <span
                                                        className={`px-3 py-1 rounded-full ${statusStyles[emprestimo.status]}`}
                                                    >
                                                        {emprestimo.status}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="w-full flex items-center justify-between mt-6">
                        <div className="flex gap-4">
                            <input
                                type="text"
                                placeholder="Pesquisar livro..."
                                className="w-80 px-4 py-3 text-lg border border-gray-400 rounded-md bg-white text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                                value={livro}
                                onChange={(e) => setLivro(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Pesquisar aluno..."
                                className="w-80 px-4 py-3 text-lg border border-gray-400 rounded-md bg-white text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                                value={aluno}
                                onChange={(e) => setAluno(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    carregarEmprestimos();
                                }}
                                className="flex items-center justify-center bg-[#006414] hover:bg-green-800 text-white p-3.5 rounded-md shadow transition-colors cursor-pointer"
                                title="Pesquisar"
                            >
                                Pesquisar
                            </button>
                        </div>

                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 bg-[#006414] hover:bg-green-800 text-white font-normal text-lg px-6 py-3 rounded shadow transition-colors cursor-pointer"
                        >
                            <span>+ Cadastrar Empréstimo</span>
                        </button>
                    </div>
                </div>
            </main>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 w-full max-w-xl shadow-2xl border border-gray-200 relative">
                        <button
                            onClick={closeModal}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold focus:outline-none cursor-pointer"
                        >
                            &times;
                        </button>

                        <div>
                            <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">
                                Cadastro de Empréstimo
                            </h2>

                            <form
                                onSubmit={handleCadastroSubmit}
                                className="space-y-4"
                            >
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-sm font-medium text-gray-700">
                                            ID do Aluno
                                        </label>
                                        <input
                                            required
                                            type="text"
                                            name="alunoId"
                                            value={formData.alunoId}
                                            onChange={handleInputChange}
                                            className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <label className="text-sm font-medium text-gray-700">
                                            ID do Livro
                                        </label>
                                        <input
                                            required
                                            type="text"
                                            name="livroId"
                                            value={formData.livroId}
                                            onChange={handleInputChange}
                                            className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium text-gray-700">
                                        Data de Devolução Prevista
                                    </label>
                                    <input
                                        required
                                        type="date"
                                        name="dataDevolucaoPrevista"
                                        value={formData.dataDevolucaoPrevista}
                                        onChange={handleInputChange}
                                        className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600"
                                    />
                                </div>

                                <div className="flex gap-4 justify-end mt-6 pt-4 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="px-5 py-2.5 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition-colors cursor-pointer"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 bg-[#006414] hover:bg-green-800 text-white font-medium rounded shadow transition-colors cursor-pointer"
                                    >
                                        Cadastrar Empréstimo
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            {selectedEmprestimo && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 w-full max-w-lg shadow-2xl border border-gray-200 relative">
                        <h2 className="text-3xl font-semibold text-gray-800 mb-6 border-b pb-2">
                            Detalhes do Empréstimo
                        </h2>

                        <div className="space-y-4 text-lg text-gray-700">
                            <div>
                                <span className="font-bold text-gray-500 block text-sm uppercase tracking-wider">
                                    ID do Aluno
                                </span>

                                <span className="text-cyan-600 font-medium">
                                    {selectedEmprestimo.aluno.id}
                                </span>
                            </div>

                            <div>
                                <span className="font-bold text-gray-500 block text-sm uppercase tracking-wider">
                                    Nome do Aluno
                                </span>

                                <span>{selectedEmprestimo.aluno.nome}</span>
                            </div>

                            <div>
                                <span className="font-bold text-gray-500 block text-sm uppercase tracking-wider">
                                    ID do Livro
                                </span>

                                <span className="text-cyan-600 font-medium">
                                    {selectedEmprestimo.livro.id}
                                </span>
                            </div>

                            <div>
                                <span className="font-bold text-gray-500 block text-sm uppercase tracking-wider">
                                    Nome do Livro
                                </span>

                                <span>{selectedEmprestimo.livro.titulo}</span>
                            </div>

                            <div>
                                <span className="font-bold text-gray-500 block text-sm uppercase tracking-wider">
                                    Data de Devolução
                                </span>

                                <span>
                                    {new Date(
                                        selectedEmprestimo.dataDevolucaoPrevista,
                                    ).toLocaleDateString("pt-BR")}
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-between mt-8 pt-4 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setShowDeleteModal(true)}
                                className="px-5 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded transition-colors cursor-pointer"
                            >
                                Deletar Empréstimo
                            </button>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowReturnModal(true)}
                                    className="px-5 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded transition-colors cursor-pointer"
                                >
                                    Devolver Livro
                                </button>
                                <button
                                    type="button"
                                    onClick={closeDetailsModal}
                                    className="px-5 py-2.5 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition-colors cursor-pointer"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
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
                                    deleteEmprestimo();
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
            {showReturnModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                        <h2 className="text-2xl font-semibold text-emerald-600 mb-4">
                            Confirmar devolução
                        </h2>

                        <p className="text-gray-600 mb-6">
                            Confirma a devolução deste livro?
                        </p>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowReturnModal(false)}
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                            >
                                Cancelar
                            </button>

                            <button
                                onClick={() => {
                                    confirmarDevolução();
                                    setShowReturnModal(false);
                                    closeDetailsModal();
                                }}
                                className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
