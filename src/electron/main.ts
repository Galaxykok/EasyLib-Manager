import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { prisma } from '../../lib/prisma.ts';


app.on('ready', () => {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 720, 
        minWidth: 1280,
        minHeight: 720,
        icon: path.join(app.getAppPath(), '/src/ui/assets/icontask.png'),
        webPreferences: {
            preload: path.join(app.getAppPath(), "dist-electron/src/electron/preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });
    
    mainWindow.maximize();
    mainWindow.loadFile(path.join(app.getAppPath(), '/dist-react/index.html'));
});

ipcMain.handle('cadastrar-aluno', async (_event, dadosAluno: any) => {
    try {
        const novoAluno = await prisma.aluno.create({
            data: {
                nome: dadosAluno.nome,
                serie: dadosAluno.serie
            }
        });
        return { success: true, data: novoAluno };
    } catch (error: any) {
        console.error("Erro no Prisma:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('obter-alunos', async () => {
    try {
        const alunos = await prisma.aluno.findMany({
            orderBy: {
                nome: 'asc'
            }
        });
        return { success: true, data: alunos };
    } catch (error: any) {
        console.error("Erro no Prisma:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('pesquisar-aluno', async (_event, nomeAluno: any) =>{
    try{
        const aluno = await prisma.aluno.findMany({
            where: { 
                nome: { contains: nomeAluno,} } 
        })
        return {success: true, data: aluno}
    }
    catch(error: any){
        console.error("Erro no Prisma:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('obter-livros', async () => {
    try {
        const alunos = await prisma.livro.findMany({
            orderBy: {
                titulo: 'asc'
            }
        });
        return { success: true, data: alunos };
    } catch (error: any) {
        console.error("Erro no Prisma:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('pesquisar-livro', async (_event, nomeLivro: any) => {
    try{
        const aluno = await prisma.livro.findMany({
            where: { 
                titulo: { contains: nomeLivro,} } 
        })
        return {success: true, data: aluno}
    }
    catch(error: any){
        console.error("Erro no Prisma:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('cadastrar-um-livro', async (_event, livro: any ) => {
    try{
        for(let unidade = 0; unidade < livro.length; unidade++){
            const novoLivro = await prisma.livro.create({
                data:{ 
                    titulo: livro[unidade].titulo,
                    autor: livro[unidade].autor,
                    numeroEdicao: livro[unidade].numeroEdicao,
                    isbn: livro[unidade].isbn,
                    editora: livro[unidade].editora,
                    unidade: livro[unidade].unidade,
                }
            });
        }
        return { success: true, data: livro };
        }
        catch(error: any){
            console.error("Erro no Prisma:", error);
            return { success: false, error: error.message };
        }
});