import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Discover from "./pages/Discover";
import Installed from "./pages/Installed";
import SkillDetail from "./pages/SkillDetail";
import SyncDashboard from "./pages/SyncDashboard";
import Security from "./pages/Security";
import Settings from "./pages/Settings";

function App() {
    return (
        <Router>
            <Layout>
                <Routes>
                    <Route path="/" element={<Installed />} />
                    <Route path="/discover" element={<Discover />} />
                    <Route path="/skill/:id" element={<SkillDetail />} />
                    <Route path="/sync" element={<SyncDashboard />} />
                    <Route path="/security" element={<Security />} />
                    <Route path="/settings" element={<Settings />} />
                </Routes>
            </Layout>
        </Router>
    );
}

export default App;
