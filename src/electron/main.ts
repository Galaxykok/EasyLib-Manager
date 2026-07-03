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

ipcMain.handle('cadastrar-aluno', async (_event, dadosAluno) => {
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

// ipcMain.handle('pesquisar-aluno', async (_event, dadoAluno) =>{
//     try{
//         const aluno = await prisma.aluno.findMany({
//             where: { nome: dadoAluno.nome } 
//         })
//     }
//     catch{

//     }
// });
