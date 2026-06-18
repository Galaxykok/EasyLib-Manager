import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link } from "react-router-dom";
import "./App.css";

interface CadastroEmprestimoForm {
    alunoId: string;
    livroId: string;
    dataDevolucaoPrevista: string;
}

export default function Emprestimos() {
    // Estados para controlar o Pop-up do formulário
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    const [formData, setFormData] = useState<CadastroEmprestimoForm>({
        alunoId: '',
        livroId: '',
        dataDevolucaoPrevista: ''
    });

    const closeModal = (): void => {
        setIsModalOpen(false);
        setFormData({ alunoId: '', livroId: '', dataDevolucaoPrevista: '' });
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCadastroSubmit = (e: FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        closeModal();
    };

    return (
        <div className="flex h-screen w-screen bg-white font-sans overflow-hidden relative">

            <aside className="w-64 flex flex-col pt-16 relative bg-white flex-shrink-0">
                <div className="absolute right-0 top-0 bottom-0 w-2 bg-gray-300" />
                <nav className="flex flex-col gap-6 pl-6 z-10">
                    <Link to="/" 
                        className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9">
                        <span>Home</span>
                    </Link>

                    <Link
                        to="/acervo"
                        className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9">
                        <span>Acervo</span>
                    </Link>

                    <Link
                        to="/emprestimos"
                        className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer">
                        <span className="w-6 h-6 bg-cyan-400 block" />
                        <span>Empréstimos</span>
                    </Link>

                    <Link
                        to="/aluno"
                        className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9">
                        <span>Alunos</span>
                    </Link>
                </nav>
            </aside>

            {/* Conteúdo Principal */}
            <main className="flex-1 flex flex-col items-center pt-8 px-12 bg-white overflow-y-auto">
                <div className="w-full max-w-7xl flex flex-col h-full justify-between pb-8">
                    
                    <div>
                        <h1 className="text-7xl font-normal text-center text-black mb-8 tracking-wide">
                            Empréstimos
                        </h1>

                        {/* Container Central de Listagem (Vazio/Sem dados mockados) */}
                        <div className="w-full bg-[#DCE2F4] border border-gray-600 rounded-md p-6 h-[60vh] flex flex-col gap-4 overflow-auto shadow-sm">
                        </div>
                    </div>

                    {/* Barra de Ações Inferior */}
                    <div className="w-full flex items-center justify-between mt-6">
                        <div className="flex gap-4">
                            <input 
                                type="text" 
                                placeholder="Pesquisar livro..." 
                                className="w-80 px-4 py-3 text-lg border border-gray-400 rounded-md bg-white text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                            />
                            <input 
                                type="text" 
                                placeholder="Pesquisar aluno..." 
                                className="w-80 px-4 py-3 text-lg border border-gray-400 rounded-md bg-white text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                            />
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

            {/* Pop-up do Formulário de Empréstimo */}
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
                            <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">Cadastro de Empréstimo</h2>
                            
                            <form onSubmit={handleCadastroSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-sm font-medium text-gray-700">ID do Aluno</label>
                                        <input required type="text" name="alunoId" value={formData.alunoId} onChange={handleInputChange} className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600" />
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <label className="text-sm font-medium text-gray-700">ID do Livro</label>
                                        <input required type="text" name="livroId" value={formData.livroId} onChange={handleInputChange} className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600" />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium text-gray-700">Data de Devolução Prevista</label>
                                    <input required type="date" name="dataDevolucaoPrevista" value={formData.dataDevolucaoPrevista} onChange={handleInputChange} className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600" />
                                </div>

                                {/* Ações do Formulário */}
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

        </div>
    );
}