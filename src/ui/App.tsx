import { Routes, Route } from "react-router-dom";
import Home from "./home.tsx";
import Acervo from "./acervo.tsx";
import Emprestimos from "./emprestimos.tsx";
import Alunos from "./alunos.tsx";
import Exportacao from "./exportacao.tsx";
import Debug from "./debug.tsx";
import Configuracoes from "./configuracoes.tsx";
import TermoResponsabilidade from "./termoResponsabilidade.tsx";
import { StatusEmprestimo } from "./enum.ts";
import { StatusLivro } from "./enum.ts";

declare global {
    interface Window {
        electronAPI: {
            obterLivros: () => Promise<{
                success: boolean;
                data?: Livro[];
                error?: string;
            }>;
            obterAlunos: () => Promise<{
                success: boolean;
                data?: Aluno[];
                error?: string;
            }>;
            obterEmprestimo: () => Promise<{
                success: boolean;
                data?: Emprestimo[];
                error?: string;
            }>;
            cadastrarAluno: (
                dados: any,
            ) => Promise<{ success: boolean; data?: any; error?: string }>;
            cadastrarLivro: (
                dados: any,
            ) => Promise<{ success: boolean; data?: any; error?: string }>;
            cadastrarEmprestimo: (
                dados: any,
            ) => Promise<{ success: boolean; data?: any; error?: string }>;
            pesquisarAluno: (
                nome: any,
            ) => Promise<{ success: boolean; data?: Aluno[]; error?: string }>;
            pesquisarLivro: (
                nome: any,
            ) => Promise<{ success: boolean; data?: Livro[]; error?: string }>;
            pesquisarEmprestimos: (dados: any) => Promise<{
                success: boolean;
                data?: Emprestimo[];
                error?: string;
            }>;
            deleteAluno: (
                dado: any,
            ) => Promise<{ success: boolean; data?: any; error?: string }>;
            deleteLivro: (dado: any,) => Promise<{ success: boolean; data?: any; error?: string }>;
            deleteEmprestimo: (dado: any) => Promise<{ success: boolean; data?: any; error?: string}>
            confirmarDevolucao: (dado: any,) => Promise<{success: boolean; data?: any; error?: string}>
            obterExportacao: (inicio?: string, fim?: string) => Promise<{ success: boolean; data?: { acervo: Livro[]; ativos: Emprestimo[]; atrasados: Emprestimo[]; historico: Emprestimo[]; movimentacoes: { id: number; tipo: string; descricao: string; criadoEm: string | Date; alunoNome?: string; livroTitulo?: string }[] }; error?: string }>
            registrarDebug: (origem: string, mensagem: string, detalhes?: string) => Promise<{ success: boolean }>;
            obterLogsDebug: () => Promise<{ success: boolean; data?: { id: number; dataHora: string; origem: string; mensagem: string; detalhes?: string }[] }>;
            limparLogsDebug: () => Promise<{ success: boolean }>;
            copiarLogsDebug: () => Promise<{ success: boolean; quantidade?: number }>;
            limparDados: (tipo: "movimentacoes" | "emprestimos" | "alunos" | "acervo") => Promise<{ success: boolean; quantidade?: number; error?: string }>;
            obterConfiguracao: () => Promise<{ success: boolean; data?: Configuracao; error?: string }>;
            salvarConfiguracao: (dados: Configuracao) => Promise<{ success: boolean; data?: Configuracao; error?: string }>;
        };
    }
    interface Aluno {
        id: number;
        nome: string;
        serie: string;
        tipo: "ALUNO" | "PROFESSOR";
    }
    interface Livro {
        id: number;
        titulo: string;
        autor: string;
        numeroEdicao?: number | null;
        isbn?: string | null;
        editora?: string | null;
        unidade: number;
        disponiveis: number;
        status: StatusLivro
    }
    interface Emprestimo {
        id: number;
        alunoId: number;
        livroId: number;
        dataHoraEmprestimo: Date | string;
        dataDevolucaoPrevista: Date | string | null;
        status: StatusEmprestimo;
        estadoLivro: string;
        aluno: Aluno;
        livro: Livro;
    }
    interface Configuracao {
        termoResponsabilidadeAtivo: boolean;
        responsavelBiblioteca: string;
        modeloTermo: string;
        paresTermosPorFolha: number;
        tipoFolha: "A4" | "CARTA" | "OFICIO";
    }
    interface TermoGerado {
        conteudo: string;
        nomeAluno: string;
        serieAluno: string;
        responsavelBiblioteca: string;
        criadoEm: string;
        paresTermosPorFolha: number;
        tipoFolha: "A4" | "CARTA" | "OFICIO";
    }
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/acervo" element={<Acervo />} />
            <Route path="/emprestimos" element={<Emprestimos />} />
            <Route path="/aluno" element={<Alunos />} />
            <Route path="/exportacao" element={<Exportacao />} />
            <Route path="/debug" element={<Debug />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/termo-impressao" element={<TermoResponsabilidade />} />
        </Routes>
    );
}
