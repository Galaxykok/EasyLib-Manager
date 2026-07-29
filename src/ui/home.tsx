import logoIcon from "./assets/icon.png";
import "./App.css";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { StatusEmprestimo } from "./enum.ts";

const statusStyles: Record<StatusEmprestimo, string> = {
    [StatusEmprestimo.ATIVO]: "bg-blue-100 text-green-800",
    [StatusEmprestimo.DEVOLVIDO]: "bg-green-100 text-blue-800",
    [StatusEmprestimo.ATRASADO]: "bg-red-100 text-red-800",
};

export default function Home() {
    const [emprestimoLista, setEmprestimoLista] = useState<Emprestimo[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [selectedEmprestimo, setSelectedEmprestimo] = useState<Emprestimo | null>(null);
    const [showReturnModal, setShowReturnModal] = useState(false);

    const carregarEmprestimos = async () => {
        setIsLoading(true);
        const response = await window.electronAPI.obterEmprestimo();
        if (response.success && response.data) {
            setEmprestimoLista(response.data);
        } else {
            console.error("Erro ao carregar alunos:", response.error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        carregarEmprestimos();
    }, []);

    const closeDetailsModal = (): void => {
        setSelectedEmprestimo(null);
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

    return (
        <div className="flex h-screen w-screen bg-white font-sans overflow-hidden">
            <aside className="w-64 flex flex-col pt-16 relative bg-white flex-shrink-0">
                <div className="absolute right-0 top-0 bottom-0 w-2 bg-gray-300" />
                <nav className="flex flex-col gap-6 pl-6 z-10">
                    <Link
                        to="/"
                        className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer"
                    >
                        <span className="w-6 h-6 bg-cyan-400 block" />
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
                        className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9"
                    >
                        <span>Empréstimos</span>
                    </Link>

                    <Link
                        to="/aluno"
                        className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9"
                    >
                        <span>Alunos</span>
                    </Link>

                    <Link
                        to="/exportacao"
                        className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9"
                    >
                        <span>Exportação de dados</span>
                    </Link>
                    <Link
                        to="/debug"
                        className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9"
                    >
                        <span>Debug</span>
                    </Link>
                </nav>
            </aside>

            <main className="flex-1 flex flex-col items-center pt-8 px-12 bg-white overflow-y-auto">
                {/* Header centralizado com espaçamento reduzido */}
                <header className="flex items-center justify-center gap-6 mb-6 w-full max-w-7xl">
                    <h1 className="text-4xl font-medium tracking-wide text-center text-gray-800">
                        Seja bem-vindo ao EasyLib Manager
                    </h1>

                    <img
                        src={logoIcon}
                        className="w-24 h-24 object-contain flex-shrink-0"
                        alt="Logo"
                    />
                </header>
                <section className="w-full max-w-7xl flex flex-col h-full justify-between pb-8">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800 text-center mb-4">
                            Empréstimos próximos do vencimento:
                        </h2>

                        <div className="w-full h-[65vh] bg-[#E2E6F3] border-2 border-black rounded-md p-6 overflow-y-auto shadow-sm">
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
                                    {emprestimoLista
                                        .map((emprestimo) => {
                                            const hoje = new Date();
                                            const dataPrevista = emprestimo.dataDevolucaoPrevista
                                                ? new Date(emprestimo.dataDevolucaoPrevista)
                                                : null;

                                            const diffDias = dataPrevista
                                                ? Math.ceil((dataPrevista.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
                                                : Number.POSITIVE_INFINITY;

                                            return {
                                                ...emprestimo,
                                                diffDias,
                                            };
                                        })
                                        .filter(
                                            (emprestimo) =>
                                                emprestimo.diffDias < 3 && emprestimo.status !== "DEVOLVIDO",
                                        )
                                        .map((emprestimo) => {
                                            const corCirculo =
                                                emprestimo.status === "ATRASADO"
                                                    ? "bg-red-500"
                                                    : "bg-yellow-400";

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
                                                            {
                                                                emprestimo.aluno
                                                                    .nome
                                                            }
                                                        </span>

                                                        <span className="text-sm text-gray-500">
                                                            {
                                                                emprestimo.livro
                                                                    .titulo
                                                            }
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-4">
                                                        <div className="flex flex-col items-end gap-2">
                                                            <span className="bg-cyan-100 text-cyan-800 font-semibold px-3 py-1 rounded-full text-sm">
                                                                {emprestimo.dataDevolucaoPrevista
                                                                    ? new Date(emprestimo.dataDevolucaoPrevista).toLocaleDateString("pt-BR")
                                                                    : "Sem prazo"}
                                                            </span>

                                                            <span
                                                                className={`px-3 py-1 rounded-full ${statusStyles[emprestimo.status]}`}
                                                            >
                                                                {
                                                                    emprestimo.status
                                                                }
                                                            </span>
                                                        </div>
                                                        <div
                                                            className={`w-4 h-4 rounded-full ${corCirculo}`}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    </div>

                    <footer className="flex items-center gap-8 mt-4 pl-2">
                        <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-red-600 block" />
                            <span className="text-lg font-semibold text-gray-900">
                                Atrasados
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-yellow-400 block" />
                            <span className="text-lg font-semibold text-gray-900">
                                Faltam 3 dias ou menos
                            </span>
                        </div>
                    </footer>
                </section>
            </main>
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
                                    {selectedEmprestimo.dataDevolucaoPrevista
                                        ? new Date(selectedEmprestimo.dataDevolucaoPrevista).toLocaleDateString("pt-BR")
                                        : "Sem prazo"}
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-between mt-8 pt-4 border-t border-gray-100">


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
                                    onClick={() => closeDetailsModal()}
                                    className="px-5 py-2.5 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition-colors cursor-pointer"
                                >
                                    Fechar
                                </button>
                            </div>
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
