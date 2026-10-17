import React, { useEffect, useState } from 'react';
import { localApi } from '../lib/localApi';

interface GalleryFile {
  name: string;
  url: string;
}

export const PhotoGallery: React.FC = () => {
  const [images, setImages] = useState<GalleryFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchGalleryImages = async () => {
    try {
      // 1. Ambil daftar file dari folder 'gallery' di dalam bucket 'wedding-gallery'
      const { data, error } = await localApi.storage
        .from('wedding-gallery')
        .list('gallery', {
          limit: 100,
          sortBy: { column: 'name', order: 'desc' }, // Menampilkan foto terbaru di awal
        });

      if (error) throw error;

      if (data) {
        // 2. Saring file berformat gambar dan buat URL publiknya
        const formattedImages = data
          .filter((file) => file.name !== '.emptyFolderPlaceholder')
          .map((file) => {
            const { data: { publicUrl } } = localApi.storage
              .from('wedding-gallery')
              .getPublicUrl(`gallery/${file.name}`);
            
            return {
              name: file.name,
              url: publicUrl,
            };
          });

        setImages(formattedImages);
      }
    } catch (error) {
      console.error('Gagal memuat galeri foto:', error);
    } finally {
      setLoading(false);
    }
  };

  // Jalankan pengambilan data otomatis saat seksi galeri dirender di layar tamu
  useEffect(() => {
    void Promise.resolve().then(fetchGalleryImages);
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-xs italic text-stone-400 animate-pulse">Memuat momen kebahagiaan kami...</p>
      </div>
    );
  }

  if (images.length === 0) {
    return null; // Sembunyikan seksi jika admin belum mengunggah foto sama sekali
  }

  return (
    <section className="space-y-6">
      <div className="text-center max-w-sm mx-auto">
        <h2 className="font-serif text-2xl text-[#2C2724] font-medium tracking-wide">Galeri Kebahagiaan</h2>
        <p className="text-[11px] text-[#5A524A] mt-1 italic">Kepingan kisah dan kenangan indah perjalanan kami</p>
      </div>

      {/* Grid Foto Responsif ala Undangan Premium */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl mx-auto px-2">
        {images.map((img) => (
          <div 
            key={img.name} 
            className="aspect-3/4 bg-stone-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-500 group relative"
          >
            <img 
              src={img.url} 
              alt="Momen Pernikahan" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out"
              loading="lazy" // Optimasi performa loading gambar pada HP tamu
            />
            {/* Efek overlay elegan saat foto disentuh/di-hover */}
            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </div>
        ))}
      </div>
    </section>
  );
};