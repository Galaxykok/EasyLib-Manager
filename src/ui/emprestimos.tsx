import './App.css'
import { Link } from "react-router-dom";

export default function Emprestimos(){
    return(<div className="flex h-screen w-screen bg-white font-sans overflow-hidden">
            <aside className="w-64 flex flex-col pt-16 relative bg-white flex-shrink-0">
                <div className="absolute right-0 top-0 bottom-0 w-2 bg-gray-300" />
                <nav className="flex flex-col gap-6 pl-6 z-10">
                    <Link
                        to="/"
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

        </div>);
}