import { app, BrowserWindow, clipboard, ipcMain } from "electron";
import path from "path";
import { prisma } from "../../lib/prisma.ts";
import { StatusEmprestimo, StatusLivro, TipoLeitor, TipoMovimentacao } from "@prisma/client";

type LivroEntrada = { titulo: string; autor?: string | null; numeroEdicao?: number | null; isbn?: string | null; editora?: string | null; unidade?: number };
type LeitorEntrada = { id?: number; nome: string; serie?: string; tipo?: "ALUNO" | "PROFESSOR" };
type EmprestimoEntrada = { leitor: LeitorEntrada; livros: number[]; dataDevolucaoPrevista?: string | Date | null };
type LogDebug = { id: number; dataHora: string; origem: string; mensagem: string; detalhes?: string };
const logsDebug: LogDebug[] = [];
let proximoLogId = 1;
const registrarErro = (origem: string, mensagem: string, detalhes?: string) => {
  logsDebug.unshift({ id: proximoLogId++, dataHora: new Date().toISOString(), origem, mensagem, detalhes });
  if (logsDebug.length > 200) logsDebug.length = 200;
};
const erro = (error: unknown) => {
  const mensagem = error instanceof Error ? error.message : "Erro inesperado.";
  registrarErro("Processo principal / banco de dados", mensagem, error instanceof Error ? error.stack : String(error));
  return { success: false, error: mensagem };
};

process.on("uncaughtException", (error) => registrarErro("Processo principal", error.message, error.stack));
process.on("unhandledRejection", (motivo) => registrarErro("Processo principal", "Promessa rejeitada sem tratamento", motivo instanceof Error ? motivo.stack : String(motivo)));

app.on("ready", () => {
  const mainWindow = new BrowserWindow({ width: 1280, height: 720, minWidth: 1024, minHeight: 640, icon: path.join(app.getAppPath(), "/src/ui/assets/icontask.png"), webPreferences: { preload: path.join(app.getAppPath(), "dist-electron/src/electron/preload.cjs"), contextIsolation: true, nodeIntegration: false } });
  mainWindow.maximize();
  mainWindow.loadFile(path.join(app.getAppPath(), "/dist-react/index.html"));
});

ipcMain.handle("registrar-debug", (_event, origem: string, mensagem: string, detalhes?: string) => {
  registrarErro(origem || "Interface", mensagem || "Erro sem mensagem", detalhes);
  return { success: true };
});
ipcMain.handle("obter-logs-debug", () => ({ success: true, data: logsDebug }));
ipcMain.handle("limpar-logs-debug", () => { logsDebug.length = 0; return { success: true }; });
ipcMain.handle("copiar-logs-debug", () => {
  const texto = logsDebug
    .map((log) => `[${new Date(log.dataHora).toLocaleString("pt-BR")}] ${log.origem}: ${log.mensagem}${log.detalhes ? `\n${log.detalhes}` : ""}`)
    .join("\n\n");
  clipboard.writeText(texto);
  return { success: true, quantidade: logsDebug.length };
});
ipcMain.handle("limpar-dados", async (_event, tipo: "movimentacoes" | "emprestimos" | "alunos" | "acervo") => {
  try {
    if (!["movimentacoes", "emprestimos", "alunos", "acervo"].includes(tipo)) {
      return { success: false, error: "Tipo de limpeza inválido." };
    }

    if (tipo === "movimentacoes") {
      const resultado = await prisma.movimentacao.deleteMany();
      await prisma.$executeRawUnsafe("DELETE FROM sqlite_sequence WHERE name = 'movimentacoes'");
      registrarErro("Manutenção do banco", `${resultado.count} movimentações removidas pelo usuário.`);
      return { success: true, quantidade: resultado.count };
    }

    if (tipo === "emprestimos") {
      const quantidade = await prisma.$transaction(async (tx) => {
        const resultado = await tx.emprestimo.deleteMany();
        const livros = await tx.livro.findMany({ select: { id: true, unidade: true } });
        for (const livro of livros) {
          await tx.livro.update({
            where: { id: livro.id },
            data: {
              disponiveis: livro.unidade,
              status: livro.unidade > 0 ? StatusLivro.LIVRE : StatusLivro.EMPRESTADO,
            },
          });
        }
        await tx.$executeRawUnsafe("DELETE FROM sqlite_sequence WHERE name = 'emprestimos'");
        return resultado.count;
      });
      registrarErro("Manutenção do banco", `${quantidade} empréstimos removidos pelo usuário; livros liberados.`);
      return { success: true, quantidade };
    }

    const emprestimosExistentes = await prisma.emprestimo.count();
    if (emprestimosExistentes > 0) {
      return {
        success: false,
        error: `Existem ${emprestimosExistentes} empréstimos vinculados. Limpe os empréstimos primeiro.`,
      };
    }

    if (tipo === "alunos") {
      const resultado = await prisma.aluno.deleteMany();
      await prisma.$executeRawUnsafe("DELETE FROM sqlite_sequence WHERE name = 'alunos'");
      registrarErro("Manutenção do banco", `${resultado.count} alunos removidos pelo usuário.`);
      return { success: true, quantidade: resultado.count };
    }

    const resultado = await prisma.livro.deleteMany();
    await prisma.$executeRawUnsafe("DELETE FROM sqlite_sequence WHERE name = 'livros'");
    registrarErro("Manutenção do banco", `${resultado.count} exemplares removidos pelo usuário.`);
    return { success: true, quantidade: resultado.count };
  } catch (e) {
    return erro(e);
  }
});

ipcMain.handle("obter-alunos", async () => { try { return { success: true, data: await prisma.aluno.findMany({ orderBy: { nome: "asc" } }) }; } catch (e) { return erro(e); } });
ipcMain.handle("pesquisar-aluno", async (_event, nome: string) => { try { return { success: true, data: await prisma.aluno.findMany({ where: { nome: { contains: nome } }, take: 10, orderBy: { nome: "asc" } }) }; } catch (e) { return erro(e); } });
ipcMain.handle("cadastrar-aluno", async (_event, leitor: LeitorEntrada) => { try { const data = await prisma.aluno.create({ data: { nome: leitor.nome.trim(), serie: leitor.serie?.trim() || "", tipo: leitor.tipo === "PROFESSOR" ? TipoLeitor.PROFESSOR : TipoLeitor.ALUNO } }); return { success: true, data }; } catch (e) { return erro(e); } });
ipcMain.handle("delete-aluno", async (_event, leitor: { id: number }) => { try { return { success: true, data: await prisma.aluno.delete({ where: { id: leitor.id } }) }; } catch (e) { return erro(e); } });

ipcMain.handle("obter-livros", async () => { try { return { success: true, data: await prisma.livro.findMany({ orderBy: { titulo: "asc" } }) }; } catch (e) { return erro(e); } });
ipcMain.handle("pesquisar-livro", async (_event, nome: string) => { try { return { success: true, data: await prisma.livro.findMany({ where: { OR: [{ titulo: { contains: nome } }, { isbn: { contains: nome } }, { autor: { contains: nome } }] }, orderBy: { titulo: "asc" } }) }; } catch (e) { return erro(e); } });
ipcMain.handle("cadastrar-um-livro", async (_event, livros: LivroEntrada[]) => { try {
  if (!Array.isArray(livros) || livros.length === 0) return { success: false, error: "Nenhum livro válido foi informado." };
  const preparados = livros.map((livro) => ({
    titulo: String(livro.titulo || "").trim(),
    autor: livro.autor?.trim() || "",
    numeroEdicao: livro.numeroEdicao || null,
    isbn: livro.isbn?.trim() || null,
    editora: livro.editora?.trim() || null,
    unidade: Number.isFinite(Number(livro.unidade))
      ? Math.floor(Number(livro.unidade))
      : 0,
  }));
  if (preparados.some((livro) => !livro.titulo)) return { success: false, error: "Existem registros sem título na importação." };
  const data = await prisma.$transaction(async (tx) => {
    const atualizados = [];
    for (const livro of preparados) {
      const existente = await tx.livro.findFirst({
        where: livro.isbn
          ? { isbn: livro.isbn }
          : {
              titulo: livro.titulo,
              autor: livro.autor,
              numeroEdicao: livro.numeroEdicao,
              editora: livro.editora,
            },
      });
      const registro = existente
        ? await tx.livro.update({
            where: { id: existente.id },
            data: {
              unidade: { increment: livro.unidade },
              disponiveis: { increment: livro.unidade },
              status: existente.disponiveis + livro.unidade > 0
                ? StatusLivro.LIVRE
                : StatusLivro.EMPRESTADO,
            },
          })
        : await tx.livro.create({
            data: {
              ...livro,
              disponiveis: livro.unidade,
              status: livro.unidade > 0 ? StatusLivro.LIVRE : StatusLivro.EMPRESTADO,
            },
          });
      atualizados.push(registro);
      await tx.movimentacao.create({
        data: {
          tipo: TipoMovimentacao.LIVRO_ADICIONADO,
          livroId: registro.id,
          descricao: `Estoque adicionado: ${registro.titulo} (+${livro.unidade}, total ${registro.unidade})`,
        },
      });
    }
    return atualizados;
  }); return { success: true, data };
} catch (e) { return erro(e); } });
ipcMain.handle("delete-livro", async (_event, livro: { id: number }) => { try { return { success: true, data: await prisma.livro.delete({ where: { id: livro.id } }) }; } catch (e) { return erro(e); } });

ipcMain.handle("cadastrar-emprestimo", async (_event, dados: EmprestimoEntrada) => { try {
  if (!dados.leitor.nome?.trim() || !dados.livros?.length) return { success: false, error: "Informe o leitor e ao menos um exemplar." };
  const idsLivros = [...new Set(dados.livros)];
  const data = await prisma.$transaction(async (tx) => {
    const leitor = dados.leitor.id ? await tx.aluno.findUnique({ where: { id: dados.leitor.id } }) : await tx.aluno.findFirst({ where: { nome: { equals: dados.leitor.nome.trim() }, tipo: dados.leitor.tipo === "PROFESSOR" ? TipoLeitor.PROFESSOR : TipoLeitor.ALUNO } });
    const pessoa = leitor ?? await tx.aluno.create({ data: { nome: dados.leitor.nome.trim(), serie: dados.leitor.serie?.trim() || "", tipo: dados.leitor.tipo === "PROFESSOR" ? TipoLeitor.PROFESSOR : TipoLeitor.ALUNO } });
    const livros = await tx.livro.findMany({ where: { id: { in: idsLivros } } });
    if (livros.length !== idsLivros.length) throw new Error("Um ou mais livros selecionados não foram encontrados.");
    const emprestimos = [];
    for (const livro of livros) {
      const emprestimo = await tx.emprestimo.create({ data: { alunoId: pessoa.id, livroId: livro.id, dataDevolucaoPrevista: dados.dataDevolucaoPrevista ? new Date(dados.dataDevolucaoPrevista) : null } });
      emprestimos.push(emprestimo);
      const restantes = livro.disponiveis - 1;
      await tx.livro.update({
        where: { id: livro.id },
        data: {
          disponiveis: { decrement: 1 },
          status: restantes > 0 ? StatusLivro.LIVRE : StatusLivro.EMPRESTADO,
        },
      });
      await tx.movimentacao.create({ data: { tipo: TipoMovimentacao.EMPRESTIMO_CRIADO, alunoId: pessoa.id, livroId: livro.id, descricao: `${pessoa.tipo === TipoLeitor.PROFESSOR ? "Professor" : "Aluno"} ${pessoa.nome} emprestou: ${livro.titulo} (${restantes} disponíveis)` } });
    }
    return { pessoa, emprestimos };
  }); return { success: true, data };
} catch (e) { return erro(e); } });

async function atualizarAtrasos() { await prisma.emprestimo.updateMany({ where: { status: StatusEmprestimo.ATIVO, dataDevolucaoPrevista: { not: null, lt: new Date() } }, data: { status: StatusEmprestimo.ATRASADO } }); }
ipcMain.handle("obter-emprestimo", async () => { try { await atualizarAtrasos(); return { success: true, data: await prisma.emprestimo.findMany({ where: { status: { not: StatusEmprestimo.DEVOLVIDO } }, include: { aluno: true, livro: true }, orderBy: { dataHoraEmprestimo: "desc" } }) }; } catch (e) { return erro(e); } });
ipcMain.handle("pesquisar-emprestimos", async (_event, dados: { aluno?: string; livro?: string }) => { try { await atualizarAtrasos(); return { success: true, data: await prisma.emprestimo.findMany({ where: { status: { not: StatusEmprestimo.DEVOLVIDO }, aluno: dados.aluno ? { nome: { contains: dados.aluno } } : undefined, livro: dados.livro ? { titulo: { contains: dados.livro } } : undefined }, include: { aluno: true, livro: true } }) }; } catch (e) { return erro(e); } });
ipcMain.handle("confirmar-devolucao", async (_event, dado: { id: number; livroId: number }) => { try {
  const data = await prisma.$transaction(async (tx) => {
    const atual = await tx.emprestimo.findUnique({ where: { id: dado.id }, include: { aluno: true, livro: true } });
    if (!atual) throw new Error("Empréstimo não encontrado.");
    if (atual.status === StatusEmprestimo.DEVOLVIDO) throw new Error("Este empréstimo já foi devolvido.");
    const emprestimo = await tx.emprestimo.update({ where: { id: dado.id }, data: { status: StatusEmprestimo.DEVOLVIDO }, include: { aluno: true, livro: true } });
    await tx.livro.update({ where: { id: atual.livroId }, data: { disponiveis: { increment: 1 }, status: atual.livro.disponiveis + 1 > 0 ? StatusLivro.LIVRE : StatusLivro.EMPRESTADO } });
    await tx.movimentacao.create({ data: { tipo: TipoMovimentacao.DEVOLUCAO, alunoId: emprestimo.alunoId, livroId: atual.livroId, descricao: `${emprestimo.aluno.nome} devolveu: ${emprestimo.livro.titulo}` } });
    return emprestimo;
  });
  return { success: true, data };
} catch (e) { return erro(e); } });
ipcMain.handle("delete-emprestimo", async (_event, dado: { id: number; livroId: number }) => { try {
  const data = await prisma.$transaction(async (tx) => {
    const emprestimo = await tx.emprestimo.delete({ where: { id: dado.id }, include: { livro: true } });
    if (emprestimo.status !== StatusEmprestimo.DEVOLVIDO) {
      await tx.livro.update({ where: { id: emprestimo.livroId }, data: { disponiveis: { increment: 1 }, status: emprestimo.livro.disponiveis + 1 > 0 ? StatusLivro.LIVRE : StatusLivro.EMPRESTADO } });
    }
    await tx.movimentacao.create({ data: { tipo: TipoMovimentacao.EMPRESTIMO_EXCLUIDO, livroId: emprestimo.livroId, descricao: `Empréstimo excluído: ${emprestimo.livro.titulo}` } });
    return emprestimo;
  });
  return { success: true, data };
} catch (e) { return erro(e); } });
ipcMain.handle("obter-exportacao", async (_event, inicio?: string, fim?: string) => {
  try {
    await atualizarAtrasos();
    const intervalo = inicio || fim ? {
      gte: inicio ? new Date(`${inicio}T00:00:00`) : undefined,
      lte: fim ? new Date(`${fim}T23:59:59.999`) : undefined,
    } : undefined;
    const periodoEmprestimo = intervalo ? { dataHoraEmprestimo: intervalo } : {};
    const periodoMovimentacao = intervalo ? { criadoEm: intervalo } : {};
    const [acervo, ativos, atrasados, historico, movimentos, alunos, livros] = await Promise.all([
      prisma.livro.findMany({ orderBy: { titulo: "asc" } }),
      prisma.emprestimo.findMany({ where: { status: StatusEmprestimo.ATIVO, ...periodoEmprestimo }, include: { aluno: true, livro: true }, orderBy: { dataHoraEmprestimo: "desc" } }),
      prisma.emprestimo.findMany({ where: { status: StatusEmprestimo.ATRASADO, ...periodoEmprestimo }, include: { aluno: true, livro: true }, orderBy: { dataHoraEmprestimo: "desc" } }),
      prisma.emprestimo.findMany({ where: periodoEmprestimo, include: { aluno: true, livro: true }, orderBy: { dataHoraEmprestimo: "desc" } }),
      prisma.movimentacao.findMany({ where: periodoMovimentacao, orderBy: { criadoEm: "desc" } }),
      prisma.aluno.findMany({ select: { id: true, nome: true } }),
      prisma.livro.findMany({ select: { id: true, titulo: true } }),
    ]);
    const nomesAlunos = new Map(alunos.map((aluno) => [aluno.id, aluno.nome]));
    const titulosLivros = new Map(livros.map((livro) => [livro.id, livro.titulo]));
    const movimentacoes = movimentos.map((movimento) => ({
      ...movimento,
      alunoNome: movimento.alunoId ? nomesAlunos.get(movimento.alunoId) : undefined,
      livroTitulo: movimento.livroId ? titulosLivros.get(movimento.livroId) : undefined,
    }));
    return { success: true, data: { acervo, ativos, atrasados, historico, movimentacoes } };
  } catch (e) {
    return erro(e);
  }
});
