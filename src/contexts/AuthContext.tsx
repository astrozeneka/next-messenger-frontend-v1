'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { generateKeyPair, storePrivateKey, getPrivateKey } from '../lib/crypto';

interface User {
  id: string;
  name: string;
  email: string;
  public_key: string;
  private_key?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshAuthToken: () => Promise<boolean>;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedRefreshToken = localStorage.getItem('refreshToken');
    
    if (storedToken && storedRefreshToken) {
      setToken(storedToken);
      setRefreshToken(storedRefreshToken);
      fetchUser(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async (authToken: string) => {
    try {
      const response = await fetch('/api/auth/user', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        setToken(null);
        setRefreshToken(null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      setToken(null);
      setRefreshToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      // Step 1: Login and get user data with public keys
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("User logged in", data);
        const keys = data.publicKeys; // Expect to have at least 1 key stored {id: ..., publicKey: ...}
        // Match if there is any of his public keys stored in localStorage
        const privateKeys = JSON.parse(localStorage.getItem(`privateKeys`)! || '{}')
        const matchedKey = keys.find((key: { id: string; publicKey: string }) =>
          (privateKeys as { [publicKey: string]: string })[key.publicKey]
        );

        // Step 2: Set authentication data
        setToken(data.token);
        setRefreshToken(data.refreshToken);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);

        // Step 3: Handle key matching logic
        const serverPublicKeys = data.publicKeys || [];
        let hasMatchingKey = false;
        console.log("Retrieve public keys from the server", serverPublicKeys)

        // Check if any server public key matches our local private keys
        for (const serverKey of serverPublicKeys) {
          const privateKey = getPrivateKey(serverKey.publicKey);
          if (privateKey) {
            console.log('Found matching key pair for login');
            hasMatchingKey = true;
            break;
          }
        }

        // Step 4: If no matching key found, generate new key pair
        if (!hasMatchingKey) {
          console.log('No existing keys found, generating new key pair');
          
          const keyPair = await generateKeyPair();
          storePrivateKey(keyPair.publicKey, keyPair.privateKey);

          // Send new public key to server
          const publicKeyResponse = await fetch('/api/auth/public-keys', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${data.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ publicKey: keyPair.publicKey }),
          });

          if (!publicKeyResponse.ok) {
            console.error('Failed to store new public key on server');
            // Don't fail login for this, but log the error
          }
        } else {
          console.log("The user have matched a key pair, no need to generate")
        }

        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch {
      return { success: false, error: 'Network error' };
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      // Step 1: Register user without public key
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Step 2: Set tokens first
        setToken(data.token);
        setRefreshToken(data.refreshToken);
        localStorage.setItem('token', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);

        // Step 3: Generate key pair and store locally
        const keyPair = await generateKeyPair();
        storePrivateKey(keyPair.publicKey, keyPair.privateKey);

        // Step 4: Create complete user object with private key
        const completeUser = {
          ...data.user,
          private_key: keyPair.privateKey
        };

        // Step 5: Set user session with private key
        setUser(completeUser);

        // Step 6: Persist complete user data to localStorage
        localStorage.setItem('userData', JSON.stringify(completeUser));

        // Step 7: Send public key to server (non-blocking for user experience)
        const publicKeyResponse = await fetch('/api/auth/public-keys', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${data.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ publicKey: keyPair.publicKey }),
        });

        if (!publicKeyResponse.ok) {
          console.error('Failed to store public key on server');
          // Don't fail registration - user already has working session
        } else {
          console.log('Public key stored on server successfully');
        }

        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch {
      return { success: false, error: 'Network error' };
    }
  };

  const refreshAuthToken = async (): Promise<boolean> => {
    if (!refreshToken) return false;

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (response.ok) {
        setToken(data.token);
        setRefreshToken(data.refreshToken);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);
        return true;
      } else {
        logout();
        return false;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      logout();
      return false;
    }
  };

  const logout = () => {
    console.log("Calling logout")
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  };

  const value = {
    user,
    token,
    refreshToken,
    login,
    register,
    logout,
    refreshAuthToken,
    loading,
    isAuthenticated: !!token && !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};