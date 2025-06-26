// frontend/src/components/admin/LessonsPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  getLessons, 
  getCourses, 
  getSubjects, 
  getClassrooms,
  createLesson, 
  updateLesson, 
  deleteLesson 
} from '../../services/api';
import type { Lesson, Course, Subject, Classroom } from '../../services/api';

const LessonsPanel: React.FC = () => {
  const { t } = useTranslation();
  
  // Stati per i dati
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // Stati per i form e modali
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [lessonToDelete, setLessonToDelete] = useState<Lesson | null>(null);
  const [filteredSubjects, setFilteredSubjects] = useState<Subject[]>([]);
  const [currentLesson, setCurrentLesson] = useState<Partial<Lesson>>({
    id: undefined,
    name: '',
    lesson_date: new Date().toISOString().split('T')[0] + 'T09:00',
    classroom_id: 0,
    course_id: 0,
    subject_id: undefined
  });
  
  // Stato per l'analisi delle presenze
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState<boolean>(false);
  const [lessonToAnalyze, setLessonToAnalyze] = useState<Lesson | null>(null);
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState<boolean>(false);
  const [directoryInfo, setDirectoryInfo] = useState<any>({
    directories: {
      images: { files: [] },
      reports: { files: [] }
    }
  });
  
  // Stato per la ricerca e filtri
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  
  // Carica i dati
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [lessonsData, coursesData, subjectsData, classroomsData] = await Promise.all([
        getLessons(),
        getCourses(),
        getSubjects(),
        getClassrooms()
      ]);
      
      console.log(t('admin.lessons.dataLoaded'), {
        lessons: lessonsData,
        courses: coursesData,
        subjects: subjectsData,
        classrooms: classroomsData
      });
      
      if (!coursesData || coursesData.length === 0) {
        setError(t('admin.lessons.errors.noCoursesAvailable'));
        setLoading(false);
        return;
      }
      
      if (!classroomsData || classroomsData.length === 0) {
        setError(t('admin.lessons.errors.noClassroomsAvailable'));
        setLoading(false);
        return;
      }
      
      setLessons(lessonsData || []);
      setCourses(coursesData);
      setSubjects(subjectsData || []);
      setClassrooms(classroomsData);
      
      setCurrentLesson(prev => ({
        ...prev,
        course_id: coursesData[0].id,
        classroom_id: classroomsData[0].id
      }));
  
      setFilteredSubjects(
        subjectsData.filter(subject => subject.course_id === coursesData[0].id)
      );
    } catch (err) {
      console.error(t('admin.lessons.errors.dataLoadingError'), err);
      setError(t('admin.lessons.errors.unableToLoadData'));
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };
  
  useEffect(() => {
    if (info) {
      const timer = setTimeout(() => {
        setInfo(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [info]);
  
  // Filtra le lezioni
  const filteredLessons = lessons.filter(lesson => {
    const matchesSearch = lesson.name 
      ? lesson.name.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    const matchesCourse = selectedCourseId === null || lesson.course_id === selectedCourseId;
    return matchesSearch && matchesCourse;
  });
  
  // Funzioni di supporto
  const getCourseName = (courseId: number): string => {
    const course = courses.find(c => c.id === courseId);
    return course ? course.name : t('admin.lessons.unknownCourse');
  };
  
  const getCourseColor = (courseId: number): string => {
    // ✅ FIX: Uso colori fissi basati sull'ID
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
    return colors[courseId % colors.length];
  };
  
  const getSubjectName = (subjectId?: number): string => {
    if (!subjectId) return t('admin.lessons.noSubject');
    const subject = subjects.find(s => s.id === subjectId);
    return subject ? subject.name : t('admin.lessons.unknownSubject');
  };
  
  const getClassroomName = (classroomId: number): string => {
    const classroom = classrooms.find(c => c.id === classroomId);
    return classroom ? classroom.name : t('admin.lessons.unknownClassroom');
  };
  
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Gestori per i form
  const handleAddLesson = () => {
    setCurrentLesson({
      id: undefined,
      name: '',
      lesson_date: new Date().toISOString().split('T')[0] + 'T09:00',
      classroom_id: classrooms.length > 0 ? classrooms[0].id : 0,
      course_id: courses.length > 0 ? courses[0].id : 0,
      subject_id: undefined
    });
    
    if (courses.length > 0) {
      setFilteredSubjects(
        subjects.filter(subject => subject.course_id === courses[0].id)
      );
    }
    
    setIsEditing(false);
    setIsFormOpen(true);
  };
  
  const handleEditLesson = (lesson: Lesson) => {
    const date = new Date(lesson.lesson_date);
    const formattedDate = date.toISOString().substring(0, 16);
    
    setCurrentLesson({
      id: lesson.id,
      name: lesson.name || '',
      lesson_date: formattedDate,
      classroom_id: lesson.classroom_id,
      course_id: lesson.course_id,
      subject_id: lesson.subject_id
    });
    
    setFilteredSubjects(
      subjects.filter(subject => subject.course_id === lesson.course_id)
    );
    
    setIsEditing(true);
    setIsFormOpen(true);
  };
  
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setError(null);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'course_id') {
      const courseId = parseInt(value, 10);
      setFilteredSubjects(
        subjects.filter(subject => subject.course_id === courseId)
      );
      setCurrentLesson({
        ...currentLesson,
        course_id: courseId,
        subject_id: undefined
      });
    } else {
      setCurrentLesson({
        ...currentLesson,
        [name]: name === 'classroom_id' || name === 'subject_id' 
          ? (value ? parseInt(value, 10) : undefined) 
          : value
      });
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!currentLesson.lesson_date || !currentLesson.classroom_id || !currentLesson.course_id) {
        setError(t('admin.lessons.errors.requiredFields'));
        return;
      }
      
      const formattedLesson = {
        ...currentLesson,
        lesson_date: new Date(currentLesson.lesson_date).toISOString()
      };
      
      console.log(t('admin.lessons.sendingLessonData'), formattedLesson);
      
      if (isEditing && currentLesson.id !== undefined) {
        await updateLesson(currentLesson.id, formattedLesson);
        setInfo(t('admin.lessons.messages.lessonUpdated'));
      } else {
        await createLesson(formattedLesson);
        setInfo(t('admin.lessons.messages.lessonCreated'));
      }
      
      await fetchData();
      handleCloseForm();
    } catch (err) {
      console.error(t('admin.lessons.errors.savingError'), err);
      setError(t('admin.lessons.errors.lessonSavingError'));
    }
  };
  
  // Gestori per l'eliminazione
  const handleDeleteConfirmation = (lesson: Lesson) => {
    setLessonToDelete(lesson);
    setIsDeleteModalOpen(true);
  };
  
  const handleDeleteLesson = async () => {
    if (!lessonToDelete) return;
    
    try {
      await deleteLesson(lessonToDelete.id);
      await fetchData();
      setIsDeleteModalOpen(false);
      setLessonToDelete(null);
      setInfo(t('admin.lessons.messages.lessonDeleted'));
    } catch (err) {
      console.error(t('admin.lessons.errors.deletionError'), err);
      setError(t('admin.lessons.errors.lessonDeletionError'));
    }
  };
  
  // Gestori per analisi presenze
  const handleViewDirectories = async (lesson: Lesson) => {
    try {
      setLoading(true);
      setError(null);
      
      const backendUrl = 'http://localhost:4321';
      const token = localStorage.getItem('token');
      if (!token) {
        setError(t('admin.lessons.errors.authTokenMissing'));
        return;
      }
      
      console.log(t('admin.lessons.retrievingDirectories', { lessonId: lesson.id }));
      
      const response = await fetch(`${backendUrl}/api/lessons/directory-info/${lesson.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      console.log(t('admin.lessons.responseStatus', { status: response.status, statusText: response.statusText }));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(t('admin.lessons.errorResponse'), errorText);
        throw new Error(t('admin.lessons.errors.httpError', { status: response.status, statusText: response.statusText }));
      }
      
      try {
        const data = await response.json();
        console.log(t('admin.lessons.dataReceived'), data);
        setDirectoryInfo(data);
        setLessonToAnalyze(lesson);
        setIsDirectoryModalOpen(true);
      } catch (jsonError) {
        console.error(t('admin.lessons.errors.jsonParsingError'), jsonError);
        throw new Error(t('admin.lessons.errors.invalidJsonResponse'));
      }
    } catch (err: unknown) {
      console.error(t('admin.lessons.errors.directoryInfoError'), err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t('admin.lessons.errors.unknownError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDirectories = async (lesson: Lesson) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/lessons/create-directories/${lesson.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(t('admin.lessons.errors.directoryCreationError'));
      }
      
      const data = await response.json();
      
      if (data.success) {
        setInfo(t('admin.lessons.messages.directoriesCreated', { path: data.paths.images }));
        handleViewDirectories(lesson);
      } else {
        throw new Error(data.message || t('admin.lessons.errors.directoryCreationError'));
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t('admin.lessons.errors.unknownError'));
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleAnalyzeAttendance = async (lesson: Lesson) => {
    try {
      setIsAnalyzing(true);
      setAnalysisResult(null);
      setError(null);
      setLessonToAnalyze(lesson);
      setIsAnalysisModalOpen(true);
      
      const backendUrl = 'http://localhost:4321';
      const token = localStorage.getItem('token');
      if (!token) {
        setError(t('admin.lessons.errors.authTokenMissing'));
        setIsAnalyzing(false);
        return;
      }
      
      console.log(t('admin.lessons.startingAttendanceAnalysis', { lessonId: lesson.id }));
      
      const dirResponse = await fetch(`${backendUrl}/api/lessons/directory-info/${lesson.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!dirResponse.ok) {
        throw new Error(t('admin.lessons.errors.directoryInfoRetrievalError'));
      }
      
      const dirData = await dirResponse.json();
      
      if (dirData.directories.images.fileCount === 0) {
        setError(t('admin.lessons.errors.noImagesInDirectory', { path: dirData.directories.images.path }));
        setIsAnalyzing(false);
        return;
      }
      
      const analyzeResponse = await fetch(`${backendUrl}/api/lessons/${lesson.id}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!analyzeResponse.ok) {
        const errorText = await analyzeResponse.text();
        console.error(t('admin.lessons.errorResponse'), errorText);
        throw new Error(t('admin.lessons.errors.analysisCompletionError', { status: analyzeResponse.status }));
      }
      
      try {
        const analysisData = await analyzeResponse.json();
        setAnalysisResult(analysisData);
        setInfo(t('admin.lessons.messages.analysisCompleted'));
      } catch (jsonError) {
        console.error(t('admin.lessons.errors.jsonParsingError'), jsonError);
        throw new Error(t('admin.lessons.errors.invalidJsonResponse'));
      }
    } catch (err: unknown) {
      console.error(t('admin.lessons.errors.attendanceAnalysisError'), err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t('admin.lessons.errors.unknownError'));
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Calcola statistiche
  const todayLessons = lessons.filter(lesson => {
    const today = new Date().toISOString().split('T')[0];
    const lessonDate = new Date(lesson.lesson_date).toISOString().split('T')[0];
    return lessonDate === today;
  }).length;

  const futureLessons = lessons.filter(lesson => {
    const now = new Date();
    const lessonDate = new Date(lesson.lesson_date);
    return lessonDate > now;
  }).length;

  const pastLessons = lessons.filter(lesson => {
    const now = new Date();
    const lessonDate = new Date(lesson.lesson_date);
    return lessonDate < now;
  }).length;
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex justify-center items-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <h3 className="text-xl font-semibold text-gray-700">{t('admin.lessons.loading.title')}</h3>
          <p className="text-gray-500 mt-2">{t('admin.lessons.loading.subtitle')}</p>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">{t('admin.lessons.title')}</h1>
                <p className="text-gray-600">{t('admin.lessons.subtitle')}</p>
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
                <span>{refreshing ? t('common.refreshing') : t('common.refresh')}</span>
              </button>

              <button
                onClick={handleAddLesson}
                className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-2.5 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200 shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold">{t('admin.lessons.actions.newLesson')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-6 py-8">
        {/* Messaggi di stato */}
        {info && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-green-700 font-medium">{info}</span>
              </div>
              <button
                onClick={() => setInfo(null)}
                className="text-green-500 hover:text-green-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.lessons.stats.totalLessons')}</p>
                <p className="text-3xl font-bold text-gray-800">{lessons.length}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-xl">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.lessons.stats.today')}</p>
                <p className="text-3xl font-bold text-gray-800">{todayLessons}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-xl">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.lessons.stats.future')}</p>
                <p className="text-3xl font-bold text-gray-800">{futureLessons}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-xl">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.lessons.stats.completed')}</p>
                <p className="text-3xl font-bold text-gray-800">{pastLessons}</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-xl">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        {/* Search e Filtri */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-8">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-indigo-100 p-2 rounded-lg">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800">{t('admin.lessons.search.title')}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.lessons.search.searchLesson')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-3 flex items-center pl-4 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path>
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder={t('admin.lessons.search.searchPlaceholder')}
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
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.lessons.search.filterByCourse')}</label>
                <select
                  value={selectedCourseId || ''}
                  onChange={(e) => setSelectedCourseId(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">{t('admin.lessons.search.allCourses')}</option>
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
        
        {error && !info && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-red-700 font-medium">{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      
        {/* Lista lezioni */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800">{t('admin.lessons.list.title')}</h3>
              </div>
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
                {t('admin.lessons.list.lessonCount', { count: filteredLessons.length })}
              </span>
            </div>
          </div>
          
          <div className="p-6">
            {filteredLessons.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredLessons.map(lesson => (
                  <div
                    key={lesson.id}
                    className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl hover:scale-105 transition-all duration-300"
                    style={{ borderTop: `4px solid ${getCourseColor(lesson.course_id)}` }}
                  >
                    {/* Header della card */}
                    <div className="p-6 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                      <div className="flex items-center space-x-3 mb-3">
                        <h3 className="text-lg font-bold text-gray-800 leading-tight">
                          {lesson.name || t('admin.lessons.list.lessonOfDate', { date: formatDate(lesson.lesson_date) })}
                        </h3>
                      </div>
                      
                      {/* Corso prominente */}
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: getCourseColor(lesson.course_id) }}
                        ></div>
                        <span className="text-sm font-semibold text-gray-700">
                          {getCourseName(lesson.course_id)}
                        </span>
                      </div>
                    </div>

                    {/* Contenuto principale */}
                    <div className="p-6">
                      {/* Informazioni in griglia 2x2 */}
                      <div className="flex flex-col md:grid md:grid-cols-2 gap-4 mb-6">
                        <div className="flex items-center p-3 bg-orange-50 rounded-lg">
                          <svg className="w-5 h-5 text-orange-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-600 mb-1">{t('admin.lessons.list.classroom')}</p>
                            <p className="text-sm text-orange-700 font-semibold">
                              {getClassroomName(lesson.classroom_id)}
                            </p>
                          </div>
                        </div>                    
                        <div className="flex items-center p-3 bg-purple-50 rounded-lg">
                          <svg className="w-5 h-5 text-purple-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-600 mb-1">{t('admin.lessons.list.subject')}</p>
                            <p className="text-sm text-purple-700 font-semibold truncate">
                              {getSubjectName(lesson.subject_id)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center p-3 bg-blue-50 rounded-lg col-span-2">
                          <svg className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-600 mb-1">{t('admin.lessons.list.dateTime')}</p>
                            <p className="text-sm text-blue-700 font-semibold truncate">
                              {formatDate(lesson.lesson_date)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Azioni */}
                      <div className="space-y-3">
                        {/* Azioni principali */}
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => handleAnalyzeAttendance(lesson)}
                            className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200 text-sm font-semibold"
                            title={t('admin.lessons.actions.analyzeAttendance')}
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            {t('admin.lessons.actions.analyze')}
                          </button>
                          
                          <button
                            onClick={() => handleViewDirectories(lesson)}
                            className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200 text-sm font-semibold"
                            title={t('admin.lessons.actions.viewDirectories')}
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            {t('admin.lessons.actions.directory')}
                          </button>
                        </div>
                        
                        {/* Azioni secondarie */}
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => handleEditLesson(lesson)}
                            className="flex items-center justify-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                            title={t('admin.lessons.actions.editLesson')}
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            {t('common.edit')}
                          </button>
                          
                          <button
                            onClick={() => handleDeleteConfirmation(lesson)}
                            className="flex items-center justify-center px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                            title={t('admin.lessons.actions.deleteLesson')}
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            {t('common.delete')}
                          </button>
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('admin.lessons.empty.noLessonsFound')}</h3>
                <p className="text-gray-500 mb-8">
                  {searchTerm || selectedCourseId 
                    ? t('admin.lessons.empty.noSearchResults')
                    : t('admin.lessons.empty.noLessonsInSystem')
                  }
                </p>
                <div className="flex justify-center space-x-4">
                  {(searchTerm || selectedCourseId) && (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedCourseId(null);
                      }}
                      className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {t('admin.lessons.search.clearFilters')}
                    </button>
                  )}
                  <button
                    onClick={handleAddLesson}
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 font-semibold"
                  >
                    <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    {lessons.length === 0 ? t('admin.lessons.empty.addFirstLesson') : t('admin.lessons.empty.addNewLesson')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Modal Form Lezione */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity backdrop-blur-sm"></div>
            
            <div className="relative bg-white rounded-2xl shadow-2xl transform transition-all sm:max-w-lg sm:w-full">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-xl">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {isEditing ? t('admin.lessons.form.editTitle') : t('admin.lessons.form.newTitle')}
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
                      {t('admin.lessons.form.nameLabel')}
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={currentLesson.name || ''}
                      onChange={handleInputChange}
                      placeholder={t('admin.lessons.form.namePlaceholder')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="lesson_date" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.lessons.form.dateTimeLabel')}
                    </label>
                    <input
                      type="datetime-local"
                      id="lesson_date"
                      name="lesson_date"
                      value={currentLesson.lesson_date}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="course_id" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.lessons.form.courseLabel')}
                    </label>
                    <select
                      id="course_id"
                      name="course_id"
                      value={currentLesson.course_id || ''}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                      <option value="">{t('admin.lessons.form.selectCourse')}</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="subject_id" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.lessons.form.subjectLabel')}
                    </label>
                    <select
                      id="subject_id"
                      name="subject_id"
                      value={currentLesson.subject_id || ''}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                      <option value="">{t('admin.lessons.form.selectSubject')}</option>
                      {filteredSubjects.map(subject => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="classroom_id" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('admin.lessons.form.classroomLabel')}
                    </label>
                    <select
                      id="classroom_id"
                      name="classroom_id"
                      value={currentLesson.classroom_id || ''}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                      <option value="">{t('admin.lessons.form.selectClassroom')}</option>
                      {classrooms.map(classroom => (
                        <option key={classroom.id} value={classroom.id}>
                          {classroom.name}
                        </option>
                      ))}
                    </select>
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
                      {isEditing ? t('admin.lessons.form.updateLesson') : t('admin.lessons.form.createLesson')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal eliminazione */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity backdrop-blur-sm"></div>
            
            <div className="relative bg-white rounded-2xl shadow-2xl transform transition-all sm:max-w-lg sm:w-full">
              <div className="p-6">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-16 w-16 rounded-full bg-red-100 sm:mx-0 sm:h-12 sm:w-12">
                    <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-xl leading-6 font-bold text-gray-900 mb-2">
                      {t('admin.lessons.deleteConfirmation.title')}
                    </h3>
                    <div className="mt-4">
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {t('admin.lessons.deleteConfirmation.message', {
                          lessonName: lessonToDelete?.name || t('admin.lessons.list.lessonOfDate', {
                            date: lessonToDelete ? formatDate(lessonToDelete.lesson_date) : ''
                          })
                        })}
                      </p>
                      <p className="text-sm text-red-600 mt-3 font-medium">
                        {t('admin.lessons.deleteConfirmation.warning')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 sm:flex sm:flex-row-reverse sm:gap-3">
                <button
                  onClick={handleDeleteLesson}
                  className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-lg px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-base font-semibold text-white hover:shadow-xl hover:scale-105 transition-all duration-200 sm:w-auto sm:text-sm"
                >
                  {t('admin.lessons.deleteConfirmation.deleteButton')}
                </button>
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-6 py-3 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors sm:mt-0 sm:w-auto sm:text-sm"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Directory */}
      {isDirectoryModalOpen && directoryInfo && directoryInfo.directories && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity backdrop-blur-sm"></div>
            
            <div className="relative bg-white rounded-2xl shadow-2xl transform transition-all sm:max-w-4xl sm:w-full max-h-screen overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-xl">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">{t('admin.lessons.directory.title')}</h3>
                  </div>
                  <button
                    onClick={() => setIsDirectoryModalOpen(false)}
                    className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-6">
                  {/* Header lezione */}
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-blue-900">
                      {directoryInfo.lesson_name || t('admin.lessons.directory.lessonId', { id: directoryInfo.lesson_id })}
                    </h3>
                    <p className="text-blue-700">{t('admin.lessons.directory.course')}: {directoryInfo.course_name}</p>
                    <p className="text-blue-600 text-sm">{t('admin.lessons.directory.lessonIdLabel')}: {directoryInfo.lesson_id}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Directory Immagini */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h4 className="text-lg font-semibold mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {t('admin.lessons.directory.imagesDirectory')}
                      </h4>
                      
                      <div className="bg-gray-50 p-3 rounded-lg mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-mono text-gray-700 break-all">
                            {directoryInfo.directories.images.path}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(directoryInfo.directories.images.path);
                              setInfo(t('admin.lessons.directory.pathCopied'));
                            }}
                            className="ml-2 p-1 text-gray-500 hover:text-gray-700"
                            title={t('admin.lessons.directory.copyPath')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      
                      {directoryInfo.directories.images.fileCount > 0 ? (
                        <div>
                          <div className="flex items-center mb-3">
                            <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="font-medium text-green-700">
                              {t('admin.lessons.directory.imagesFound', { count: directoryInfo.directories.images.fileCount })}
                            </span>
                          </div>
                          <div className="max-h-32 overflow-y-auto bg-gray-50 p-3 rounded">
                            {directoryInfo.directories.images.files.map((file: string, index: number) => (
                              <div key={index} className="text-sm text-gray-600 py-1">
                                📷 {file}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                          <p className="text-yellow-700 text-sm">
                            {t('admin.lessons.directory.noImagesFound')}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Directory Report */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h4 className="text-lg font-semibold mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        {t('admin.lessons.directory.reportsDirectory')}
                      </h4>
                      
                      <div className="bg-gray-50 p-3 rounded-lg mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-mono text-gray-700 break-all">
                            {directoryInfo.directories.reports.path}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(directoryInfo.directories.reports.path);
                              setInfo(t('admin.lessons.directory.pathCopied'));
                            }}
                            className="ml-2 p-1 text-gray-500 hover:text-gray-700"
                            title={t('admin.lessons.directory.copyPath')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      
                      {directoryInfo.directories.reports.fileCount > 0 ? (
                        <div>
                          <div className="flex items-center mb-3">
                            <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="font-medium text-green-700">
                              {t('admin.lessons.directory.reportsFound', { count: directoryInfo.directories.reports.fileCount })}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 border-l-4 border-gray-400 p-3 rounded">
                          <p className="text-gray-600 text-sm">
                            {t('admin.lessons.directory.noReportsGenerated')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Istruzioni */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold mb-3 flex items-center text-blue-900">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t('admin.lessons.directory.instructions')}
                    </h4>
                    <ol className="list-decimal pl-6 space-y-2 text-blue-800">
                      <li>{t('admin.lessons.directory.instruction1')}</li>
                      <li>{t('admin.lessons.directory.instruction2')}</li>
                      <li>{t('admin.lessons.directory.instruction3')}</li>
                    </ol>
                  </div>
                </div>
                
                <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => handleViewDirectories(lessonToAnalyze!)}
                    disabled={loading}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {t('admin.lessons.directory.updateButton')}
                  </button>
                  
                  <div className="space-x-3">
                    <button
                      onClick={() => handleCreateDirectories(lessonToAnalyze!)}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      {t('admin.lessons.directory.recreateButton')}
                    </button>
                    
                    {directoryInfo.directories.images.fileCount > 0 && (
                      <button
                        onClick={() => {
                          setIsDirectoryModalOpen(false);
                          if (lessonToAnalyze) {
                            handleAnalyzeAttendance(lessonToAnalyze);
                          }
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all"
                      >
                        {t('admin.lessons.directory.analyzeButton')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Analisi */}
      {isAnalysisModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity backdrop-blur-sm"></div>
            
            <div className="relative bg-white rounded-2xl shadow-2xl transform transition-all sm:max-w-4xl sm:w-full max-h-screen overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className={`p-3 rounded-xl ${
                      isAnalyzing ? 'bg-blue-100' : error ? 'bg-red-100' : 'bg-green-100'
                    }`}>
                      {isAnalyzing ? (
                        <svg className="w-6 h-6 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : error ? (
                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {isAnalyzing ? t('admin.lessons.analysis.analyzing') : error ? t('admin.lessons.analysis.error') : t('admin.lessons.analysis.completed')}
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsAnalysisModalOpen(false)}
                    disabled={isAnalyzing}
                    className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-6">
                  {isAnalyzing ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                      <h3 className="text-xl font-semibold text-gray-700 mb-2">{t('admin.lessons.analysis.inProgress')}</h3>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                        <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                      </div>
                      <p className="text-gray-600 max-w-lg mx-auto">
                        {t('admin.lessons.analysis.processingDescription')}
                      </p>
                    </div>
                  ) : error ? (
                    <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg">
                      <h3 className="text-lg font-medium text-red-800 mb-2">{t('admin.lessons.analysis.errorTitle')}</h3>
                      <p className="text-red-700">{error}</p>
                    </div>
                  ) : analysisResult ? (
                    <div className="space-y-6">
                      <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg">
                        <h3 className="text-lg font-medium text-green-800">{t('admin.lessons.analysis.completedTitle')}</h3>
                        <p className="text-green-700">{t('admin.lessons.analysis.completedDescription')}</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {analysisResult.results.imagesCount}
                            </div>
                            <div className="text-sm text-gray-600">{t('admin.lessons.analysis.imagesAnalyzed')}</div>
                          </div>
                        </div>
                        
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="text-center">
                            <div className="text-lg font-semibold text-green-600">
                              {analysisResult.results.courseName}
                            </div>
                            <div className="text-sm text-gray-600">{t('admin.lessons.analysis.course')}</div>
                          </div>
                        </div>
                        
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="text-center">
                            <div className="text-lg font-semibold text-purple-600">
                              {analysisResult.results.lessonName}
                            </div>
                            <div className="text-sm text-gray-600">{t('admin.lessons.analysis.lesson')}</div>
                          </div>
                        </div>
                      </div>
                      
                      {analysisResult.results.results && (
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                          <h4 className="text-lg font-semibold mb-4">{t('admin.lessons.analysis.detailResults')}</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.lessons.analysis.image')}</th>
                                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">{t('admin.lessons.analysis.faces')}</th>
                                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">{t('admin.lessons.analysis.recognized')}</th>
                                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">{t('admin.lessons.analysis.status')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {analysisResult.results.results.map((result: any, index: number) => (
                                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-4 py-2 font-medium">{result.imageFile}</td>
                                    <td className="px-4 py-2 text-center">
                                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                                        {result.detectedFaces}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                                        {result.recognizedStudents}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      {result.error ? (
                                        <span className="text-red-500">{t('admin.lessons.analysis.statusError')}</span>
                                      ) : (
                                        <span className="text-green-500">{t('admin.lessons.analysis.statusCompleted')}</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-600">{t('admin.lessons.analysis.noDataAvailable')}</p>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end mt-8 pt-6 border-t border-gray-200 space-x-3">
                  <button
                    onClick={() => setIsAnalysisModalOpen(false)}
                    disabled={isAnalyzing}
                    className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    {t('common.close')}
                  </button>
                  
                  {analysisResult && (
                    <button
                      onClick={() => {
                        setIsAnalysisModalOpen(false);
                        window.location.href = `/admin/attendance?lessonId=${lessonToAnalyze?.id}`;
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                    >
                      {t('admin.lessons.analysis.viewAttendance')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonsPanel;