import { useState, useEffect } from 'react'; // Adicionado useEffect
import type { FormEvent } from 'react';
import { Link } from "react-router-dom";
import "./App.css";


interface CadastroAlunoForm {
    nome: string;
    serie: string;
}

export default function Alunos() {
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [alunosLista, setAlunosLista] = useState<Aluno[]>([]); 
    const [isLoading, setIsLoading] = useState<boolean>(true); 
    const [aluno, setAluno] = useState("")

    const [formData, setFormData] = useState<CadastroAlunoForm>({
        nome: '',
        serie: ''
    });


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
        carregarAlunos();
    }, []);

    const closeModal = (): void => {
        setIsModalOpen(false);
        setFormData({ nome: '', serie: '' });
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
        <div className="flex h-screen w-screen bg-white font-sans overflow-hidden relative">

            <aside className="w-64 flex flex-col pt-16 relative bg-white flex-shrink-0">
                <div className="absolute right-0 top-0 bottom-0 w-2 bg-gray-300" />
                <nav className="flex flex-col gap-6 pl-6 z-10">
                    <Link to="/" className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9">
                        <span>Home</span>
                    </Link>
                    <Link to="/acervo" className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9">
                        <span>Acervo</span>
                    </Link>
                    <Link to="/emprestimos" className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9">
                        <span>Empréstimos</span>
                    </Link>
                    <Link to="/aluno" className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer">
                        <span className="w-6 h-6 bg-cyan-400 block" />
                        <span>Alunos</span>
                    </Link>
                </nav>
            </aside>

            <main className="flex-1 flex flex-col items-center pt-8 px-12 bg-white overflow-y-auto">
                <div className="w-full max-w-7xl flex flex-col h-full justify-between pb-8">

                    <div>
                        <h1 className="text-7xl font-normal text-center text-black mb-8 tracking-wide">
                            Alunos
                        </h1>

                        <div className="w-full bg-[#DCE2F4] border border-gray-600 rounded-md p-6 h-[60vh] flex flex-col gap-2 overflow-y-auto shadow-sm">
                            {isLoading ? (
                                <div className="text-center text-gray-600 text-xl m-auto">Carregando alunos...</div>
                            ) : alunosLista.length === 0 ? (
                                <div className="text-center text-gray-500 text-xl m-auto">Nenhum aluno cadastrado.</div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {alunosLista.map((aluno) => (
                                        <div 
                                            key={aluno.id} 
                                            className="flex justify-between items-center bg-white border border-gray-300 p-4 rounded shadow-sm hover:border-gray-400 transition-all"
                                        >
                                            <span className='text-xl font-medium text-cyan-500 rounded-full'>{aluno.id}</span>
                                            <span className="text-xl font-medium text-gray-800">{aluno.nome}</span>
                                            <span className="bg-cyan-100 text-cyan-800 font-semibold px-3 py-1 rounded-full text-sm">
                                                {aluno.serie}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="w-full flex items-center justify-between mt-6">
                        <div className="flex items-center gap-2">
                            <input
                                id="pesquisarAluno"
                                type="text"
                                placeholder="Pesquisar aluno..."
                                className="w-80 px-4 py-3 text-lg border border-gray-400 rounded-md bg-white text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                                value={aluno}
                                onChange={(e) => setAluno(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => {carregarAlunos()}}
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
                            <span>+ Cadastrar Aluno</span>
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
                            <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">Cadastro de Aluno</h2>
                            <form onSubmit={handleCadastroSubmit} className="space-y-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium text-gray-700">Nome do Aluno</label>
                                    <input required type="text" name="nome" value={formData.nome} onChange={handleInputChange} className="border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-green-600" />
                                </div>

                                <div className="flex flex-col items-center w-full">
                                    <label className="mb-2 text-sm font-medium text-gray-700">Turma do Aluno</label>
                                    <div className="relative w-64">
                                        <input readOnly value={turmas[indiceTurma]} className="w-full h-10 border rounded px-3 pr-10" />
                                        <div className="absolute right-0 top-0 h-10 w-10 flex flex-col border-l bg-white">
                                            <button type="button" onClick={proximaTurma} className="h-5 flex items-center justify-center hover:bg-gray-100">▲</button>
                                            <button type="button" onClick={turmaAnterior} className="h-5 flex items-center justify-center hover:bg-gray-100 border-t">▼</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 justify-center mt-6 pt-4 border-t border-gray-100">
                                    <button type="button" onClick={closeModal} className="px-5 py-2.5 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition-colors cursor-pointer">Cancelar</button>
                                    <button type="submit" className="px-6 py-2.5 bg-[#006414] hover:bg-green-800 text-white font-medium rounded shadow transition-colors cursor-pointer">Cadastrar Aluno</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}