// frontend/src/components/admin/CoursesPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  getCourses, 
  createCourse, 
  updateCourse, 
  deleteCourse,
  getSubjects,
  updateSubject,
  Course,
  Subject 
} from '../../services/api';
import ConfirmDeleteModal from '../common/ConfirmDeleteModal';

const CoursesPanel: React.FC = () => {
  const { t } = useTranslation();
  
  // Stati per i dati
  const [courses, setCourses] = useState<Course[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // Stati per i form e modali
  const [showModal, setShowModal] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false); // ✅ AGGIUNTA
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formColor, setFormColor] = useState<string>('#3498db'); // ✅ Ripristinato
  const [selectedSubjects, setSelectedSubjects] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  // Stato per la ricerca e filtri
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Colori predefiniti per la selezione rapida
  const predefinedColors = [
    '#3498db', // Blu
    '#e74c3c', // Rosso
    '#2ecc71', // Verde
    '#f39c12', // Arancione
    '#9b59b6', // Viola
    '#1abc9c', // Turchese
    '#34495e', // Grigio scuro
    '#e67e22', // Arancione scuro
    '#8e44ad', // Viola scuro
    '#16a085'  // Verde acqua
  ];
  
  // Carica i dati
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [coursesData, subjectsData] = await Promise.all([
        getCourses(),
        getSubjects({ all: true })
      ]);
      
      setCourses(coursesData || []);
      setAllSubjects(subjectsData || []);
    } catch (err: any) {
      console.error('❌ Errore durante il caricamento dei dati:', err);
      setError(t('admin.courses.errorLoading'));
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
  
  // Filtra i corsi in base alla ricerca
  const filteredCourses = courses.filter(course =>
    course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (course.description && course.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // ✅ Funzione per ottenere il colore del corso dal DB (FUNZIONANTE)
  const getCourseColor = (course: Course | number): string => {
    let courseObj: Course | undefined;
    let courseId: number;
    
    // Determina l'oggetto corso e l'ID
    if (typeof course === 'object') {
      courseObj = course;
      courseId = course.id;
    } else {
      courseId = course;
      courseObj = courses.find(c => c.id === course);
    }
    
    // Se è un oggetto Course e ha il colore, usalo
    if (courseObj && courseObj.color) {
      return courseObj.color;
    }
    
    // Fallback ai colori predefiniti
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
    const fallbackColor = colors[courseId % colors.length];
    return fallbackColor;
  };
  
  // Gestori per i form
  const handleAddCourse = () => {
    setEditingCourse(null);
    setIsEditing(false); // ✅ AGGIUNTA
    setFormName('');
    setFormDescription('');
    setFormColor('#3498db'); // ✅ Reset colore default
    setSelectedSubjects([]);
    setError(null);
    setShowModal(true);
  };
  
  const handleEditCourse = async (course: Course) => {
    setEditingCourse(course);
    setIsEditing(true); // ✅ AGGIUNTA
    setFormName(course.name);
    setFormDescription(course.description || '');
    setFormColor(course.color || '#3498db'); // ✅ Usa colore del corso o default
    setError(null);
    
    try {
      // Carica le materie associate al corso
      const courseSubjects = allSubjects.filter(subject => subject.course_id === course.id);
      setSelectedSubjects(courseSubjects.map(subject => subject.id));
      setShowModal(true);
    } catch (err: any) {
      console.error('❌ Errore apertura modal edit:', err);
      setError(t('admin.courses.errorOpeningModal'));
    }
  };
  
  const handleCloseForm = () => {
    setShowModal(false);
    setEditingCourse(null);
    setIsEditing(false); // ✅ AGGIUNTA
    setError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'name') {
      setFormName(value);
    } else if (name === 'description') {
      setFormDescription(value);
    } else if (name === 'color') {
      setFormColor(value);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formName.trim()) {
      setError(t('admin.courses.nameRequired'));
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      // ✅ Include il colore nei dati del corso
      const courseData = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        color: formColor // ✅ Aggiunto colore
      };
      
      // 🐛 DEBUG: Verifica dati inviati
      console.log('📤 DATI INVIATI AL SERVER:', courseData);
      console.log('🎨 COLORE FORM ATTUALE:', formColor);
      console.log('🔧 OPERAZIONE:', isEditing ? 'UPDATE' : 'CREATE');
      
      let savedCourse: Course;
      
      if (isEditing && editingCourse) {
        console.log('🔄 Chiamando updateCourse con ID:', editingCourse.id);
        console.log('🔗 Verifica frontend/src/services/api.ts per vedere URL completo');
        savedCourse = await updateCourse(editingCourse.id, courseData);
      } else {
        console.log('➕ Chiamando createCourse');
        console.log('🔗 Verifica frontend/src/services/api.ts per vedere URL completo');
        savedCourse = await createCourse(courseData);
      }
      
      // 🐛 DEBUG: Verifica risposta server
      console.log('📥 RISPOSTA DAL SERVER:', savedCourse);
      console.log('🎨 COLORE NELLA RISPOSTA:', savedCourse.color);
      
      // Aggiorna le associazioni delle materie
      if (savedCourse && savedCourse.id) {
        // Prima rimuovi tutte le associazioni esistenti per questo corso
        const currentCourseSubjects = allSubjects.filter(subject => subject.course_id === savedCourse.id);
        for (const subject of currentCourseSubjects) {
          if (!selectedSubjects.includes(subject.id)) {
            await updateSubject(subject.id, { course_id: 0 });
          }
        }
        
        // Poi aggiungi le nuove associazioni
        for (const subjectId of selectedSubjects) {
          const subject = allSubjects.find(s => s.id === subjectId);
          if (subject && subject.course_id !== savedCourse.id) {
            await updateSubject(subjectId, { course_id: savedCourse.id });
          }
        }
      }
      
      // ✅ Ricarica i dati per assicurare sincronizzazione
      await fetchData();
      handleCloseForm();
      
    } catch (err: any) {
      console.error('❌ Errore salvataggio corso:', err);
      setError(err.response?.data?.message || t('admin.courses.errorSaving'));
    } finally {
      setSubmitting(false);
    }
  };
  
  // Gestori per l'eliminazione
  const handleDeleteConfirmation = (course: Course) => {
    setDeletingCourse(course);
    setShowDeleteModal(true);
  };
  
  const handleDeleteCourse = async () => {
    if (!deletingCourse) return;
    
    setSubmitting(true);
    
    try {
      // Prima dissocia tutte le materie
      const courseSubjects = allSubjects.filter(subject => subject.course_id === deletingCourse.id);
      for (const subject of courseSubjects) {
        await updateSubject(subject.id, { course_id: 0 });
      }
      
      // Poi elimina il corso
      await deleteCourse(deletingCourse.id);
      
      await fetchData();
      setShowDeleteModal(false);
      setDeletingCourse(null);
      
    } catch (err: any) {
      console.error('❌ Errore eliminazione corso:', err);
      setError(err.response?.data?.message || t('admin.courses.errorDeleting'));
    } finally {
      setSubmitting(false);
    }
  };
  
  const toggleSubjectSelection = (subjectId: number) => {
    setSelectedSubjects(prev => 
      prev.includes(subjectId)
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  // Calcola statistiche
  const totalSubjectsAssigned = allSubjects.filter(subject => subject.course_id && subject.course_id > 0).length;
  const coursesWithoutSubjects = courses.filter(course => 
    !allSubjects.some(subject => subject.course_id === course.id)
  ).length;
  const subjectsWithoutCourse = allSubjects.filter(subject => !subject.course_id || subject.course_id === 0).length;
  
  // Materie disponibili per associazione
  const availableSubjects = allSubjects.filter(subject => 
    !subject.course_id || subject.course_id === 0 || (editingCourse && subject.course_id === editingCourse.id)
  );
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex justify-center items-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <h3 className="text-xl font-semibold text-gray-700">{t('admin.courses.loading')}</h3>
          <p className="text-gray-500 mt-2">{t('admin.courses.loadingSubtext')}</p>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">{t('admin.courses.title')}</h1>
                <p className="text-gray-600">{t('admin.courses.subtitle')}</p>
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
                <span>{refreshing ? t('admin.courses.refreshing') : t('common.refresh')}</span>
              </button>

              <button
                onClick={handleAddCourse}
                className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-2.5 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200 shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold">{t('admin.courses.newCourse')}</span>
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
                <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.courses.totalCourses')}</p>
                <p className="text-3xl font-bold text-gray-800">{courses.length}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-xl">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.courses.searchResults')}</p>
                <p className="text-3xl font-bold text-gray-800">{filteredCourses.length}</p>
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
                <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.courses.associatedSubjects')}</p>
                <p className="text-3xl font-bold text-gray-800">{totalSubjectsAssigned}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-xl">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.courses.availableSubjects')}</p>
                <p className="text-3xl font-bold text-gray-800">{subjectsWithoutCourse}</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-xl">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        {/* Search */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-8">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-indigo-100 p-2 rounded-lg">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800">{t('admin.courses.searchCourses')}</h3>
            </div>
            
            <div className="max-w-md">
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.courses.searchCourse')}</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-3 flex items-center pl-4 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path>
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder={t('admin.courses.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
        
        {/* Lista corsi */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800">{t('admin.courses.courseCatalog')}</h3>
              </div>
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
                {t('admin.courses.courseCount', { count: filteredCourses.length })}
              </span>
            </div>
          </div>
          
          <div className="p-6">
            {filteredCourses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourses.map(course => {
                  const courseSubjects = allSubjects.filter(subject => subject.course_id === course.id);
                  const courseColor = getCourseColor(course); // ✅ Usa colore dal DB
                  
                  return (
                    <div
                      key={course.id}
                      className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl hover:scale-105 transition-all duration-300"
                      style={{ borderLeft: `5px solid ${courseColor}` }}
                    >
                      <div className="flex flex-col h-full">
                        {/* Header */}
                        <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-bold text-gray-800 truncate pr-2">{course.name}</h3>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleEditCourse(course)}
                                className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors"
                                title={t('admin.courses.editCourse')}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteConfirmation(course)}
                                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                title={t('admin.courses.deleteCourse')}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          
                          {course.description && (
                            <p className="text-sm text-gray-600 mb-3">{course.description}</p>
                          )}
                          
                          {/* Course badge */}
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: courseColor }}
                            ></div>
                            <span
                              className="px-3 py-1 rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: courseColor }}
                            >
                              ID: {course.id}
                            </span>
                          </div>
                        </div>
                        
                        {/* Content */}
                        <div className="p-6 flex-grow">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-600">{t('admin.courses.associatedSubjects')}</span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              courseSubjects.length > 0 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {courseSubjects.length}
                            </span>
                          </div>
                          
                          {courseSubjects.length > 0 ? (
                            <div className="space-y-2 max-h-24 overflow-y-auto">
                              {courseSubjects.map(subject => (
                                <div key={subject.id} className="flex items-center text-sm text-gray-600">
                                  <div
                                    className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                                    style={{ backgroundColor: courseColor }}
                                  ></div>
                                  <span className="truncate">{subject.name}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4">
                              <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <p className="text-xs text-gray-400 mb-2">{t('admin.courses.noSubjectsAssociated')}</p>
                              <button
                                onClick={() => handleEditCourse(course)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                {t('admin.courses.addSubjects')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('admin.courses.noCoursesFound')}</h3>
                <p className="text-gray-500 mb-8">
                  {searchTerm 
                    ? t('admin.courses.noSearchResults') 
                    : t('admin.courses.noCoursesInSystem')
                  }
                </p>
                <div className="flex justify-center space-x-4">
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {t('admin.courses.clearSearch')}
                    </button>
                  )}
                  <button
                    onClick={handleAddCourse}
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 font-semibold"
                  >
                    <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    {courses.length === 0 ? t('admin.courses.addFirstCourse') : t('admin.courses.addNewCourse')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Modal per aggiungere/modificare un corso */}
      {showModal && (
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {isEditing ? t('admin.courses.editCourse') : t('admin.courses.newCourse')}
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
                      {t('admin.courses.courseName')} *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formName}
                      onChange={handleInputChange}
                      required
                      placeholder={t('admin.courses.courseNamePlaceholder')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.courses.description')} ({t('admin.courses.optional')})
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formDescription}
                      onChange={handleInputChange}
                      rows={3}
                      placeholder={t('admin.courses.descriptionPlaceholder')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  
                  {/* ✅ NUOVO CAMPO COLORE */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      {t('admin.courses.courseColor')}
                    </label>
                    <div className="space-y-4">
                      {/* Color Picker */}
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          id="color"
                          name="color"
                          value={formColor}
                          onChange={handleInputChange}
                          className="h-10 w-16 rounded-lg border border-gray-300 cursor-pointer"
                        />
                        <div className="flex-1">
                          <input
                            type="text"
                            value={formColor}
                            onChange={handleInputChange}
                            name="color"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="#3498db"
                          />
                        </div>
                      </div>
                      
                      {/* Predefined Colors */}
                      <div>
                        <p className="text-xs text-gray-500 mb-2">{t('admin.courses.predefinedColors')}:</p>
                        <div className="grid grid-cols-5 gap-2">
                          {predefinedColors.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setFormColor(color)}
                              className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${
                                formColor === color ? 'border-gray-800 shadow-lg' : 'border-gray-300'
                              }`}
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                      
                      {/* Preview */}
                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: formColor }}
                        ></div>
                        <span
                          className="px-3 py-1 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: formColor }}
                        >
                          {t('admin.courses.coursePreview')}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.courses.subjectsToAssociate')} ({selectedSubjects.length} {t('admin.courses.selected')})
                    </label>
                    {availableSubjects.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="space-y-2">
                          {availableSubjects.map(subject => (
                            <label key={subject.id} className="flex items-center p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={selectedSubjects.includes(subject.id)}
                                onChange={() => toggleSubjectSelection(subject.id)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="ml-3 text-sm text-gray-700">{subject.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
                        <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-sm text-gray-500 mb-1">{t('admin.courses.noSubjectsAvailable')}</p>
                        <p className="text-xs text-gray-400">{t('admin.courses.createSubjectsFirst')}</p>
                      </div>
                    )}
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
                      disabled={submitting}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white inline" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {t('admin.courses.saving')}...
                        </>
                      ) : (
                        isEditing ? t('admin.courses.updateCourse') : t('admin.courses.createCourse')
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal di conferma eliminazione */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteCourse}
        title={t('admin.courses.confirmDelete')}
        itemName={deletingCourse?.name || ''}
        itemType={t('admin.courses.courseType')}
        description={t('admin.courses.deleteDescription')}
        isDeleting={submitting}
        additionalWarning={t('admin.courses.deleteWarning')}
      />
    </div>
  );
};

export default CoursesPanel;