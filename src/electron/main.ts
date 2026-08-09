import "dotenv/config";
import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeTheme } from "electron";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "path";
import { StatusEmprestimo, StatusLivro, TipoLeitor, TipoMovimentacao } from "@prisma/client";
import { chaveSerie, normalizarSerie } from "../shared/normalizacao.ts";

type LivroEntrada = { titulo: string; autor?: string | null; numeroEdicao?: number | null; isbn?: string | null; editora?: string | null; unidade?: number };
type LivroAtualizacaoEntrada = { id: number; titulo: string; autor: string; numeroEdicao: number | null; isbn: string | null; editora: string | null; unidade: number };
type LeitorEntrada = { id?: number; nome: string; serie?: string; tipo?: "ALUNO" | "PROFESSOR" };
type AlunoAtualizacaoEntrada = LeitorEntrada & { id: number };
type ItemEmprestimoEntrada = { livroId: number; quantidade: number; estadoLivro: string };
type EmprestimoEntrada = {
  leitor: LeitorEntrada;
  itens?: ItemEmprestimoEntrada[];
  livros?: number[];
  estadosLivros?: Record<string, string>;
  dataDevolucaoPrevista?: string | Date | null;
  confirmarMultiplosTitulos?: boolean;
  confirmarEmprestimoPendente?: boolean;
};
type DevolucaoEntrada = {
  id: number;
  quantidade?: number;
  punicao?: { dias: number; motivo?: string } | null;
};
type LogDebug = { id: number; dataHora: string; origem: string; mensagem: string; detalhes?: string };
type ConfiguracaoEntrada = { termoResponsabilidadeAtivo: boolean; responsavelBiblioteca: string; modeloTermo: string; paresTermosPorFolha?: number; tipoFolha?: string; painelDebugAtivo?: boolean; modoEscuro?: boolean };

const LIMITE_INTEIRO_BANCO = 2_147_483_647;
const DIA_EM_MS = 86_400_000;
const FORMATO_BACKUP = "easylib-manager-backup";
const VERSAO_BACKUP = 1;

type ClientePrisma = typeof import("../../lib/prisma.ts").prisma;
let prisma: ClientePrisma;

const inicializarClientePrisma = async () => {
  if (prisma) return;
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL === "undefined") {
    const pastaDados = app.getPath("userData");
    await mkdir(pastaDados, { recursive: true });
    process.env.DATABASE_URL = `file:${path.join(pastaDados, "easylib.db").replaceAll("\\", "/")}`;
  }
  ({ prisma } = await import("../../lib/prisma.ts"));
};

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

const CONFIGURACAO_PADRAO = {
  id: 1,
  termoResponsabilidadeAtivo: true,
  responsavelBiblioteca: "",
  modeloTermo: MODELO_TERMO_PADRAO,
  paresTermosPorFolha: 2,
  tipoFolha: "A4",
  painelDebugAtivo: true,
  modoEscuro: false,
};

type ColunaSqlite = { name: string };

const garantirTabelasBase = async () => {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "alunos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "serie" TEXT NOT NULL DEFAULT '',
    "tipo" TEXT NOT NULL DEFAULT 'ALUNO',
    "ativo" BOOLEAN NOT NULL DEFAULT 1,
    "banidoAte" DATETIME,
    "motivoBanimento" TEXT
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "livros" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titulo" TEXT NOT NULL,
    "autor" TEXT NOT NULL DEFAULT '',
    "numeroEdicao" INTEGER,
    "isbn" TEXT,
    "editora" TEXT,
    "unidade" INTEGER NOT NULL DEFAULT 1,
    "disponiveis" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'LIVRE'
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "emprestimos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "grupoId" TEXT NOT NULL DEFAULT '',
    "id_aluno" INTEGER NOT NULL,
    "id_livro" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "quantidadeDevolvida" INTEGER NOT NULL DEFAULT 0,
    "dataHoraEmprestimo" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataDevolucaoPrevista" DATETIME,
    "devolvidoEm" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "estadoLivro" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "emprestimos_id_aluno_fkey" FOREIGN KEY ("id_aluno") REFERENCES "alunos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "emprestimos_id_livro_fkey" FOREIGN KEY ("id_livro") REFERENCES "livros" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "configuracoes" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "termoResponsabilidadeAtivo" BOOLEAN NOT NULL DEFAULT 1,
    "responsavelBiblioteca" TEXT NOT NULL DEFAULT '',
    "modeloTermo" TEXT NOT NULL DEFAULT '',
    "paresTermosPorFolha" INTEGER NOT NULL DEFAULT 2,
    "tipoFolha" TEXT NOT NULL DEFAULT 'A4',
    "painelDebugAtivo" BOOLEAN NOT NULL DEFAULT 1,
    "modoEscuro" BOOLEAN NOT NULL DEFAULT 0
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "movimentacoes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "alunoId" INTEGER,
    "livroId" INTEGER,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "livros_id_key" ON "livros"("id")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "livros_titulo_idx" ON "livros"("titulo")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "livros_isbn_idx" ON "livros"("isbn")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "movimentacoes_criadoEm_idx" ON "movimentacoes"("criadoEm")');
};

const garantirEstruturaBanco = async () => {
  await garantirTabelasBase();
  const colunasAlunos = await prisma.$queryRawUnsafe<ColunaSqlite[]>('PRAGMA table_info("alunos")');
  const nomesAlunos = new Set(colunasAlunos.map((coluna) => coluna.name));
  const colunasEmprestimos = await prisma.$queryRawUnsafe<ColunaSqlite[]>('PRAGMA table_info("emprestimos")');
  const nomesEmprestimos = new Set(colunasEmprestimos.map((coluna) => coluna.name));
  const precisaMigrar = !nomesAlunos.has("ativo")
    || !nomesAlunos.has("banidoAte")
    || !nomesAlunos.has("motivoBanimento")
    || !nomesEmprestimos.has("grupoId")
    || !nomesEmprestimos.has("quantidade")
    || !nomesEmprestimos.has("quantidadeDevolvida")
    || !nomesEmprestimos.has("devolvidoEm");
  if (precisaMigrar) {
    const integridade = await prisma.$queryRawUnsafe<Array<{ integrity_check: string }>>("PRAGMA integrity_check");
    if (integridade.some((item) => item.integrity_check !== "ok")) {
      throw new Error("O banco local não passou na verificação de integridade. Nenhuma migração foi aplicada.");
    }
    const chavesInvalidas = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>("PRAGMA foreign_key_check");
    if (chavesInvalidas.length > 0) {
      throw new Error("O banco local possui vínculos inválidos. Nenhuma migração foi aplicada.");
    }
    const instante = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
    const destino = path.join(app.getPath("userData"), `antes-migracao-${instante}.sqlite`).replaceAll("'", "''");
    await prisma.$executeRawUnsafe(`VACUUM INTO '${destino}'`);
  }
  if (!nomesAlunos.has("ativo")) {
    await prisma.$executeRawUnsafe('ALTER TABLE "alunos" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT 1');
  }
  if (!nomesAlunos.has("banidoAte")) {
    await prisma.$executeRawUnsafe('ALTER TABLE "alunos" ADD COLUMN "banidoAte" DATETIME');
  }
  if (!nomesAlunos.has("motivoBanimento")) {
    await prisma.$executeRawUnsafe('ALTER TABLE "alunos" ADD COLUMN "motivoBanimento" TEXT');
  }
  if (!nomesEmprestimos.has("grupoId")) {
    await prisma.$executeRawUnsafe('ALTER TABLE "emprestimos" ADD COLUMN "grupoId" TEXT NOT NULL DEFAULT \'\'');
  }
  if (!nomesEmprestimos.has("quantidade")) {
    await prisma.$executeRawUnsafe('ALTER TABLE "emprestimos" ADD COLUMN "quantidade" INTEGER NOT NULL DEFAULT 1');
  }
  if (!nomesEmprestimos.has("quantidadeDevolvida")) {
    await prisma.$executeRawUnsafe('ALTER TABLE "emprestimos" ADD COLUMN "quantidadeDevolvida" INTEGER NOT NULL DEFAULT 0');
  }
  if (!nomesEmprestimos.has("devolvidoEm")) {
    await prisma.$executeRawUnsafe('ALTER TABLE "emprestimos" ADD COLUMN "devolvidoEm" DATETIME');
  }

  await prisma.$executeRawUnsafe('UPDATE "emprestimos" SET "grupoId" = \'legado-\' || "id" WHERE "grupoId" = \'\'');
  await prisma.$executeRawUnsafe('UPDATE "emprestimos" SET "quantidadeDevolvida" = "quantidade" WHERE "status" = \'DEVOLVIDO\' AND "quantidadeDevolvida" <> "quantidade"');
  await prisma.$executeRawUnsafe(`UPDATE "livros"
    SET "unidade" = MAX("unidade", COALESCE((
      SELECT SUM(MAX(0, "emprestimos"."quantidade" - "emprestimos"."quantidadeDevolvida"))
      FROM "emprestimos" WHERE "emprestimos"."id_livro" = "livros"."id"
    ), 0))`);
  await prisma.$executeRawUnsafe(`UPDATE "livros"
    SET "disponiveis" = MAX(0, "unidade" - COALESCE((
      SELECT SUM(MAX(0, "emprestimos"."quantidade" - "emprestimos"."quantidadeDevolvida"))
      FROM "emprestimos" WHERE "emprestimos"."id_livro" = "livros"."id"
    ), 0)),
    "status" = CASE WHEN "unidade" - COALESCE((
      SELECT SUM(MAX(0, "emprestimos"."quantidade" - "emprestimos"."quantidadeDevolvida"))
      FROM "emprestimos" WHERE "emprestimos"."id_livro" = "livros"."id"
    ), 0) > 0 THEN 'LIVRE' ELSE 'EMPRESTADO' END`);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "alunos_ativo_nome_idx" ON "alunos"("ativo", "nome")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "emprestimos_grupoId_idx" ON "emprestimos"("grupoId")');
  if (precisaMigrar) {
    await prisma.movimentacao.create({
      data: {
        tipo: TipoMovimentacao.DADOS_LIMPOS,
        descricao: "Estrutura de dados atualizada para leitores arquivados, banimentos, quantidades e devoluções parciais; estoques conferidos.",
      },
    });
  }
};

const obterConfiguracaoPersistida = async () => {
  const configuracao = await prisma.configuracao.upsert({
    where: { id: 1 },
    update: {},
    create: { ...CONFIGURACAO_PADRAO },
  });
  return {
    ...configuracao,
    modeloTermo: configuracao.modeloTermo || MODELO_TERMO_PADRAO,
  };
};

const substituirVariaveis = (modelo: string, valores: Record<string, string>) =>
  Object.entries(valores).reduce(
    (texto, [variavel, valor]) => texto.replaceAll(`{{${variavel}}}`, valor),
    modelo,
  );

const converterData = (valor: string | Date) =>
  typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? new Date(`${valor}T23:59:59.999`)
    : new Date(valor);

const inicioDoDia = (data = new Date()) => new Date(
  data.getFullYear(),
  data.getMonth(),
  data.getDate(),
);

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

type EstadoInicializacao = "carregando" | "pronto" | "erro";
type StatusInicializacao = {
  estado: EstadoInicializacao;
  titulo: string;
  detalhe: string;
  tema?: "light" | "dark";
};

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let inicializando = false;

const aguardar = (tempo: number) => new Promise((resolve) => setTimeout(resolve, tempo));
const caminhoDistribuicao = (...partes: string[]) => path.join(app.getAppPath(), ...partes);

const enviarStatusInicializacao = (status: StatusInicializacao) => {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  splashWindow.webContents.send("startup:status", status);
};

const criarSplash = async () => {
  const temaInicial = nativeTheme.shouldUseDarkColors ? "dark" : "light";
  splashWindow = new BrowserWindow({
    width: 520,
    height: 390,
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    autoHideMenuBar: true,
    backgroundColor: temaInicial === "dark" ? "#111820" : "#f1f4f6",
    webPreferences: {
      preload: caminhoDistribuicao("dist-electron", "src", "electron", "splash-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  splashWindow.center();
  splashWindow.on("closed", () => { splashWindow = null; });
  await splashWindow.loadFile(caminhoDistribuicao("dist-react", "splash.html"), {
    query: { theme: temaInicial },
  });
  splashWindow.show();
};

const prepararInicializacao = async () => {
  enviarStatusInicializacao({
    estado: "carregando",
    titulo: "Verificando o banco local",
    detalhe: "Conferindo se os dados da biblioteca estão disponíveis.",
  });
  await inicializarClientePrisma();
  await prisma.$queryRawUnsafe("SELECT 1 AS ok");
  await garantirEstruturaBanco();

  enviarStatusInicializacao({
    estado: "carregando",
    titulo: "Carregando preferências",
    detalhe: "Aplicando as configurações salvas neste computador.",
  });
  const configuracao = await obterConfiguracaoPersistida();
  const tema: "dark" | "light" = configuracao.modoEscuro ? "dark" : "light";
  enviarStatusInicializacao({
    estado: "carregando",
    titulo: "Preparando o ambiente local",
    detalhe: "Organizando os serviços necessários para iniciar o EasyLib.",
    tema,
  });

  // A futura validação de licença e vínculo com o computador deve executar aqui,
  // antes que a janela principal e os dados do sistema sejam liberados.
  return { tema };
};

const criarJanelaPrincipal = async (tema: "light" | "dark") => {
  const janela = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: tema === "dark" ? "#111820" : "#f1f4f6",
    icon: caminhoDistribuicao("src", "ui", "assets", "icontask.png"),
    webPreferences: {
      preload: caminhoDistribuicao("dist-electron", "src", "electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow = janela;

  const prontaParaMostrar = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("A interface demorou demais para responder.")), 15000);
    janela.once("ready-to-show", () => {
      clearTimeout(timeout);
      resolve();
    });
    janela.webContents.once("did-fail-load", (_event, codigo, descricao) => {
      clearTimeout(timeout);
      reject(new Error(`Não foi possível carregar a interface (${codigo}): ${descricao}`));
    });
  });

  await janela.loadFile(caminhoDistribuicao("dist-react", "index.html"), {
    query: { theme: tema },
  });
  await prontaParaMostrar;
  return janela;
};

const iniciarAplicacao = async () => {
  if (inicializando) return;
  inicializando = true;
  const inicio = Date.now();

  try {
    if (!splashWindow || splashWindow.isDestroyed()) await criarSplash();
    enviarStatusInicializacao({
      estado: "carregando",
      titulo: "Preparando o sistema",
      detalhe: "Iniciando os serviços locais da biblioteca.",
    });

    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
    mainWindow = null;

    const { tema } = await prepararInicializacao();
    enviarStatusInicializacao({
      estado: "carregando",
      titulo: "Carregando a interface",
      detalhe: "O EasyLib estará pronto em instantes.",
      tema,
    });
    const janela = await criarJanelaPrincipal(tema);

    const tempoRestante = Math.max(0, 650 - (Date.now() - inicio));
    if (tempoRestante) await aguardar(tempoRestante);
    enviarStatusInicializacao({
      estado: "pronto",
      titulo: "Tudo pronto",
      detalhe: "Abrindo o painel da biblioteca.",
      tema,
    });
    await aguardar(180);

    janela.maximize();
    janela.show();
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Erro inesperado durante a inicialização.";
    registrarErro("Inicialização", mensagem, error instanceof Error ? error.stack : String(error));
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
    mainWindow = null;
    enviarStatusInicializacao({
      estado: "erro",
      titulo: "Não foi possível iniciar o EasyLib",
      detalhe: mensagem,
    });
  } finally {
    inicializando = false;
  }
};

ipcMain.on("startup:retry", () => { void iniciarAplicacao(); });
ipcMain.on("startup:close", () => app.quit());

app.whenReady().then(() => { void iniciarAplicacao(); });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
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
ipcMain.handle("restaurar-foco", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    mainWindow.webContents.focus();
  }
  return { success: true };
});
ipcMain.handle("obter-configuracao", async () => {
  try {
    return { success: true, data: await obterConfiguracaoPersistida() };
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
    const valores = {
        termoResponsabilidadeAtivo: Boolean(dados.termoResponsabilidadeAtivo),
        responsavelBiblioteca,
        modeloTermo: String(dados.modeloTermo || "").trim() || MODELO_TERMO_PADRAO,
        paresTermosPorFolha,
        tipoFolha,
        painelDebugAtivo: Boolean(dados.painelDebugAtivo),
        modoEscuro: Boolean(dados.modoEscuro),
    };
    const data = await prisma.$transaction(async (tx) => {
      const configuracao = await tx.configuracao.upsert({
        where: { id: 1 },
        update: valores,
        create: { id: 1, ...valores },
      });
      await tx.movimentacao.create({ data: {
        tipo: TipoMovimentacao.CONFIGURACAO_ATUALIZADA,
        descricao: `Configurações atualizadas: termo ${configuracao.termoResponsabilidadeAtivo ? "ativo" : "inativo"}, tema ${configuracao.modoEscuro ? "escuro" : "claro"}.`,
      } });
      return configuracao;
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
      const quantidade = await prisma.$transaction(async (tx) => {
        const resultado = await tx.movimentacao.deleteMany();
        await tx.$executeRawUnsafe("DELETE FROM sqlite_sequence WHERE name = 'movimentacoes'");
        await tx.movimentacao.create({
          data: {
            tipo: TipoMovimentacao.DADOS_LIMPOS,
            descricao: `Histórico de movimentações limpo pelo usuário: ${resultado.count} registro(s) removido(s).`,
          },
        });
        return resultado.count;
      });
      registrarErro("Manutenção do banco", `${quantidade} movimentações removidas pelo usuário.`);
      return { success: true, quantidade };
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
        await tx.movimentacao.create({ data: { tipo: TipoMovimentacao.DADOS_LIMPOS, descricao: `Limpeza de empréstimos executada: ${resultado.count} registro(s) removido(s) e estoques recalculados.` } });
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
      const quantidade = await prisma.$transaction(async (tx) => {
        const resultado = await tx.aluno.deleteMany();
        await tx.$executeRawUnsafe("DELETE FROM sqlite_sequence WHERE name = 'alunos'");
        await tx.movimentacao.create({ data: { tipo: TipoMovimentacao.DADOS_LIMPOS, descricao: `Limpeza total de leitores executada: ${resultado.count} cadastro(s) removido(s).` } });
        return resultado.count;
      });
      registrarErro("Manutenção do banco", `${quantidade} alunos removidos pelo usuário.`);
      return { success: true, quantidade };
    }

    const quantidade = await prisma.$transaction(async (tx) => {
      const resultado = await tx.livro.deleteMany();
      await tx.$executeRawUnsafe("DELETE FROM sqlite_sequence WHERE name = 'livros'");
      await tx.movimentacao.create({ data: { tipo: TipoMovimentacao.DADOS_LIMPOS, descricao: `Limpeza total do acervo executada: ${resultado.count} título(s) removido(s).` } });
      return resultado.count;
    });
    registrarErro("Manutenção do banco", `${quantidade} exemplares removidos pelo usuário.`);
    return { success: true, quantidade };
  } catch (e) {
    return erro(e);
  }
});

const prepararLeitor = (leitor: LeitorEntrada) => ({
  nome: String(leitor?.nome || "").trim(),
  serie: normalizarSerie(leitor?.serie),
  tipo: leitor?.tipo === "PROFESSOR" ? TipoLeitor.PROFESSOR : TipoLeitor.ALUNO,
});

const validarId = (id: unknown) => Number.isSafeInteger(id)
  && Number(id) > 0
  && Number(id) <= LIMITE_INTEIRO_BANCO;

ipcMain.handle("obter-alunos", async () => {
  try {
    return {
      success: true,
      data: await prisma.aluno.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    };
  } catch (e) {
    return erro(e);
  }
});

ipcMain.handle("pesquisar-aluno", async (_event, nome: string) => {
  try {
    return {
      success: true,
      data: await prisma.aluno.findMany({
        where: { ativo: true, nome: { contains: String(nome || "") } },
        take: 20,
        orderBy: { nome: "asc" },
      }),
    };
  } catch (e) {
    return erro(e);
  }
});

ipcMain.handle("cadastrar-aluno", async (_event, leitor: LeitorEntrada) => {
  try {
    const preparado = prepararLeitor(leitor);
    if (!preparado.nome) return { success: false, error: "Informe o nome do leitor." };
    if (preparado.tipo === TipoLeitor.ALUNO && !preparado.serie) {
      return { success: false, error: "Informe a turma ou série do aluno." };
    }
    const data = await prisma.$transaction(async (tx) => {
      const aluno = await tx.aluno.create({ data: preparado });
      await tx.movimentacao.create({
        data: {
          tipo: TipoMovimentacao.ALUNO_CADASTRADO,
          alunoId: aluno.id,
          descricao: `${aluno.tipo === TipoLeitor.PROFESSOR ? "Professor" : "Aluno"} cadastrado: ${aluno.nome}.`,
        },
      });
      return aluno;
    });
    return { success: true, data };
  } catch (e) {
    return erro(e);
  }
});

ipcMain.handle("atualizar-aluno", async (_event, leitor: AlunoAtualizacaoEntrada) => {
  try {
    if (!validarId(leitor?.id)) return { success: false, error: "O leitor selecionado é inválido." };
    const preparado = prepararLeitor(leitor);
    if (!preparado.nome) return { success: false, error: "Informe o nome do leitor." };
    if (preparado.tipo === TipoLeitor.ALUNO && !preparado.serie) {
      return { success: false, error: "Informe a turma ou série do aluno." };
    }
    const data = await prisma.$transaction(async (tx) => {
      const atual = await tx.aluno.findFirst({ where: { id: leitor.id, ativo: true } });
      if (!atual) throw new Error("O aluno ou professor não foi encontrado.");
      const atualizado = await tx.aluno.update({ where: { id: leitor.id }, data: preparado });
      await tx.movimentacao.create({
        data: {
          tipo: TipoMovimentacao.ALUNO_ATUALIZADO,
          alunoId: atualizado.id,
          descricao: `Cadastro atualizado: ${atual.nome} → ${atualizado.nome}; turma/tipo: ${atual.serie || "—"}/${atual.tipo} → ${atualizado.serie || "—"}/${atualizado.tipo}.`,
        },
      });
      return atualizado;
    });
    return { success: true, data };
  } catch (e) {
    return erro(e);
  }
});

const arquivarAlunos = async (idsRecebidos: unknown) => {
  if (!Array.isArray(idsRecebidos) || idsRecebidos.length === 0) {
    return { success: false as const, error: "Selecione ao menos um aluno ou professor." };
  }
  if (idsRecebidos.some((id) => !validarId(id))) {
    return { success: false as const, error: "A seleção contém um leitor inválido." };
  }
  const ids = [...new Set(idsRecebidos as number[])];
  return prisma.$transaction(async (tx) => {
    const alunos = await tx.aluno.findMany({
      where: { id: { in: ids }, ativo: true },
      orderBy: { nome: "asc" },
    });
    if (alunos.length !== ids.length) {
      return { success: false as const, error: "Um ou mais leitores não foram encontrados. Atualize a lista." };
    }
    const pendentes = await tx.emprestimo.findMany({
      where: {
        alunoId: { in: ids },
        status: { in: [StatusEmprestimo.ATIVO, StatusEmprestimo.ATRASADO] },
      },
      select: { alunoId: true },
    });
    const idsPendentes = new Set(pendentes.map((item) => item.alunoId));
    const bloqueados = alunos.filter((aluno) => idsPendentes.has(aluno.id));
    if (bloqueados.length) {
      const nomes = bloqueados.slice(0, 3).map((aluno) => aluno.nome).join(", ");
      return {
        success: false as const,
        error: `${nomes}${bloqueados.length > 3 ? ` e mais ${bloqueados.length - 3}` : ""} possui empréstimo pendente. Nenhum cadastro foi arquivado.`,
      };
    }
    await tx.aluno.updateMany({ where: { id: { in: ids } }, data: { ativo: false } });
    for (const aluno of alunos) {
      await tx.movimentacao.create({
        data: {
          tipo: TipoMovimentacao.ALUNO_ARQUIVADO,
          alunoId: aluno.id,
          descricao: `Cadastro arquivado: ${aluno.nome} (${aluno.tipo === TipoLeitor.PROFESSOR ? "professor" : aluno.serie || "aluno"}).`,
        },
      });
    }
    return { success: true as const, quantidade: alunos.length };
  });
};

ipcMain.handle("arquivar-alunos", async (_event, ids: number[]) => {
  try {
    return await arquivarAlunos(ids);
  } catch (e) {
    return erro(e);
  }
});

ipcMain.handle("delete-aluno", async (_event, leitor: { id: number }) => {
  try {
    return await arquivarAlunos([leitor?.id]);
  } catch (e) {
    return erro(e);
  }
});

ipcMain.handle("aplicar-banimento", async (_event, entrada: { alunoId: number; dias: number; motivo: string }) => {
  try {
    if (!validarId(entrada?.alunoId)) return { success: false, error: "O leitor selecionado é inválido." };
    if (!Number.isSafeInteger(entrada?.dias) || entrada.dias < 1 || entrada.dias > 3650) {
      return { success: false, error: "Informe uma punição entre 1 e 3650 dias." };
    }
    const motivo = String(entrada?.motivo || "").trim();
    if (!motivo) return { success: false, error: "Informe o motivo do banimento." };
    const banidoAte = new Date(Date.now() + entrada.dias * DIA_EM_MS);
    const data = await prisma.$transaction(async (tx) => {
      const atual = await tx.aluno.findFirst({ where: { id: entrada.alunoId, ativo: true } });
      if (!atual) throw new Error("O aluno ou professor não está ativo no sistema.");
      const aluno = await tx.aluno.update({
        where: { id: entrada.alunoId },
        data: { banidoAte, motivoBanimento: motivo },
      });
      await tx.movimentacao.create({
        data: {
          tipo: TipoMovimentacao.BANIMENTO_APLICADO,
          alunoId: aluno.id,
          descricao: `Banimento aplicado a ${aluno.nome} por ${entrada.dias} dia(s). Motivo: ${motivo}.`,
        },
      });
      return aluno;
    });
    return { success: true, data };
  } catch (e) {
    return erro(e);
  }
});

ipcMain.handle("remover-banimento", async (_event, entrada: { alunoId: number; motivo?: string }) => {
  try {
    if (!validarId(entrada?.alunoId)) return { success: false, error: "O leitor selecionado é inválido." };
    const data = await prisma.$transaction(async (tx) => {
      const atual = await tx.aluno.findUnique({ where: { id: entrada.alunoId } });
      if (!atual) throw new Error("O aluno ou professor não foi encontrado.");
      if (!atual.ativo) throw new Error("O aluno ou professor não está ativo no sistema.");
      if (!atual.banidoAte || atual.banidoAte <= new Date()) throw new Error("Este leitor não possui banimento ativo.");
      const aluno = await tx.aluno.update({
        where: { id: entrada.alunoId },
        data: { banidoAte: null, motivoBanimento: null },
      });
      await tx.movimentacao.create({
        data: {
          tipo: TipoMovimentacao.BANIMENTO_REMOVIDO,
          alunoId: aluno.id,
          descricao: `Banimento removido de ${aluno.nome}.${entrada.motivo ? ` Motivo: ${String(entrada.motivo).trim()}.` : ""}`,
        },
      });
      return aluno;
    });
    return { success: true, data };
  } catch (e) {
    return erro(e);
  }
});

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
  if (preparados.some((livro) => livro.numeroEdicao !== null
    && (!Number.isSafeInteger(livro.numeroEdicao)
      || livro.numeroEdicao < 1
      || livro.numeroEdicao > LIMITE_INTEIRO_BANCO))) {
    return { success: false, error: `A edição deve ser um inteiro entre 1 e ${LIMITE_INTEIRO_BANCO} ou ficar em branco.` };
  }
  if (preparados.some((livro) => !Number.isSafeInteger(livro.unidade)
    || livro.unidade < 0
    || livro.unidade > LIMITE_INTEIRO_BANCO)) {
    return { success: false, error: `O estoque deve ser um inteiro entre 0 e ${LIMITE_INTEIRO_BANCO}.` };
  }
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

ipcMain.handle("atualizar-livro", async (_event, entrada: LivroAtualizacaoEntrada | null) => {
  try {
    if (!entrada || typeof entrada !== "object") {
      return { success: false, error: "Os dados do livro são inválidos." };
    }
    if (!Number.isSafeInteger(entrada.id) || entrada.id <= 0 || entrada.id > LIMITE_INTEIRO_BANCO) {
      return { success: false, error: "O identificador do livro é inválido." };
    }
    if (typeof entrada.titulo !== "string" || !entrada.titulo.trim()) {
      return { success: false, error: "Informe o título do livro." };
    }
    if (typeof entrada.autor !== "string") {
      return { success: false, error: "O autor informado é inválido." };
    }
    if (entrada.numeroEdicao !== null && (!Number.isSafeInteger(entrada.numeroEdicao)
      || entrada.numeroEdicao <= 0
      || entrada.numeroEdicao > LIMITE_INTEIRO_BANCO)) {
      return { success: false, error: `A edição deve ser um número inteiro entre 1 e ${LIMITE_INTEIRO_BANCO} ou ficar em branco.` };
    }
    if (entrada.isbn !== null && typeof entrada.isbn !== "string") {
      return { success: false, error: "O ISBN informado é inválido." };
    }
    if (entrada.editora !== null && typeof entrada.editora !== "string") {
      return { success: false, error: "A editora informada é inválida." };
    }
    if (!Number.isSafeInteger(entrada.unidade)
      || entrada.unidade < 0
      || entrada.unidade > LIMITE_INTEIRO_BANCO) {
      return { success: false, error: `O estoque total deve ser um número inteiro entre 0 e ${LIMITE_INTEIRO_BANCO}.` };
    }

    const id = entrada.id;
    const titulo = entrada.titulo.trim();
    const autor = entrada.autor.trim();
    const numeroEdicao = entrada.numeroEdicao;
    const isbn = entrada.isbn?.trim() || null;
    const editora = entrada.editora?.trim() || null;
    const unidade = entrada.unidade;

    return await prisma.$transaction(async (tx) => {
      const livroAtual = await tx.livro.findUnique({ where: { id }, select: { id: true } });
      if (!livroAtual) {
        return { success: false, error: "O livro selecionado não foi encontrado." };
      }

      if (isbn) {
        const livroComMesmoIsbn = await tx.livro.findFirst({
          where: { isbn, id: { not: id } },
          select: { titulo: true },
        });
        if (livroComMesmoIsbn) {
          return {
            success: false,
            error: `O ISBN informado já pertence ao livro "${livroComMesmoIsbn.titulo}".`,
          };
        }
      }

      const linhasAtivas = await tx.emprestimo.findMany({
        where: {
          livroId: id,
          status: { in: [StatusEmprestimo.ATIVO, StatusEmprestimo.ATRASADO] },
        },
        select: { quantidade: true, quantidadeDevolvida: true },
      });
      const emprestimosAtivos = linhasAtivas.reduce(
        (total, item) => total + Math.max(0, item.quantidade - item.quantidadeDevolvida),
        0,
      );
      if (unidade < emprestimosAtivos) {
        const descricao = emprestimosAtivos === 1
          ? "1 exemplar está emprestado"
          : `${emprestimosAtivos} exemplares estão emprestados`;
        return {
          success: false,
          error: `O estoque total não pode ser menor que ${emprestimosAtivos}, pois ${descricao}.`,
        };
      }

      const disponiveis = unidade - emprestimosAtivos;
      const data = await tx.livro.update({
        where: { id },
        data: {
          titulo,
          autor,
          numeroEdicao,
          isbn,
          editora,
          unidade,
          disponiveis,
          status: disponiveis > 0 ? StatusLivro.LIVRE : StatusLivro.EMPRESTADO,
        },
      });
      await tx.movimentacao.create({
        data: {
          tipo: TipoMovimentacao.LIVRO_ATUALIZADO,
          livroId: data.id,
          descricao: `Livro atualizado: ${data.titulo}; estoque total ${data.unidade}, disponível ${data.disponiveis}.`,
        },
      });
      return { success: true, data };
    });
  } catch (e) {
    return erro(e);
  }
});

const excluirLivrosComSeguranca = async (idsRecebidos: unknown) => {
  try {
    if (!Array.isArray(idsRecebidos) || idsRecebidos.length === 0) {
      return { success: false as const, error: "Selecione ao menos um livro para excluir." };
    }
    if (idsRecebidos.some((id) => !Number.isSafeInteger(id) || id <= 0 || id > LIMITE_INTEIRO_BANCO)) {
      return { success: false as const, error: "A seleção contém um identificador de livro inválido." };
    }

    const ids = [...new Set(idsRecebidos as number[])];
    return await prisma.$transaction(async (tx) => {
      const livros = await tx.livro.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          titulo: true,
          autor: true,
          numeroEdicao: true,
          isbn: true,
          editora: true,
          unidade: true,
          disponiveis: true,
          status: true,
          _count: { select: { emprestimos: true } },
        },
        orderBy: { titulo: "asc" },
      });
      if (livros.length !== ids.length) {
        return {
          success: false as const,
          error: "Um ou mais livros selecionados não foram encontrados. Atualize a lista e tente novamente.",
        };
      }

      const bloqueados = livros.filter((livro) => livro._count.emprestimos > 0);
      if (bloqueados.length > 0) {
        const limiteTitulos = 3;
        const titulos = bloqueados
          .slice(0, limiteTitulos)
          .map((livro) => `"${livro.titulo}"`)
          .join(", ");
        const restantes = bloqueados.length - limiteTitulos;
        const complemento = restantes > 0 ? ` e mais ${restantes}` : "";
        return {
          success: false as const,
          error: `Não foi possível excluir o lote. Há empréstimos vinculados a ${titulos}${complemento}. Nenhum livro foi excluído.`,
        };
      }

      const resultado = await tx.livro.deleteMany({ where: { id: { in: ids } } });
      for (const livro of livros) {
        await tx.movimentacao.create({
          data: {
            tipo: TipoMovimentacao.LIVRO_EXCLUIDO,
            livroId: livro.id,
            descricao: `Livro excluído: ${livro.titulo} (${livro.unidade} unidade(s)).`,
          },
        });
      }
      const livrosExcluidos = livros.map((livro) => ({
        id: livro.id,
        titulo: livro.titulo,
        autor: livro.autor,
        numeroEdicao: livro.numeroEdicao,
        isbn: livro.isbn,
        editora: livro.editora,
        unidade: livro.unidade,
        disponiveis: livro.disponiveis,
        status: livro.status,
      }));
      return {
        success: true as const,
        quantidade: resultado.count,
        livros: livrosExcluidos,
      };
    });
  } catch (e) {
    const resultadoErro = erro(e);
    return { success: false as const, error: resultadoErro.error };
  }
};

ipcMain.handle("delete-livros", async (_event, ids: number[]) => {
  const resultado = await excluirLivrosComSeguranca(ids);
  if (!resultado.success) return resultado;
  return { success: true, quantidade: resultado.quantidade };
});

ipcMain.handle("delete-livro", async (_event, livro: { id: number } | null) => {
  const resultado = await excluirLivrosComSeguranca([livro?.id]);
  if (!resultado.success) return resultado;
  return {
    success: true,
    data: resultado.livros[0],
    quantidade: resultado.quantidade,
  };
});

ipcMain.handle("cadastrar-emprestimo", async (_event, dados: EmprestimoEntrada) => {
  try {
    const leitorPreparado = prepararLeitor(dados?.leitor);
    const itensLegados = Array.isArray(dados?.livros)
      ? dados.livros.map((livroId) => ({
          livroId,
          quantidade: 1,
          estadoLivro: String(dados.estadosLivros?.[String(livroId)] || ""),
        }))
      : [];
    const itensRecebidos = Array.isArray(dados?.itens) ? dados.itens : itensLegados;
    if (!leitorPreparado.nome || itensRecebidos.length === 0) {
      return { success: false, error: "Informe o leitor e ao menos um título." };
    }
    if (leitorPreparado.tipo === TipoLeitor.ALUNO && !leitorPreparado.serie) {
      return { success: false, error: "Informe a turma ou série do aluno." };
    }
    if (itensRecebidos.some((item) => !validarId(item?.livroId)
      || !Number.isSafeInteger(item?.quantidade)
      || item.quantidade < 1
      || item.quantidade > LIMITE_INTEIRO_BANCO
      || !String(item?.estadoLivro || "").trim())) {
      return { success: false, error: "Confira a quantidade e o estado de conservação de todos os títulos." };
    }
    const itensPorLivro = new Map<number, ItemEmprestimoEntrada>();
    for (const item of itensRecebidos) {
      if (itensPorLivro.has(item.livroId)) {
        return { success: false, error: "Cada título deve aparecer apenas uma vez no empréstimo." };
      }
      itensPorLivro.set(item.livroId, {
        livroId: item.livroId,
        quantidade: item.quantidade,
        estadoLivro: String(item.estadoLivro).trim(),
      });
    }
    const itens = [...itensPorLivro.values()];
    const dataDevolucaoPrevista = dados.dataDevolucaoPrevista
      ? converterData(dados.dataDevolucaoPrevista)
      : null;
    if (dataDevolucaoPrevista && !Number.isFinite(dataDevolucaoPrevista.getTime())) {
      return { success: false, error: "A data prevista para devolução é inválida." };
    }
    if (leitorPreparado.tipo === TipoLeitor.ALUNO && itens.some((item) => item.quantidade !== 1)) {
      return { success: false, error: "Alunos podem retirar somente uma unidade de cada título." };
    }
    if (leitorPreparado.tipo === TipoLeitor.ALUNO
      && itens.length > 1
      && !dados.confirmarMultiplosTitulos) {
      return {
        success: false,
        codigo: "CONFIRMAR_MULTIPLOS_TITULOS",
        error: "Existe mais de um título selecionado, deseja prosseguir?",
      };
    }

    const agora = new Date();
    const resultado = await prisma.$transaction(async (tx) => {
      const candidatos = dados.leitor.id
        ? []
        : await tx.aluno.findMany({
            where: { ativo: true, nome: { equals: leitorPreparado.nome }, tipo: leitorPreparado.tipo },
          });
      const leitorExistente = dados.leitor.id
        ? await tx.aluno.findUnique({ where: { id: dados.leitor.id } })
        : candidatos.find((candidato) => chaveSerie(candidato.serie) === chaveSerie(leitorPreparado.serie)) ?? null;
      if (dados.leitor.id && !leitorExistente) throw new Error("O leitor selecionado não foi encontrado.");
      if (leitorExistente && !leitorExistente.ativo) throw new Error("Este cadastro está arquivado e não pode realizar empréstimos.");
      if (leitorExistente?.banidoAte && leitorExistente.banidoAte > agora) {
        const diasRestantes = Math.max(1, Math.ceil((leitorExistente.banidoAte.getTime() - agora.getTime()) / DIA_EM_MS));
        return { aviso: { codigo: "LEITOR_BANIDO", error: `Esse aluno está banido por mais ${diasRestantes} dia(s).`, diasRestantes, alunoId: leitorExistente.id } };
      }
      if (leitorExistente && leitorPreparado.tipo === TipoLeitor.ALUNO) {
        const pendentes = await tx.emprestimo.count({
          where: { alunoId: leitorExistente.id, status: { in: [StatusEmprestimo.ATIVO, StatusEmprestimo.ATRASADO] } },
        });
        if (pendentes > 0 && !dados.confirmarEmprestimoPendente) {
          return { aviso: { codigo: "CONFIRMAR_EMPRESTIMO_PENDENTE", error: "Esse aluno já tem um empréstimo pendente, deseja prosseguir?" } };
        }
      }

      const idsLivros = itens.map((item) => item.livroId);
      const livros = await tx.livro.findMany({ where: { id: { in: idsLivros } } });
      if (livros.length !== idsLivros.length) throw new Error("Um ou mais títulos selecionados não foram encontrados.");
      for (const item of itens) {
        const livro = livros.find((registro) => registro.id === item.livroId)!;
        if (livro.disponiveis < item.quantidade) {
          throw new Error(`Estoque insuficiente para "${livro.titulo}". Disponíveis: ${Math.max(0, livro.disponiveis)}.`);
        }
      }

      let pessoa = leitorExistente;
      if (pessoa) {
        const mudou = pessoa.nome !== leitorPreparado.nome || pessoa.serie !== leitorPreparado.serie || pessoa.tipo !== leitorPreparado.tipo;
        if (mudou) {
          const anterior = pessoa;
          pessoa = await tx.aluno.update({ where: { id: pessoa.id }, data: leitorPreparado });
          await tx.movimentacao.create({ data: { tipo: TipoMovimentacao.ALUNO_ATUALIZADO, alunoId: pessoa.id, descricao: `Cadastro atualizado durante o empréstimo: ${anterior.nome}/${anterior.serie || "—"}/${anterior.tipo} → ${pessoa.nome}/${pessoa.serie || "—"}/${pessoa.tipo}.` } });
        }
      } else {
        pessoa = await tx.aluno.create({ data: leitorPreparado });
        await tx.movimentacao.create({ data: { tipo: TipoMovimentacao.ALUNO_CADASTRADO, alunoId: pessoa.id, descricao: `${pessoa.tipo === TipoLeitor.PROFESSOR ? "Professor" : "Aluno"} cadastrado durante empréstimo: ${pessoa.nome}.` } });
      }

      const configuracao = pessoa.tipo === TipoLeitor.ALUNO
        ? await tx.configuracao.upsert({ where: { id: 1 }, update: {}, create: { ...CONFIGURACAO_PADRAO } })
        : null;
      if (configuracao?.termoResponsabilidadeAtivo && !configuracao.responsavelBiblioteca.trim()) {
        throw new Error("Configure o nome do responsável pela biblioteca antes de gerar o termo.");
      }

      const grupoId = randomUUID();
      const emprestimos = [];
      for (const item of itens) {
        const livro = livros.find((registro) => registro.id === item.livroId)!;
        const reserva = await tx.livro.updateMany({
          where: { id: livro.id, disponiveis: { gte: item.quantidade } },
          data: { disponiveis: { decrement: item.quantidade } },
        });
        if (reserva.count !== 1) throw new Error(`O estoque de "${livro.titulo}" mudou. Confira a seleção e tente novamente.`);
        const restantes = livro.disponiveis - item.quantidade;
        await tx.livro.update({ where: { id: livro.id }, data: { status: restantes > 0 ? StatusLivro.LIVRE : StatusLivro.EMPRESTADO } });
        const emprestimo = await tx.emprestimo.create({
          data: {
            grupoId,
            alunoId: pessoa.id,
            livroId: livro.id,
            quantidade: item.quantidade,
            quantidadeDevolvida: 0,
            estadoLivro: item.estadoLivro,
            dataHoraEmprestimo: agora,
            dataDevolucaoPrevista,
          },
          include: { aluno: true, livro: true },
        });
        emprestimos.push(emprestimo);
        await tx.movimentacao.create({ data: { tipo: TipoMovimentacao.EMPRESTIMO_CRIADO, alunoId: pessoa.id, livroId: livro.id, descricao: `${pessoa.tipo === TipoLeitor.PROFESSOR ? "Professor" : "Aluno"} ${pessoa.nome} retirou ${item.quantidade} unidade(s) de ${livro.titulo} (${restantes} disponível(is)).` } });
      }

      const listaLivros = itens.map((item, indice) => {
        const livro = livros.find((registro) => registro.id === item.livroId)!;
        return `${indice + 1}. ${livro.titulo} — ${item.quantidade} unidade(s) — Estado: ${item.estadoLivro}`;
      }).join("\n");
      const dataDevolucao = dataDevolucaoPrevista ? dataDevolucaoPrevista.toLocaleDateString("pt-BR") : "data a combinar";
      const termo = configuracao?.termoResponsabilidadeAtivo
        ? {
            conteudo: substituirVariaveis(configuracao.modeloTermo || MODELO_TERMO_PADRAO, {
              nome_aluno: pessoa.nome,
              serie_aluno: pessoa.serie || "Não informada",
              tipo_leitor: "Aluno",
              data: agora.toLocaleDateString("pt-BR"),
              hora: agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
              responsavel_biblioteca: configuracao.responsavelBiblioteca,
              livros: listaLivros,
              estado_livros: itens.map((item) => item.estadoLivro).join(", "),
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
      return { data: { pessoa, emprestimos, termo } };
    });
    if ("aviso" in resultado) return { success: false, ...resultado.aviso };
    return { success: true, data: resultado.data };
  } catch (e) {
    return erro(e);
  }
});

async function atualizarAtrasos() {
  const hoje = inicioDoDia();
  await prisma.$transaction([
    prisma.emprestimo.updateMany({
      where: { status: StatusEmprestimo.ATIVO, dataDevolucaoPrevista: { not: null, lt: hoje } },
      data: { status: StatusEmprestimo.ATRASADO },
    }),
    prisma.emprestimo.updateMany({
      where: { status: StatusEmprestimo.ATRASADO, dataDevolucaoPrevista: { gte: hoje } },
      data: { status: StatusEmprestimo.ATIVO },
    }),
  ]);
}

ipcMain.handle("obter-emprestimo", async () => {
  try {
    await atualizarAtrasos();
    return {
      success: true,
      data: await prisma.emprestimo.findMany({
        where: { status: { not: StatusEmprestimo.DEVOLVIDO } },
        include: { aluno: true, livro: true },
        orderBy: [{ dataDevolucaoPrevista: "asc" }, { dataHoraEmprestimo: "asc" }],
      }),
    };
  } catch (e) {
    return erro(e);
  }
});

ipcMain.handle("pesquisar-emprestimos", async (_event, dados: { aluno?: string; livro?: string }) => {
  try {
    await atualizarAtrasos();
    return {
      success: true,
      data: await prisma.emprestimo.findMany({
        where: {
          status: { not: StatusEmprestimo.DEVOLVIDO },
          aluno: dados.aluno ? { nome: { contains: dados.aluno } } : undefined,
          livro: dados.livro ? { titulo: { contains: dados.livro } } : undefined,
        },
        include: { aluno: true, livro: true },
        orderBy: [{ dataDevolucaoPrevista: "asc" }, { dataHoraEmprestimo: "asc" }],
      }),
    };
  } catch (e) {
    return erro(e);
  }
});

ipcMain.handle("confirmar-devolucao", async (_event, dado: DevolucaoEntrada) => {
  try {
    if (!validarId(dado?.id)) return { success: false, error: "O empréstimo selecionado é inválido." };
    const quantidade = dado.quantidade ?? 1;
    if (!Number.isSafeInteger(quantidade) || quantidade < 1) {
      return { success: false, error: "Informe uma quantidade válida para devolver." };
    }
    if (dado.punicao) {
      if (!Number.isSafeInteger(dado.punicao.dias) || dado.punicao.dias < 1 || dado.punicao.dias > 3650) {
        return { success: false, error: "Informe uma punição entre 1 e 3650 dias." };
      }
    }
    const data = await prisma.$transaction(async (tx) => {
      const atual = await tx.emprestimo.findUnique({ where: { id: dado.id }, include: { aluno: true, livro: true } });
      if (!atual) throw new Error("Empréstimo não encontrado.");
      const restante = atual.quantidade - atual.quantidadeDevolvida;
      if (atual.status === StatusEmprestimo.DEVOLVIDO || restante <= 0) throw new Error("Este empréstimo já foi devolvido.");
      if (quantidade > restante) throw new Error(`A quantidade máxima para esta devolução é ${restante}.`);
      const novaQuantidadeDevolvida = atual.quantidadeDevolvida + quantidade;
      const devolucaoCompleta = novaQuantidadeDevolvida === atual.quantidade;
      const atrasada = Boolean(atual.dataDevolucaoPrevista && atual.dataDevolucaoPrevista < inicioDoDia());
      const emprestimo = await tx.emprestimo.update({
        where: { id: dado.id },
        data: {
          quantidadeDevolvida: novaQuantidadeDevolvida,
          status: devolucaoCompleta ? StatusEmprestimo.DEVOLVIDO : (atrasada ? StatusEmprestimo.ATRASADO : StatusEmprestimo.ATIVO),
          devolvidoEm: devolucaoCompleta ? new Date() : null,
        },
        include: { aluno: true, livro: true },
      });
      await tx.livro.update({
        where: { id: atual.livroId },
        data: {
          disponiveis: { increment: quantidade },
          status: atual.livro.disponiveis + quantidade > 0 ? StatusLivro.LIVRE : StatusLivro.EMPRESTADO,
        },
      });
      await tx.movimentacao.create({
        data: {
          tipo: devolucaoCompleta ? TipoMovimentacao.DEVOLUCAO : TipoMovimentacao.DEVOLUCAO_PARCIAL,
          alunoId: emprestimo.alunoId,
          livroId: atual.livroId,
          descricao: `${emprestimo.aluno.nome} devolveu ${quantidade} unidade(s) de ${emprestimo.livro.titulo}${devolucaoCompleta ? "." : `; restam ${emprestimo.quantidade - emprestimo.quantidadeDevolvida}.`}`,
        },
      });
      let aluno = emprestimo.aluno;
      if (atrasada && aluno.tipo === TipoLeitor.ALUNO && dado.punicao) {
        const motivo = String(dado.punicao.motivo || "Devolução realizada após o prazo").trim();
        const banidoAte = new Date(Date.now() + dado.punicao.dias * DIA_EM_MS);
        aluno = await tx.aluno.update({
          where: { id: aluno.id },
          data: { banidoAte, motivoBanimento: motivo },
        });
        await tx.movimentacao.create({
          data: {
            tipo: TipoMovimentacao.BANIMENTO_APLICADO,
            alunoId: aluno.id,
            livroId: atual.livroId,
            descricao: `Punição aplicada a ${aluno.nome} por ${dado.punicao.dias} dia(s) após devolução atrasada. Motivo: ${motivo}.`,
          },
        });
      }
      return { ...emprestimo, aluno, atrasada, devolucaoCompleta, quantidadeDevolvidaAgora: quantidade };
    });
    return { success: true, data };
  } catch (e) {
    return erro(e);
  }
});

ipcMain.handle("delete-emprestimo", async (_event, dado: { id: number }) => { try {
  const data = await prisma.$transaction(async (tx) => {
    const emprestimo = await tx.emprestimo.delete({ where: { id: dado.id }, include: { livro: true } });
    const quantidadePendente = Math.max(0, emprestimo.quantidade - emprestimo.quantidadeDevolvida);
    if (quantidadePendente > 0) {
      await tx.livro.update({ where: { id: emprestimo.livroId }, data: { disponiveis: { increment: quantidadePendente }, status: emprestimo.livro.disponiveis + quantidadePendente > 0 ? StatusLivro.LIVRE : StatusLivro.EMPRESTADO } });
    }
    await tx.movimentacao.create({ data: { tipo: TipoMovimentacao.EMPRESTIMO_EXCLUIDO, alunoId: emprestimo.alunoId, livroId: emprestimo.livroId, descricao: `Empréstimo excluído: ${emprestimo.livro.titulo}; ${quantidadePendente} unidade(s) liberada(s).` } });
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

type BackupAluno = {
  id: number;
  nome: string;
  serie: string;
  tipo: TipoLeitor;
  ativo: boolean;
  banidoAte: string | null;
  motivoBanimento: string | null;
};
type BackupLivro = {
  id: number;
  titulo: string;
  autor: string;
  numeroEdicao: number | null;
  isbn: string | null;
  editora: string | null;
  unidade: number;
  disponiveis: number;
  status: StatusLivro;
};
type BackupEmprestimo = {
  id: number;
  grupoId: string;
  alunoId: number;
  livroId: number;
  quantidade: number;
  quantidadeDevolvida: number;
  dataHoraEmprestimo: string;
  dataDevolucaoPrevista: string | null;
  devolvidoEm: string | null;
  status: StatusEmprestimo;
  estadoLivro: string;
};
type BackupConfiguracao = {
  id: number;
  termoResponsabilidadeAtivo: boolean;
  responsavelBiblioteca: string;
  modeloTermo: string;
  paresTermosPorFolha: number;
  tipoFolha: string;
  painelDebugAtivo: boolean;
  modoEscuro: boolean;
};
type BackupMovimentacao = {
  id: number;
  tipo: TipoMovimentacao;
  descricao: string;
  alunoId: number | null;
  livroId: number | null;
  criadoEm: string;
};
type DadosBackup = {
  alunos: BackupAluno[];
  livros: BackupLivro[];
  emprestimos: BackupEmprestimo[];
  configuracoes: BackupConfiguracao[];
  movimentacoes: BackupMovimentacao[];
};
type BackupTotal = {
  formato: typeof FORMATO_BACKUP;
  versaoEsquema: typeof VERSAO_BACKUP;
  versaoAplicativo: string;
  criadoEm: string;
  dados: DadosBackup;
  quantidades: { alunos: number; livros: number; emprestimos: number; movimentacoes: number };
  sha256: string;
};

const serializarDadosBackup = async (): Promise<DadosBackup> => {
  const { alunos, livros, emprestimos, configuracoes, movimentacoes } = await prisma.$transaction(async (tx) => ({
    alunos: await tx.aluno.findMany({ orderBy: { id: "asc" } }),
    livros: await tx.livro.findMany({ orderBy: { id: "asc" } }),
    emprestimos: await tx.emprestimo.findMany({ orderBy: { id: "asc" } }),
    configuracoes: await tx.configuracao.findMany({ orderBy: { id: "asc" } }),
    movimentacoes: await tx.movimentacao.findMany({ orderBy: { id: "asc" } }),
  }), { timeout: 30_000 });
  return JSON.parse(JSON.stringify({ alunos, livros, emprestimos, configuracoes, movimentacoes })) as DadosBackup;
};

const montarBackupTotal = async (): Promise<BackupTotal> => {
  const dados = await serializarDadosBackup();
  const conteudo: Omit<BackupTotal, "sha256"> = {
    formato: FORMATO_BACKUP,
    versaoEsquema: VERSAO_BACKUP,
    versaoAplicativo: app.getVersion(),
    criadoEm: new Date().toISOString(),
    dados,
    quantidades: {
      alunos: dados.alunos.length,
      livros: dados.livros.length,
      emprestimos: dados.emprestimos.length,
      movimentacoes: dados.movimentacoes.length,
    },
  };
  return {
    ...conteudo,
    sha256: createHash("sha256").update(JSON.stringify(conteudo)).digest("hex"),
  };
};

const ehRegistro = (valor: unknown): valor is Record<string, unknown> => Boolean(valor)
  && typeof valor === "object"
  && !Array.isArray(valor);
const dataValida = (valor: unknown, permitirNulo = false) => (permitirNulo && valor === null)
  || (typeof valor === "string" && Number.isFinite(new Date(valor).getTime()));
const inteiroValido = (valor: unknown, minimo = 1) => Number.isSafeInteger(valor)
  && Number(valor) >= minimo
  && Number(valor) <= LIMITE_INTEIRO_BANCO;

const validarBackupTotal = (valor: unknown): { success: true; data: BackupTotal } | { success: false; error: string } => {
  if (!ehRegistro(valor) || valor.formato !== FORMATO_BACKUP) {
    return { success: false, error: "O arquivo selecionado não é um backup total do EasyLib Manager." };
  }
  if (valor.versaoEsquema !== VERSAO_BACKUP) {
    return { success: false, error: "A versão deste backup não é compatível com esta versão do sistema." };
  }
  if (typeof valor.versaoAplicativo !== "string" || !dataValida(valor.criadoEm)) {
    return { success: false, error: "O backup não informa corretamente a versão ou a data de criação." };
  }
  if (!ehRegistro(valor.dados)) return { success: false, error: "O backup não contém a seção de dados." };
  const dados = valor.dados;
  const nomesColecoes = ["alunos", "livros", "emprestimos", "configuracoes", "movimentacoes"] as const;
  if (nomesColecoes.some((nome) => !Array.isArray(dados[nome]))) {
    return { success: false, error: "O backup está incompleto ou danificado." };
  }

  const idsUnicos = (itens: unknown[]) => {
    const ids = itens.map((item) => ehRegistro(item) ? item.id : null);
    return ids.every((id) => inteiroValido(id)) && new Set(ids).size === ids.length;
  };
  if (!idsUnicos(dados.alunos as unknown[]) || !idsUnicos(dados.livros as unknown[])
    || !idsUnicos(dados.emprestimos as unknown[]) || !idsUnicos(dados.movimentacoes as unknown[])) {
    return { success: false, error: "O backup contém identificadores inválidos ou repetidos." };
  }

  const tiposLeitor = new Set(Object.values(TipoLeitor));
  const statusLivros = new Set(Object.values(StatusLivro));
  const statusEmprestimos = new Set(Object.values(StatusEmprestimo));
  const tiposMovimentacao = new Set(Object.values(TipoMovimentacao));
  const alunos = dados.alunos as unknown[];
  const livros = dados.livros as unknown[];
  const emprestimos = dados.emprestimos as unknown[];
  const configuracoes = dados.configuracoes as unknown[];
  const movimentacoes = dados.movimentacoes as unknown[];
  if (alunos.some((item) => !ehRegistro(item)
    || typeof item.nome !== "string"
    || typeof item.serie !== "string"
    || !tiposLeitor.has(item.tipo as TipoLeitor)
    || typeof item.ativo !== "boolean"
    || !dataValida(item.banidoAte, true)
    || !(item.motivoBanimento === null || typeof item.motivoBanimento === "string"))) {
    return { success: false, error: "O backup contém um cadastro de leitor inválido." };
  }
  if (livros.some((item) => !ehRegistro(item)
    || typeof item.titulo !== "string"
    || typeof item.autor !== "string"
    || !(item.numeroEdicao === null || inteiroValido(item.numeroEdicao))
    || !(item.isbn === null || typeof item.isbn === "string")
    || !(item.editora === null || typeof item.editora === "string")
    || !inteiroValido(item.unidade, 0)
    || !inteiroValido(item.disponiveis, 0)
    || Number(item.disponiveis) > Number(item.unidade)
    || !statusLivros.has(item.status as StatusLivro))) {
    return { success: false, error: "O backup contém um registro de livro inválido." };
  }
  const idsAlunos = new Set(alunos.map((item) => (item as Record<string, unknown>).id));
  const idsLivros = new Set(livros.map((item) => (item as Record<string, unknown>).id));
  if (emprestimos.some((item) => !ehRegistro(item)
    || !idsAlunos.has(item.alunoId)
    || !idsLivros.has(item.livroId)
    || typeof item.grupoId !== "string"
    || !item.grupoId
    || !inteiroValido(item.quantidade)
    || !inteiroValido(item.quantidadeDevolvida, 0)
    || Number(item.quantidadeDevolvida) > Number(item.quantidade)
    || !dataValida(item.dataHoraEmprestimo)
    || !dataValida(item.dataDevolucaoPrevista, true)
    || !dataValida(item.devolvidoEm, true)
    || !statusEmprestimos.has(item.status as StatusEmprestimo)
    || (Number(item.quantidadeDevolvida) === Number(item.quantidade)) !== (item.status === StatusEmprestimo.DEVOLVIDO)
    || typeof item.estadoLivro !== "string")) {
    return { success: false, error: "O backup contém um empréstimo inválido ou uma referência ausente." };
  }
  const saldosPorLivro = new Map<number, number>();
  for (const item of emprestimos as BackupEmprestimo[]) {
    saldosPorLivro.set(
      item.livroId,
      (saldosPorLivro.get(item.livroId) || 0) + item.quantidade - item.quantidadeDevolvida,
    );
  }
  if ((livros as BackupLivro[]).some((livro) => {
    const disponiveisEsperados = livro.unidade - (saldosPorLivro.get(livro.id) || 0);
    return disponiveisEsperados < 0
      || livro.disponiveis !== disponiveisEsperados
      || livro.status !== (livro.disponiveis > 0 ? StatusLivro.LIVRE : StatusLivro.EMPRESTADO);
  })) {
    return { success: false, error: "O estoque do backup não corresponde aos empréstimos pendentes." };
  }
  if (configuracoes.length !== 1 || configuracoes.some((item) => !ehRegistro(item)
    || item.id !== 1
    || typeof item.termoResponsabilidadeAtivo !== "boolean"
    || typeof item.responsavelBiblioteca !== "string"
    || typeof item.modeloTermo !== "string"
    || !inteiroValido(item.paresTermosPorFolha)
    || Number(item.paresTermosPorFolha) > 4
    || !["A4", "CARTA", "OFICIO"].includes(String(item.tipoFolha))
    || typeof item.painelDebugAtivo !== "boolean"
    || typeof item.modoEscuro !== "boolean")) {
    return { success: false, error: "A configuração contida no backup é inválida." };
  }
  if (movimentacoes.some((item) => !ehRegistro(item)
    || !tiposMovimentacao.has(item.tipo as TipoMovimentacao)
    || typeof item.descricao !== "string"
    || !(item.alunoId === null || inteiroValido(item.alunoId))
    || !(item.livroId === null || inteiroValido(item.livroId))
    || !dataValida(item.criadoEm))) {
    return { success: false, error: "O backup contém uma movimentação inválida." };
  }
  if (!ehRegistro(valor.quantidades)
    || valor.quantidades.alunos !== alunos.length
    || valor.quantidades.livros !== livros.length
    || valor.quantidades.emprestimos !== emprestimos.length
    || valor.quantidades.movimentacoes !== movimentacoes.length) {
    return { success: false, error: "O resumo de quantidades do backup não corresponde ao conteúdo." };
  }
  if (typeof valor.sha256 !== "string") return { success: false, error: "O backup não possui assinatura de integridade." };
  const { sha256, ...conteudo } = valor;
  const hashCalculado = createHash("sha256").update(JSON.stringify(conteudo)).digest("hex");
  if (sha256 !== hashCalculado) return { success: false, error: "A verificação de integridade do backup falhou." };
  return { success: true, data: valor as BackupTotal };
};

const backupsPendentes = new Map<string, BackupTotal>();

ipcMain.handle("exportar-backup-total", async () => {
  try {
    const nome = `backup-easylib-${new Date().toISOString().slice(0, 10)}.easylib.json`;
    const opcoes = {
      title: "Exportar backup total do EasyLib",
      defaultPath: path.join(app.getPath("documents"), nome),
      filters: [{ name: "Backup EasyLib", extensions: ["json"] }],
    };
    const escolha = mainWindow && !mainWindow.isDestroyed()
      ? await dialog.showSaveDialog(mainWindow, opcoes)
      : await dialog.showSaveDialog(opcoes);
    if (escolha.canceled || !escolha.filePath) return { success: true, cancelado: true };
    const backupMontado = await montarBackupTotal();
    const validacaoBackup = validarBackupTotal(backupMontado);
    if (!validacaoBackup.success) throw new Error(`O banco atual não pôde ser convertido em um backup restaurável: ${validacaoBackup.error}`);
    const backup = validacaoBackup.data;
    await writeFile(escolha.filePath, JSON.stringify(backup, null, 2), "utf8");
    await prisma.movimentacao.create({
      data: { tipo: TipoMovimentacao.BACKUP_EXPORTADO, descricao: `Backup total exportado (${backup.quantidades.alunos} leitores, ${backup.quantidades.livros} livros e ${backup.quantidades.emprestimos} empréstimos).` },
    });
    return { success: true, caminho: escolha.filePath };
  } catch (e) {
    return erro(e);
  }
});

ipcMain.handle("selecionar-backup-total", async () => {
  try {
    const opcoes = {
      title: "Selecionar backup total do EasyLib",
      properties: ["openFile"] as Array<"openFile">,
      filters: [{ name: "Backup EasyLib", extensions: ["json"] }],
    };
    const escolha = mainWindow && !mainWindow.isDestroyed()
      ? await dialog.showOpenDialog(mainWindow, opcoes)
      : await dialog.showOpenDialog(opcoes);
    if (escolha.canceled || !escolha.filePaths[0]) return { success: true, cancelado: true };
    const caminho = escolha.filePaths[0];
    const informacoes = await stat(caminho);
    if (informacoes.size > 100 * 1024 * 1024) return { success: false, error: "O arquivo excede o limite de 100 MB." };
    const conteudo = await readFile(caminho, "utf8");
    const validacao = validarBackupTotal(JSON.parse(conteudo) as unknown);
    if (!validacao.success) return validacao;
    const token = randomUUID();
    backupsPendentes.clear();
    backupsPendentes.set(token, validacao.data);
    const temporizador = setTimeout(() => backupsPendentes.delete(token), 15 * 60 * 1000);
    temporizador.unref();
    return {
      success: true,
      data: {
        token,
        criadoEm: validacao.data.criadoEm,
        versaoAplicativo: validacao.data.versaoAplicativo,
        quantidades: validacao.data.quantidades,
      },
    };
  } catch (e) {
    return erro(e instanceof SyntaxError ? new Error("O arquivo selecionado não contém um JSON válido.") : e);
  }
});

ipcMain.handle("confirmar-importacao-total", async (_event, token: string) => {
  try {
    const backup = backupsPendentes.get(String(token || ""));
    if (!backup) return { success: false, error: "A seleção do backup expirou. Selecione o arquivo novamente." };
    backupsPendentes.delete(token);

    const recuperacaoMontada = await montarBackupTotal();
    const validacaoRecuperacao = validarBackupTotal(recuperacaoMontada);
    if (!validacaoRecuperacao.success) {
      throw new Error(`A importação foi cancelada porque a cópia de recuperação não seria restaurável: ${validacaoRecuperacao.error}`);
    }
    const recuperacao = validacaoRecuperacao.data;
    const instante = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
    const caminhoRecuperacao = path.join(app.getPath("userData"), `backup-recuperacao-${instante}.easylib.json`);
    await writeFile(caminhoRecuperacao, JSON.stringify(recuperacao, null, 2), "utf8");

    const dados = backup.dados;
    await prisma.$transaction(async (tx) => {
      await tx.movimentacao.deleteMany();
      await tx.emprestimo.deleteMany();
      await tx.aluno.deleteMany();
      await tx.livro.deleteMany();
      await tx.configuracao.deleteMany();

      for (let inicio = 0; inicio < dados.alunos.length; inicio += 500) {
        await tx.aluno.createMany({
          data: dados.alunos.slice(inicio, inicio + 500).map((aluno) => ({
            ...aluno,
            banidoAte: aluno.banidoAte ? new Date(aluno.banidoAte) : null,
          })),
        });
      }
      for (let inicio = 0; inicio < dados.livros.length; inicio += 500) {
        await tx.livro.createMany({ data: dados.livros.slice(inicio, inicio + 500) });
      }
      if (dados.configuracoes.length) await tx.configuracao.createMany({ data: dados.configuracoes });
      for (let inicio = 0; inicio < dados.emprestimos.length; inicio += 500) {
        await tx.emprestimo.createMany({
          data: dados.emprestimos.slice(inicio, inicio + 500).map((emprestimo) => ({
            ...emprestimo,
            dataHoraEmprestimo: new Date(emprestimo.dataHoraEmprestimo),
            dataDevolucaoPrevista: emprestimo.dataDevolucaoPrevista ? new Date(emprestimo.dataDevolucaoPrevista) : null,
            devolvidoEm: emprestimo.devolvidoEm ? new Date(emprestimo.devolvidoEm) : null,
          })),
        });
      }
      for (let inicio = 0; inicio < dados.movimentacoes.length; inicio += 500) {
        await tx.movimentacao.createMany({
          data: dados.movimentacoes.slice(inicio, inicio + 500).map((movimento) => ({ ...movimento, criadoEm: new Date(movimento.criadoEm) })),
        });
      }
      await tx.movimentacao.create({
        data: {
          tipo: TipoMovimentacao.BACKUP_IMPORTADO,
          descricao: `Backup total de ${new Date(backup.criadoEm).toLocaleString("pt-BR")} importado. Cópia de recuperação: ${path.basename(caminhoRecuperacao)}.`,
        },
      });
    }, { maxWait: 10_000, timeout: 120_000 });
    return { success: true, caminhoRecuperacao };
  } catch (e) {
    return erro(e);
  }
});
