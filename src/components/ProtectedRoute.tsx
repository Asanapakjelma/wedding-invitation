import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { localApi } from '../lib/localApi';

type LocalSession = { user: { id: string } } | null;

export const ProtectedRoute: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [authenticated, setAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    // Memeriksa status token sesi saat ini secara real-time
    const checkSession = async () => {
      const { data: { session } } = await localApi.auth.getSession() as { data: { session: LocalSession } };
      if (!session?.user) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      setAuthenticated(true);
      setLoading(false);
    };

    checkSession();

    // Memantau jika terjadi perubahan status auth (login/logout otomatis)
    const { data: { subscription } } = localApi.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setAuthenticated(false);
        return;
      }

      setAuthenticated(true);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-xs font-medium text-stone-400 animate-pulse">Memvalidasi token akses...</p>
      </div>
    );
  }

  // Jika terautentikasi, loloskan ke halaman admin. Jika tidak, lempar ke /login
  return authenticated ? <Outlet /> : <Navigate to="/login" replace />;
};