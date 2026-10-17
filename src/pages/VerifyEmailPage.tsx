import React, { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { localApi } from '../lib/localApi';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [developmentOtp, setDevelopmentOtp] = useState<string | undefined>(location.state?.developmentOtp);
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: verifyError } = await localApi.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'signup',
      });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }
      navigate('/admin', { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Verifikasi gagal. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setError('');
    if (!email.trim()) {
      setError('Masukkan email akun terlebih dahulu.');
      return;
    }
    setResending(true);
    try {
      const { data, error: resendError } = await localApi.auth.resend({ type: 'signup', email: email.trim() });
      if (resendError) setError(resendError.message);
      else {
        setDevelopmentOtp(data?.developmentOtp);
        setError(data?.developmentOtp ? 'Mode development: gunakan OTP yang ditampilkan di bawah.' : 'Kode verifikasi baru sudah dikirim ke email Anda.');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Pengiriman OTP gagal. Silakan coba lagi.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-linear-to-tr from-[#F4F0EA] via-[#F9F6F0] to-[#EAE5DC] px-4 py-8">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-[#EBE6DD] shadow-xl space-y-6 text-stone-800">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#6F4E37] font-bold">Email Verification</p>
          <h2 className="font-serif text-3xl font-semibold">Verifikasi akun</h2>
          <p className="text-xs text-stone-400">Masukkan kode OTP yang dikirim ke email Anda.</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-200">{error}</div>}

        {developmentOtp && (
          <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-xl border border-amber-200">
            <p>OTP development (SMTP belum dikonfigurasi):</p>
            <strong className="text-lg tracking-[0.4em]">{developmentOtp}</strong>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-2">Email</label>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full px-4 py-3 bg-stone-50/50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400 transition-colors" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-2">Kode OTP</label>
            <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} placeholder="6 digit kode" className="w-full px-4 py-3 bg-stone-50/50 border border-stone-200 rounded-xl text-sm tracking-[0.4em] focus:outline-none focus:border-stone-400 transition-colors" required />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 bg-[#6F4E37] text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:bg-[#5a3f2b] active:scale-[0.98] disabled:opacity-50 shadow-sm">
            {loading ? 'Memverifikasi...' : 'Verifikasi dan masuk'}
          </button>
        </form>

        <div className="flex items-center justify-between text-xs">
          <button type="button" onClick={() => void resendCode()} disabled={resending} className="text-[#6F4E37] hover:text-[#5a3f2b] disabled:opacity-50">
            {resending ? 'Mengirim ulang...' : 'Kirim ulang OTP'}
          </button>
          <button type="button" onClick={() => navigate('/login')} className="text-stone-400 hover:text-stone-600">Kembali ke login</button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
