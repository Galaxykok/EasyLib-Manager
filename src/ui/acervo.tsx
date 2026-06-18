import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link } from "react-router-dom";
import "./App.css";

interface CadastroLivroForm {
    nome: string;
    autor: string;
    isbn: string;
    edicao: string;
    editora: string;
    unidades: string;
}

type ModalStep = 'choice' | 'form';

export default function Acervo() {
    // Estados tipados para controlar o Pop-up
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [modalStep, setModalStep] = useState<ModalStep>('choice');

    //const [livros, setLivros] = useState<CadastroLivroForm[]>([]);

    const [formData, setFormData] = useState<CadastroLivroForm>({
        nome: '',
        autor: '',
        isbn: '',
        edicao: '',
        editora: '',
        unidades: ''
    });

    const closeModal = (): void => {
        setIsModalOpen(false);
        setModalStep('choice');
        setFormData({ nome: '', autor: '', isbn: '', edicao: '', editora: '', unidades: '' });
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCadastroSubmit = (e: FormEvent<HTMLFormElement>): void => {
        e.preventDefault();

        
        console.log("Livro Cadastrado via TypeScript:", formData);
        closeModal();
    };

    return (
        <div className="flex h-screen w-screen bg-white font-sans overflow-hidden relative">

            <aside className="w-64 flex flex-col pt-16 relative bg-white flex-shrink-0">
                <div className="absolute right-0 top-0 bottom-0 w-2 bg-gray-300" />
                <nav className="flex flex-col gap-6 pl-6 z-10">
                    <Link to="/" className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9">
                        <span>Home</span>
                    </Link>
                    <Link to="/acervo" className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer">
                        <span className="w-6 h-6 bg-cyan-400 block" />
                        <span>Acervo</span>
                    </Link>
                    <Link to="/emprestimos" className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9">
                        <span>Empréstimos</span>
                    </Link>
                    <Link to="/aluno" className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9">
                        <span>Alunos</span>
                    </Link>
                </nav>
            </aside>

            <main className="flex-1 flex flex-col items-center pt-8 px-12 bg-white overflow-y-auto">
                <div className="w-full max-w-7xl flex flex-col h-full justify-between pb-8">
                    
                    <div>
                        <h1 className="text-7xl font-normal text-center text-black mb-8 tracking-wide">
                            Acervo
                        </h1>

                        <div className="w-full bg-[#DCE2F4] border border-gray-600 rounded-md p-6 h-[60vh] flex flex-col gap-4 overflow-auto shadow-sm">
                            
                        </div>
                    </div>

                    {/* Barra de Ações */}
                    <div className="w-full flex items-center justify-between mt-6">
                        <input 
                            type="text" 
                            placeholder="Pesquisar livro..." 
                            className="w-80 px-4 py-3 text-lg border border-gray-400 rounded-md bg-white text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                        />

                        <button 
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 bg-[#006414] hover:bg-green-800 text-white font-normal text-lg px-6 py-3 rounded shadow transition-colors cursor-pointer"
                        >
                            <span>+ Cadastrar Livro</span>
                        </button>
                    </div>

                </div>
            </main>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 w-full max-w-2xl shadow-2xl border border-gray-200 relative">
                        
                        <button 
                            onClick={closeModal}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold focus:outline-none cursor-pointer"
                        >
                            &times;
                        </button>

                        {modalStep === 'choice' && (
                            <div className="text-center py-6">
                                <h2 className="text-3xl font-semibold text-gray-800 mb-8">Adicionar Novo Livro</h2>
                                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                                    <button 
                                        onClick={() => setModalStep('form')}
                                        className="w-full sm:w-64 py-4 bg-[#006414] hover:bg-green-800 text-white text-lg font-medium rounded-md transition-colors cursor-pointer shadow"
                                    >
                                        Cadastrar Livro Manualmente
                                    </button>
                                    <button 
                                        disabled
                                        className="w-full sm:w-64 py-4 bg-gray-300 text-gray-500 text-lg font-medium rounded-md cursor-not-allowed shadow"
                                        title="Função indisponível no momento"
                                    >
                                        Importar Tabela de Livros
                                    </button>
                                </div>
                            </div>
                        )}

                        {modalStep === 'form' && (
                            <div>
                                <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">Cadastro de Livro</h2>
                                
                                <form onSubmit={handleCadastroSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1 col-span-1 sm:col-span-2">
                                            <label className="text-sm font-medium text-gray-700">Nome do Livro</label>
                                            <input required type="text" name="nome" value={formData.nome} onChange={handleInputChange} className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600" />
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-sm font-medium text-gray-700">Autor do Livro</label>
                                            <input required type="text" name="autor" value={formData.autor} onChange={handleInputChange} className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600" />
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-sm font-medium text-gray-700">ISBN</label>
                                            <input required type="text" name="isbn" value={formData.isbn} onChange={handleInputChange} className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600" />
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-sm font-medium text-gray-700">Edição do Livro</label>
                                            <input required type="text" name="edicao" value={formData.edicao} onChange={handleInputChange} className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600" />
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-sm font-medium text-gray-700">Editora</label>
                                            <input required type="text" name="editora" value={formData.editora} onChange={handleInputChange} className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600" />
                                        </div>

                                        <div className="flex flex-col gap-1 col-span-1 sm:col-span-2">
                                            <label className="text-sm font-medium text-gray-700">Unidades do Livro</label>
                                            <input required type="number" min="1" name="unidades" value={formData.unidades} onChange={handleInputChange} className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600" />
                                        </div>
                                    </div>

                                    {/* Ações do Formulário */}
                                    <div className="flex gap-4 justify-end mt-6 pt-4 border-t border-gray-100">
                                        <button 
                                            type="button" 
                                            onClick={() => setModalStep('choice')}
                                            className="px-5 py-2.5 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition-colors cursor-pointer"
                                        >
                                            Voltar
                                        </button>
                                        <button 
                                            type="submit"
                                            className="px-6 py-2.5 bg-[#006414] hover:bg-green-800 text-white font-medium rounded shadow transition-colors cursor-pointer"
                                        >
                                            Cadastrar Livro
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                    </div>
                </div>
            )}

        </div>
    );
}