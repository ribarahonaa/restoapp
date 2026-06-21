import { Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage.js";
import { BranchDetailPage } from "./pages/BranchDetailPage.js";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/branch/:id" element={<BranchDetailPage />} />
    </Routes>
  );
}
