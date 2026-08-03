import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import Sidebar from "./sidebar.tsx";

interface Aluno {
    id: number;
    nome: string;
    serie: string;
}

interface CadastroAlunoForm {
    nome: string;
    serie: string;
}

export default function Alunos() {
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null); 
    const [alunosLista, setAlunosLista] = useState<Aluno[]>([]); 
    const [isLoading, setIsLoading] = useState<boolean>(true); 
    const [aluno, setAluno] = useState("");
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const [formData, setFormData] = useState<CadastroAlunoForm>({
        nome: '',
        serie: ''
    });

    const deleteAluno = async () => {
        const response = await window.electronAPI.deleteAluno(selectedAluno)

        if(response.success && response.data){
            closeDetailsModal()
            carregarAlunos()
        } else{
            alert("Erro ao excluir aluno:")
            console.log(response.error)
        }
    }

    const carregarAlunos = async () => {
        setIsLoading(true);
        if(aluno !== ""){
            const response = await window.electronAPI.pesquisarAluno(aluno);
            if (response.success && response.data) {
                setAlunosLista(response.data);
            } else {
                console.error("Erro ao carregar alunos:", response.error);
            }
            setIsLoading(false);
        }else{
            const response = await window.electronAPI.obterAlunos();
            if (response.success && response.data) {
                setAlunosLista(response.data);
            } else {
                console.error("Erro ao carregar alunos:", response.error);
            }
            setIsLoading(false);     
        }
    };

    useEffect(() => {
        window.electronAPI.obterAlunos().then((response) => {
            if (response.success && response.data) {
                setAlunosLista(response.data);
            } else {
                console.error("Erro ao carregar alunos:", response.error);
            }
            setIsLoading(false);
        });
    }, []);

    const closeModal = (): void => {
        setIsModalOpen(false);
        setFormData({ nome: '', serie: '' });
    };

    const closeDetailsModal = (): void => {
        setSelectedAluno(null);
    };

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleCadastroSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const dadosParaEnviar = {
            nome: formData.nome,
            serie: turmas[indiceTurma]
        };

        const response = await window.electronAPI.cadastrarAluno(dadosParaEnviar);

        if (response.success) {
            console.log("Aluno cadastrado com sucesso no banco local:", response.data);
            closeModal();
            carregarAlunos();
        } else {
            console.error("Erro ao salvar:", response.error);
            alert("Erro ao cadastrar aluno no banco de dados.");
        }
    };

    const turmas = [
        "1º ano", "2º ano", "3º ano", "4º ano", "5º ano",
        "6º ano", "7º ano", "8º ano", "9º ano",
        "1º ano médio", "2º ano médio", "3º ano médio",
    ];

    const [indiceTurma, setIndiceTurma] = useState(0);
    const proximaTurma = () => setIndiceTurma((i) => Math.min(i + 1, turmas.length - 1));
    const turmaAnterior = () => setIndiceTurma((i) => Math.max(i - 1, 0));

    return (
        <div className="app-shell flex h-screen w-screen font-sans overflow-hidden relative">
            <Sidebar />

            <main className="app-main flex-1 flex flex-col items-center p-8 xl:p-10 overflow-y-auto">
                <div className="w-full max-w-7xl flex flex-col min-h-full pb-2">

                    <div className="contents">
                        <header className="app-page-header order-1 py-5 px-6 mb-5">
                        <p className="app-eyebrow text-xs font-semibold tracking-[0.18em] text-cyan-700 mb-1">COMUNIDADE</p>
                        <h1 className="text-4xl font-semibold text-slate-900 tracking-tight">
                            Alunos
                        </h1>
                        <p className="text-sm text-slate-600 mt-1">Encontre estudantes e mantenha os dados de turma organizados.</p>
                        </header>

                        <div className="app-panel-muted order-3 w-full rounded-xl p-3 min-h-[420px] flex flex-col gap-2 overflow-y-auto">
                            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-xl border border-sky-200 bg-sky-100 px-4 py-3 shadow-sm">
                                <div>
                                    <h2 className="font-semibold text-slate-900">Alunos encontrados</h2>
                                    <p className="text-xs text-slate-600">Selecione um cadastro para consultar ou excluir o registro.</p>
                                </div>
                                <span className="rounded-full bg-cyan-700 px-3 py-1 text-xs font-bold text-white">{alunosLista.length}</span>
                            </div>
                            {isLoading ? (
                                <div className="text-center text-gray-600 text-xl m-auto">Carregando alunos...</div>
                            ) : alunosLista.length === 0 ? (
                                <div className="text-center text-gray-500 text-xl m-auto">Nenhum aluno cadastrado.</div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <div className="grid grid-cols-[70px_minmax(0,1fr)_160px] gap-4 px-4 py-2 text-[11px] font-semibold tracking-[0.12em] text-slate-600 uppercase">
                                        <span>Código</span>
                                        <span>Aluno</span>
                                        <span className="text-right">Turma</span>
                                    </div>
                                    {alunosLista.map((aluno) => (
                                        <div 
                                            key={aluno.id} 
                                            onClick={() => setSelectedAluno(aluno)}
                                            className="app-panel grid grid-cols-[70px_minmax(0,1fr)_160px] gap-4 items-center p-4 rounded-lg hover:border-cyan-500 transition-colors cursor-pointer"
                                        >
                                            <span className="w-fit font-mono text-xs font-semibold text-cyan-800 bg-cyan-50 border border-cyan-100 px-2.5 py-1.5 rounded-lg">{aluno.id}</span>
                                            <span className="text-lg font-semibold text-slate-800 truncate">{aluno.nome}</span>
                                            <span className="justify-self-end bg-cyan-100 text-cyan-800 font-semibold px-3 py-1 rounded-full text-sm">
                                                {aluno.serie}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="app-search-panel order-2 w-full flex items-end justify-between gap-4 mb-5 p-4 rounded-xl">
                        <div className="flex min-w-0 flex-col gap-1.5">
                            <span className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-900">Localizar estudante</span>
                            <div className="flex items-center gap-2">
                            <input
                                id="pesquisarAluno"
                                type="text"
                                placeholder="Pesquisar aluno..."
                                className="w-80 px-4 py-2.5 border border-slate-400 rounded-xl bg-white text-slate-800 shadow-sm outline-none placeholder-slate-400 focus:border-cyan-700 focus:ring-4 focus:ring-cyan-200"
                                value={aluno}
                                onChange={(e) => setAluno(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => {carregarAlunos()}}
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
                            <span>+ Cadastrar Aluno</span>
                        </button>
                    </div>

                </div>
            </main>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-sky-50 rounded-2xl p-8 w-full max-w-xl shadow-2xl border border-cyan-200 relative">
                        <button
                            onClick={closeModal}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold focus:outline-none cursor-pointer"
                        >
                            &times;
                        </button>

                        <div>
                            <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">Cadastro de Aluno</h2>
                            <form onSubmit={handleCadastroSubmit} className="space-y-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium text-gray-700">Nome do Aluno</label>
                                    <input required type="text" name="nome" value={formData.nome} onChange={handleInputChange} className="border border-slate-400 bg-white rounded-xl p-2.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-cyan-200 focus:border-cyan-700" />
                                </div>

                                <div className="flex flex-col items-center w-full">
                                    <label className="mb-2 text-sm font-medium text-gray-700">Turma do Aluno</label>
                                    <div className="relative w-64">
                                        <input readOnly value={turmas[indiceTurma]} className="w-full h-10 border border-slate-400 bg-white rounded-xl px-3 pr-10 shadow-sm" />
                                        <div className="absolute right-0 top-0 h-10 w-10 flex flex-col border-l bg-white">
                                            <button type="button" onClick={proximaTurma} className="h-5 flex items-center justify-center hover:bg-gray-100">▲</button>
                                            <button type="button" onClick={turmaAnterior} className="h-5 flex items-center justify-center hover:bg-gray-100 border-t">▼</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 justify-center mt-6 pt-4 border-t border-gray-100">
                                    <button type="button" onClick={closeModal} className="px-5 py-2.5 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition-colors cursor-pointer">Cancelar</button>
                                    <button type="submit" className="px-6 py-2.5 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-xl shadow-sm transition-colors cursor-pointer">Cadastrar Aluno</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {selectedAluno && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-sky-50 rounded-2xl p-8 w-full max-w-md shadow-2xl border border-cyan-200 relative">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Informações do Registro</h2>
                            
                            <div className="space-y-4 mb-8 bg-sky-100/70 p-4 rounded-xl border border-sky-200">
                                <p className="text-base text-gray-700"><strong>ID:</strong> {selectedAluno.id}</p>
                                <p className="text-base text-gray-700"><strong>Nome:</strong> {selectedAluno.nome}</p>
                                <p className="text-base text-gray-700"><strong>Série / Turma:</strong> {selectedAluno.serie}</p>
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                                <button 
                                    type="button" 
                                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded shadow transition-colors cursor-pointer"
                                    onClick={() => setShowDeleteModal(true)}
                                >
                                    Excluir Aluno
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
                                    deleteAluno();
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
