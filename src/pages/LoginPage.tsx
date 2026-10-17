import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { localApi } from '../lib/localApi';
import BrandLogo from '../components/BrandLogo';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: authError } = await localApi.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
      } else {
        navigate('/admin');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Login gagal. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    // PEMBARUAN: Menggunakan gradasi warna krem hangat estetik yang menyatu dengan tombol cokelat
    <div className="min-h-screen w-full flex items-center justify-center bg-linear-to-tr from-[#F4F0EA] via-[#F9F6F0] to-[#EAE5DC] px-4">
      
      {/* Kartu Kontainer Login */}
      <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-[#EBE6DD] shadow-xl space-y-6 animate-fade-in">
        <BrandLogo compact />
        <div className="text-center space-y-1">
          <h2 className="font-serif text-2xl font-semibold text-stone-800">User Login</h2>
          <p className="text-xs text-stone-400">Gunakan akun email user untuk mengakses website</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-2">Email Address</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="admin@email.com"
              name="login-email"
              autoComplete="off"
              className="w-full px-4 py-3 bg-stone-50/50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400 transition-colors" 
              required 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-2">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••"
              name="login-password"
              autoComplete="new-password"
              className="w-full px-4 py-3 bg-stone-50/50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400 transition-colors" 
              required 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 bg-[#6F4E37] text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:bg-[#5a3f2b] active:scale-[0.98] disabled:opacity-50 shadow-sm"
          >
            {loading ? 'Memvalidasi Sesi...' : 'Masuk ke Dashboard'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => navigate('/register')}
          className="w-full text-xs text-stone-500 hover:text-[#6F4E37] transition-colors"
        >
          Belum punya akun? Daftar di sini
        </button>
      </div>
    </div>
  );
};

export default LoginPage;