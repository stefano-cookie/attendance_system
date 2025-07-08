import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import teacherService, { LessonImage } from '../../services/teacherService';

const LessonImages: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [images, setImages] = useState<LessonImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<LessonImage | null>(null);

  useEffect(() => {
    if (id) {
      loadImages();
    }
  }, [id]);

  const loadImages = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const imagesData = await teacherService.getLessonImages(parseInt(id));
      setImages(imagesData);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore caricamento immagini');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('it-IT');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center bg-gray-800 p-8 rounded-lg border border-gray-700">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-600 border-t-blue-500 mx-auto mb-4"></div>
          <h3 className="text-base font-medium text-gray-300">Caricamento immagini...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-6">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-lg font-medium text-red-300">Errore</h3>
              <p className="text-red-400">{error}</p>
            </div>
          </div>
          <button 
            onClick={() => navigate(`/teacher/lessons/${id}`)}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Torna alla Lezione
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <style>{`body { background-color: #111827 !important; }`}</style>
      
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Immagini Lezione</h1>
              <p className="text-gray-400 mt-1">{images.length} immagini trovate</p>
            </div>
            <button 
              onClick={() => navigate(`/teacher/lessons/${id}`)}
              className="text-gray-400 hover:text-white flex items-center space-x-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Torna alla Lezione</span>
            </button>
          </div>
        </div>

        {/* Images Grid */}
        {images.length === 0 ? (
          <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-white mb-2">Nessuna immagine disponibile</h3>
            <p className="text-gray-400 mb-6">Non sono ancora state scattate immagini per questa lezione</p>
            <button 
              onClick={() => navigate(`/teacher/lessons/${id}`)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
            Scatta Prima Immagine
          </button>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {images.map((image) => (
              <div key={image.id} className="border border-gray-600 rounded-lg overflow-hidden hover:border-gray-500 transition-all bg-gray-750">
                <div className="aspect-video bg-gray-700 relative cursor-pointer" onClick={() => setSelectedImage(image)}>
                  <img 
                    src={image.thumbnail_url} 
                    alt={`Scatto ${formatDate(image.captured_at)}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgMTZsNC41ODYtNC41ODZhMiAyIDAgMDEyLjgyOCAwTDE2IDE2bS0yLTJsMS41ODYtMS41ODZhMiAyIDAgMDEyLjgyOCAwTDIwIDE0bS02LTZoLjAxTTYgMjBoMTJhMiAyIDAgMDAyLTJWNmEyIDIgMCAwMC0yLTJINmEyIDIgMCAwMC0yIDJ2MTJhMiAyIDAgMDAyIDJ6IiBzdHJva2U9IiM2Qjc0ODkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';
                    }}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all flex items-center justify-center">
                    <svg className="w-8 h-8 text-white opacity-0 hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">
                      {formatDate(image.captured_at)}
                    </span>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      image.is_analyzed 
                        ? 'bg-green-900/50 text-green-400 border border-green-600/30' 
                        : 'bg-yellow-900/50 text-yellow-400 border border-yellow-600/30'
                    }`}>
                      {image.is_analyzed ? 'Analizzata' : 'In attesa'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      {image.detected_faces || 0} volti
                    </span>
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {image.recognized_faces || 0} riconosciuti
                    </span>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-500">
                    Fonte: {image.source === 'camera' ? 'Camera originale' : 
                            image.source === 'face_detection_report' ? 'Analisi con contorni' : 'Upload'}
                    {image.camera_ip && ` • ${image.camera_ip}`}
                  </div>
                  
                  {image.source === 'face_detection_report' && (
                    <div className="mt-2 inline-flex items-center px-2 py-1 bg-green-900/50 text-green-400 text-xs rounded-full border border-green-600/30">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Con contorni rilevamento
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal per visualizzazione immagine */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-4xl max-h-full overflow-auto border border-gray-700 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">
                Immagine del {formatDate(selectedImage.captured_at)}
              </h3>
              <button 
                onClick={() => setSelectedImage(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4">
              <img 
                src={selectedImage.url} 
                alt={`Scatto ${formatDate(selectedImage.captured_at)}`}
                className="w-full h-auto max-h-96 object-contain rounded-lg border border-gray-600"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgMTZsNC41ODYtNC41ODZhMiAyIDAgMDEyLjgyOCAwTDE2IDE2bS0yLTJsMS41ODYtMS41ODZhMiAyIDAgMDEyLjgyOCAwTDIwIDE0bS02LTZoLjAxTTYgMjBoMTJhMiAyIDAgMDAyLTJWNmEyIDIgMCAwMC0yLTJINmEyIDIgMCAwMC0yIDJ2MTJhMiAyIDAgMDAyIDJ6IiBzdHJva2U9IiM2Qjc0ODkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';
                }}
              />
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-white mb-2">Dettagli Immagine</h4>
                  <div className="space-y-1 text-gray-400">
                    <p>Data: {formatDate(selectedImage.captured_at)}</p>
                    <p>Fonte: {selectedImage.source === 'camera' ? 'Camera' : 'Upload'}</p>
                    {selectedImage.camera_ip && <p>Camera IP: {selectedImage.camera_ip}</p>}
                    <p>ID: {selectedImage.id}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-white mb-2">Analisi</h4>
                  <div className="space-y-1 text-gray-400">
                    <p>Stato: {selectedImage.is_analyzed ? 'Analizzata' : 'In attesa'}</p>
                    <p>Volti rilevati: {selectedImage.detected_faces || 0}</p>
                    <p>Volti riconosciuti: {selectedImage.recognized_faces || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default LessonImages;