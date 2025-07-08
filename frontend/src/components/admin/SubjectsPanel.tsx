// frontend/src/components/admin/SubjectsPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  getSubjects, 
  getCourses, 
  createSubject, 
  updateSubject, 
  deleteSubject 
} from '../../services/api';
import type { Subject, Course } from '../../services/api';
import ConfirmDeleteModal from '../common/ConfirmDeleteModal';

const SubjectsPanel: React.FC = () => {
  const { t } = useTranslation();
  
  // Stati per i dati
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // Stati per i form e modali
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [currentSubject, setCurrentSubject] = useState<Partial<Subject>>({
    id: undefined,
    name: '',
    course_id: 0
  });
  
  // Stato per la ricerca e filtri
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  
  // Stati per eliminazione
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  
  // Carica i dati
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [subjectsData, coursesData] = await Promise.all([
        getSubjects(),
        getCourses()
      ]);
      
      setSubjects(subjectsData);
      setCourses(coursesData);
    } catch (err) {
      console.error('Errore durante il caricamento dei dati:', err);
      setError(t('admin.subjects.errorLoading'));
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
  
  // Filtra le materie in base alla ricerca e al corso selezionato
  const filteredSubjects = subjects.filter(subject => {
    const matchesSearch = subject.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = selectedCourseId === null || subject.course_id === selectedCourseId;
    return matchesSearch && matchesCourse;
  });
  
  // Funzione per ottenere il nome del corso
  const getCourseName = (courseId: number | null): string => {
    if (!courseId) return t('admin.subjects.list.noCourse');
    const course = courses.find(c => c.id === courseId);
    return course ? course.name : t('admin.subjects.list.unknownCourse');
  };
  
  // ✅ Funzione aggiornata per ottenere il colore del corso dal DB
  const getCourseColor = (courseId: number | null): string => {
    if (!courseId) return '#6B7280'; // Colore grigio per materie senza corso
    // Cerca il corso nella lista dei corsi
    const course = courses.find(c => c.id === courseId);
    
    // Se il corso esiste e ha un colore, usalo
    if (course && course.color) {
      return course.color;
    }
    
    // Fallback ai colori predefiniti se il colore non è disponibile
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
    return colors[courseId % colors.length];
  };
  
  // Gestori per i form
  const handleAddSubject = () => {
    setCurrentSubject({
      id: undefined,
      name: '',
      course_id: courses.length > 0 ? courses[0].id : 0
    });
    setIsEditing(false);
    setIsFormOpen(true);
  };
  
  const handleEditSubject = (subject: Subject) => {
    setCurrentSubject({
      id: subject.id,
      name: subject.name,
      course_id: subject.course_id
    });
    setIsEditing(true);
    setIsFormOpen(true);
  };
  
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setError(null);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentSubject({
      ...currentSubject,
      [name]: name === 'course_id' ? parseInt(value, 10) : value
    });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!currentSubject.name || !currentSubject.course_id) {
        setError(t('admin.subjects.nameRequired'));
        return;
      }
      
      if (isEditing && currentSubject.id !== undefined) {
        await updateSubject(currentSubject.id, currentSubject);
      } else {
        await createSubject(currentSubject);
      }
      
      await fetchData();
      handleCloseForm();
    } catch (err) {
      console.error('Errore durante il salvataggio:', err);
      setError(t('admin.subjects.errorSaving'));
    }
  };
  
  // Gestori per l'eliminazione
  const handleDeleteConfirmation = (subject: Subject) => {
    setSubjectToDelete(subject);
    setIsDeleteModalOpen(true);
  };
  
  const handleDeleteSubject = async () => {
    if (!subjectToDelete) return;
    
    setIsDeleting(true);
    
    try {
      await deleteSubject(subjectToDelete.id);
      await fetchData();
      setIsDeleteModalOpen(false);
      setSubjectToDelete(null);
    } catch (err) {
      console.error('Errore durante l\'eliminazione:', err);
      setError(t('admin.subjects.errorDeleting'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Calcola statistiche
  const subjectsByCourse = courses.map(course => ({
    course,
    count: subjects.filter(subject => subject.course_id === course.id).length
  }));
  const subjectsWithoutCourse = subjects.filter(subject => !subject.course_id).length;
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex justify-center items-center">
        <div className="text-center bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-700">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <h3 className="text-xl font-semibold text-gray-200">{t('admin.subjects.loading')}</h3>
          <p className="text-gray-400 mt-2">{t('admin.subjects.loadingSubtext')}</p>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">{t('admin.subjects.title')}</h1>
                <p className="text-gray-300">{t('admin.subjects.subtitle')}</p>
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
                <span>{refreshing ? t('admin.subjects.refreshing') : t('admin.subjects.refresh')}</span>
              </button>

              <button
                onClick={handleAddSubject}
                className="flex items-center space-x-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-2.5 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200 shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold">{t('admin.subjects.newSubject')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-6 py-8">
        {/* Statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">{t('admin.subjects.stats.totalSubjects')}</p>
                <p className="text-3xl font-bold text-white">{subjects.length}</p>
              </div>
              <div className="bg-blue-600/20 p-3 rounded-xl">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">{t('admin.subjects.stats.searchResults')}</p>
                <p className="text-3xl font-bold text-white">{filteredSubjects.length}</p>
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
                <p className="text-sm font-medium text-gray-400 mb-1">{t('admin.subjects.stats.activeCourses')}</p>
                <p className="text-3xl font-bold text-white">{courses.length}</p>
              </div>
              <div className="bg-purple-600/20 p-3 rounded-xl">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">{t('admin.subjects.stats.withoutCourse')}</p>
                <p className="text-3xl font-bold text-white">{subjectsWithoutCourse}</p>
              </div>
              <div className="bg-orange-600/20 p-3 rounded-xl">
                <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        {/* Search e Filtri */}
        <div className="bg-gray-800 rounded-2xl shadow-lg border border-gray-700 mb-8">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-indigo-600/20 p-2 rounded-lg">
                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white">{t('admin.subjects.search.title')}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">{t('admin.subjects.search.searchSubject')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-3 flex items-center pl-4 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path>
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder={t('admin.subjects.search.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400"
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
              
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">{t('admin.subjects.search.filterByCourse')}</label>
                <select
                  value={selectedCourseId || ''}
                  onChange={(e) => setSelectedCourseId(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">{t('admin.subjects.search.allCourses')}</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
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
        
        {/* Lista materie */}
        <div className="bg-gray-800 rounded-2xl shadow-lg border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-600/20 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white">{t('admin.subjects.list.title')}</h3>
              </div>
              <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm font-medium">
                {t('admin.subjects.list.subjectCount', { count: filteredSubjects.length })}
              </span>
            </div>
          </div>
          
          <div className="p-6">
            {filteredSubjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSubjects.map(subject => (
                  <div
                    key={subject.id}
                    className="bg-gradient-to-br from-gray-800 to-gray-750 rounded-2xl shadow-lg border border-gray-700 overflow-hidden hover:shadow-xl hover:scale-105 transition-all duration-300"
                    style={{ borderLeft: `5px solid ${getCourseColor(subject.course_id)}` }}
                  >
                    <div className="flex flex-col h-full">
                      {/* Header */}
                      <div className="p-6 bg-gradient-to-r from-gray-700 to-gray-800 border-b border-gray-600">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-bold text-white truncate pr-2">{subject.name}</h3>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditSubject(subject)}
                              className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600/30 transition-colors border border-indigo-800/30"
                              title={t('admin.subjects.list.editSubject')}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteConfirmation(subject)}
                              className="p-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors border border-red-800/30"
                              title={t('admin.subjects.list.deleteSubject')}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        
                        {/* Course badge */}
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getCourseColor(subject.course_id) }}
                          ></div>
                          <span
                            className="px-3 py-1 rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: getCourseColor(subject.course_id) }}
                          >
                            {getCourseName(subject.course_id)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="p-6 flex-grow">
                        <div className="flex items-center text-sm text-gray-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                          </svg>
                          <span>{t('admin.subjects.list.subjectId')}: {subject.id}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="bg-gray-700 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{t('admin.subjects.empty.noSubjectsFound')}</h3>
                <p className="text-gray-400 mb-8">
                  {searchTerm || selectedCourseId 
                    ? t('admin.subjects.empty.noSearchResults')
                    : t('admin.subjects.empty.noSubjectsInSystem')
                  }
                </p>
                <div className="flex justify-center space-x-4">
                  {(searchTerm || selectedCourseId) && (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedCourseId(null);
                      }}
                      className="inline-flex items-center px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      {t('admin.subjects.search.clearFilters')}
                    </button>
                  )}
                  <button
                    onClick={handleAddSubject}
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 font-semibold"
                  >
                    <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    {subjects.length === 0 ? t('admin.subjects.empty.addFirstSubject') : t('admin.subjects.empty.addNewSubject')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Modal per aggiungere/modificare una materia */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity backdrop-blur-sm" aria-hidden="true"></div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-gray-800 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-700">
              <div className="bg-gray-800 px-6 pt-6 pb-4 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-xl">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white">
                      {isEditing ? t('admin.subjects.editSubject') : t('admin.subjects.newSubject')}
                    </h3>
                  </div>
                  <button
                    onClick={handleCloseForm}
                    className="p-2 bg-gray-700 text-gray-400 rounded-lg hover:bg-gray-600 hover:text-gray-300 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-gray-300 mb-2">
                      {t('admin.subjects.form.nameLabel')}
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={currentSubject.name}
                      onChange={handleInputChange}
                      required
                      placeholder={t('admin.subjects.form.namePlaceholder')}
                      className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="course_id" className="block text-sm font-semibold text-gray-300 mb-2">
                      {t('admin.subjects.form.courseLabel')}
                    </label>
                    <select
                      id="course_id"
                      name="course_id"
                      value={currentSubject.course_id || ''}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                      <option value="">{t('admin.subjects.form.selectCourse')}</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {error && (
                    <div className="bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg border border-red-800">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-red-300 font-medium">{error}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-end space-x-3 pt-6 border-t border-gray-700">
                    <button
                      type="button"
                      onClick={handleCloseForm}
                      className="px-6 py-3 border border-gray-600 rounded-lg text-gray-300 font-medium hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
                    >
                      {isEditing ? t('admin.subjects.form.updateSubject') : t('admin.subjects.form.createSubject')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal di conferma eliminazione - Utilizzando il nuovo componente */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteSubject}
        title={t('admin.subjects.deleteConfirmation.title')}
        itemName={subjectToDelete?.name || ''}
        itemType={t('admin.subjects.deleteConfirmation.itemType')}
        description={`${t('navigation.courses')}: ${subjectToDelete ? getCourseName(subjectToDelete.course_id) : ''}`}
        isDeleting={isDeleting}
        additionalWarning={t('admin.subjects.deleteConfirmation.additionalWarning')}
      />
    </div>
  );
};

export default SubjectsPanel;