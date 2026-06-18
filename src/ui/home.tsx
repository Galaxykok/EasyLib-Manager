import logoIcon from './assets/icon.png';
import './App.css'
import { Link } from "react-router-dom";

export default function Home() {
    return (
        <div className="flex h-screen w-screen bg-white font-sans overflow-hidden">

            {/* Sidebar / Barra Lateral */}
            <aside className="w-64 flex flex-col pt-16 relative bg-white flex-shrink-0">
                <div className="absolute right-0 top-0 bottom-0 w-2 bg-gray-300" />
                <nav className="flex flex-col gap-6 pl-6 z-10">
                    <Link
                        to="/"
                        className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer">
                        <span className="w-6 h-6 bg-cyan-400 block" />
                        <span>Home</span>
                    </Link>

                    <Link
                        to="/acervo"
                        className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9">
                        <span>Acervo</span>
                    </Link>

                    <Link
                        to="/emprestimos"
                        className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9">
                        <span>Empréstimos</span>
                    </Link>

                    <Link
                        to="/aluno"
                        className="flex items-center gap-3 text-2xl font-normal text-gray-800 hover:text-cyan-500 transition-colors cursor-pointer pl-9">
                        <span>Alunos</span>
                    </Link>
                </nav>
            </aside>

            {/* Conteúdo Principal Ampliado */}
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

                        {/* ALTURA EXPANDIDA PARA 65vh (O dobro do h-96 original) */}
                        <div className="w-full h-[65vh] bg-[#E2E6F3] border-2 border-black rounded-md p-6 overflow-y-auto shadow-sm">
                            {/* A lista ou tabela de empréstimos pendentes entra aqui */}
                        </div>
                    </div>

                    {/* Legendas na base do dashboard */}
                    <footer className="flex items-center gap-8 mt-4 pl-2">
                        <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-red-600 block" />
                            <span className="text-lg font-semibold text-gray-900">Atrasados</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-yellow-400 block" />
                            <span className="text-lg font-semibold text-gray-900">Faltam 3 dias ou menos</span>
                        </div>
                    </footer>
                </section>

            </main>
        </div>
    );
}