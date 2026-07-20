-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_livros" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titulo" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "numeroEdicao" INTEGER,
    "isbn" TEXT,
    "editora" TEXT,
    "unidade" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'LIVRE'
);
INSERT INTO "new_livros" ("autor", "editora", "id", "isbn", "numeroEdicao", "titulo", "unidade") SELECT "autor", "editora", "id", "isbn", "numeroEdicao", "titulo", "unidade" FROM "livros";
DROP TABLE "livros";
ALTER TABLE "new_livros" RENAME TO "livros";
CREATE UNIQUE INDEX "livros_id_key" ON "livros"("id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
