import "./App.css";

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SessionList from "@client/pages/SessionList";
import SessionDetail from "@client/pages/SessionDetail";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SessionList />} />
        <Route path="/session/:sessionId" element={<SessionDetail />} />
      </Routes>
    </Router>
  );
}

export default App;
