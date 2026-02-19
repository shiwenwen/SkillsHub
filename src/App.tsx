import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import { UpdateCheckProvider } from "./contexts/UpdateCheckContext";

// Lazy-loaded page components for code splitting
const Installed = lazy(() => import("./pages/Installed"));
const Discover = lazy(() => import("./pages/Discover"));
const SkillDetail = lazy(() => import("./pages/SkillDetail"));
const SyncDashboard = lazy(() => import("./pages/SyncDashboard"));
const Security = lazy(() => import("./pages/Security"));
const Settings = lazy(() => import("./pages/Settings"));

function App() {
    return (
        <Router>
            <UpdateCheckProvider>
                <Layout>
                    <Suspense
                        fallback={
                            <div className="flex items-center justify-center h-64">
                                <span className="loading loading-spinner loading-lg" />
                            </div>
                        }
                    >
                        <Routes>
                            <Route path="/" element={<Installed />} />
                            <Route path="/discover" element={<Discover />} />
                            <Route path="/skill/:id" element={<SkillDetail />} />
                            <Route path="/sync" element={<SyncDashboard />} />
                            <Route path="/security" element={<Security />} />
                            <Route path="/settings" element={<Settings />} />
                        </Routes>
                    </Suspense>
                </Layout>
            </UpdateCheckProvider>
        </Router>
    );
}

export default App;
