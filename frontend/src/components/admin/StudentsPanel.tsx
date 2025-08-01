// frontend/src/components/admin/StudentsPanel.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { Student, getStudents, deleteStudent } from '../../services/api';

const StudentsPanel: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // Funzione per navigare alla pagina di registrazione studente
  const handleCreateStudent = (): void => {
    navigate('/admin/technician/register');
  };
  
  // Carica la lista degli studenti
  useEffect(() => {
    fetchStudents();
  }, []);
  
  const fetchStudents = async (): Promise<void> => {
    setLoading(true);
    try {
      const studentsData = await getStudents();
      setStudents(studentsData);
      setError(null);
    } catch (err) {
      console.error('Errore nel caricamento degli studenti:', err);
      setError(t('admin.users.errorLoadingStudents'));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await fetchStudents();
    setRefreshing(false);
  };
  
  // Apre il modal di conferma eliminazione
  const openDeleteModal = (student: Student): void => {
    setStudentToDelete(student);
    setShowDeleteModal(true);
  };
  
  // Chiude il modal di conferma eliminazione
  const closeDeleteModal = (): void => {
    setShowDeleteModal(false);
    setStudentToDelete(null);
  };
  
  // Gestisce eliminazione effettiva
  const confirmDelete = async (): Promise<void> => {
    if (!studentToDelete) return;
    
    try {
      await api.delete(`/users/students/${studentToDelete.id}`);
      setStudents(students.filter(s => s.id !== studentToDelete.id));
      closeDeleteModal();
    } catch (err) {
      console.error('Errore durante l\'eliminazione dello studente:', err);
      setError(t('admin.users.errorDeletingStudent'));
    }
  };
  
  // Filtra gli studenti in base al termine di ricerca
  const filteredStudents = students.filter(student => {
    const fullName = `${student.name} ${student.surname}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) || 
           (student.matricola?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
           student.email.toLowerCase().includes(searchTerm.toLowerCase());
  });
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex justify-center items-center">
        <div className="text-center bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-700">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <h3 className="text-xl font-semibold text-gray-200">{t('admin.users.loadingStudents')}</h3>
          <p className="text-gray-400 mt-2">{t('admin.users.loadingSubtext')}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 shadow-lg border-b border-gray-700">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">{t('admin.users.studentManagement')}</h1>
                <p className="text-gray-300">{t('admin.users.studentManagementSubtitle')}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 bg-gray-700 text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{refreshing ? t('admin.users.refreshing') : t('common.refresh')}</span>
              </button>

              <button
                onClick={handleCreateStudent}
                className="flex items-center space-x-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-2.5 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200 shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold">{t('admin.users.registerNewStudent')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-6 py-8">
        {/* Statistiche veloci */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">{t('admin.users.totalStudents')}</p>
                <p className="text-3xl font-bold text-white">{students.length}</p>
              </div>
              <div className="bg-blue-600/20 p-3 rounded-xl">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">{t('admin.users.searchResults')}</p>
                <p className="text-3xl font-bold text-white">{filteredStudents.length}</p>
              </div>
              <div className="bg-green-600/20 p-3 rounded-xl">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">{t('admin.users.withProfilePhoto')}</p>
                <p className="text-3xl font-bold text-white">
                  {students.filter(s => s.hasPhoto).length}
                </p>
              </div>
              <div className="bg-purple-600/20 p-3 rounded-xl">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        {/* Barra di ricerca */}
        <div className="bg-gray-800 rounded-2xl shadow-lg border border-gray-700 mb-8">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-indigo-600/20 p-2 rounded-lg">
                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white">{t('admin.users.searchStudents')}</h3>
            </div>
            
            <div className="relative">
              <div className="absolute inset-y-0 right-3 flex items-center pl-4 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path>
                </svg>
              </div>
              <input
                type="text"
                className="w-full pl-12 pr-4 py-4 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400"
                placeholder={t('admin.users.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-200"
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
          <div className="mb-6 bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg shadow border border-red-800">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-300 font-medium">{error}</span>
            </div>
          </div>
        )}
        
        {/* Lista studenti */}
        <div className="bg-gray-800 rounded-2xl shadow-lg border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-600/20 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white">{t('admin.users.studentList')}</h3>
              </div>
              <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm font-medium">
                {t('admin.users.studentCount', { count: filteredStudents.length })}
              </span>
            </div>
          </div>
          
          <div className="p-6">
            {filteredStudents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStudents.map((student) => (
                  <div key={student.id} className="bg-gradient-to-br from-gray-800 to-gray-750 rounded-2xl shadow-lg border border-gray-700 overflow-hidden hover:shadow-xl hover:scale-105 transition-all duration-300">
                    <div className="flex flex-col h-full">
                      {/* Header con foto e info principali */}
                      <div className="p-6 bg-gradient-to-r from-gray-700 to-gray-800">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            {student.photoPath ? (
                              <img
                                className="h-16 w-16 rounded-full object-cover border-3 border-gray-600 shadow-lg"
                                src={student.photoPath}
                                alt={`${student.name} ${student.surname}`}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const nextElement = target.nextElementSibling as HTMLDivElement;
                                  if (nextElement) {
                                    nextElement.style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}
                            <div 
                              className="h-16 w-16 rounded-full flex items-center justify-center text-white bg-gradient-to-r from-blue-600 to-indigo-600 text-xl font-bold shadow-lg"
                              style={{ display: student.photoPath ? 'none' : 'flex' }}
                            >
                              {student.name[0]}{student.surname[0]}
                            </div>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-white">
                              {student.name} {student.surname}
                            </h3>
                            <p className="text-sm font-medium text-blue-300 bg-blue-600/20 px-2 py-1 rounded-full inline-block border border-blue-800/30">
                              {student.matricola || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Contenuto principale */}
                      <div className="p-6 flex-grow">
                        <div className="space-y-3">
                          <div className="flex items-center text-sm bg-gray-700 p-3 rounded-lg border border-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                            </svg>
                            <span className="text-gray-300 font-medium">{student.email}</span>
                          </div>
                          
                          {student.course_id && (
                            <div className="flex items-center text-sm bg-gray-700 p-3 rounded-lg border border-gray-600">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                              </svg>
                              <span className="text-gray-300 font-medium">{t('admin.users.courseId')}: {student.course_id}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Footer con azioni */}
                      <div className="p-4 bg-gray-700 border-t border-gray-600 flex justify-end space-x-3">
                        <button
                          onClick={() => navigate(`/admin/students/edit/${student.id}`)}
                          className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200 font-medium"
                          title="Modifica studente"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                          <span>{t('common.edit')}</span>
                        </button>
                        
                        <button
                          onClick={() => openDeleteModal(student)}
                          className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200 font-medium"
                          title="Elimina studente"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span>{t('common.delete')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="bg-gray-700 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{t('admin.users.noStudentsFound')}</h3>
                <p className="text-gray-400 mb-8">
                  {searchTerm ? t('admin.users.noSearchResults') : t('admin.users.noStudentsInSystem')}
                </p>
                <button
                  onClick={handleCreateStudent}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 font-semibold"
                >
                  <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  {students.length === 0 ? t('admin.users.addFirstStudent') : t('admin.users.registerNewStudent')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Modal di eliminazione modernizzato */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div className="fixed inset-0 bg-gray-900 bg-opacity-80 transition-opacity backdrop-blur-sm" aria-hidden="true"></div>
            
            {/* Centra il modal */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            {/* Modal content */}
            <div className="inline-block align-bottom bg-gray-800 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-700">
              <div className="bg-gray-800 px-6 pt-6 pb-4 sm:p-8 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-16 w-16 rounded-full bg-red-900/20 border border-red-800 sm:mx-0 sm:h-12 sm:w-12">
                    <svg className="h-8 w-8 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-xl leading-6 font-bold text-white mb-2" id="modal-title">
                      {t('admin.users.confirmDelete')}
                    </h3>
                    <div className="mt-4">
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {t('admin.users.deleteConfirmMessage', { 
                          name: `${studentToDelete?.name} ${studentToDelete?.surname}` 
                        })}
                      </p>
                      <p className="text-sm text-red-400 mt-3 font-medium">
                        ⚠️ {t('admin.users.deleteWarning')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-700 px-6 py-4 sm:px-8 sm:flex sm:flex-row-reverse sm:gap-3">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-lg px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-base font-semibold text-white hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 sm:w-auto sm:text-sm"
                  onClick={confirmDelete}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {t('admin.users.deletePermanently')}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-600 shadow-sm px-6 py-3 bg-gray-800 text-base font-medium text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={closeDeleteModal}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentsPanel;