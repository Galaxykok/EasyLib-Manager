import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const variaveis = [
    ["{{nome_aluno}}", "Nome do aluno"],
    ["{{serie_aluno}}", "Série / turma"],
    ["{{tipo_leitor}}", "Tipo de leitor"],
    ["{{data}}", "Data"],
    ["{{hora}}", "Hora"],
    ["{{data_devolucao}}", "Data de devolução"],
    ["{{responsavel_biblioteca}}", "Responsável"],
    ["{{livros}}", "Livros e estados"],
    ["{{estado_livros}}", "Estados dos livros"],
] as const;

export default function Configuracoes() {
    const [configuracao, setConfiguracao] = useState<Configuracao>({
        termoResponsabilidadeAtivo: true,
        responsavelBiblioteca: "",
        modeloTermo: "",
        paresTermosPorFolha: 2,
        tipoFolha: "A4",
    });
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [mensagem, setMensagem] = useState("");
    const editorRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        window.electronAPI.obterConfiguracao().then((resposta) => {
            if (resposta.success && resposta.data) setConfiguracao(resposta.data);
            else alert(resposta.error || "Não foi possível carregar as configurações.");
            setCarregando(false);
        });
    }, []);

    const inserirVariavel = (variavel: string) => {
        const editor = editorRef.current;
        const inicio = editor?.selectionStart ?? configuracao.modeloTermo.length;
        const fim = editor?.selectionEnd ?? inicio;
        setConfiguracao((atual) => ({
            ...atual,
            modeloTermo:
                atual.modeloTermo.slice(0, inicio) +
                variavel +
                atual.modeloTermo.slice(fim),
        }));
        window.setTimeout(() => {
            editor?.focus();
            editor?.setSelectionRange(inicio + variavel.length, inicio + variavel.length);
        });
    };

    const salvar = async () => {
        if (
            configuracao.termoResponsabilidadeAtivo &&
            !configuracao.responsavelBiblioteca.trim()
        ) {
            alert("Informe o nome do responsável pela biblioteca.");
            return;
        }
        setSalvando(true);
        const resposta = await window.electronAPI.salvarConfiguracao(configuracao);
        setSalvando(false);
        if (!resposta.success) {
            alert(resposta.error || "Não foi possível salvar as configurações.");
            return;
        }
        if (resposta.data) setConfiguracao(resposta.data);
        setMensagem("Configurações salvas.");
        window.setTimeout(() => setMensagem(""), 3000);
    };

    return (
        <div className="flex min-h-screen bg-white font-sans">
            <aside className="w-64 p-6 border-r-8 border-gray-300">
                <nav className="flex flex-col gap-5 text-xl text-gray-800">
                    <Link to="/">Home</Link>
                    <Link to="/acervo">Acervo</Link>
                    <Link to="/emprestimos">Empréstimos</Link>
                    <Link to="/aluno">Alunos</Link>
                    <Link to="/exportacao">Exportação de dados</Link>
                    <Link to="/debug">Debug</Link>
                    <Link className="font-semibold text-cyan-600" to="/configuracoes">Configurações</Link>
                </nav>
            </aside>

            <main className="flex-1 p-8 max-w-5xl overflow-y-auto">
                <h1 className="text-4xl font-semibold mb-2">Configurações</h1>
                <p className="text-gray-600 mb-7">Configure a geração do termo de responsabilidade.</p>

                {carregando ? (
                    <p>Carregando...</p>
                ) : (
                    <div className="space-y-6">
                        <section className="border rounded-lg p-5 bg-slate-50">
                            <label className="flex items-center justify-between gap-4 cursor-pointer">
                                <span>
                                    <strong className="block text-lg">Gerar termo de responsabilidade</strong>
                                    <span className="text-sm text-gray-600">Ao registrar um empréstimo, o sistema oferecerá a impressão em duas vias.</span>
                                </span>
                                <input
                                    type="checkbox"
                                    className="w-5 h-5"
                                    checked={configuracao.termoResponsabilidadeAtivo}
                                    onChange={(evento) => setConfiguracao((atual) => ({ ...atual, termoResponsabilidadeAtivo: evento.target.checked }))}
                                />
                            </label>
                        </section>

                        <section className="border rounded-lg p-5">
                            <label className="font-semibold text-lg">
                                Nome do responsável pela biblioteca
                                <input
                                    type="text"
                                    value={configuracao.responsavelBiblioteca}
                                    onChange={(evento) => setConfiguracao((atual) => ({ ...atual, responsavelBiblioteca: evento.target.value }))}
                                    placeholder="Nome completo"
                                    className="block w-full border rounded p-3 mt-2 font-normal"
                                />
                            </label>
                        </section>

                        <section className="border rounded-lg p-5">
                            <h2 className="font-semibold text-lg mb-4">Layout de impressão</h2>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <label className="font-medium">
                                    Pares de termos por folha
                                    <select
                                        value={configuracao.paresTermosPorFolha}
                                        onChange={(evento) => setConfiguracao((atual) => ({ ...atual, paresTermosPorFolha: Number(evento.target.value) }))}
                                        className="block w-full border rounded p-3 mt-2 bg-white font-normal"
                                    >
                                        <option value={1}>1 par — 2 termos por folha</option>
                                        <option value={2}>2 pares — 4 termos por folha</option>
                                        <option value={3}>3 pares — 6 termos por folha</option>
                                        <option value={4}>4 pares — 8 termos por folha</option>
                                    </select>
                                </label>
                                <label className="font-medium">
                                    Tipo de folha
                                    <select
                                        value={configuracao.tipoFolha}
                                        onChange={(evento) => setConfiguracao((atual) => ({ ...atual, tipoFolha: evento.target.value as Configuracao["tipoFolha"] }))}
                                        className="block w-full border rounded p-3 mt-2 bg-white font-normal"
                                    >
                                        <option value="A4">A4 — 210 × 297 mm</option>
                                        <option value="CARTA">Carta — 216 × 279 mm</option>
                                        <option value="OFICIO">Ofício — 216 × 356 mm</option>
                                    </select>
                                </label>
                            </div>
                            <p className="text-sm text-gray-600 mt-3">
                                O par atual será sempre posicionado no rodapé, permitindo reutilizar a parte inferior de uma folha já usada ou cortada.
                            </p>
                        </section>

                        <section className="border rounded-lg p-5">
                            <h2 className="font-semibold text-lg">Modelo do termo</h2>
                            <p className="text-sm text-gray-600 mt-1 mb-3">Clique em uma variável para inseri-la na posição atual do cursor.</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {variaveis.map(([variavel, rotulo]) => (
                                    <button
                                        type="button"
                                        key={variavel}
                                        onClick={() => inserirVariavel(variavel)}
                                        title={variavel}
                                        className="px-3 py-1.5 rounded bg-cyan-100 text-cyan-900 hover:bg-cyan-200 cursor-pointer text-sm"
                                    >
                                        {rotulo}
                                    </button>
                                ))}
                            </div>
                            <textarea
                                ref={editorRef}
                                rows={18}
                                value={configuracao.modeloTermo}
                                onChange={(evento) => setConfiguracao((atual) => ({ ...atual, modeloTermo: evento.target.value }))}
                                className="w-full border rounded p-4 font-mono text-sm leading-relaxed"
                            />
                        </section>

                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={salvar}
                                disabled={salvando}
                                className="bg-green-700 hover:bg-green-800 text-white rounded px-6 py-3 disabled:opacity-50 cursor-pointer"
                            >
                                {salvando ? "Salvando..." : "Salvar configurações"}
                            </button>
                            {mensagem && <span className="text-green-700" role="status">{mensagem}</span>}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
