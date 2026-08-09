const { contextBridge, ipcRenderer } = require('electron');

type LivroAtualizacao = {
    id: number;
    titulo: string;
    autor: string;
    numeroEdicao: number | null;
    isbn: string | null;
    editora: string | null;
    unidade: number;
};

type AlunoAtualizacao = {
    id: number;
    nome: string;
    serie: string;
    tipo: "ALUNO" | "PROFESSOR";
};

contextBridge.exposeInMainWorld('electronAPI', {
    cadastrarAluno: (dados: any) => ipcRenderer.invoke("cadastrar-aluno", dados),
    atualizarAluno: (dados: AlunoAtualizacao) => ipcRenderer.invoke("atualizar-aluno", dados),
    arquivarAlunos: (ids: number[]) => ipcRenderer.invoke("arquivar-alunos", ids),
    aplicarBanimento: (dados: { alunoId: number; dias: number; motivo: string }) => ipcRenderer.invoke("aplicar-banimento", dados),
    removerBanimento: (dados: { alunoId: number; motivo?: string }) => ipcRenderer.invoke("remover-banimento", dados),
    cadastrarLivro: (dados: any) => ipcRenderer.invoke("cadastrar-um-livro", dados),
    atualizarLivro: (dados: LivroAtualizacao) => ipcRenderer.invoke("atualizar-livro", dados),
    cadastrarEmprestimo: (dados:any) => ipcRenderer.invoke("cadastrar-emprestimo", dados),
    obterAlunos: () => ipcRenderer.invoke("obter-alunos"),
    obterLivros: () => ipcRenderer.invoke("obter-livros"),
    obterEmprestimo: () => ipcRenderer.invoke("obter-emprestimo"),
    pesquisarAluno: (dado: any) => ipcRenderer.invoke("pesquisar-aluno", dado),
    pesquisarLivro: (dado: any) => ipcRenderer.invoke("pesquisar-livro", dado),
    pesquisarEmprestimos: (dados: any) => ipcRenderer.invoke("pesquisar-emprestimos", dados),
    deleteAluno: (dado: any) => ipcRenderer.invoke("delete-aluno", dado),
    deleteLivro: (dado: { id: number } | null) => ipcRenderer.invoke("delete-livro", dado),
    deleteLivros: (ids: number[]) => ipcRenderer.invoke("delete-livros", ids),
    deleteEmprestimo: (dado: any) => ipcRenderer.invoke("delete-emprestimo", dado),
    confirmarDevolucao: (dado: any) => ipcRenderer.invoke("confirmar-devolucao", dado),
    obterExportacao: (inicio?: string, fim?: string) => ipcRenderer.invoke("obter-exportacao", inicio, fim),
    registrarDebug: (origem: string, mensagem: string, detalhes?: string) => ipcRenderer.invoke("registrar-debug", origem, mensagem, detalhes),
    obterLogsDebug: () => ipcRenderer.invoke("obter-logs-debug"),
    limparLogsDebug: () => ipcRenderer.invoke("limpar-logs-debug"),
    copiarLogsDebug: () => ipcRenderer.invoke("copiar-logs-debug"),
    restaurarFoco: () => ipcRenderer.invoke("restaurar-foco"),
    limparDados: (tipo: "movimentacoes" | "emprestimos" | "alunos" | "acervo") => ipcRenderer.invoke("limpar-dados", tipo),
    obterConfiguracao: () => ipcRenderer.invoke("obter-configuracao"),
    salvarConfiguracao: (dados: any) => ipcRenderer.invoke("salvar-configuracao", dados),
    obterDashboard: () => ipcRenderer.invoke("obter-dashboard"),
    exportarBackupTotal: () => ipcRenderer.invoke("exportar-backup-total"),
    selecionarBackupTotal: () => ipcRenderer.invoke("selecionar-backup-total"),
    confirmarImportacaoTotal: (token: string) => ipcRenderer.invoke("confirmar-importacao-total", token),
});
