const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    cadastrarAluno: (dados: any) => ipcRenderer.invoke("cadastrar-aluno", dados),
    cadastrarLivro: (dados: any) => ipcRenderer.invoke("cadastrar-um-livro", dados),
    cadastrarEmprestimo: (dados:any) => ipcRenderer.invoke("cadastrar-emprestimo", dados),
    obterAlunos: () => ipcRenderer.invoke("obter-alunos"),
    obterLivros: () => ipcRenderer.invoke("obter-livros"),
    obterEmprestimo: () => ipcRenderer.invoke("obter-emprestimo"),
    pesquisarAluno: (dado: any) => ipcRenderer.invoke("pesquisar-aluno", dado),
    pesquisarLivro: (dado: any) => ipcRenderer.invoke("pesquisar-livro", dado),
    pesquisarEmprestimos: (dados: any) => ipcRenderer.invoke("pesquisar-emprestimos", dados),
    deleteAluno: (dado: any) => ipcRenderer.invoke("delete-aluno", dado),
    deleteLivro: (dado: any) => ipcRenderer.invoke("delete-livro", dado),
    deleteEmprestimo: (dado: any) => ipcRenderer.invoke("delete-emprestimo", dado),
    confirmarDevolucao: (dado: any) => ipcRenderer.invoke("confirmar-devolucao", dado),
});