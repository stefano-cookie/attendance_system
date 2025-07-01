// frontend/src/components/admin/ClassroomsPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  getClassrooms, 
  createClassroom, 
  updateClassroom, 
  deleteClassroom,
  testCameraConnection,
  discoverCameras,
  assignCameraToClassroom,
  getCameraHealth 
} from '../../services/api';
import type { Classroom } from '../../services/api';
import CameraDiscovery from './CameraDiscovery';

const ClassroomsPanel: React.FC = () => {
  const { t } = useTranslation();
  
  // Stati per i dati
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // Stati per i form e modali
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [classroomToDelete, setClassroomToDelete] = useState<Classroom | null>(null);
  const [isCameraDiscoveryOpen, setIsCameraDiscoveryOpen] = useState<boolean>(false);
  const [currentClassroom, setCurrentClassroom] = useState<Partial<Classroom>>({
    id: undefined,
    name: '',
    code: '',
    has_projector: false,
    has_whiteboard: false,
    camera_ip: '',
    camera_port: 80,
    camera_username: 'admin',
    camera_password: '',
    camera_model: '',
    camera_manufacturer: '',
    camera_position: '',
    camera_angle: '',
    camera_notes: '',
    is_active: true,
    maintenance_mode: false
  });
  
  // Stato per la ricerca
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Stati per gestione camere avanzata
  const [targetClassroomForCamera, setTargetClassroomForCamera] = useState<Classroom | null>(null);
  const [testingCameraId, setTestingCameraId] = useState<number | null>(null);
  const [cameraStatuses, setCameraStatuses] = useState<Record<number, string>>({});
  
  // Carica i dati
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const classroomsData = await getClassrooms();
      console.log('Classrooms loaded:', classroomsData);
      setClassrooms(classroomsData);
      
      // Inizializza stati camera dai dati del database
      const initialStatuses: Record<number, string> = {};
      classroomsData.forEach(classroom => {
        if (classroom.camera_ip && classroom.camera_status) {
          initialStatuses[classroom.id] = classroom.camera_status;
        }
      });
      setCameraStatuses(initialStatuses);
    } catch (err) {
      console.error('Error loading classrooms:', err);
      setError(t('admin.classrooms.errorLoading'));
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Carica i dati all'avvio
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };
  
  // Filtra le aule in base alla ricerca
  const filteredClassrooms = classrooms.filter(classroom => 
    classroom.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (classroom.camera_ip && classroom.camera_ip.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (classroom.code && classroom.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Gestori per i form
  const handleAddClassroom = () => {
    setCurrentClassroom({
      id: undefined,
      name: '',
      code: '',
      has_projector: false,
      has_whiteboard: false,
      camera_ip: '',
      camera_port: 80,
      camera_username: 'admin',
      camera_password: '',
      camera_model: '',
      camera_manufacturer: '',
      camera_position: '',
      camera_angle: '',
      camera_notes: '',
      is_active: true,
      maintenance_mode: false
    });
    setIsEditing(false);
    setIsFormOpen(true);
  };
  
  const handleEditClassroom = (classroom: Classroom) => {
    setCurrentClassroom({
      id: classroom.id,
      name: classroom.name,
      code: classroom.code || '',
      has_projector: classroom.has_projector || false,
      has_whiteboard: classroom.has_whiteboard || false,
      camera_ip: classroom.camera_ip || '',
      camera_port: classroom.camera_port || 80,
      camera_username: classroom.camera_username || 'admin',
      camera_password: classroom.camera_password || '',
      camera_model: classroom.camera_model || '',
      camera_manufacturer: classroom.camera_manufacturer || '',
      camera_position: classroom.camera_position || '',
      camera_angle: classroom.camera_angle || '',
      camera_notes: classroom.camera_notes || '',
      is_active: classroom.is_active !== undefined ? classroom.is_active : true,
      maintenance_mode: classroom.maintenance_mode || false
    });
    setIsEditing(true);
    setIsFormOpen(true);
  };
  
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setError(null);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let processedValue: any = value;
    
    if (type === 'checkbox') {
      processedValue = (e.target as HTMLInputElement).checked;
    } else if (name === 'camera_port') {
      processedValue = value ? parseInt(value, 10) : undefined;
    }
    
    setCurrentClassroom({
      ...currentClassroom,
      [name]: processedValue
    });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!currentClassroom.name) {
        setError(t('admin.classrooms.nameRequired'));
        return;
      }
      
      if (isEditing && currentClassroom.id !== undefined) {
        await updateClassroom(currentClassroom.id, currentClassroom);
      } else {
        await createClassroom(currentClassroom);
      }
      
      await fetchData();
      handleCloseForm();
    } catch (err) {
      console.error('Error saving:', err);
      setError(t('admin.classrooms.errorSaving'));
    }
  };
  
  // Gestori per l'eliminazione
  const handleDeleteConfirmation = (classroom: Classroom) => {
    setClassroomToDelete(classroom);
    setIsDeleteModalOpen(true);
  };
  
  const handleDeleteClassroom = async () => {
    if (!classroomToDelete) return;
    
    try {
      await deleteClassroom(classroomToDelete.id);
      await fetchData();
      setIsDeleteModalOpen(false);
      setClassroomToDelete(null);
    } catch (err) {
      console.error('Error deleting:', err);
      setError(t('admin.classrooms.errorDeleting'));
    }
  };

  const handleCameraSelect = (camera: any) => {
    if (targetClassroomForCamera) {
      // Modalità assegnazione diretta - assegna camera alla classroom specifica
      handleDirectCameraAssignment(targetClassroomForCamera, camera);
    } else {
      // Modalità normale - popola il form
      setCurrentClassroom({
        ...currentClassroom,
        camera_ip: camera.ip,
        camera_model: camera.model,
        camera_manufacturer: camera.model.includes('IMOU') ? 'IMOU' : 'Generic',
        camera_username: camera.workingCredentials?.username || 'admin',
        camera_password: camera.workingCredentials?.password || 'Mannoli2025'
      });
    }
    setIsCameraDiscoveryOpen(false);
    setTargetClassroomForCamera(null);
  };

  // Assegnazione diretta camera a classroom specifica
  const handleDirectCameraAssignment = async (classroom: Classroom, camera: any) => {
    try {
      setError(null);
      console.log(`🎯 Assegnazione diretta camera ${camera.ip} a aula ${classroom.name}`);
      
      await assignCameraToClassroom(classroom.id, camera);
      
      // Aggiorna la lista delle aule
      await fetchData();
      
      console.log(`✅ Camera ${camera.ip} assegnata con successo a ${classroom.name}`);
      
    } catch (err: any) {
      console.error('Errore assegnazione camera:', err);
      setError(`Errore nell'assegnazione della camera: ${err.response?.data?.error || err.message}`);
    }
  };

  // Test connessione camera
  const handleTestCamera = async (classroom: Classroom) => {
    try {
      setTestingCameraId(classroom.id);
      setError(null);
      
      console.log(`🧪 Test camera per aula: ${classroom.name} (${classroom.camera_ip})`);
      
      const result = await testCameraConnection(classroom.id);
      
      // Aggiorna lo stato della camera
      setCameraStatuses(prev => ({
        ...prev,
        [classroom.id]: result.success ? 'online' : 'error'
      }));
      
      // Aggiorna la lista per riflettere i nuovi stati
      await fetchData();
      
      console.log(`📊 Test camera risultato: ${result.success ? 'Successo' : 'Fallito'}`);
      
    } catch (err: any) {
      console.error('Errore test camera:', err);
      setCameraStatuses(prev => ({
        ...prev,
        [classroom.id]: 'error'
      }));
      setError(`Errore test camera: ${err.response?.data?.error || err.message}`);
    } finally {
      setTestingCameraId(null);
    }
  };

  // Apri discovery per assegnazione diretta
  const handleAssignCameraToClassroom = (classroom: Classroom) => {
    setTargetClassroomForCamera(classroom);
    setIsCameraDiscoveryOpen(true);
  };

  // Calcola statistiche
  const classroomsWithCamera = classrooms.filter(classroom => classroom.camera_ip).length;
  const totalClassrooms = classrooms.length;
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex justify-center items-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <h3 className="text-xl font-semibold text-gray-700">{t('admin.classrooms.loading')}</h3>
          <p className="text-gray-500 mt-2">{t('admin.classrooms.loadingSubtext')}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">{t('admin.classrooms.title')}</h1>
                <p className="text-gray-600">{t('admin.classrooms.subtitle')}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
              >
                <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{refreshing ? t('admin.classrooms.refreshing') : t('common.refresh')}</span>
              </button>

              <button
                onClick={() => setIsCameraDiscoveryOpen(true)}
                className="flex items-center space-x-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-lg hover:bg-purple-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>{t('admin.classrooms.searchCameras')}</span>
              </button>

              <button
                onClick={handleAddClassroom}
                className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-2.5 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200 shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold">{t('admin.classrooms.newClassroom')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-6 py-8">
        {/* Statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.classrooms.totalClassrooms')}</p>
                <p className="text-3xl font-bold text-gray-800">{classrooms.length}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-xl">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.classrooms.searchResults')}</p>
                <p className="text-3xl font-bold text-gray-800">{filteredClassrooms.length}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-xl">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.classrooms.withCamera')}</p>
                <p className="text-3xl font-bold text-gray-800">{classroomsWithCamera}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-xl">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
          
        </div>
        
        {/* Ricerca */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-8">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-indigo-100 p-2 rounded-lg">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800">{t('admin.classrooms.searchClassrooms')}</h3>
            </div>
            
            <div className="relative">
              <div className="absolute inset-y-0 right-3 flex items-center pl-4 pointer-events-none">
                <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path>
                </svg>
              </div>
              <input
                type="text"
                placeholder={t('admin.classrooms.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
        
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-700 font-medium">{error}</span>
            </div>
          </div>
        )}
        
        {/* Lista aule */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800">{t('admin.classrooms.classroomList')}</h3>
              </div>
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
                {t('admin.classrooms.classroomCount', { count: filteredClassrooms.length })}
              </span>
            </div>
          </div>
          
          <div className="p-6">
            {filteredClassrooms.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClassrooms.map(classroom => (
                  <div
                    key={classroom.id}
                    className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl hover:scale-105 transition-all duration-300"
                  >
                    <div className="flex flex-col h-full">
                      {/* Header */}
                      <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-bold text-gray-800 flex items-center">
                            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            {classroom.name}
                          </h3>
                          
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditClassroom(classroom)}
                              className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors"
                              title={t('admin.classrooms.editClassroom')}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                            </button>
                            {/* Camera Test Button */}
                            {classroom.camera_ip && (
                              <button
                                onClick={() => handleTestCamera(classroom)}
                                disabled={testingCameraId === classroom.id}
                                className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50"
                                title="Test Camera Connection"
                              >
                                {testingCameraId === classroom.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent"></div>
                                ) : (
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                            )}
                            
                            {/* Assign Camera Button */}
                            {!classroom.camera_ip && (
                              <button
                                onClick={() => handleAssignCameraToClassroom(classroom)}
                                className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                                title="Assign Camera to Classroom"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                              </button>
                            )}
                            
                            <button
                              onClick={() => handleDeleteConfirmation(classroom)}
                              className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                              title={t('admin.classrooms.deleteClassroom')}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="p-6 flex-grow">
                        <div className="space-y-3">
                          {classroom.camera_ip ? (
                            <div className="flex items-center p-3 bg-green-50 rounded-lg">
                              <svg className="w-5 h-5 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <div>
                                <p className="text-sm font-medium text-gray-700">{t('admin.classrooms.cameraIP')}</p>
                                <p className="text-sm text-green-700 font-semibold">{classroom.camera_ip}</p>
                                {(cameraStatuses[classroom.id] || classroom.camera_status) && (
                                  <span className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${
                                    (cameraStatuses[classroom.id] || classroom.camera_status) === 'online' ? 'bg-green-100 text-green-800' :
                                    (cameraStatuses[classroom.id] || classroom.camera_status) === 'offline' ? 'bg-red-100 text-red-800' :
                                    (cameraStatuses[classroom.id] || classroom.camera_status) === 'error' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {cameraStatuses[classroom.id] || classroom.camera_status}
                                    {testingCameraId === classroom.id && (
                                      <span className="ml-1">
                                        <div className="inline-block animate-spin rounded-full h-3 w-3 border border-current border-t-transparent"></div>
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                              <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18 21l-4.95-4.95m0 0L5.636 5.636M13.05 16.05L18 21" />
                              </svg>
                              <div>
                                <p className="text-sm font-medium text-gray-500">{t('admin.classrooms.cameraIP')}</p>
                                <p className="text-sm text-gray-400">{t('admin.classrooms.notConfigured')}</p>
                              </div>
                            </div>
                          )}
                          
                          
                          <div className="flex items-center p-3 bg-purple-50 rounded-lg">
                            <svg className="w-5 h-5 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-gray-700">{t('admin.classrooms.classroomId')}</p>
                              <p className="text-sm text-purple-700 font-semibold">#{classroom.id}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('admin.classrooms.noClassroomsFound')}</h3>
                <p className="text-gray-500 mb-8">
                  {searchTerm 
                    ? t('admin.classrooms.noSearchResults') 
                    : t('admin.classrooms.noClassroomsInSystem')
                  }
                </p>
                <div className="flex justify-center space-x-4">
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {t('admin.classrooms.clearSearch')}
                    </button>
                  )}
                  <button
                    onClick={handleAddClassroom}
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 font-semibold"
                  >
                    <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    {classrooms.length === 0 ? t('admin.classrooms.addFirstClassroom') : t('admin.classrooms.addNewClassroom')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Modal per aggiungere/modificare un'aula */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity backdrop-blur-sm" aria-hidden="true"></div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-6 pt-6 pb-4 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-xl">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {isEditing ? t('admin.classrooms.editClassroom') : t('admin.classrooms.newClassroom')}
                    </h3>
                  </div>
                  <button
                    onClick={handleCloseForm}
                    className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.classrooms.classroomName')} *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={currentClassroom.name}
                      onChange={handleInputChange}
                      required
                      placeholder={t('admin.classrooms.classroomNamePlaceholder')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  
                  
                  
                  {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-red-700 font-medium">{error}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={handleCloseForm}
                      className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
                    >
                      {isEditing ? t('admin.classrooms.updateClassroom') : t('admin.classrooms.createClassroom')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal di conferma eliminazione */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity backdrop-blur-sm" aria-hidden="true"></div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-6 pt-6 pb-4 sm:p-8 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-16 w-16 rounded-full bg-red-100 sm:mx-0 sm:h-12 sm:w-12">
                    <svg className="h-8 w-8 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-xl leading-6 font-bold text-gray-900 mb-2">
                      {t('admin.classrooms.confirmDelete')}
                    </h3>
                    <div className="mt-4">
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {t('admin.classrooms.deleteConfirmMessage', { name: classroomToDelete?.name })}
                      </p>
                      <p className="text-sm text-red-600 mt-3 font-medium">
                        ⚠️ {t('admin.classrooms.deleteWarning')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 sm:px-8 sm:flex sm:flex-row-reverse sm:gap-3">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-lg px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-base font-semibold text-white hover:shadow-xl hover:scale-105 transition-all duration-200 sm:w-auto sm:text-sm"
                  onClick={handleDeleteClassroom}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {t('admin.classrooms.deletePermanently')}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-6 py-3 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={() => setIsDeleteModalOpen(false)}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Camera Discovery */}
      {isCameraDiscoveryOpen && (
        <CameraDiscovery
          onCameraSelect={handleCameraSelect}
          onClose={() => {
            setIsCameraDiscoveryOpen(false);
            setTargetClassroomForCamera(null);
          }}
          targetClassroom={targetClassroomForCamera}
        />
      )}
    </div>
  );
};

export default ClassroomsPanel;