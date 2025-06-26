import React, { useState } from 'react';
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4321/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface DiscoveredCamera {
  ip: string;
  model: string;
  workingEndpoint?: string;
  workingCredentials?: {
    username: string;
    password: string;
  };
  imageSize?: number;
  isCamera: boolean;
  isPotentialCamera?: boolean;
  reason?: string;
  openPorts?: number[];
  suggestion?: string;
  requiresCredentials?: boolean;
  supportedProtocols?: string[];
  protocol?: string;
  method?: string;
}

interface CameraDiscoveryProps {
  onCameraSelect: (camera: DiscoveredCamera) => void;
  onClose: () => void;
}

const CameraDiscovery: React.FC<CameraDiscoveryProps> = ({ onCameraSelect, onClose }) => {
  const [discovering, setDiscovering] = useState(false);
  const [confirmedCameras, setConfirmedCameras] = useState<DiscoveredCamera[]>([]);
  const [potentialCameras, setPotentialCameras] = useState<DiscoveredCamera[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [testingCamera, setTestingCamera] = useState<string | null>(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState<DiscoveredCamera | null>(null);
  const [credentials, setCredentials] = useState({ username: 'admin', password: 'Mannoli2025' });

  const discoverCameras = async () => {
    try {
      setDiscovering(true);
      setError(null);
      setConfirmedCameras([]);
      setPotentialCameras([]);

      // Non invia più networkRange - usa discovery LIMITATO con auto-test
      const response = await api.post('/cameras/discover', {}, {
        timeout: 40000 // 40 secondi per discovery limitato con auto-test
      });

      // Nuova struttura della risposta
      const result = response.data;
      setConfirmedCameras(result.confirmed || []);
      setPotentialCameras(result.potential || []);
      
      // Mostra messaggio se trova dispositivi
      if (result.total > 0) {
        console.log(`✅ Trovati ${result.total} dispositivi sulla rete`);
        if (result.confirmed && result.confirmed.length > 0) {
          console.log(`🎉 ${result.confirmed.length} camere confermate automaticamente!`);
        }
      }
      
    } catch (err: any) {
      if (err.code === 'ECONNABORTED') {
        setError('Ricerca interrotta per timeout. La rete potrebbe essere lenta o congestionata.');
      } else {
        setError(err.response?.data?.error || 'Errore durante la ricerca delle camere');
      }
    } finally {
      setDiscovering(false);
    }
  };

  const testCamera = async (ip: string) => {
    try {
      const response = await api.post('/cameras/test', { ip });
      return response.data;
    } catch (err) {
      return { success: false, error: 'Test fallito' };
    }
  };

  const testCameraWithCredentials = async (camera: DiscoveredCamera, username: string, password: string) => {
    try {
      setTestingCamera(camera.ip);
      
      const response = await api.post('/cameras/test-credentials', {
        ip: camera.ip,
        username,
        password
      });

      if (response.data.success) {
        // Camera confermata! Aggiorna i dati e spostala nelle confermate
        const confirmedCamera: DiscoveredCamera = {
          ...camera,
          isCamera: true,
          isPotentialCamera: false,
          workingCredentials: { username, password },
          protocol: response.data.data.protocol,
          method: response.data.data.method,
          workingEndpoint: response.data.data.endpoint,
          imageSize: response.data.data.imageSize,
          model: response.data.data.model
        };

        setConfirmedCameras(prev => [...prev, confirmedCamera]);
        setPotentialCameras(prev => prev.filter(c => c.ip !== camera.ip));
        setShowCredentialsModal(null);
        
        return { success: true, camera: confirmedCamera };
      } else {
        return { success: false, error: response.data.message };
      }
    } catch (err: any) {
      return { 
        success: false, 
        error: err.response?.data?.message || 'Test credenziali fallito' 
      };
    } finally {
      setTestingCamera(null);
    }
  };

  const handleCredentialsSubmit = async () => {
    if (!showCredentialsModal) return;
    
    const result = await testCameraWithCredentials(
      showCredentialsModal, 
      credentials.username, 
      credentials.password
    );
    
    if (!result.success) {
      setError(result.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity backdrop-blur-sm" aria-hidden="true"></div>
        
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        
        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white px-6 pt-6 pb-4 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-3 rounded-xl">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Ricerca Camere IP</h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Configurazione ricerca semplificata */}
            <div className="mb-6">
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  Il sistema eseguirà una scansione automatica completa della rete locale
                </p>
                <button
                  onClick={discoverCameras}
                  disabled={discovering}
                  className="px-8 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50"
                >
                  {discovering ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Ricerca in corso... (mostra TUTTI i dispositivi)</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>Avvia Ricerca Automatica</span>
                    </div>
                  )}
                </button>
                {discovering && (
                  <p className="text-sm text-gray-500 mt-2">
                    Discovery intelligente range 1-50 con auto-test credenziali (30-35 secondi)...
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-red-700 font-medium">{error}</span>
                </div>
              </div>
            )}

            {/* Risultati ricerca */}
            <div className="max-h-96 overflow-y-auto">
              {discovering && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Discovery intelligente in corso...</h4>
                  <p className="text-gray-500">Scansione range 1-50 + auto-test credenziali</p>
                  <p className="text-sm text-gray-400 mt-2">Conferma automaticamente le camere funzionanti</p>
                </div>
              )}

              {!discovering && confirmedCameras.length === 0 && potentialCameras.length === 0 && (
                <div className="text-center py-12">
                  <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Nessuna camera trovata</h4>
                  <p className="text-gray-500">Prova a modificare il range di rete o verifica che le camere siano accese</p>
                </div>
              )}

              {/* Camere confermate */}
              {confirmedCameras.length > 0 && (
                <div className="space-y-4 mb-6">
                  <h4 className="text-lg font-semibold text-green-800 border-b border-green-200 pb-2 flex items-center">
                    <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Camere confermate ({confirmedCameras.length})
                  </h4>
                  
                  <div className="grid gap-4">
                    {confirmedCameras.map((camera, index) => (
                      <div
                        key={camera.ip}
                        className="border border-green-200 bg-green-50 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <h5 className="text-lg font-semibold text-gray-900">{camera.ip}</h5>
                              <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                                {camera.model}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                              <div>
                                <span className="font-medium">Endpoint:</span> {camera.workingEndpoint}
                              </div>
                              <div>
                                <span className="font-medium">Dimensione immagine:</span> {camera.imageSize ? (camera.imageSize / 1024).toFixed(1) + 'KB' : 'N/A'}
                              </div>
                              {camera.workingCredentials && (
                                <div className="col-span-2">
                                  <span className="font-medium">Credenziali:</span> {camera.workingCredentials.username}:{camera.workingCredentials.password || 'empty'}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <button
                            onClick={() => onCameraSelect(camera)}
                            className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium hover:shadow-lg hover:scale-105 transition-all duration-200"
                          >
                            Seleziona
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Camere potenziali */}
              {potentialCameras.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-amber-800 border-b border-amber-200 pb-2 flex items-center">
                    <svg className="w-5 h-5 text-amber-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Possibili camere - richiedono configurazione ({potentialCameras.length})
                  </h4>
                  
                  <div className="grid gap-4">
                    {potentialCameras.map((camera, index) => (
                      <div
                        key={camera.ip}
                        className="border border-amber-200 bg-amber-50 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                              <h5 className="text-lg font-semibold text-gray-900">{camera.ip}</h5>
                              <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-0.5 rounded">
                                {camera.model}
                              </span>
                            </div>
                            
                            <div className="text-sm text-gray-600 space-y-1">
                              <div>
                                <span className="font-medium">Motivo:</span> {camera.reason}
                              </div>
                              {camera.openPorts && camera.openPorts.length > 0 && (
                                <div>
                                  <span className="font-medium">Porte aperte:</span> {camera.openPorts.join(', ')}
                                </div>
                              )}
                              {camera.suggestion && (
                                <div className="bg-amber-100 border border-amber-200 rounded p-2 mt-2">
                                  <span className="font-medium text-amber-800">💡 Suggerimento:</span> {camera.suggestion}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <button
                            onClick={() => setShowCredentialsModal(camera)}
                            disabled={testingCamera === camera.ip}
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50"
                          >
                            {testingCamera === camera.ip ? (
                              <div className="flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                <span>Test...</span>
                              </div>
                            ) : (
                              'Testa Credenziali'
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h5 className="font-medium text-blue-800 mb-1">Come configurare una camera potenziale:</h5>
                        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                          <li>Apri l'app della camera (es. IMOU Life)</li>
                          <li>Vai nelle impostazioni della camera</li>
                          <li>Abilita "HTTP Service" o "Web Service"</li>
                          <li>Imposta username e password (es. admin/Mannoli2025)</li>
                          <li>Clicca "Configura Manualmente" per aggiungere la camera</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal Credenziali */}
      {showCredentialsModal && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Test Camera</h3>
              <button
                onClick={() => setShowCredentialsModal(null)}
                className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="font-medium text-blue-900">{showCredentialsModal.ip}</p>
                  <p className="text-sm text-blue-700">{showCredentialsModal.model}</p>
                  <p className="text-xs text-blue-600">
                    Protocolli: {showCredentialsModal.supportedProtocols?.join(', ') || 'Rilevazione...'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                <input
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="admin"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="password"
                />
              </div>
            </div>
            
            {showCredentialsModal.supportedProtocols?.includes('RTSP') && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-green-800 font-medium">RTSP supportato - Ottimo per streaming!</span>
                </div>
              </div>
            )}
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowCredentialsModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={handleCredentialsSubmit}
                disabled={testingCamera === showCredentialsModal.ip}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50"
              >
                {testingCamera === showCredentialsModal.ip ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Test...</span>
                  </div>
                ) : (
                  'Testa Camera'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraDiscovery;