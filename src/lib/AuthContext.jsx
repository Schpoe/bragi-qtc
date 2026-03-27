import React, { createContext, useState, useContext, useEffect } from 'react';
import { bragiQTC } from '@/api/bragiQTCClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [actualUser, setActualUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const currentUser = await bragiQTC.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (err) {
      setIsAuthenticated(false);
      if (err.status === 401) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      } else {
        setAuthError({ type: 'unknown', message: err.message || 'Failed to load app' });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const login = async (email, password) => {
    const data = await bragiQTC.auth.login(email, password);
    setUser(data.user);
    setIsAuthenticated(true);
    setAuthError(null);
    return data;
  };

  const logout = () => {
    bragiQTC.auth.logout();
    setUser(null);
    setActualUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  const impersonateUser = async (targetUserEmail) => {
    if (user?.role !== 'admin') return false;
    try {
      const users = await bragiQTC.entities.User.list();
      const targetUser = users.find(u => u.email === targetUserEmail);
      if (!targetUser) return false;
      setActualUser(user);
      setUser({ ...targetUser, role: targetUser.role || 'viewer', managed_team_ids: targetUser.managed_team_ids || [], _impersonating: true });
      return true;
    } catch {
      return false;
    }
  };

  const stopImpersonation = () => {
    if (actualUser) {
      setUser(actualUser);
      setActualUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      actualUser,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: null,
      login,
      logout,
      navigateToLogin,
      navigateToSignup: navigateToLogin,
      checkAppState,
      impersonateUser,
      stopImpersonation,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
