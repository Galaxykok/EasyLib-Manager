import { app, BrowserWindow, clipboard, ipcMain } from "electron";
import path from "path";
import { prisma } from "../../lib/prisma.ts";
import { StatusEmprestimo, StatusLivro, TipoLeitor, TipoMovimentacao } from "@prisma/client";
import { chaveSerie, normalizarSerie } from "../shared/normalizacao.ts";

type LivroEntrada = { titulo: string; autor?: string | null; numeroEdicao?: number | null; isbn?: string | null; editora?: string | null; unidade?: number };
type LeitorEntrada = { id?: number; nome: string; serie?: string; tipo?: "ALUNO" | "PROFESSOR" };
type EmprestimoEntrada = { leitor: LeitorEntrada; livros: number[]; estadosLivros?: Record<string, string>; dataDevolucaoPrevista?: string | Date | null };
type LogDebug = { id: number; dataHora: string; origem: string; mensagem: string; detalhes?: string };
type ConfiguracaoEntrada = { termoResponsabilidadeAtivo: boolean; responsavelBiblioteca: string; modeloTermo: string; paresTermosPorFolha?: number; tipoFolha?: string; painelDebugAtivo?: boolean; modoEscuro?: boolean };

const MODELO_TERMO_PADRAO = `TERMO DE RESPONSABILIDADE PELO EMPRÉSTIMO DE LIVRO

Eu, {{nome_aluno}}, da turma/série {{serie_aluno}}, declaro ter recebido o(s) livro(s) abaixo relacionado(s), comprometendo-me a conservá-lo(s) e devolvê-lo(s) até {{data_devolucao}} nas mesmas condições em que foi(ram) recebido(s).

Livro(s) e estado de conservação:
{{livros}}

Empréstimo realizado em {{data}}, às {{hora}}.

Responsável pela biblioteca: {{responsavel_biblioteca}}


____________________________________
Assinatura do aluno


____________________________________
Assinatura do responsável pela biblioteca`;

const substituirVariaveis = (modelo: string, valores: Record<string, string>) =>
  Object.entries(valores).reduce(
    (texto, [variavel, valor]) => texto.replaceAll(`{{${variavel}}}`, valor),
    modelo,
  );

const converterData = (valor: string | Date) =>
  typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? new Date(`${valor}T12:00:00`)
    : new Date(valor);

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
ipcMain.handle("obter-configuracao", async () => {
  try {
    const configuracao = await prisma.configuracao.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        termoResponsabilidadeAtivo: true,
        responsavelBiblioteca: "",
        modeloTermo: MODELO_TERMO_PADRAO,
        paresTermosPorFolha: 2,
        tipoFolha: "A4",
        painelDebugAtivo: true,
        modoEscuro: false,
      },
    });
    return {
      success: true,
      data: {
        ...configuracao,
        modeloTermo: configuracao.modeloTermo || MODELO_TERMO_PADRAO,
      },
    };
  } catch (e) {
    return erro(e);
  }
});
ipcMain.handle("salvar-configuracao", async (_event, dados: ConfiguracaoEntrada) => {
  try {
    const responsavelBiblioteca = String(dados.responsavelBiblioteca || "").trim();
    const paresTermosPorFolha = Math.min(4, Math.max(1, Math.floor(Number(dados.paresTermosPorFolha) || 2)));
    const tipoFolha = ["A4", "CARTA", "OFICIO"].includes(String(dados.tipoFolha))
      ? String(dados.tipoFolha)
      : "A4";
    if (dados.termoResponsabilidadeAtivo && !responsavelBiblioteca) {
      return { success: false, error: "Informe o nome do responsável pela biblioteca." };
    }
    const data = await prisma.configuracao.upsert({
      where: { id: 1 },
      update: {
        termoResponsabilidadeAtivo: Boolean(dados.termoResponsabilidadeAtivo),
        responsavelBiblioteca,
        modeloTermo: String(dados.modeloTermo || "").trim() || MODELO_TERMO_PADRAO,
        paresTermosPorFolha,
        tipoFolha,
        painelDebugAtivo: Boolean(dados.painelDebugAtivo),
        modoEscuro: Boolean(dados.modoEscuro),
      },
      create: {
        id: 1,
        termoResponsabilidadeAtivo: Boolean(dados.termoResponsabilidadeAtivo),
        responsavelBiblioteca,
        modeloTermo: String(dados.modeloTermo || "").trim() || MODELO_TERMO_PADRAO,
        paresTermosPorFolha,
        tipoFolha,
        painelDebugAtivo: Boolean(dados.painelDebugAtivo),
        modoEscuro: Boolean(dados.modoEscuro),
      },
    });
    return { success: true, data };
  } catch (e) {
    return erro(e);
  }
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
ipcMain.handle("cadastrar-aluno", async (_event, leitor: LeitorEntrada) => { try { const data = await prisma.aluno.create({ data: { nome: leitor.nome.trim(), serie: normalizarSerie(leitor.serie), tipo: leitor.tipo === "PROFESSOR" ? TipoLeitor.PROFESSOR : TipoLeitor.ALUNO } }); return { success: true, data }; } catch (e) { return erro(e); } });
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
  if (idsLivros.some((id) => !String(dados.estadosLivros?.[String(id)] || "").trim())) {
    return { success: false, error: "Informe o estado de conservação de todos os livros selecionados." };
  }
  const agora = new Date();
  const data = await prisma.$transaction(async (tx) => {
    const serieNormalizada = normalizarSerie(dados.leitor.serie);
    const tipoLeitor = dados.leitor.tipo === "PROFESSOR" ? TipoLeitor.PROFESSOR : TipoLeitor.ALUNO;
    const candidatos = dados.leitor.id
      ? []
      : await tx.aluno.findMany({
          where: { nome: { equals: dados.leitor.nome.trim() }, tipo: tipoLeitor },
        });
    const leitor = dados.leitor.id
      ? await tx.aluno.findUnique({ where: { id: dados.leitor.id } })
      : candidatos.find((candidato) => chaveSerie(candidato.serie) === chaveSerie(serieNormalizada)) ?? null;
    const pessoa = leitor ?? await tx.aluno.create({ data: { nome: dados.leitor.nome.trim(), serie: serieNormalizada, tipo: tipoLeitor } });
    const livros = await tx.livro.findMany({ where: { id: { in: idsLivros } } });
    if (livros.length !== idsLivros.length) throw new Error("Um ou mais livros selecionados não foram encontrados.");
    const configuracao = await tx.configuracao.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, termoResponsabilidadeAtivo: true, responsavelBiblioteca: "", modeloTermo: MODELO_TERMO_PADRAO, paresTermosPorFolha: 2, tipoFolha: "A4", painelDebugAtivo: true, modoEscuro: false },
    });
    if (configuracao.termoResponsabilidadeAtivo && !configuracao.responsavelBiblioteca.trim()) {
      throw new Error("Configure o nome do responsável pela biblioteca antes de gerar o termo.");
    }
    const emprestimos = [];
    for (const livro of livros) {
      const estadoLivro = String(dados.estadosLivros?.[String(livro.id)] || "").trim();
      const emprestimo = await tx.emprestimo.create({ data: { alunoId: pessoa.id, livroId: livro.id, estadoLivro, dataHoraEmprestimo: agora, dataDevolucaoPrevista: dados.dataDevolucaoPrevista ? converterData(dados.dataDevolucaoPrevista) : null } });
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
    const listaLivros = livros
      .map((livro, indice) => `${indice + 1}. ${livro.titulo} — Estado: ${String(dados.estadosLivros?.[String(livro.id)] || "Não informado")}`)
      .join("\n");
    const dataDevolucao = dados.dataDevolucaoPrevista
      ? converterData(dados.dataDevolucaoPrevista).toLocaleDateString("pt-BR")
      : "data a combinar";
    const termo = configuracao.termoResponsabilidadeAtivo
      ? {
          conteudo: substituirVariaveis(configuracao.modeloTermo || MODELO_TERMO_PADRAO, {
            nome_aluno: pessoa.nome,
            serie_aluno: pessoa.serie || "Não informada",
            tipo_leitor: pessoa.tipo === TipoLeitor.PROFESSOR ? "Professor" : "Aluno",
            data: agora.toLocaleDateString("pt-BR"),
            hora: agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            responsavel_biblioteca: configuracao.responsavelBiblioteca || "Não informado",
            livros: listaLivros,
            estado_livros: livros.map((livro) => String(dados.estadosLivros?.[String(livro.id)] || "Não informado")).join(", "),
            data_devolucao: dataDevolucao,
          }),
          nomeAluno: pessoa.nome,
          serieAluno: pessoa.serie,
          responsavelBiblioteca: configuracao.responsavelBiblioteca,
          criadoEm: agora.toISOString(),
          paresTermosPorFolha: configuracao.paresTermosPorFolha,
          tipoFolha: configuracao.tipoFolha as "A4" | "CARTA" | "OFICIO",
        }
      : undefined;
    return { pessoa, emprestimos, termo };
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
ipcMain.handle("obter-dashboard", async () => {
  try {
    await atualizarAtrasos();
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const [emprestimosMes, ativos, atrasados] = await Promise.all([
      prisma.emprestimo.findMany({
        where: { dataHoraEmprestimo: { gte: inicioMes } },
        include: { aluno: true, livro: true },
      }),
      prisma.emprestimo.count({ where: { status: StatusEmprestimo.ATIVO } }),
      prisma.emprestimo.count({ where: { status: StatusEmprestimo.ATRASADO } }),
    ]);

    const maisFrequente = <T extends { nome: string; total: number }>(itens: T[]) =>
      itens.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"))[0];
    const contar = (valores: string[]) => {
      const contagem = new Map<string, number>();
      valores.filter(Boolean).forEach((valor) => contagem.set(valor, (contagem.get(valor) || 0) + 1));
      return maisFrequente([...contagem].map(([nome, total]) => ({ nome, total })));
    };

    return {
      success: true,
      data: {
        emprestimosMes: emprestimosMes.length,
        emprestimosHoje: emprestimosMes.filter((emprestimo) => emprestimo.dataHoraEmprestimo >= inicioHoje).length,
        ativos,
        atrasados,
        livroFavorito: contar(emprestimosMes.map((emprestimo) => emprestimo.livro.titulo)),
        serieDestaque: contar(emprestimosMes.map((emprestimo) => normalizarSerie(emprestimo.aluno.serie) || "Sem turma")),
        alunoDestaque: contar(emprestimosMes.map((emprestimo) => emprestimo.aluno.nome)),
      },
    };
  } catch (e) {
    return erro(e);
  }
});
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
