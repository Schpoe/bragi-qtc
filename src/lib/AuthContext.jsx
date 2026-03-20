import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [actualUser, setActualUser] = useState(null); // Track the real user when impersonating
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token, // Include token if available
        interceptResponses: true
      });
      
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);
        
        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            console.log('Auth required - redirecting to login');
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      
      // Verify user exists in User entity (access control) and merge custom fields
      try {
        const users = await base44.entities.User.list();
        let userRecord = users.find(u => u.email === currentUser.email);
        
        // Auto-create User record if it doesn't exist (with default viewer role)
        if (!userRecord) {
          try {
            userRecord = await base44.entities.User.create({
              email: currentUser.email,
              role: 'viewer',
              managed_team_ids: []
            });
          } catch (createError) {
            console.error('Failed to auto-create user record:', createError);
            setAuthError({
              type: 'access_check_failed',
              message: 'Unable to initialize user account. Please contact an administrator.'
            });
            setIsLoadingAuth(false);
            setIsAuthenticated(false);
            return;
          }
        }
        
        // Merge custom fields from User entity into the current user object
        const mergedUser = {
          ...currentUser,
          ...userRecord,
          // Ensure role and managed_team_ids are available at top level
          role: userRecord.role || currentUser.role,
          managed_team_ids: userRecord.managed_team_ids || []
        };
        
        setUser(mergedUser);
      } catch (accessError) {
        console.error('Access verification failed:', accessError);
        setAuthError({
          type: 'access_check_failed',
          message: 'Unable to verify access. Please try again.'
        });
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        return;
      }
      
      // User is set above in the try block
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      
      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setActualUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    base44.auth.redirectToLogin(window.location.href);
  };

  const impersonateUser = async (targetUserEmail) => {
    if (!actualUser || actualUser.role !== 'admin') {
      return false;
    }
    
    try {
      const users = await base44.entities.User.list();
      const targetUser = users.find(u => u.email === targetUserEmail);
      
      if (!targetUser) {
        return false;
      }
      
      // Store the actual admin user if not already stored
      if (!actualUser) {
        setActualUser(user);
      }
      
      const mergedUser = {
        ...targetUser,
        role: targetUser.role || 'viewer',
        managed_team_ids: targetUser.managed_team_ids || [],
        _impersonating: true
      };
      
      setUser(mergedUser);
      return true;
    } catch (error) {
      console.error('Impersonation failed:', error);
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
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
      impersonateUser,
      stopImpersonation
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};