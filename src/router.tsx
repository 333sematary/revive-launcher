import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import App from "./App";
import Login from "./login";
import Onboard from "./onboard";
import Settings from "./settings";
import Register from "./register";
import WindowLayout from "./WindowLayout";

function Main() {
  return (
    <Router>
      <WindowLayout>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/onboard" element={<Onboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      </WindowLayout>
    </Router>
  );
}

export default Main;
