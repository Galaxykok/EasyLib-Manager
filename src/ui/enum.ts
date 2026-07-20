export const StatusEmprestimo = {
    ATIVO: "ATIVO",
    DEVOLVIDO: "DEVOLVIDO",
    ATRASADO: "ATRASADO",
} as const;

export const StatusLivro = {
    LIVRE: "LIVRE",
    EMPRESTADO: "EMPRESTADO"
} as const

export type StatusEmprestimo =
    typeof StatusEmprestimo[keyof typeof StatusEmprestimo];

export type StatusLivro =
    typeof StatusLivro[keyof typeof StatusLivro];