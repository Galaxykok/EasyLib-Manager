import Sidebar from "./sidebar.tsx";
import fotoEquipe from "./assets/equipe-easylib.jpg";

function IconeCoracao() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
            <path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z" />
        </svg>
    );
}

export default function Sobre() {
    return (
        <div className="app-shell flex min-h-screen text-slate-900">
            <Sidebar />
            <main className="app-main min-w-0 flex-1 overflow-y-auto p-8 xl:p-10">
                <div className="mx-auto max-w-6xl space-y-6">
                    <header className="app-page-header px-7 py-6">
                        <p className="app-eyebrow mb-1 text-xs font-semibold tracking-[0.18em] text-cyan-700">O PROJETO</p>
                        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Sobre o EasyLib Manager</h1>
                        <p className="mt-2 max-w-3xl text-slate-600">
                            Uma solução criada em equipe para tornar a rotina da biblioteca mais simples, organizada e próxima da realidade da escola.
                        </p>
                    </header>

                    <section aria-label="Recado da equipe do projeto" className="app-panel grid gap-7 rounded-2xl p-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,25rem)] xl:p-8">
                        <article className="flex flex-col justify-center">
                            <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-800">
                                <IconeCoracao />
                            </span>
                            <p className="app-eyebrow mb-2 text-xs font-semibold tracking-[0.16em] text-cyan-700">NOSSA HISTÓRIA</p>

                            <div className="mt-3 space-y-4 text-base leading-relaxed text-slate-600">
                                <p className="text-lg font-medium leading-relaxed text-slate-800">
                                    Se você está vendo isso, parabéns! A escola em que você trabalha ou estuda decidiu usar o EasyLib Manager como sistema principal de sua sala de leitura ou biblioteca.
                                </p>
                                <p>
                                    Não sabemos o quanto isso te comove, mas, para nós, que criamos e desenvolvemos este sistema, é muito bom ver uma ideia virar realidade e ser realmente usada em algum lugar, para alguma coisa.
                                </p>
                                <p>
                                    O EasyLib Manager nasceu como nosso projeto integrador para a faculdade, e logo surgiu o desejo de produzir um software que realmente pudesse ser útil e usado todos os dias por alguém. Foi pensando nisso que surgiu a ideia de um sistema para bibliotecas: imaginamos a dificuldade de uma pessoa tentando gerir uma sala de leitura ou biblioteca com papel e caneta — ou, pior ainda, sendo obrigada a aprender a usar um sistema complexo e confuso.
                                </p>
                                <p>
                                    Um dia, algum tempo depois de a professora Jane se despedir do Monsa, esperamos ter notícias a respeito do paradeiro deste sistema dentro da escola. Esperamos que ele ainda esteja em pleno funcionamento e uso; isso significaria muito para a gente.
                                </p>
                            </div>

                            <aside className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
                                <p className="font-medium leading-relaxed">
                                    Queremos mandar um sincero beijo e agradecimento para a professora Jane, atual professora da sala de leitura, e para a Escola Estadual Monsenhor Luis Gonzaga de Moura, por ser a primeira escola a adotar o EasyLib Manager.
                                </p>
                                <p className="mt-3 text-lg font-bold">Beijo, Jane!</p>
                            </aside>

                            <div className="mt-7 border-t border-cyan-100 pt-5">
                                <p className="text-sm font-medium text-slate-500">Atenciosamente,</p>
                                <p className="mt-1 text-lg font-semibold text-slate-900">Equipe do Projeto Integrador EasyLib Manager</p>
                                <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600">
                                    O desenvolvimento do EasyLib Manager como sistema foi realizado por Lucas e Felipe, responsáveis pelo planejamento técnico, pela programação e pela implementação do software. Miguel e Jorge participaram ativamente de outras frentes do Projeto Integrador acadêmico, sem atuação no desenvolvimento do sistema.
                                </p>
                                <ul aria-label="Integrantes da equipe" className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                                    <li className="rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-3 text-cyan-950">
                                        <strong className="block">Lucas Daniel Tura</strong>
                                        <span className="block text-xs font-semibold text-cyan-800">Desenvolvedor</span>
                                        <span className="text-xs text-cyan-700">Ex-aluno formado no Monsa</span>
                                    </li>
                                    <li className="rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-3 text-cyan-950">
                                        <strong className="block">Felipe Horacio Mateu</strong>
                                        <span className="block text-xs font-semibold text-cyan-800">Desenvolvedor</span>
                                        <span className="text-xs text-cyan-700">Ex-aluno do Monsa</span>
                                    </li>
                                    <li className="rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-3 text-cyan-950">
                                        <strong className="block">Miguel Rybaltowski Marion</strong>
                                        <span className="text-xs text-cyan-800">Participação ativa no Projeto Integrador</span>
                                    </li>
                                    <li className="rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-3 text-cyan-950">
                                        <strong className="block">Jorge José Martins Neto</strong>
                                        <span className="text-xs text-cyan-800">Participação ativa no Projeto Integrador</span>
                                    </li>
                                </ul>
                                <time dateTime="2026-08-11" className="mt-5 block text-right text-sm font-medium italic text-slate-600">
                                    11/08/2026
                                </time>
                            </div>
                        </article>

                        <figure className="rounded-2xl border border-slate-200 bg-slate-100 p-3 shadow-sm">
                            <div className="flex min-h-80 items-center justify-center overflow-hidden rounded-xl bg-white">
                                <img
                                    src={fotoEquipe}
                                    width="3000"
                                    height="4000"
                                    alt="Equipe do EasyLib Manager: Miguel, Jorge, Lucas e Felipe, da esquerda para a direita."
                                    className="max-h-[38rem] w-full object-contain"
                                />
                            </div>
                            <figcaption className="px-2 pb-1 pt-3 text-center text-sm font-medium text-slate-600">
                                Miguel, Jorge, Lucas e Felipe — a equipe por trás do EasyLib Manager.
                            </figcaption>
                        </figure>
                    </section>

                </div>
            </main>
        </div>
    );
}
