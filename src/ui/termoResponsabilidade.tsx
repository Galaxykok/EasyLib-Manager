import type { CSSProperties } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const folhas = {
    A4: { rotulo: "A4", largura: 210, altura: 297 },
    CARTA: { rotulo: "Carta", largura: 216, altura: 279 },
    OFICIO: { rotulo: "Ofício", largura: 216, altura: 356 },
} as const;

export default function TermoResponsabilidade() {
    const location = useLocation();
    const navigate = useNavigate();
    const termo = (location.state as { termo?: TermoGerado } | null)?.termo;

    if (!termo) {
        return (
            <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
                <h1 className="text-2xl font-semibold">Nenhum termo disponível para impressão.</h1>
                <Link to="/emprestimos" className="text-cyan-700 hover:underline">Voltar aos empréstimos</Link>
            </main>
        );
    }

    const tipoFolha = termo.tipoFolha || "A4";
    const folha = folhas[tipoFolha];
    const paresPorFolha = Math.min(4, Math.max(1, termo.paresTermosPorFolha || 2));
    const alturaPar = folha.altura / paresPorFolha;
    const tamanhoFonte = paresPorFolha >= 4 ? 6 : paresPorFolha === 3 ? 7 : paresPorFolha === 2 ? 8 : 10;
    const estiloFolha = {
        "--largura-folha": `${folha.largura}mm`,
        "--altura-folha": `${folha.altura}mm`,
        "--altura-par": `${alturaPar}mm`,
        "--fonte-termo": `${tamanhoFonte}pt`,
    } as CSSProperties;

    return (
        <main className="bg-slate-100 min-h-screen py-6 print:bg-white print:py-0">
            <style>{`@page { size: ${folha.largura}mm ${folha.altura}mm; margin: 0; }`}</style>
            <div className="nao-imprimir sticky top-0 z-10 max-w-4xl mx-auto mb-5 flex justify-between gap-3 bg-white border rounded-lg p-4 shadow">
                <button type="button" onClick={() => navigate("/emprestimos")} className="px-4 py-2 rounded bg-slate-200 hover:bg-slate-300 cursor-pointer">Voltar</button>
                <div className="text-center">
                    <strong className="block">Par de termos no rodapé</strong>
                    <span className="text-sm text-gray-500">
                        Folha {folha.rotulo} · capacidade de {paresPorFolha} par(es) por folha
                    </span>
                </div>
                <button type="button" onClick={() => window.print()} className="px-5 py-2 rounded bg-green-700 hover:bg-green-800 text-white cursor-pointer">Imprimir 2 vias</button>
            </div>

            <div className="folha-termos bg-white mx-auto shadow print:shadow-none" style={estiloFolha}>
                <div className="par-termos">
                    {["1ª via — Biblioteca", "2ª via — Aluno"].map((via) => (
                        <article key={via} className="termo-via-compacto">
                            <div className="rotulo-via">{via}</div>
                            <div className="conteudo-termo-compacto">{termo.conteudo}</div>
                        </article>
                    ))}
                </div>
            </div>
        </main>
    );
}
