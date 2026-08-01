const montarSerie = (numero: string, tipo?: string, nivel?: string, turma?: string) => {
    const ordinal = tipo?.toLocaleLowerCase("pt-BR").startsWith("s") ? "ª série" : "º ano";
    const etapa = nivel
        ? ` ${nivel.toLocaleLowerCase("pt-BR").replace(/^medio$/i, "médio")}`
        : "";
    const sala = turma ? ` ${turma.toLocaleUpperCase("pt-BR")}` : "";
    return `${Number(numero)}${ordinal}${etapa}${sala}`;
};

export const normalizarSerie = (valor?: string | null) => {
    const texto = String(valor || "")
        .normalize("NFKC")
        .trim()
        .replace(/[‐‑‒–—]/g, "-")
        .replace(/\s+/g, " ");
    if (!texto) return "";

    const comTurma = texto.match(/^(\d{1,2})\s*(?:[º°ªoa]\s*)?(?:(ano|s[ée]rie)\s*)?(?:(?:do\s+)?(?:ensino\s+)?(fundamental|m[eé]dio)\s*)?(?:[-/]\s*)?([a-z])$/iu);
    if (comTurma) return montarSerie(comTurma[1], comTurma[2], comTurma[3], comTurma[4]);

    const semTurma = texto.match(/^(\d{1,2})\s*(?:[º°ªoa]\s*)?(ano|s[ée]rie)(?:\s+(?:do\s+)?(?:ensino\s+)?(fundamental|m[eé]dio))?$/iu);
    if (semTurma) return montarSerie(semTurma[1], semTurma[2], semTurma[3]);

    return texto
        .replace(/^eja\b/i, "EJA")
        .replace(/(\s+|\s*[-/]\s*)([a-z])$/iu, (_trecho, separador: string, turma: string) =>
            `${separador.trim() ? " " : separador}${turma.toLocaleUpperCase("pt-BR")}`,
        );
};

export const chaveSerie = (valor?: string | null) =>
    normalizarSerie(valor).toLocaleUpperCase("pt-BR");
