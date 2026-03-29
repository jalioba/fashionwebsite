
import { useState, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import HomePage      from "./pages/HomePage";
import DemoPage      from "./pages/DemoPage";
import DashboardPage from "./pages/DashboardPage";
import AppPage       from "./pages/AppPage";
import LoginPage     from "./pages/LoginPage";
import Navbar        from "./components/Navbar";

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}


function Protected({ children, requiredRole }) {
  const { user, role } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && role !== requiredRole) return <Navigate to="/" replace />;
  return children;
}


export default function App() {
  const [user, setUser]   = useState(null);
  const [role, setRole]   = useState(null);   // 'client' | 'franchisee'
  const [token, setToken] = useState(null);

  function login(userData, userRole, accessToken) {
    setUser(userData);
    setRole(userRole);
    setToken(accessToken);
  }

  function logout() {
    setUser(null);
    setRole(null);
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ user, role, token, login, logout }}>
      <BrowserRouter>
        <Navbar />
        <Routes>
          {/* Public */}
          <Route path="/"      element={<HomePage />} />
          <Route path="/app"   element={<AppPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Client only */}
          <Route
            path="/demo"
            element={
              <Protected requiredRole="client">
                <DemoPage />
              </Protected>
            }
          />

          {/* Franchisee only */}
          <Route
            path="/dashboard"
            element={
              <Protected requiredRole="franchisee">
                <DashboardPage />
              </Protected>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
