

import { Routes, Route } from "react-router-dom";
import Home from "./home.tsx";
import Acervo from "./acervo.tsx";
import Emprestimos from "./emprestimos.tsx";
import Alunos from "./alunos.tsx";
declare global{
  interface Window {
      electronAPI: {
          obterLivros: () => Promise<{ success: boolean; data?: Livro[]; error?: string }>;
          obterAlunos: () => Promise<{ success: boolean; data?: Aluno[]; error?: string }>;
          cadastrarAluno: (dados: any) => Promise<{ success: boolean; data?: any; error?: string }>;
          cadastrarLivro: (dados: any) => Promise<{ success: boolean; data?: any; error?: string }>;
          pesquisarAluno: (nome: any) => Promise<{ success: boolean; data?: Aluno[]; error?: string }>
          pesquisarLivro: (nome: any) => Promise<{ success: boolean; data?: Livro[]; error?: string }>
          deleteAluno: (dado: any) => Promise<{success: boolean; data?: any; error?: string}>
          deleteLivro: (dado: any) => Promise<{success: boolean; data?: any; error?: string}>
      };
  }
  interface Aluno {
    id: number;
    nome: string;
    serie: string;
  }
  interface Livro {
    id: number;
    titulo: string;
    autor: string;
    numeroEdicao?: number | null; 
    isbn?: string | null;         
    editora?: string | null;      
    unidade: number;
  }
}

export default function App() {
  return (
     <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/acervo" element={<Acervo />} />
      <Route path="/emprestimos" element={<Emprestimos />} />
      <Route path="/aluno" element={<Alunos />} />
    </Routes>
  );
}