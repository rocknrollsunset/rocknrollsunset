import { Routes, Route, Link } from "react-router-dom";
import Timeline from "./pages/Timeline";
import TripDetail from "./pages/TripDetail";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white px-6 py-4">
        <Link to="/" className="text-xl font-semibold">
          Travel Memory Timeline
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Timeline />} />
          <Route path="/trips/:id" element={<TripDetail />} />
        </Routes>
      </main>
    </div>
  );
}
