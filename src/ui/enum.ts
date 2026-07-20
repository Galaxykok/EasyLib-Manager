export const StatusEmprestimo = {
    ATIVO: "ATIVO",
    DEVOLVIDO: "DEVOLVIDO",
    ATRASADO: "ATRASADO",
} as const;

export type StatusEmprestimo =
    typeof StatusEmprestimo[keyof typeof StatusEmprestimo];