import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { localApi } from '../lib/localApi';

export const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password minimal 8 karakter.');
      return;
    }
    if (password !== confirmation) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setLoading(true);
    const { data: signUpData, error: signUpError } = await localApi.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/verify-email` },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`, { state: { developmentOtp: signUpData?.developmentOtp } });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-linear-to-tr from-[#F4F0EA] via-[#F9F6F0] to-[#EAE5DC] px-4 py-8">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-[#EBE6DD] shadow-xl space-y-6 text-stone-800">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#6F4E37] font-bold">Workspace Access</p>
          <h2 className="font-serif text-3xl font-semibold">Buat akun baru</h2>
          <p className="text-xs text-stone-400">Buat email dan password Anda sendiri untuk mendapatkan kode verifikasi.</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-200">{error}</div>}

        <form onSubmit={handleRegister} className="space-y-4" autoComplete="off">
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-2">Email</label>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" name="register-email" autoComplete="off" className="w-full px-4 py-3 bg-stone-50/50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400 transition-colors" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-2">Password</label>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 8 karakter" name="register-password" autoComplete="new-password" className="w-full px-4 py-3 bg-stone-50/50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400 transition-colors" required minLength={8} />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-2">Konfirmasi Password</label>
            <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Ulangi password" name="register-confirm-password" autoComplete="new-password" className="w-full px-4 py-3 bg-stone-50/50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400 transition-colors" required minLength={8} />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 bg-[#6F4E37] text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:bg-[#5a3f2b] active:scale-[0.98] disabled:opacity-50 shadow-sm">
            {loading ? 'Mengirim kode...' : 'Daftar dan kirim OTP'}
          </button>
        </form>

        <button type="button" onClick={() => navigate('/login')} className="w-full text-xs text-stone-500 hover:text-[#6F4E37] transition-colors">Sudah memiliki akun? Masuk</button>
      </div>
    </div>
  );
};

export default RegisterPage;
