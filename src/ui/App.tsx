

import { Routes, Route } from "react-router-dom";
import Home from "./home.tsx";
import Acervo from "./acervo.tsx";
import Emprestimos from "./emprestimos.tsx";
import Alunos from "./alunos.tsx";

export default function App() {

  return (
     <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/acervo" element={<Acervo />} />
      <Route path="/emprestimos" element={<Emprestimos />} />
      <Route path="/aluno" element={<Alunos />} />
    </Routes>
  );
}