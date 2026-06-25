import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link } from "react-router-dom";
import * as XLSX from 'xlsx';
import "./App.css";

// Interface atualizada de acordo com o seu Schema do Prisma
interface CadastroLivroForm {
    titulo: string;
    autor: string;
    numeroEdicao?: number | null; // Int?
    isbn?: string | null;         // String? @unique
    editora?: string | null;      // String?
    unidade: number;              // Int @default(1) - Cada objeto representará 1 unidade física
}

type ModalStep = 'choice' | 'form' | 'import';

export default function Acervo() {
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [modalStep, setModalStep] = useState<ModalStep>('choice');

    // Array que guardará a lista de livros (já desmembrados unitariamente) prontos para o Prisma
    const [livrosParaImportar, setLivrosParaImportar] = useState<CadastroLivroForm[]>([]);

    // Form manual simplificado (unidades aqui serve apenas para o usuário dizer quantos quer gerar)
    const [formData, setFormData] = useState({
        titulo: '',
        autor: '',
        isbn: '',
        numeroEdicao: '',
        editora: '',
        unidades: '1'
    });

    const closeModal = (): void => {
        setIsModalOpen(false);
        setModalStep('choice');
        setFormData({ titulo: '', autor: '', isbn: '', numeroEdicao: '', editora: '', unidades: '1' });
        setLivrosParaImportar([]);
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCadastroSubmit = (e: FormEvent<HTMLFormElement>): void => {
        e.preventDefault();

        const quantidade = Math.max(1, Number(formData.unidades || 1));
        const novosLivros: CadastroLivroForm[] = [];

        for (let i = 0; i < quantidade; i++) {
            novosLivros.push({
                titulo: formData.titulo,
                autor: formData.autor,
                isbn: formData.isbn || null,
                numeroEdicao: formData.numeroEdicao ? Number(formData.numeroEdicao) : null,
                editora: formData.editora || null,
                unidade: i+1
            });
        }

        console.log(`Cadastrando ${quantidade} unidades individuais manualmente no Prisma:`, novosLivros);
        closeModal();
    };

    const handleExcelUpload = (e: ChangeEvent<HTMLInputElement>): void => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (event) => {
            const data = event.target?.result;
            if (!data) return;

            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

            const livrosDesmembrados: CadastroLivroForm[] = [];

            // Varre cada linha da planilha
            jsonData.forEach((row) => {
                const qtdPlanilha = Number(row.unidades || row.Unidades || row.unidade || row.Unidade || 1);
                const quantidade = Math.max(1, qtdPlanilha);

                for (let i = 0; i < quantidade; i++) {
                    livrosDesmembrados.push({
                        titulo: String(row.titulo || row.Titulo || row.nome || row.Nome || ''),
                        autor: String(row.autor || row.Autor || ''),
                        isbn: row.isbn || row.ISBN ? String(row.isbn || row.ISBN) : null,
                        numeroEdicao: row.numeroEdicao || row.edicao || row.Edição ? Number(row.numeroEdicao || row.edicao || row.Edição) : null,
                        editora: row.editora || row.Editora ? String(row.editora || row.Editora) : null,
                        unidade: i + 1
                    });
                }
            });

            setLivrosParaImportar(livrosDesmembrados);
            console.log("Linhas individuais geradas para o Prisma:", livrosDesmembrados);
        };

        reader.readAsBinaryString(file);
    };

    const handleConfirmarImportacao = () => {
        if (livrosParaImportar.length === 0) return alert("Nenhum dado importado válido.");
        console.log("Enviando coleção unitária para o Prisma:", livrosParaImportar);
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
                            {/* Lista do acervo */}
                        </div>
                    </div>

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

                        <button onClick={closeModal} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold focus:outline-none cursor-pointer">
                            &times;
                        </button>

                        {/* PASSO 1: ESCOLHA */}
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
                                        onClick={() => setModalStep('import')}
                                        className="w-full sm:w-64 py-4 bg-blue-700 hover:bg-blue-800 text-white text-lg font-medium rounded-md transition-colors cursor-pointer shadow"
                                    >
                                        Importar tabela do acervo
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* PASSO 2: FORMULÁRIO MANUAL */}
                        {modalStep === 'form' && (
                            <div>
                                <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">Cadastro de Livro</h2>

                                <form onSubmit={handleCadastroSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1 col-span-1 sm:col-span-2">
                                            <label className="text-sm font-medium text-gray-700">Título do Livro</label>
                                            <input required type="text" name="titulo" value={formData.titulo} onChange={handleInputChange} className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600" />
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-sm font-medium text-gray-700">Autor do Livro</label>
                                            <input required type="text" name="autor" value={formData.autor} onChange={handleInputChange} className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600" />
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-sm font-medium text-gray-700">ISBN (Opcional)</label>
                                            <input type="text" name="isbn" value={formData.isbn} onChange={handleInputChange} className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600" />
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-sm font-medium text-gray-700">Número da Edição (Opcional)</label>
                                            <input type="number" name="numeroEdicao" value={formData.numeroEdicao} onChange={handleInputChange} className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600" />
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-sm font-medium text-gray-700">Editora (Opcional)</label>
                                            <input type="text" name="editora" value={formData.editora} onChange={handleInputChange} className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600" />
                                        </div>

                                        <div className="flex flex-col gap-1 col-span-1 sm:col-span-2">
                                            <label className="text-sm font-medium text-gray-700">Quantidade de cópias</label>
                                            <input required type="number" min="1" name="unidades" value={formData.unidades} onChange={handleInputChange} className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600" />
                                        </div>
                                    </div>

                                    <div className="flex gap-4 justify-end mt-6 pt-4 border-t border-gray-100">
                                        <button type="button" onClick={() => setModalStep('choice')} className="px-5 py-2.5 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition-colors cursor-pointer">
                                            Voltar
                                        </button>
                                        <button type="submit" className="px-6 py-2.5 bg-[#006414] hover:bg-green-800 text-white font-medium rounded shadow transition-colors cursor-pointer">
                                            Cadastrar Livros
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {modalStep === 'import' && (
                            <div className="flex flex-col items-center py-4">
                                <h2 className="text-3xl font-semibold text-gray-800 mb-2 text-center">Importar Planilha do Acervo</h2>
                                <p className="text-sm text-gray-500 mb-6 text-center">
                                    O Excel deve conter colunas equivalentes a: <b className="text-gray-700">titulo, autor, numeroEdicao, isbn, editora, unidades</b>.
                                </p>

                                <div className="w-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8 bg-gray-50 hover:bg-gray-100 transition-colors relative group">
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={handleExcelUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className="text-center pointer-events-none">
                                        <span className="text-4xl block mb-2">📊</span>
                                        <p className="text-lg font-medium text-gray-700">Clique para selecionar ou arraste o arquivo</p>
                                        <p className="text-xs text-gray-400 mt-1">Formatos suportados: .xlsx, .xls</p>
                                    </div>
                                </div>

                                {livrosParaImportar.length > 0 && (
                                    <div className="mt-4 w-full bg-green-50 border border-green-200 text-green-800 p-4 rounded text-sm flex justify-between items-center">
                                        <span>✓ Foram gerados <b>{livrosParaImportar.length}</b> registros de livros unitários prontos para o banco!</span>
                                    </div>
                                )}

                                <div className="w-full flex gap-4 justify-end mt-8 pt-4 border-t border-gray-100">
                                    <button type="button" onClick={() => setModalStep('choice')} className="px-5 py-2.5 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition-colors cursor-pointer">
                                        Voltar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmarImportacao}
                                        disabled={livrosParaImportar.length === 0}
                                        className={`px-6 py-2.5 text-white font-medium rounded shadow transition-colors ${livrosParaImportar.length > 0
                                                ? 'bg-blue-700 hover:bg-blue-800 cursor-pointer'
                                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            }`}
                                    >
                                        Confirmar Importação
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
}