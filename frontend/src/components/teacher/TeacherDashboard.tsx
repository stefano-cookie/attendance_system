import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import teacherService, { TeacherDashboardData } from '../../services/teacherService';
import FullscreenLoader from '../common/FullscreenLoader';

const TeacherDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await teacherService.getDashboard();
      setDashboardData(data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || t('teacher.dashboard.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getLessonTiming = (lesson: any) => {
    const now = new Date();
    
    // Use lesson_start and lesson_end if available, otherwise extract from lesson_date
    const startTime = lesson.lesson_start ? 
      new Date(`${lesson.lesson_date.split('T')[0]}T${lesson.lesson_start}`) : 
      new Date(lesson.lesson_date);
    
    const endTime = lesson.lesson_end ? 
      new Date(`${lesson.lesson_date.split('T')[0]}T${lesson.lesson_end}`) : 
      new Date(startTime.getTime() + 60 * 60 * 1000); // +1 hour default
    
    return { startTime, endTime, now };
  };

  const getLessonStatus = (lesson: any) => {
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

  const formatLessonTime = (lesson: any) => {
    const { startTime, endTime } = getLessonTiming(lesson);
    const startTimeStr = startTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = endTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    return `${startTimeStr} - ${endTimeStr}`;
  };

  const getLessonStatusText = (lesson: any) => {
    const status = getLessonStatus(lesson);
    switch (status) {
      case 'not_started': return t('teacher.lessons.status.notStarted') || 'Non Iniziata';
      case 'in_progress': return t('teacher.lessons.status.inProgress') || 'In Corso';
      case 'completed': return t('teacher.lessons.status.completed') || 'Completata';
      case 'ended': return t('teacher.lessons.status.ended') || 'Terminata';
      default: return t('teacher.lessons.status.unknown') || 'Sconosciuto';
    }
  };

  const getLessonStatusColor = (lesson: any) => {
    const status = getLessonStatus(lesson);
    switch (status) {
      case 'not_started': return 'bg-gray-600/20 text-gray-300 border-gray-600/30';
      case 'in_progress': return 'bg-green-600/20 text-green-400 border-green-600/30';
      case 'completed': return 'bg-blue-600/20 text-blue-400 border-blue-600/30';
      case 'ended': return 'bg-orange-600/20 text-orange-400 border-orange-600/30';
      default: return 'bg-gray-600/20 text-gray-300 border-gray-600/30';
    }
  };

  const canCapturePhotos = (lesson: any) => {
    const status = getLessonStatus(lesson);
    return status === 'in_progress';
  };

  if (loading) {
    return (
      <FullscreenLoader 
        message={t('teacher.dashboard.loading')}
        stages={[
          t('teacher.dashboard.loading'),
          'Caricamento lezioni...',
          'Preparazione dashboard...'
        ]}
        stageDuration={1200}
      />
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-6">
        <div className="flex items-center">
          <svg className="w-6 h-6 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-lg font-medium text-red-300">{t('common.error')}</h3>
            <p className="text-red-400">{error}</p>
          </div>
        </div>
        <button 
          onClick={loadDashboard}
          className="mt-4 bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors text-sm"
        >
          {t('common.refresh')}
        </button>
      </div>
    );
  }

  if (!dashboardData) {
    return <div className="text-white">{t('common.noData')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          {t('teacher.dashboard.welcome', { name: dashboardData.teacher.name })}
        </h2>
        <p className="text-gray-300">
          {t('teacher.dashboard.today', { date: formatDate(dashboardData.today.date) })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">{t('teacher.dashboard.stats.totalLessons')}</p>
              <p className="text-3xl font-bold text-white">{dashboardData.stats.total_lessons}</p>
            </div>
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">{t('teacher.dashboard.stats.activeLessons')}</p>
              <p className="text-3xl font-bold text-green-400">{dashboardData.stats.active_lessons}</p>
            </div>
            <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">{t('teacher.dashboard.stats.completedLessons')}</p>
              <p className="text-3xl font-bold text-white">{dashboardData.stats.completed_lessons}</p>
            </div>
            <div className="w-12 h-12 bg-gray-600/50 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Lezioni Attive/Oggi */}
      <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700">
        <div className="px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">
                {t('teacher.dashboard.todayLessons', { count: dashboardData.today.count })}
              </h3>
            </div>
            <button 
              onClick={() => navigate('/teacher/lessons/create')}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all hover:scale-105 flex items-center space-x-2 shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>{t('teacher.dashboard.newLesson')}</span>
            </button>
          </div>
        </div>

        <div className="p-6">
          {dashboardData.today.lessons.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <h4 className="text-lg font-medium text-white mb-2">{t('teacher.dashboard.noLessonsToday')}</h4>
              <p className="text-gray-400 mb-6">{t('teacher.dashboard.createLessonPrompt')}</p>
              <button 
                onClick={() => navigate('/teacher/lessons/create')}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all hover:scale-105 shadow-md"
              >
                {t('teacher.dashboard.createFirstLesson')}
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {dashboardData.today.lessons.map((lesson) => {
                const status = getLessonStatus(lesson);
                const borderColor = status === 'in_progress' ? 'border-green-600/50' : 
                                  status === 'completed' ? 'border-blue-600/50' :
                                  status === 'not_started' ? 'border-gray-600/50' : 'border-orange-600/50';
                
                return (
                <div key={lesson.id} className={`border ${borderColor} rounded-lg p-4 hover:shadow-lg transition-all hover:scale-[1.02] bg-gray-700/50`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-white">{lesson.name}</h4>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-300">
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatLessonTime(lesson)}
                        </span>
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          {lesson.classroom.name}
                          {lesson.classroom.hasCamera && (
                            <span className="ml-2 inline-flex items-center px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded-full border border-green-600/30">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              {t('teacher.dashboard.camera')}
                            </span>
                          )}
                        </span>
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          {lesson.course.name}
                        </span>
                        {lesson.subject && (
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {lesson.subject.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {/* Status Badge */}
                      <div className={`px-3 py-1.5 rounded-lg font-medium text-sm border ${getLessonStatusColor(lesson)}`}>
                        {getLessonStatusText(lesson)}
                      </div>
                      
                      {/* Action Button */}
                      {getLessonStatus(lesson) === 'completed' ? (
                        <div className="px-4 py-2 rounded-lg font-medium flex items-center space-x-2 bg-blue-600/20 text-blue-400 border border-blue-600/30">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{t('teacher.dashboard.lessonCompleted')}</span>
                        </div>
                      ) : canCapturePhotos(lesson) ? (
                        <button 
                          onClick={() => navigate(`/teacher/lessons/${lesson.id}`)}
                          className="bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/30 px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 flex items-center space-x-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>{t('teacher.dashboard.detectAttendance')}</span>
                        </button>
                      ) : getLessonStatus(lesson) === 'not_started' ? (
                        <div className="px-4 py-2 rounded-lg font-medium flex items-center space-x-2 bg-gray-600/20 text-gray-400 border border-gray-600/30">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Non Ancora Iniziata</span>
                        </div>
                      ) : (
                        <button 
                          onClick={() => navigate(`/teacher/lessons/${lesson.id}`)}
                          className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30 px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 flex items-center space-x-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>Visualizza Lezione</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Prossime Lezioni */}
      <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700">
        <div className="px-6 py-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Prossime Lezioni</h3>
          </div>
        </div>
        <div className="p-6">
          <div className="text-center py-8">
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-400">Le prossime lezioni pianificate appariranno qui</p>
          </div>
        </div>
      </div>

      {/* Storico Lezioni */}
      <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700">
        <div className="px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Storico Lezioni</h3>
            </div>
            <button 
              onClick={() => navigate('/teacher/history')}
              className="text-purple-400 hover:text-purple-300 px-3 py-1.5 rounded-lg transition-colors text-sm flex items-center space-x-1 border border-purple-600/30 hover:border-purple-500/50"
            >
              <span>Vedi Tutto</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="text-center py-8">
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-gray-400">Le lezioni completate appariranno qui</p>
            <p className="text-sm text-gray-500 mt-1">Clicca "Vedi Tutto" per accedere al report completo</p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default TeacherDashboard;