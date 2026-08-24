import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { InvitationPage } from './pages/InvitationPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { supabase } from './lib/supabaseClient';

const App: React.FC = () => {
  // State Global Konten Teks & Tanggal
  const [brideName, setBrideName] = useState<string>('Wanita');
  const [groomName, setGroomName] = useState<string>('Pria');
  const [weddingDate, setWeddingDate] = useState<string>('2027-12-31T09:00:00');
  
  // State Global Finansial
  const [bcaWanita, setBcaWanita] = useState<string>('123456789');
  const [bcaPria, setBcaPria] = useState<string>('987654321');

  // State Global Warna Tema Stempel Lilin
  const [waxColor, setWaxColor] = useState<string>('#E3D5CA'); 
  const [textColor, setTextColor] = useState<string>('#6F4E37'); 

  // Sinkronisasi Data Real-Time (Ambil data dari cloud PostgreSQL saat aplikasi dimuat)
  useEffect(() => {
    const fetchGlobalSettings = async () => {
      const { data, error } = await supabase
        .from('wedding_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (!error && data) {
        setBrideName(data.bride_name);
        setGroomName(data.groom_name);
        setWeddingDate(data.wedding_date);
        setBcaWanita(data.bca_wanita);
        setBcaPria(data.bca_pria);
        setWaxColor(data.wax_color);
        setTextColor(data.text_color);
      }
    };

    fetchGlobalSettings();
  }, []);

  return (
    <Router>
      <Routes>
        {/* Jalur Utama: Halaman Undangan Pernikahan (Akses Publik) */}
        <Route 
          path="/" 
          element={
            <InvitationPage 
              brideName={brideName} 
              groomName={groomName} 
              weddingDate={weddingDate}
              bcaWanita={bcaWanita}
              bcaPria={bcaPria}
              waxColor={waxColor}
              textColor={textColor}
            />
          } 
        />
        
        {/* Jalur Masuk Login Admin */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Jalur Khusus Admin (Diproteksi Guard Route) */}
        <Route element={<ProtectedRoute />}>
          <Route 
            path="/admin" 
            element={
              <DashboardPage 
                brideName={brideName} setBrideName={setBrideName} 
                groomName={groomName} setGroomName={setGroomName} 
                weddingDate={weddingDate} setWeddingDate={setWeddingDate}
                bcaWanita={bcaWanita} setBcaWanita={setBcaWanita}
                bcaPria={bcaPria} setBcaPria={setBcaPria}
                waxColor={waxColor} setWaxColor={setWaxColor}
                textColor={textColor} setTextColor={setTextColor}
              />
            } 
          />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;