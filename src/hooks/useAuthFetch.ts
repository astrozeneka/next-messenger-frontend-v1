'use client';

import { useAuth } from '@/contexts/AuthContext';

export const useAuthFetch = () => {
  const { token, refreshAuthToken, logout } = useAuth();

  const authFetch = async (url: string, options: RequestInit = {}) => {
    if (!token) {
      throw new Error('No authentication token available');
    }

    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    };

    let response = await fetch(url, config);

    if (response.status === 401) {
      const refreshSuccess = await refreshAuthToken();
      
      if (refreshSuccess) {
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        };
        response = await fetch(url, config);
      } else {
        logout();
        throw new Error('Session expired. Please log in again.');
      }
    }

    return response;
  };

  return { authFetch };
};