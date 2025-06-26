// src/components/technician/StudentRegistration.tsx - UI REDESIGN
import React, { useState, useRef, useEffect } from 'react';
import api from '../../services/api';
import { authService } from '../../services/authService';
import { useNavigate } from 'react-router-dom';

interface Course {
  id: number;
  name: string;
}

const StudentRegistration: React.FC = () => {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [matricola, setMatricola] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  
  // Controlla l'autenticazione
  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const user = await authService.getCurrentUser();
        
        // Verifica che l'utente sia admin o tecnico
        if (!user || (user.role !== 'admin' && user.role !== 'technician')) {
          // Reindirizza al login se non autorizzato
          navigate('/login');
        }
      } catch (error) {
        console.error('Errore verifica autenticazione:', error);
        navigate('/login');
      }
    };

    checkAuthentication();
  }, [navigate]);
  
  // Carica i corsi all'avvio
  useEffect(() => {
    const loadCourses = async () => {
      try {
        const response = await api.get('/users/courses');
        setCourses(response.data.courses);
      } catch (error) {
        console.error('Errore caricamento corsi:', error);
        setMessage({ type: 'error', text: 'Errore caricamento corsi' });
      }
    };
    
    loadCourses();
  }, []);
  
  const startCamera = async () => {
    setIsCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Errore accesso webcam:', error);
      setMessage({ type: 'error', text: 'Errore accesso webcam' });
      setIsCapturing(false);
    }
  };
  
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        
        // Converti canvas in File
        canvasRef.current.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `${matricola || 'photo'}.jpg`, { type: 'image/jpeg' });
            setPhoto(file);
            
            // Ferma la webcam
            const stream = videoRef.current?.srcObject as MediaStream;
            const tracks = stream?.getTracks();
            tracks?.forEach(track => track.stop());
            setIsCapturing(false);
          }
        }, 'image/jpeg');
      }
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    const tracks = stream?.getTracks();
    tracks?.forEach(track => track.stop());
    setIsCapturing(false);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !surname || !matricola || !email || !photo) {
      setMessage({ type: 'error', text: 'Tutti i campi sono obbligatori' });
      return;
    }
    
    try {
      setLoading(true);
      
      const formData = new FormData();
      formData.append('name', name);
      formData.append('surname', surname);
      formData.append('matricola', matricola);
      formData.append('email', email);
      formData.append('birthDate', birthDate);
      if (selectedCourse) formData.append('courseId', selectedCourse.toString());
      formData.append('photo', photo);
      
      await api.post('/users/register-student', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setMessage({ type: 'success', text: 'Studente registrato con successo!' });
      
      // Reset form
      setName('');
      setSurname('');
      setMatricola('');
      setEmail('');
      setBirthDate('');
      setSelectedCourse(null);
      setPhoto(null);
    } catch (error: any) {
      console.error('Errore registrazione:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Errore durante la registrazione' 
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-3 rounded-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Registrazione Nuovo Studente</h1>
                <p className="text-gray-600">Aggiungi un nuovo studente al sistema</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Dashboard</span>
              </button>
              
              <button
                onClick={() => authService.logout()}
                className="flex items-center space-x-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-6 py-8">
        {/* Messaggio di feedback */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl border-l-4 shadow-lg ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-500 text-green-800' 
              : 'bg-red-50 border-red-500 text-red-800'
          }`}>
            <div className="flex items-center">
              {message.type === 'success' ? (
                <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span className="font-medium">{message.text}</span>
            </div>
          </div>
        )}
        
        {/* Form principale */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
            <form onSubmit={handleSubmit}>
              {/* Sezione Dati Personali */}
              <div className="p-8 border-b border-gray-200">
                <div className="flex items-center mb-6">
                  <div className="bg-blue-100 p-3 rounded-lg mr-4">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">Dati Personali</h3>
                    <p className="text-gray-600">Inserisci le informazioni anagrafiche dello studente</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Inserisci il nome"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cognome *
                    </label>
                    <input
                      type="text"
                      value={surname}
                      onChange={(e) => setSurname(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Inserisci il cognome"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Matricola *
                    </label>
                    <input
                      type="text"
                      value={matricola}
                      onChange={(e) => setMatricola(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Es. ABC123456"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="studente@esempio.com"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data di nascita *
                    </label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Corso di Studi *
                    </label>
                    <select
                      value={selectedCourse || ''}
                      onChange={(e) => setSelectedCourse(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                      <option value="">Seleziona un corso</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id}>{course.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              {/* Sezione Foto */}
              <div className="p-8">
                <div className="flex items-center mb-6">
                  <div className="bg-purple-100 p-3 rounded-lg mr-4">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">Foto Profilo *</h3>
                    <p className="text-gray-600">Scatta una foto per il riconoscimento facciale</p>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-xl p-6">
                  {isCapturing ? (
                    <div className="text-center">
                      <div className="relative inline-block rounded-xl overflow-hidden shadow-lg">
                        <video 
                          ref={videoRef} 
                          autoPlay 
                          className="w-full max-w-md"
                          style={{ height: '320px', objectFit: 'cover' }}
                        />
                        <div className="absolute inset-0 border-4 border-blue-500 rounded-xl pointer-events-none">
                          <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-blue-500"></div>
                          <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-blue-500"></div>
                          <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-blue-500"></div>
                          <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-blue-500"></div>
                        </div>
                      </div>
                      
                      <div className="mt-6 space-x-4">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-8 rounded-xl hover:shadow-lg transition-all transform hover:scale-105"
                        >
                          <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Scatta Foto
                        </button>
                        
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="bg-gray-500 text-white py-3 px-8 rounded-xl hover:bg-gray-600 transition-colors"
                        >
                          <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      {photo ? (
                        <div className="space-y-4">
                          <div className="relative inline-block">
                            <img 
                              src={URL.createObjectURL(photo)} 
                              alt="Foto studente" 
                              className="w-64 h-64 object-cover border-4 border-green-500 rounded-xl shadow-lg"
                            />
                            <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-2">
                              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                          
                          <div className="space-x-4">
                            <button
                              type="button"
                              onClick={() => {
                                setPhoto(null);
                                startCamera();
                              }}
                              className="bg-blue-500 text-white py-3 px-6 rounded-xl hover:bg-blue-600 transition-colors"
                            >
                              <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Scatta Nuova Foto
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-12">
                          <div className="bg-gray-200 rounded-full w-32 h-32 flex items-center justify-center mx-auto mb-6">
                            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <h4 className="text-lg font-medium text-gray-700 mb-2">Nessuna foto scattata</h4>
                          <p className="text-gray-500 mb-6">Attiva la camera per scattare una foto dello studente</p>
                          
                          <button
                            type="button"
                            onClick={startCamera}
                            className="bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 px-8 rounded-xl hover:shadow-lg transition-all transform hover:scale-105"
                          >
                            <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Attiva Camera
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Footer con pulsante submit */}
              <div className="px-8 py-6 bg-gray-50 rounded-b-2xl border-t border-gray-200">
                <div className="flex flex-col md:flex-row gap-5 items-center justify-between">
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="w-5 h-5 mr-2 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    I campi contrassegnati con * sono obbligatori
                  </div>
                  
                  <button
                    type="submit"
                    className={`flex items-center space-x-3 px-8 py-4 rounded-xl text-white font-semibold transition-all transform ${
                      loading || !photo
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg hover:scale-105'
                    }`}
                    disabled={loading || !photo}
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        <span>Registrazione in corso...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>Registra Studente</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
        
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default StudentRegistration;