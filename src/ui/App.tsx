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

type RespostaIPC<T = undefined> = {
    success: boolean;
    data?: T;
    quantidade?: number;
    error?: string;
    codigo?: "CONFIRMAR_MULTIPLOS_TITULOS" | "CONFIRMAR_EMPRESTIMO_PENDENTE" | "LEITOR_BANIDO";
    diasRestantes?: number;
    alunoId?: number;
};

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
            cadastrarAluno: (dados: Omit<AlunoAtualizacao, "id">) => Promise<RespostaIPC<Aluno>>;
            atualizarAluno: (dados: AlunoAtualizacao) => Promise<RespostaIPC<Aluno>>;
            arquivarAlunos: (ids: number[]) => Promise<RespostaIPC>;
            aplicarBanimento: (dados: { alunoId: number; dias: number; motivo: string }) => Promise<RespostaIPC<Aluno>>;
            removerBanimento: (dados: { alunoId: number; motivo?: string }) => Promise<RespostaIPC<Aluno>>;
            cadastrarLivro: (dados: LivroCadastro[]) => Promise<RespostaIPC<Livro[]>>;
            atualizarLivro: (
                dados: LivroAtualizacao,
            ) => Promise<{ success: boolean; data?: Livro; error?: string }>;
            cadastrarEmprestimo: (dados: EmprestimoEntrada) => Promise<RespostaIPC<{ pessoa: Aluno; emprestimos: Emprestimo[]; termo?: TermoGerado }>>;
            pesquisarAluno: (
                nome: string,
            ) => Promise<{ success: boolean; data?: Aluno[]; error?: string }>;
            pesquisarLivro: (
                nome: string,
            ) => Promise<{ success: boolean; data?: Livro[]; error?: string }>;
            pesquisarEmprestimos: (dados: { aluno?: string; livro?: string }) => Promise<{
                success: boolean;
                data?: Emprestimo[];
                error?: string;
            }>;
            deleteAluno: (
                dado: { id: number },
            ) => Promise<RespostaIPC>;
            deleteLivro: (dado: { id: number } | null) => Promise<{ success: boolean; data?: Livro; quantidade?: number; error?: string }>;
            deleteLivros: (ids: number[]) => Promise<{ success: boolean; quantidade?: number; error?: string }>;
            deleteEmprestimo: (dado: { id: number }) => Promise<RespostaIPC<Emprestimo>>
            confirmarDevolucao: (dado: DevolucaoEntrada) => Promise<RespostaIPC<Emprestimo & { atrasada: boolean; devolucaoCompleta: boolean; quantidadeDevolvidaAgora: number }>>
            obterExportacao: (inicio?: string, fim?: string) => Promise<{ success: boolean; data?: { acervo: Livro[]; ativos: Emprestimo[]; atrasados: Emprestimo[]; historico: Emprestimo[]; movimentacoes: { id: number; tipo: string; descricao: string; criadoEm: string | Date; alunoNome?: string; livroTitulo?: string }[] }; error?: string }>
            registrarDebug: (origem: string, mensagem: string, detalhes?: string) => Promise<{ success: boolean }>;
            obterLogsDebug: () => Promise<{ success: boolean; data?: { id: number; dataHora: string; origem: string; mensagem: string; detalhes?: string }[] }>;
            limparLogsDebug: () => Promise<{ success: boolean }>;
            copiarLogsDebug: () => Promise<{ success: boolean; quantidade?: number }>;
            restaurarFoco: () => Promise<{ success: boolean }>;
            limparDados: (tipo: "movimentacoes" | "emprestimos" | "alunos" | "acervo") => Promise<{ success: boolean; quantidade?: number; error?: string }>;
            obterConfiguracao: () => Promise<{ success: boolean; data?: Configuracao; error?: string }>;
            salvarConfiguracao: (dados: Configuracao) => Promise<{ success: boolean; data?: Configuracao; error?: string }>;
            obterDashboard: () => Promise<{ success: boolean; data?: Dashboard; error?: string }>;
            exportarBackupTotal: () => Promise<{ success: boolean; cancelado?: boolean; caminho?: string; error?: string }>;
            selecionarBackupTotal: () => Promise<{ success: boolean; cancelado?: boolean; data?: ResumoBackupSelecionado; error?: string }>;
            confirmarImportacaoTotal: (token: string) => Promise<{ success: boolean; caminhoRecuperacao?: string; error?: string }>;
        };
    }
    interface Aluno {
        id: number;
        nome: string;
        serie: string;
        tipo: "ALUNO" | "PROFESSOR";
        ativo: boolean;
        banidoAte?: Date | string | null;
        motivoBanimento?: string | null;
    }
    interface AlunoAtualizacao {
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
    interface LivroAtualizacao {
        id: number;
        titulo: string;
        autor: string;
        numeroEdicao: number | null;
        isbn: string | null;
        editora: string | null;
        unidade: number;
    }
    interface LivroCadastro {
        titulo: string;
        autor?: string | null;
        numeroEdicao?: number | null;
        isbn?: string | null;
        editora?: string | null;
        unidade?: number;
    }
    interface Emprestimo {
        id: number;
        grupoId: string;
        alunoId: number;
        livroId: number;
        quantidade: number;
        quantidadeDevolvida: number;
        dataHoraEmprestimo: Date | string;
        dataDevolucaoPrevista: Date | string | null;
        devolvidoEm?: Date | string | null;
        status: StatusEmprestimo;
        estadoLivro: string;
        aluno: Aluno;
        livro: Livro;
    }
    interface ItemEmprestimoEntrada {
        livroId: number;
        quantidade: number;
        estadoLivro: string;
    }
    interface EmprestimoEntrada {
        leitor: {
            id?: number;
            nome: string;
            serie?: string;
            tipo?: "ALUNO" | "PROFESSOR";
        };
        itens: ItemEmprestimoEntrada[];
        dataDevolucaoPrevista?: string | Date | null;
        confirmarMultiplosTitulos?: boolean;
        confirmarEmprestimoPendente?: boolean;
    }
    interface DevolucaoEntrada {
        id: number;
        quantidade: number;
        punicao?: { dias: number; motivo?: string } | null;
    }
    interface Configuracao {
        termoResponsabilidadeAtivo: boolean;
        responsavelBiblioteca: string;
        modeloTermo: string;
        paresTermosPorFolha: number;
        tipoFolha: "A4" | "CARTA" | "OFICIO";
        painelDebugAtivo: boolean;
        modoEscuro: boolean;
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
    interface DashboardDestaque {
        nome: string;
        total: number;
    }
    interface Dashboard {
        emprestimosMes: number;
        emprestimosHoje: number;
        ativos: number;
        atrasados: number;
        livroFavorito?: DashboardDestaque;
        serieDestaque?: DashboardDestaque;
        alunoDestaque?: DashboardDestaque;
    }
    interface ResumoBackupSelecionado {
        token: string;
        criadoEm: string;
        versaoAplicativo: string;
        quantidades: {
            alunos: number;
            livros: number;
            emprestimos: number;
            movimentacoes: number;
        };
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
