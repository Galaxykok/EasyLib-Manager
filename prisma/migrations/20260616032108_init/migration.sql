-- CreateTable
CREATE TABLE "alunos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "serie" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "livros" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titulo" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "numeroEdicao" INTEGER,
    "isbn" TEXT,
    "editora" TEXT,
    "unidade" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "emprestimos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_aluno" INTEGER NOT NULL,
    "id_livro" INTEGER NOT NULL,
    "dataHoraEmprestimo" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataDevolucaoPrevista" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    CONSTRAINT "emprestimos_id_aluno_fkey" FOREIGN KEY ("id_aluno") REFERENCES "alunos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "emprestimos_id_livro_fkey" FOREIGN KEY ("id_livro") REFERENCES "livros" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "livros_isbn_key" ON "livros"("isbn");
