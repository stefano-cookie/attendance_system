import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  getLessons, 
  getCourses, 
  getSubjects, 
  getClassrooms,
  createLesson, 
  updateLesson, 
  getTeachers
} from '../../services/api';
import type { Lesson, Course, Subject, Classroom, User } from '../../services/api';
import LessonsCalendar from './LessonsCalendar';
import LessonModal from './LessonModal';


const LessonsPanel: React.FC = () => {
  const { t } = useTranslation();
  
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [isLessonModalOpen, setIsLessonModalOpen] = useState<boolean>(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(undefined);
  const [defaultHour, setDefaultHour] = useState<number>(9);
  
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState<boolean>(false);
  const [lessonToAnalyze, setLessonToAnalyze] = useState<Lesson | null>(null);
  
  const [isCaptureAnalyzing, setIsCaptureAnalyzing] = useState<boolean>(false);
  const [currentCaptureStage, setCurrentCaptureStage] = useState<number>(0);
  const [captureAnalysisResult, setCaptureAnalysisResult] = useState<any | null>(null);
  const [isCaptureAnalysisModalOpen, setIsCaptureAnalysisModalOpen] = useState<boolean>(false);
  
  const [isImagesModalOpen, setIsImagesModalOpen] = useState<boolean>(false);
  const [lessonImages, setLessonImages] = useState<any[]>([]);
  const [loadingImages, setLoadingImages] = useState<boolean>(false);
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState<boolean>(false);
  const [directoryInfo, setDirectoryInfo] = useState<any>({
    directories: {
      images: { files: [] },
      reports: { files: [] }
    }
  });
  
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [lessonsData, coursesData, subjectsData, classroomsData, teachersData] = await Promise.all([
        getLessons(),
        getCourses(),
        getSubjects(),
        getClassrooms(),
        getTeachers()
      ]);
      
      console.log(t('admin.lessons.dataLoaded'), {
        lessons: lessonsData,
        courses: coursesData,
        subjects: subjectsData,
        classrooms: classroomsData,
        teachers: teachersData
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
      setTeachers(teachersData || []);
      
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

  
  const filteredLessons = lessons.filter(lesson => {
    const matchesSearch = lesson.name 
      ? lesson.name.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    const matchesCourse = selectedCourseId === null || lesson.course_id === selectedCourseId;
    return matchesSearch && matchesCourse;
  });
  
  const getCourseName = (courseId: number): string => {
    const course = courses.find(c => c.id === courseId);
    return course ? course.name : t('admin.lessons.unknownCourse');
  };
  
  const getCourseColor = (courseId: number): string => {
    const course = courses.find(c => c.id === courseId);
    if (course && course.color) {
      return course.color;
    }
    // Fallback colors if course color is not available
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
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Lesson state management functions
  const getLessonTiming = (lesson: Lesson) => {
    const now = new Date();
    
    // Use lesson_start and lesson_end if available, otherwise use default times
    const startTime = lesson.lesson_start ? 
      new Date(`${lesson.lesson_date}T${lesson.lesson_start}`) : 
      new Date(`${lesson.lesson_date}T09:00:00`); // Default start time
    
    const endTime = lesson.lesson_end ? 
      new Date(`${lesson.lesson_date}T${lesson.lesson_end}`) : 
      new Date(`${lesson.lesson_date}T10:00:00`); // Default end time (1 hour later)
    
    return { startTime, endTime, now };
  };

  const getLessonStatus = (lesson: Lesson) => {
    // Check if lesson is manually completed
    if (lesson.is_completed || lesson.status === 'completed') {
      return 'completed';
    }
    
    const { startTime, endTime, now } = getLessonTiming(lesson);
    
    if (now < startTime) {
      return 'not_started';
    } else if (now >= startTime && now <= endTime) {
      return 'in_progress';
    } else {
      return 'ended'; // Time has passed but not manually completed
    }
  };

  const canCapturePhotos = (lesson: Lesson) => {
    const status = getLessonStatus(lesson);
    return status === 'in_progress';
  };

  const getLessonStatusText = (lesson: Lesson) => {
    const status = getLessonStatus(lesson);
    switch (status) {
      case 'not_started':
        return t('admin.lessons.status.notStarted');
      case 'in_progress':
        return t('admin.lessons.status.inProgress');
      case 'completed':
        return t('admin.lessons.status.completed');
      case 'ended':
        return t('admin.lessons.status.ended');
      default:
        return t('admin.lessons.status.unknown');
    }
  };

  const getLessonStatusColor = (lesson: Lesson) => {
    const status = getLessonStatus(lesson);
    switch (status) {
      case 'not_started':
        return 'text-gray-600 bg-gray-100';
      case 'in_progress':
        return 'text-green-700 bg-green-100';
      case 'completed':
        return 'text-blue-700 bg-blue-100';
      case 'ended':
        return 'text-orange-700 bg-orange-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const handleLessonClick = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setIsLessonModalOpen(true);
  };

  const handleTimeSlotClick = (date: Date, hour: number) => {
    setSelectedLesson(null);
    setDefaultDate(date);
    setDefaultHour(hour);
    setIsLessonModalOpen(true);
  };

  // Funzione per verificare sovrapposizioni in aula
  const checkClassroomOverlap = (lessonData: any) => {
    if (!lessonData.lesson_start || !lessonData.lesson_end) {
      return []; // Se non ci sono orari definiti, non può esserci conflitto
    }

    const lessonStart = new Date(`${lessonData.lesson_date}T${lessonData.lesson_start}`);
    const lessonEnd = new Date(`${lessonData.lesson_date}T${lessonData.lesson_end}`);
    
    const overlappingLessons = lessons.filter(existingLesson => {
      // Salta la lezione corrente se stiamo modificando
      if (lessonData.id && existingLesson.id === lessonData.id) {
        return false;
      }
      
      // Controlla solo la stessa aula
      if (existingLesson.classroom_id !== lessonData.classroom_id) {
        return false;
      }

      // Controlla solo lezioni dello stesso giorno
      const existingDate = new Date(existingLesson.lesson_date).toISOString().split('T')[0];
      const newLessonDate = new Date(lessonData.lesson_date).toISOString().split('T')[0];
      if (existingDate !== newLessonDate) {
        return false;
      }
      
      // Usa lesson_start e lesson_end se disponibili, altrimenti usa tempi di default
      const existingStart = existingLesson.lesson_start 
        ? new Date(`${existingDate}T${existingLesson.lesson_start}`)
        : new Date(`${existingDate}T09:00:00`);
      
      const existingEnd = existingLesson.lesson_end 
        ? new Date(`${existingDate}T${existingLesson.lesson_end}`)
        : new Date(`${existingDate}T10:00:00`);
      
      // Verifica sovrapposizione temporale
      return (
        (lessonStart < existingEnd && lessonEnd > existingStart)
      );
    });
    
    return overlappingLessons;
  };
  
  // Funzione per trovare aule disponibili
  const findAvailableClassrooms = (lessonData: any) => {
    if (!lessonData.lesson_start || !lessonData.lesson_end) {
      return classrooms; // Se non ci sono orari, tutte le aule sono disponibili
    }

    const lessonStart = new Date(`${lessonData.lesson_date}T${lessonData.lesson_start}`);
    const lessonEnd = new Date(`${lessonData.lesson_date}T${lessonData.lesson_end}`);
    
    return classrooms.filter(classroom => {
      const classroomLessons = lessons.filter(lesson => {
        const lessonDate = new Date(lesson.lesson_date).toISOString().split('T')[0];
        const targetDate = new Date(lessonData.lesson_date).toISOString().split('T')[0];
        
        return lesson.classroom_id === classroom.id &&
               lessonDate === targetDate &&
               (!lessonData.id || lesson.id !== lessonData.id);
      });
      
      return !classroomLessons.some(existingLesson => {
        const lessonDateStr = new Date(lessonData.lesson_date).toISOString().split('T')[0];
        const existingStart = existingLesson.lesson_start 
          ? new Date(`${lessonDateStr}T${existingLesson.lesson_start}`)
          : new Date(`${lessonDateStr}T09:00:00`);
        
        const existingEnd = existingLesson.lesson_end 
          ? new Date(`${lessonDateStr}T${existingLesson.lesson_end}`)
          : new Date(`${lessonDateStr}T10:00:00`);
        
        return (lessonStart < existingEnd && lessonEnd > existingStart);
      });
    });
  };

  const handleSaveLesson = async (lessonData: any) => {
    try {
      // Assicurati che lesson_date contenga solo la data (YYYY-MM-DD)
      let processedLessonData = { ...lessonData };
      
      if (lessonData.lesson_date) {
        // Assicurati che lesson_date sia in formato YYYY-MM-DD senza orario
        const dateOnly = new Date(lessonData.lesson_date).toISOString().split('T')[0];
        processedLessonData.lesson_date = dateOnly;
        
        console.log('🕐 Processing lesson data:', {
          original_date: lessonData.lesson_date,
          lesson_start: lessonData.lesson_start,
          lesson_end: lessonData.lesson_end,
          processed_date: processedLessonData.lesson_date
        });
      }
      
      // Verifica sovrapposizioni in aula
      const overlappingLessons = checkClassroomOverlap(processedLessonData);
      
      if (overlappingLessons.length > 0) {
        const classroomName = classrooms.find(c => c.id === processedLessonData.classroom_id)?.name || 'Sconosciuta';
        const overlappingLesson = overlappingLessons[0];
        const overlappingDate = new Date(overlappingLesson.lesson_date).toLocaleDateString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        const overlappingTime = overlappingLesson.lesson_start && overlappingLesson.lesson_end 
          ? `${overlappingLesson.lesson_start} - ${overlappingLesson.lesson_end}`
          : 'orario non specificato';
        
        // Trova aule disponibili
        const availableClassrooms = findAvailableClassrooms(processedLessonData);
        
        let errorMessage = `⚠️ Conflitto in aula "${classroomName}"! Esiste già la lezione "${overlappingLesson.name}" il ${overlappingDate} dalle ${overlappingTime}.`;
        
        if (availableClassrooms.length > 0) {
          const availableNames = availableClassrooms.slice(0, 3).map(c => c.name).join(', ');
          errorMessage += ` Aule disponibili: ${availableNames}${availableClassrooms.length > 3 ? ` e altre ${availableClassrooms.length - 3}...` : ''}`;
        } else {
          errorMessage += ` Nessuna aula disponibile in questo orario.`;
        }
        
        setError(errorMessage);
        return;
      }
      
      console.log('💾 Saving lesson data:', processedLessonData);
      
      if (processedLessonData.id) {
        await updateLesson(processedLessonData.id, processedLessonData);
        setInfo(t('admin.lessons.messages.lessonUpdated'));
      } else {
        await createLesson(processedLessonData);
        setInfo(t('admin.lessons.messages.lessonCreated'));
      }
      await fetchData();
      setIsLessonModalOpen(false);
    } catch (error: any) {
      console.error(t('admin.lessons.errors.savingError'), error);
      setError(error.response?.data?.message || t('admin.lessons.errors.lessonSavingError'));
    }
  };

  const handleCloseModal = () => {
    setIsLessonModalOpen(false);
    setSelectedLesson(null);
    setDefaultDate(undefined);
    setDefaultHour(9);
  };
  
  const handleAddLesson = () => {
    setSelectedLesson(null);
    setDefaultDate(undefined);
    setDefaultHour(9);
    setIsFormOpen(true);
  };
  
  const handleEditLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setDefaultDate(undefined);
    setDefaultHour(9);
    setIsFormOpen(true);
  };
  
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setError(null);
  };
  
  
  const handleViewImages = async (lesson: Lesson) => {
    try {
      setLoadingImages(true);
      setLessonToAnalyze(lesson);
      setIsImagesModalOpen(true);
      
      const backendUrl = 'http://localhost:4321';
      const token = localStorage.getItem('token');
      if (!token) {
        setError(t('admin.lessons.errors.authTokenMissing'));
        setLoadingImages(false);
        return;
      }
      
      const response = await fetch(`${backendUrl}/api/images/lesson/${lesson.id}/list`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(t('admin.lessons.errors.loadingImagesError', { status: response.status }));
      }
      
      const data = await response.json();
      setLessonImages(data.images || []);
      
    } catch (err: unknown) {
      console.error(`❌ ${t('admin.lessons.errors.loadingImagesError', { status: '' })}`, err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t('admin.lessons.errors.unknownErrorDuringImageLoad'));
      }
    } finally {
      setLoadingImages(false);
    }
  };

  const handleCaptureAndAnalyze = async (lesson: Lesson) => {
    try {
      setIsCaptureAnalyzing(true);
      setCurrentCaptureStage(0); // Start with capture phase
      setCaptureAnalysisResult(null);
      setError(null);
      setLessonToAnalyze(lesson);
      setIsCaptureAnalysisModalOpen(true);
      
      console.log(`📸 ${t('admin.lessons.captureAnalysis.captureAnalysisInProgress')} ${lesson.id}`);
      
      const backendUrl = 'http://localhost:4321';
      const token = localStorage.getItem('token');
      if (!token) {
        setError(t('admin.lessons.errors.authTokenMissing'));
        setIsCaptureAnalyzing(false);
        setCurrentCaptureStage(0);
        return;
      }
      
      // Stage 1: Capture (blue)
      setCurrentCaptureStage(0);
      await new Promise(resolve => setTimeout(resolve, 800)); // Minimum time to show capture stage
      
      // Stage 2: Analysis (yellow) - start request
      setCurrentCaptureStage(1);
      
      const response = await fetch(`${backendUrl}/api/admin/lessons/${lesson.id}/capture-and-analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      // Stage 3: Report generation (green)
      setCurrentCaptureStage(2);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ ${t('admin.lessons.errors.invalidServerResponse')}:`, errorText);
        throw new Error(t('admin.lessons.errors.errorDuringCaptureAnalysis', { status: response.status }));
      }
      
      try {
        const data = await response.json();
        setCaptureAnalysisResult(data);
        
        let message = `✅ ${t('admin.lessons.captureAnalysis.captureCompleted')}: ${data.analysis.detected_faces} ${t('admin.lessons.captureAnalysis.facesDetected').toLowerCase()}, ${data.analysis.recognized_students} ${t('admin.lessons.captureAnalysis.studentsRecognized').toLowerCase()}`;
        if (data.lesson_completed) {
          message += `. ${t('admin.lessons.captureAnalysis.lessonCompleted')}`;
        }
        setInfo(message);
        
        // Sempre ricarica i dati dopo uno scatto di successo
        fetchData(); // Ricarica la lista delle lezioni
      } catch (jsonError) {
        console.error(`❌ ${t('admin.lessons.errors.jsonParsingError')}`, jsonError);
        throw new Error(t('admin.lessons.errors.invalidServerResponse'));
      }
    } catch (err: unknown) {
      console.error(`❌ ${t('admin.lessons.errors.errorDuringCaptureAnalysis', { status: '' })}`, err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t('admin.lessons.errors.unknownErrorDuringCaptureAnalysis'));
      }
    } finally {
      setIsCaptureAnalyzing(false);
      setCurrentCaptureStage(0); // Reset stage
    }
  };

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

  const todayLessons = lessons.filter(lesson => {
    const today = new Date().toISOString().split('T')[0];
    const lessonDate = new Date(lesson.lesson_date).toISOString().split('T')[0];
    return lessonDate === today;
  }).length;

  const futureLessons = lessons.filter(lesson => {
    const today = new Date().toISOString().split('T')[0];
    const lessonDate = new Date(lesson.lesson_date).toISOString().split('T')[0];
    return lessonDate > today;
  }).length;

  const pastLessons = lessons.filter(lesson => {
    const today = new Date().toISOString().split('T')[0];
    const lessonDate = new Date(lesson.lesson_date).toISOString().split('T')[0];
    return lessonDate < today;
  }).length;
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex justify-center items-center">
        <div className="text-center bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-700">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <h3 className="text-xl font-semibold text-gray-200">{t('admin.lessons.loading.title')}</h3>
          <p className="text-gray-400 mt-2">{t('admin.lessons.loading.subtitle')}</p>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">{t('admin.lessons.title')}</h1>
                <p className="text-gray-300">{t('admin.lessons.subtitle')}</p>
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
                <span>{refreshing ? t('common.refreshing') : t('common.refresh')}</span>
              </button>

              <button
                onClick={handleAddLesson}
                className="flex items-center space-x-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-2.5 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200 shadow-md"
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
          <div className="mb-6 bg-green-900/20 border-l-4 border-green-500 p-4 rounded-lg shadow border border-green-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-green-300 font-medium">{info}</span>
              </div>
              <button
                onClick={() => setInfo(null)}
                className="text-green-400 hover:text-green-300"
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
          <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">{t('admin.lessons.stats.totalLessons')}</p>
                <p className="text-3xl font-bold text-white">{lessons.length}</p>
              </div>
              <div className="bg-blue-600/20 p-3 rounded-xl">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">{t('admin.lessons.stats.today')}</p>
                <p className="text-3xl font-bold text-white">{todayLessons}</p>
              </div>
              <div className="bg-green-600/20 p-3 rounded-xl">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">{t('admin.lessons.stats.future')}</p>
                <p className="text-3xl font-bold text-white">{futureLessons}</p>
              </div>
              <div className="bg-purple-600/20 p-3 rounded-xl">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">{t('admin.lessons.stats.completed')}</p>
                <p className="text-3xl font-bold text-white">{pastLessons}</p>
              </div>
              <div className="bg-orange-600/20 p-3 rounded-xl">
                <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        {/* Search e Filtri - Solo in modalità lista */}
        {viewMode === 'list' && (
          <div className="bg-gray-800 rounded-2xl shadow-lg border border-gray-700 mb-8">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-indigo-600/20 p-2 rounded-lg">
                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white">{t('admin.lessons.search.title')}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">{t('admin.lessons.search.searchLesson')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-3 flex items-center pl-4 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path>
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder={t('admin.lessons.search.searchPlaceholder')}
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
                <label className="block text-sm font-semibold text-gray-300 mb-2">{t('admin.lessons.search.filterByCourse')}</label>
                <select
                  value={selectedCourseId || ''}
                  onChange={(e) => setSelectedCourseId(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
        )}
        
        {error && !info && (
          <div className="mb-6 bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg shadow border border-red-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-red-300 font-medium">{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Toggle visualizzazione */}
        <div className="flex justify-center mb-6">
          <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'calendar'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-blue-400'
              }`}
            >
              {t('admin.lessons.viewModes.calendar')}
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-blue-400'
              }`}
            >
              {t('admin.lessons.viewModes.list')}
            </button>
          </div>
        </div>

        {/* Vista Calendario */}
        {viewMode === 'calendar' && (
          <div className="mb-8">
            <LessonsCalendar
              lessons={lessons}
              onLessonClick={handleLessonClick}
              onTimeSlotClick={handleTimeSlotClick}
              onCreateLesson={handleSaveLesson}
            />
          </div>
        )}
      
        {/* Lista lezioni */}
        {viewMode === 'list' && (
          <div className="bg-gray-800 rounded-2xl shadow-lg border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-600/20 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white">{t('admin.lessons.list.title')}</h3>
              </div>
              <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm font-medium">
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
                    className="bg-gradient-to-br from-gray-800 to-gray-750 rounded-2xl shadow-lg border border-gray-700 overflow-hidden hover:shadow-xl hover:scale-105 transition-all duration-300 relative"
                    style={{ borderLeft: `5px solid ${getCourseColor(lesson.course_id)}` }}
                  >
                    {/* Header della card */}
                    <div 
                      className="p-6 border-b border-gray-600 relative"
                      style={{
                        background: `linear-gradient(135deg, ${getCourseColor(lesson.course_id)}15 0%, rgba(55, 65, 81, 1) 100%)`
                      }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold text-white leading-tight">
                          {lesson.name || t('admin.lessons.list.lessonOfDate', { date: formatDate(lesson.lesson_date) })}
                        </h3>
                        {lesson.is_completed && (
                          <div className="flex items-center space-x-1 bg-green-900/30 text-green-400 px-2 py-1 rounded-full text-xs font-semibold border border-green-800">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Completata</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Corso prominente e stato */}
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex items-center space-x-2 px-3 py-1 rounded-full border"
                          style={{
                            backgroundColor: `${getCourseColor(lesson.course_id)}20`,
                            borderColor: `${getCourseColor(lesson.course_id)}40`
                          }}
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getCourseColor(lesson.course_id) }}
                          ></div>
                          <span 
                            className="text-sm font-semibold"
                            style={{ color: getCourseColor(lesson.course_id) }}
                          >
                            {getCourseName(lesson.course_id)}
                          </span>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${getLessonStatusColor(lesson)}`}>
                          {getLessonStatusText(lesson)}
                        </div>
                      </div>
                    </div>

                    {/* Contenuto principale */}
                    <div className="p-6">
                      {/* Informazioni in griglia 2x2 */}
                      <div className="flex flex-col md:grid md:grid-cols-2 gap-4 mb-6">
                        <div className="flex items-center p-3 bg-orange-600/10 rounded-lg border border-orange-800/30">
                          <svg className="w-5 h-5 text-orange-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-400 mb-1">{t('admin.lessons.list.classroom')}</p>
                            <p className="text-sm text-orange-300 font-semibold">
                              {getClassroomName(lesson.classroom_id)}
                            </p>
                          </div>
                        </div>                    
                        <div className="flex items-center p-3 bg-purple-600/10 rounded-lg border border-purple-800/30">
                          <svg className="w-5 h-5 text-purple-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-400 mb-1">{t('admin.lessons.list.subject')}</p>
                            <p className="text-sm text-purple-300 font-semibold truncate">
                              {getSubjectName(lesson.subject_id)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center p-3 bg-blue-600/10 rounded-lg col-span-2 border border-blue-800/30">
                          <svg className="w-5 h-5 text-blue-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-400 mb-1">{t('admin.lessons.list.dateTime')}</p>
                            <p className="text-sm text-blue-300 font-semibold truncate">
                              {formatDate(lesson.lesson_date)}
                            </p>
                            {(() => {
                              const { startTime, endTime } = getLessonTiming(lesson);
                              return (
                                <p className="text-xs text-gray-400 mt-1">
                                  {startTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} - {endTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Azioni */}
                      <div className="space-y-3">
                        {/* Azione principale */}
                        {lesson.is_completed ? (
                          <div className="w-full flex items-center justify-center px-4 py-3 bg-gray-600 text-gray-300 rounded-lg text-sm font-semibold opacity-75">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {t('admin.lessons.status.lessonCompleted')}
                          </div>
                        ) : canCapturePhotos(lesson) ? (
                          <button
                            onClick={() => handleCaptureAndAnalyze(lesson)}
                            className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200 text-sm font-semibold"
                            title={t('admin.lessons.actions.captureAndAnalyzeRealtime')}
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Scatta e Analizza
                          </button>
                        ) : (
                          <div className="w-full flex items-center justify-center px-4 py-3 bg-gray-600 text-gray-400 rounded-lg text-sm font-semibold opacity-75">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {getLessonStatus(lesson) === 'not_started' 
                              ? t('admin.lessons.status.notStartedYet') 
                              : t('admin.lessons.status.lessonEnded')}
                          </div>
                        )}
                        
                        {/* Azioni secondarie */}
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => handleViewImages(lesson)}
                            className="flex items-center justify-center px-3 py-2 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30 transition-colors text-sm font-medium border border-green-800/30"
                            title="Visualizza immagini con riquadri"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {t('admin.lessons.actions.viewImages')}
                          </button>
                          
                          <button
                            onClick={() => !lesson.is_completed && handleEditLesson(lesson)}
                            disabled={lesson.is_completed}
                            className={`flex items-center justify-center px-3 py-2 rounded-lg transition-colors text-sm font-medium border ${
                              lesson.is_completed
                                ? 'bg-gray-700/50 text-gray-500 border-gray-700/50 cursor-not-allowed'
                                : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border-blue-800/30'
                            }`}
                            title={lesson.is_completed ? t('admin.lessons.errors.cannotEditCompletedLesson') : t('admin.lessons.actions.editLesson')}
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            {lesson.is_completed ? t('admin.lessons.completedLesson') : t('common.edit')}
                          </button>
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
        )}
      
      {/* Modal Form Lezione */}
      <LessonModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSave={handleSaveLesson}
        lesson={selectedLesson}
        courses={courses}
        subjects={subjects}
        classrooms={classrooms}
        teachers={teachers}
        lessons={lessons}
        defaultDate={defaultDate}
        defaultHour={defaultHour}
      />
      

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

      {/* Modal Visualizzazione Immagini */}
      {isImagesModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity backdrop-blur-sm"></div>
            
            <div className="relative bg-gray-800 rounded-2xl shadow-2xl transform transition-all sm:max-w-6xl sm:w-full max-h-screen overflow-y-auto border border-gray-700">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="bg-green-600/20 p-3 rounded-xl">
                      <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white">
                      {t('admin.lessons.images.title')}
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsImagesModalOpen(false)}
                    className="p-2 bg-gray-700 text-gray-400 rounded-lg hover:bg-gray-600 hover:text-gray-200 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-6">
                  {loadingImages ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mx-auto mb-4"></div>
                      <h3 className="text-lg font-semibold text-gray-200 mb-2">{t('admin.lessons.images.loading')}</h3>
                    </div>
                  ) : lessonImages.length > 0 ? (
                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-gray-300">{lessonImages.length} immagini trovate</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-300">
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
                            <span>Originali</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                            <span>Con riquadri</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {lessonImages
                          .sort((a, b) => {
                            if (a.source === 'face_detection_report' && b.source !== 'face_detection_report') return -1;
                            if (b.source === 'face_detection_report' && a.source !== 'face_detection_report') return 1;
                            return new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime();
                          })
                          .map((image, index) => (
                          <div key={image.id} className="border border-gray-600 rounded-lg overflow-hidden hover:shadow-xl hover:border-gray-500 transition-all bg-gray-700">
                            <div className="aspect-video bg-gray-600 relative">
                              <img 
                                src={image.url} 
                                alt={`Immagine ${index + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgMTZsNC41ODYtNC41ODZhMiAyIDAgMDEyLjgyOCAwTDE2IDE2bS0yLTJsMS41ODYtMS41ODZhMiAyIDAgMDEyLjgyOCAwTDIwIDE0bS02LTZoLjAxTTYgMjBoMTJhMiAyIDAgMDAyLTJWNmEyIDIgMCAwMC0yLTJINmEyIDIgMCAwMC0yIDJ2MTJhMiAyIDAgMDAyIDJ6IiBzdHJva2U9IiM5Q0E3QjIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';
                                }}
                              />
                            </div>
                            
                            <div className="p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-200">
                                  {new Date(image.captured_at).toLocaleString('it-IT')}
                                </span>
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  image.is_analyzed 
                                    ? 'bg-green-900/30 text-green-300 border border-green-500/30' 
                                    : 'bg-yellow-900/30 text-yellow-300 border border-yellow-500/30'
                                }`}>
                                  {image.is_analyzed ? 'Analizzata' : 'In attesa'}
                                </span>
                              </div>
                              
                              <div className="flex items-center justify-between text-sm text-gray-300 mb-2">
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
                              
                              <div className="text-xs text-gray-400">
                                {t('admin.lessons.captureAnalysis.source')}: {image.source === 'camera' ? t('admin.lessons.captureAnalysis.originalCamera') : 
                                        image.source === 'face_detection_report' ? t('admin.lessons.images.analysisWithContours') : t('admin.lessons.images.upload')}
                                {image.camera_ip && ` • ${image.camera_ip}`}
                              </div>
                              
                              {image.source === 'face_detection_report' && (
                                <div className="mt-2 inline-flex items-center px-2 py-1 bg-green-900/30 text-green-300 text-xs rounded-full border border-green-500/30">
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {t('admin.lessons.captureAnalysis.withGreenFrames')}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="bg-gray-700 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-200 mb-2">{t('admin.lessons.images.noImagesAvailable')}</h3>
                      <p className="text-gray-300 mb-6">{t('admin.lessons.images.noImagesMessage')}</p>
                      <button 
                        onClick={() => {
                          setIsImagesModalOpen(false);
                          if (lessonToAnalyze && canCapturePhotos(lessonToAnalyze)) {
                            handleCaptureAndAnalyze(lessonToAnalyze);
                          }
                        }}
                        disabled={!lessonToAnalyze || !canCapturePhotos(lessonToAnalyze)}
                        className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                          lessonToAnalyze && canCapturePhotos(lessonToAnalyze)
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {lessonToAnalyze && canCapturePhotos(lessonToAnalyze) 
                          ? t('admin.lessons.images.captureFirstImage')
                          : (getLessonStatus(lessonToAnalyze!) === 'not_started' 
                              ? t('admin.lessons.status.notStartedYet')
                              : t('admin.lessons.status.lessonEnded'))}
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end mt-6 pt-4 border-t border-gray-600">
                  <button
                    onClick={() => setIsImagesModalOpen(false)}
                    className="px-6 py-3 border border-gray-600 rounded-lg text-gray-300 font-medium hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    {t('admin.lessons.images.close')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Scatta e Analizza */}
      {isCaptureAnalysisModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
            <div className="fixed inset-0 bg-gray-900 bg-opacity-80 transition-opacity backdrop-blur-sm"></div>
            
            <div className="relative bg-gray-800 rounded-2xl shadow-2xl transform transition-all sm:max-w-2xl sm:w-full border border-gray-700">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className={`p-3 rounded-xl ${
                      isCaptureAnalyzing ? 'bg-emerald-900/20 border border-emerald-500/30' : error ? 'bg-red-900/20 border border-red-500/30' : 'bg-green-900/20 border border-green-500/30'
                    }`}>
                      {isCaptureAnalyzing ? (
                        <svg className="w-6 h-6 text-emerald-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        </svg>
                      ) : error ? (
                        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <h3 className="text-2xl font-bold text-white">
                      {isCaptureAnalyzing ? t('admin.lessons.captureAnalysis.captureInProgress') : error ? t('admin.lessons.captureAnalysis.error') : t('admin.lessons.captureAnalysis.captureCompleted')}
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsCaptureAnalysisModalOpen(false)}
                    disabled={isCaptureAnalyzing}
                    className="p-2 bg-gray-700 text-gray-400 rounded-lg hover:bg-gray-600 hover:text-white transition-colors disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-6">
                  {isCaptureAnalyzing ? (
                    <div className="text-center py-12">
                      <div className="relative mb-8">
                        <div className={`animate-spin rounded-full h-16 w-16 border-4 border-t-transparent mx-auto transition-all duration-700 ${
                          currentCaptureStage === 0 ? 'border-blue-500' :
                          currentCaptureStage === 1 ? 'border-yellow-500' : 
                          'border-green-500'
                        }`}></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className={`w-6 h-6 animate-pulse transition-all duration-700 ${
                            currentCaptureStage === 0 ? 'text-blue-400' :
                            currentCaptureStage === 1 ? 'text-yellow-400' :
                            'text-green-400'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          </svg>
                        </div>
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-3">
                        {currentCaptureStage === 0 ? t('admin.lessons.captureAnalysis.stages.capture') || 'Cattura in corso...' :
                         currentCaptureStage === 1 ? t('admin.lessons.captureAnalysis.stages.analyze') || 'Analisi volti...' :
                         t('admin.lessons.captureAnalysis.stages.report') || 'Generazione report...'}
                      </h3>
                      <div className="w-full bg-gray-700 rounded-full h-2 mb-4 max-w-xs mx-auto">
                        <div className={`h-2 rounded-full transition-all duration-700 ${
                          currentCaptureStage === 0 ? 'bg-blue-500 w-1/3' :
                          currentCaptureStage === 1 ? 'bg-yellow-500 w-2/3' :
                          'bg-green-500 w-full'
                        }`}></div>
                      </div>
                      <p className="text-gray-300 max-w-md mx-auto">
                        {t('admin.lessons.captureAnalysis.waitMessage')}
                      </p>
                      <div className="mt-6 grid grid-cols-3 gap-4 max-w-md mx-auto">
                        <div className={`rounded-lg p-3 text-center transition-all duration-500 ${
                          currentCaptureStage >= 0 ? 'bg-blue-600/20' : 'bg-gray-700'
                        }`}>
                          <div className={`w-2 h-2 rounded-full mx-auto mb-2 transition-all duration-500 ${
                            currentCaptureStage >= 0 ? 'bg-blue-400 animate-pulse' : 'bg-gray-500'
                          }`}></div>
                          <p className="text-xs text-gray-400">Cattura</p>
                        </div>
                        <div className={`rounded-lg p-3 text-center transition-all duration-500 ${
                          currentCaptureStage >= 1 ? 'bg-yellow-600/20' : 'bg-gray-700'
                        }`}>
                          <div className={`w-2 h-2 rounded-full mx-auto mb-2 transition-all duration-500 ${
                            currentCaptureStage >= 1 ? 'bg-yellow-400 animate-pulse' : 'bg-gray-500'
                          }`}></div>
                          <p className="text-xs text-gray-400">Analisi</p>
                        </div>
                        <div className={`rounded-lg p-3 text-center transition-all duration-500 ${
                          currentCaptureStage >= 2 ? 'bg-green-600/20' : 'bg-gray-700'
                        }`}>
                          <div className={`w-2 h-2 rounded-full mx-auto mb-2 transition-all duration-500 ${
                            currentCaptureStage >= 2 ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                          }`}></div>
                          <p className="text-xs text-gray-400">Report</p>
                        </div>
                      </div>
                    </div>
                  ) : error ? (
                    <div className="bg-red-900/20 border-l-4 border-red-500 p-6 rounded-lg">
                      <div className="flex items-center mb-3">
                        <svg className="w-6 h-6 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h3 className="text-lg font-medium text-red-300">{t('admin.lessons.captureAnalysis.errorDuringCapture')}</h3>
                      </div>
                      <p className="text-red-400 ml-9">{error}</p>
                    </div>
                  ) : captureAnalysisResult ? (
                    <div className="space-y-6">
                      <div className="bg-green-900/20 border-l-4 border-green-500 p-6 rounded-lg">
                        <div className="flex items-center mb-3">
                          <svg className="w-6 h-6 text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <h3 className="text-lg font-medium text-green-300">{t('admin.lessons.captureAnalysis.captureSuccessful')}</h3>
                        </div>
                        <p className="text-green-400 ml-9">{t('admin.lessons.captureAnalysis.imageAcquiredMessage')}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div className="bg-gray-700 border border-gray-600 rounded-lg p-6 text-center">
                          <div className="text-3xl font-bold text-blue-400 mb-2">
                            {captureAnalysisResult.analysis.detected_faces}
                          </div>
                          <div className="text-sm text-gray-300">{t('admin.lessons.captureAnalysis.facesDetected')}</div>
                        </div>
                        
                        <div className="bg-gray-700 border border-gray-600 rounded-lg p-6 text-center">
                          <div className="text-3xl font-bold text-green-400 mb-2">
                            {captureAnalysisResult.analysis.recognized_students}
                          </div>
                          <div className="text-sm text-gray-300">{t('admin.lessons.captureAnalysis.studentsRecognized')}</div>
                        </div>
                      </div>
                      
                      {captureAnalysisResult.analysis.students && captureAnalysisResult.analysis.students.length > 0 && (
                        <div className="bg-gray-700 border border-gray-600 rounded-lg p-6">
                          <h4 className="font-semibold mb-4 text-white">{t('admin.lessons.captureAnalysis.recognizedStudentsList')}</h4>
                          <div className="space-y-3">
                            {captureAnalysisResult.analysis.students.map((student: any, index: number) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                                <span className="font-medium text-white">{student.name} {student.surname}</span>
                                <span className="text-sm text-green-400 bg-green-900/30 px-2 py-1 rounded">
                                  {Math.round(student.confidence * 100)}% {t('admin.lessons.captureAnalysis.confidence')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Mostra l'immagine del report se disponibile */}
                      {captureAnalysisResult.report_image_id && (
                        <div className="bg-gray-700 border border-gray-600 rounded-lg p-6">
                          <h4 className="font-semibold mb-4 text-white">{t('admin.lessons.captureAnalysis.reportImageWithDetections')}</h4>
                          <div className="relative bg-gray-800 rounded-lg overflow-hidden border border-gray-600">
                            <img 
                              src={`http://localhost:4321/api/images/lesson/${captureAnalysisResult.report_image_id}`}
                              alt="Report con volti rilevati"
                              className="w-full h-auto max-h-96 object-contain"
                              onError={(e) => {
                                console.warn(t('admin.lessons.errors.loadingImagesError', { status: 'report' }));
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                              {t('admin.lessons.captureAnalysis.facesDetectedCount', { count: captureAnalysisResult.analysis.detected_faces })}
                            </div>
                          </div>
                          <p className="text-sm text-gray-400 mt-3">
                            {t('admin.lessons.captureAnalysis.greenFramesIndicateRecognized')}
                          </p>
                        </div>
                      )}
                      
                      {captureAnalysisResult.lesson_completed && (
                        <div className="bg-amber-900/20 border-l-4 border-amber-500 p-6 rounded-lg">
                          <div className="flex items-center mb-3">
                            <svg className="w-6 h-6 text-amber-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h4 className="font-semibold text-amber-300">{t('admin.lessons.captureAnalysis.lessonCompleted')}</h4>
                          </div>
                          <p className="text-amber-400 ml-9">
                            {t('admin.lessons.captureAnalysis.lessonCompletedMessage')}
                          </p>
                        </div>
                      )}
                      
                      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
                        <h4 className="font-semibold mb-4 text-blue-300 flex items-center">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Dettagli tecnici
                        </h4>
                        <div className="text-sm text-blue-400 space-y-2">
                          <div className="flex items-center justify-between p-2 bg-blue-900/20 rounded">
                            <span>Metodo camera:</span>
                            <span className="font-mono">{captureAnalysisResult.camera.method}</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-blue-900/20 rounded">
                            <span>Dimensione file:</span>
                            <span className="font-mono">{Math.round(captureAnalysisResult.camera.file_size / 1024)} KB</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-blue-900/20 rounded">
                            <span>ID immagine:</span>
                            <span className="font-mono">{captureAnalysisResult.image_id}</span>
                          </div>
                          {captureAnalysisResult.report_image_id && (
                            <div className="flex items-center justify-between p-2 bg-blue-900/20 rounded">
                              <span>ID report:</span>
                              <span className="font-mono">{captureAnalysisResult.report_image_id}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <svg className="w-12 h-12 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-400">Nessun dato disponibile</p>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between mt-8 pt-6 border-t border-gray-600">
                  <div className="flex space-x-3">
                    {captureAnalysisResult && !isCaptureAnalyzing && captureAnalysisResult.lesson_completed && (
                      <button
                        onClick={() => {
                          setIsCaptureAnalysisModalOpen(false);
                          setCaptureAnalysisResult(null);
                          setLessonToAnalyze(null);
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                      >
                        🏠 Torna alla Dashboard
                      </button>
                    )}
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setIsCaptureAnalysisModalOpen(false)}
                      disabled={isCaptureAnalyzing}
                      className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {isCaptureAnalyzing ? t('admin.lessons.captureAnalysis.wait') : t('admin.lessons.captureAnalysis.close')}
                    </button>
                    
                    {captureAnalysisResult && !isCaptureAnalyzing && (
                      <button
                        onClick={() => {
                          setIsCaptureAnalysisModalOpen(false);
                          window.location.href = `/admin/attendance?lessonId=${lessonToAnalyze?.id}`;
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                      >
                        {t('admin.lessons.captureAnalysis.viewDetailedReport')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lezione */}
      <LessonModal
        isOpen={isLessonModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveLesson}
        lesson={selectedLesson}
        courses={courses}
        subjects={subjects}
        classrooms={classrooms}
        teachers={teachers}
        lessons={lessons}
        defaultDate={defaultDate}
        defaultHour={defaultHour}
      />
      </div>
    </div>
  );
};

export default LessonsPanel;