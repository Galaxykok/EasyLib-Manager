
import logoIcon from './assets/icon.png';
import './App.css'
import { Link } from "react-router-dom";


export default function Home() {
    return (
        <div className="flex h-screen w-screen bg-white font-sans overflow-hidden">

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

            <main className="flex-1 flex flex-col items-center pt-16 px-12 bg-white overflow-y-auto">
                <header className="flex items-center justify-center gap-6 mb-12 w-full max-w-3xl">
                    <h1 className="text-3xl font-medium tracking-wide text-center text-gray-800">
                        Seja bem-vindo ao EasyLib Manager
                    </h1>

                    <img
                        src={logoIcon}
                        className="w-32 h-32 object-contain flex-shrink-0"
                    />
                </header>

                <section className="w-full max-w-3xl flex flex-col">
                    <h1 className="text-xl font-normal text-center font-semibold text-gray-800 mb-4">
                        Empréstimos próximos do vencimento:
                    </h1>


                    <div className="w-full h-96 bg-[#E2E6F3] border-2 border-black rounded-none p-6 overflow-y-auto shadow-sm">
                    </div>

                    <footer className="flex items-center gap-8 mt-4 pl-2">
                        <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-red-600 block" />
                            <span className="text-lg font-normal font-semibold text-gray-900">Atrasados</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-yellow-400 block" />
                            <span className="text-lg font-normal font-semibold text-gray-900">Faltam 3 dias ou menos</span>
                        </div>
                    </footer>
                </section>

            </main>
        </div>
    );
}