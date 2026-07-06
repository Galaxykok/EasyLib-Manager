const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    cadastrarAluno: (dados: any) => ipcRenderer.invoke('cadastrar-aluno', dados),
    obterAlunos: () => ipcRenderer.invoke("obter-alunos"),
    pesquisarAluno: (dado: any) => ipcRenderer.invoke("pesquisar-aluno", dado),
});