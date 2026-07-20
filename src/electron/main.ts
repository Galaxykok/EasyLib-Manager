import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { prisma } from "../../lib/prisma.ts";

app.on("ready", () => {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 1280,
        minHeight: 720,
        icon: path.join(app.getAppPath(), "/src/ui/assets/icontask.png"),
        webPreferences: {
            preload: path.join(
                app.getAppPath(),
                "dist-electron/src/electron/preload.cjs",
            ),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.maximize();
    mainWindow.loadFile(path.join(app.getAppPath(), "/dist-react/index.html"));
});

ipcMain.handle("cadastrar-aluno", async (_event, dadosAluno: any) => {
    try {
        const novoAluno = await prisma.aluno.create({
            data: {
                nome: dadosAluno.nome,
                serie: dadosAluno.serie,
            },
        });
        return { success: true, data: novoAluno };
    } catch (error: any) {
        console.error("Erro no Prisma:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle("obter-alunos", async () => {
    try {
        const alunos = await prisma.aluno.findMany({
            orderBy: {
                nome: "asc",
            },
        });
        return { success: true, data: alunos };
    } catch (error: any) {
        console.error("Erro no Prisma:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle("pesquisar-aluno", async (_event, nomeAluno: any) => {
    try {
        const aluno = await prisma.aluno.findMany({
            where: {
                nome: { contains: nomeAluno },
            },
        });
        return { success: true, data: aluno };
    } catch (error: any) {
        console.error("Erro no Prisma:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle("obter-livros", async () => {
    try {
        const alunos = await prisma.livro.findMany({
            orderBy: {
                titulo: "asc",
            },
        });
        return { success: true, data: alunos };
    } catch (error: any) {
        console.error("Erro no Prisma:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle("pesquisar-livro", async (_event, nomeLivro: any) => {
    try {
        const aluno = await prisma.livro.findMany({
            where: {
                titulo: { contains: nomeLivro },
            },
        });
        return { success: true, data: aluno };
    } catch (error: any) {
        console.error("Erro no Prisma:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle("cadastrar-um-livro", async (_event, livro: any) => {
    try {
        let result: any;
        for (let unidade = 0; unidade < livro.length; unidade++) {
            const novoLivro = await prisma.livro.create({
                data: {
                    titulo: livro[unidade].titulo,
                    autor: livro[unidade].autor,
                    numeroEdicao: livro[unidade].numeroEdicao,
                    isbn: livro[unidade].isbn,
                    editora: livro[unidade].editora,
                    unidade: livro[unidade].unidade,
                },
            });
            result.push(novoLivro);
        }
        return { success: true, data: result };
    } catch (error: any) {
        console.error("Erro no Prisma:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle("delete-livro", async (_event, livro: any) => {
    try {
        const livroAExcluir = await prisma.livro.delete({
            where: {
                id: livro.id,
            },
        });
        return { success: true, data: livroAExcluir };
    } catch (error: any) {
        console.error("Erro no Prisma:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle("delete-emprestimo", async (_event, dado: any) => {
    try {
        const emprestimoAExcluir = await prisma.emprestimo.delete({
            where: { id: dado.id },
        });
        return { success: true, data: emprestimoAExcluir };
    } catch (error: any) {
        console.error("Erro no Prisma:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle("delete-aluno", async (_event, aluno: any) => {
    try {
        const alunoAExcluir = await prisma.aluno.delete({
            where: {
                id: aluno.id,
            },
        });
        return { success: true, data: alunoAExcluir };
    } catch (error: any) {
        console.error("Erro no Prisma:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle("cadastrar-emprestimo", async (_event, dados: any) => {
    try {
        const novoEmprestimo = await prisma.emprestimo.create({
            data: {
                alunoId: dados.aluno,
                livroId: dados.livro,
                dataDevolucaoPrevista: dados.dataDevolucaoPrevista,
            },
        });
        return { success: true, data: novoEmprestimo };
    } catch (error: any) {
        console.log("Erro no prisma: ", error.message);
        return { success: false, error: error.message };
    }
});

ipcMain.handle("obter-emprestimo", async (_event) => {
    try {
        await prisma.emprestimo.updateMany({
            where: {
                status: "ATIVO",
                dataDevolucaoPrevista: {
                    not: null,
                    lt: new Date(),
                },
            },
            data: {
                status: "ATRASADO",
            },
        });
        const emprestimos = await prisma.emprestimo.findMany({
            include: {
                aluno: true,
                livro: true,
            },
        });
        return { success: true, data: emprestimos };
    } catch (error: any) {
        console.error("Erro no Prisma:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle("pesquisar-emprestimos", async (_event, dados) => {
    try {
        const emprestimo = await prisma.emprestimo.findMany({
            where: {
                aluno: dados.aluno
                    ? {
                          nome: {
                              contains: dados.aluno,
                          },
                      }
                    : undefined,

                livro: dados.livro
                    ? {
                          titulo: {
                              contains: dados.livro,
                          },
                      }
                    : undefined,
            },
            include: {
                aluno: true,
                livro: true,
            },
        });
        return { success: true, data: emprestimo };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});
ipcMain.handle("confirmar-devolucao", async (_event, dado: any) => {
    try {
        const livroDevolvido = await prisma.emprestimo.update({
            where: { id: dado.id },
            data: { status: "DEVOLVIDO" },
        });
        return { success: true, data: livroDevolvido };
    } catch (error: any) {
        console.error("Erro no Prisma: ", error);
        return { success: false, error: error.message };
    }
});
