const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    cadastrarAluno: (dados: any) => ipcRenderer.invoke('cadastrar-aluno', dados),
    cadastrarLivro: (dados: any) => ipcRenderer.invoke("cadastrar-um-livro", dados),
    obterAlunos: () => ipcRenderer.invoke("obter-alunos"),
    obterLivros: () => ipcRenderer.invoke("obter-livros"),
    pesquisarAluno: (dado: any) => ipcRenderer.invoke("pesquisar-aluno", dado),
    pesquisarLivro: (dado: any) => ipcRenderer.invoke("pesquisar-livro", dado),
    deleteAluno: (dado: any) => ipcRenderer.invoke("delete-aluno", dado),
    deleteLivro: (dado: any) => ipcRenderer.invoke("delete-livro", dado),
});