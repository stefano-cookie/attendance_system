import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import teacherService, { AttendanceReport } from '../../services/teacherService';
import { sendAttendanceEmails } from '../../services/api';
import FullscreenLoader from '../common/FullscreenLoader';

const ActiveLesson: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [lesson, setLesson] = useState<any>(null);
  const [reportImageId, setReportImageId] = useState<number | null>(null);
  const [attendanceReport, setAttendanceReport] = useState<AttendanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadLessonData();
    }
  }, [id]);

  const loadLessonData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const [lessonData, reportData] = await Promise.all([
        teacherService.getLesson(parseInt(id)),
        teacherService.getAttendanceReport(parseInt(id))
      ]);
      
      setLesson(lessonData);
      setAttendanceReport(reportData);
      
      // Se la lezione è completata, carica l'ID dell'immagine report
      if (lessonData.is_completed) {
        try {
          const images = await teacherService.getLessonImages(parseInt(id));
          const reportImage = images.find((img: any) => img.source === 'report');
          if (reportImage) {
            setReportImageId(reportImage.id);
          }
        } catch (imgError) {
          console.error('Errore caricamento immagini:', imgError);
        }
      }
      
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || t('teacher.lessons.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleCaptureAndAnalyze = async () => {
    if (!id) return;
    
    try {
      setCapturing(true);
      setError(null);
      setEmailSuccess(null);
      
      // Timeout client-side dopo 45 secondi
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: operazione troppo lenta')), 45000)
      );
      
      const result = await Promise.race([
        teacherService.captureAndAnalyze(parseInt(id)),
        timeoutPromise
      ]);
      
      if (result.success) {
        if (result.lesson_completed) {
          // Ricarica il report reale dal backend invece di usare un mock
          try {
            const realReport = await teacherService.getAttendanceReport(parseInt(id));
            setAttendanceReport(realReport);
            setEmailSuccess('Analisi completata con successo! La lezione è stata marcata come completata.');
            setLesson((prev: any) => prev ? {...prev, is_completed: true} : null);
            setReportImageId(result.report_image_id || result.image_id);
          } catch (reportError) {
            console.error('Errore caricamento report:', reportError);
            // Fallback al comportamento precedente se il report non si carica
            setEmailSuccess('Analisi completata ma errore nel caricamento report.');
          }
        } else {
          await loadLessonData();
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('teacher.lessons.errorCapturing'));
    } finally {
      setCapturing(false);
    }
  };

  const handleSendEmails = async () => {
    if (!id) return;
    
    try {
      setSendingEmails(true);
      setError(null);
      setEmailSuccess(null);
      
      const result = await sendAttendanceEmails(parseInt(id));
      
      if (result.success) {
        setEmailSuccess(result.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante invio email');
    } finally {
      setSendingEmails(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <FullscreenLoader 
        message={t('common.loading')}
        stages={[
          'Caricamento lezione...',
          'Verifica presenze...',
          'Preparazione interfaccia...'
        ]}
        stageDuration={1000}
      />
    );
  }

  if (error && !lesson) {
    return (
      <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-6">
        <div className="flex items-center">
          <svg className="w-6 h-6 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-lg font-medium text-red-300">{t('common.error')}</h3>
            <p className="text-red-200">{error}</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/teacher')}
          className="mt-4 bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors text-sm"
        >
          {t('teacher.lessons.backToDashboard')}
        </button>
      </div>
    );
  }

  if (!lesson) {
    return <div className="text-gray-300">{t('teacher.lessons.lessonNotFound')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{lesson.name}</h1>
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-300">
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(lesson.lesson_date)}
              </span>
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {lesson.classroom?.name}
              </span>
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                {lesson.course?.name}
              </span>
            </div>
          </div>
          <button 
            onClick={() => navigate('/teacher')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-300">{error}</span>
          </div>
        </div>
      )}

      {emailSuccess && (
        <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-green-300">{emailSuccess}</span>
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">{t('teacher.lessons.attendanceControl')}</h2>
        <div className="flex items-center space-x-4 flex-wrap gap-4">
          <button 
            onClick={handleCaptureAndAnalyze}
            disabled={capturing || lesson?.is_completed}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-all hover:scale-105"
          >
            {capturing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                <span>{t('teacher.lessons.analyzing')}</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{t('teacher.lessons.captureAndAnalyze')}</span>
              </>
            )}
          </button>

          {lesson?.is_completed && (
            <div className="w-full space-y-3">
              <div className="flex items-center justify-center px-4 py-3 bg-green-600/20 text-green-400 rounded-lg text-sm font-semibold border border-green-600/30">
                {t('teacher.lessons.captureAnalysis.lessonCompleted') || '✅ Lezione Completata'}
              </div>
              <button 
                onClick={() => navigate('/teacher')}
                className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all hover:scale-105 text-sm font-semibold"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Torna alla Dashboard
              </button>
            </div>
          )}

          {attendanceReport && attendanceReport.attendance.students.length > 0 && !lesson?.is_completed && (
            <button 
              onClick={handleSendEmails}
              disabled={sendingEmails}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-all hover:scale-105"
            >
              {sendingEmails ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Invio email...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.05a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>Invia Email Presenze</span>
                </>
              )}
            </button>
          )}
          
          {!lesson?.is_completed && (
            <button 
              onClick={() => navigate(`/teacher/lessons/${id}/images`)}
              className="bg-gray-700 text-gray-300 px-6 py-3 rounded-lg hover:bg-gray-600 flex items-center space-x-2 transition-all hover:scale-105"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{t('teacher.lessons.viewImages')}</span>
            </button>
          )}
        </div>
      </div>

      {attendanceReport && (
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-600">
            <h2 className="text-lg font-semibold text-white">{t('teacher.attendance.reportTitle')}</h2>
          </div>
          
          {lesson?.is_completed && reportImageId && (
            <div className="p-6 border-b border-gray-600">
              <h3 className="text-md font-semibold text-white mb-4">Immagine con Riconoscimenti</h3>
              <div className="flex justify-center">
                <img 
                  src={`http://localhost:4321/api/images/lesson/${reportImageId}`}
                  alt="Report con riconoscimenti facciali"
                  className="max-w-full h-auto rounded-lg border border-gray-600 shadow-lg"
                  style={{ maxHeight: '400px' }}
                  onError={(e) => {
                    console.error('Errore caricamento immagine report:', e);
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <p className="text-sm text-gray-400 text-center mt-2">
                I riquadri verdi indicano i volti riconosciuti degli studenti
              </p>
            </div>
          )}
          
          <div className="p-6 border-b border-gray-600">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{attendanceReport.attendance.summary.total}</p>
                <p className="text-sm text-gray-400">{t('teacher.attendance.totalStudents')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{attendanceReport.attendance.summary.present}</p>
                <p className="text-sm text-gray-400">{t('teacher.attendance.present')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">{attendanceReport.attendance.summary.absent}</p>
                <p className="text-sm text-gray-400">{t('teacher.attendance.absent')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-400">{attendanceReport.attendance.summary.percentage}%</p>
                <p className="text-sm text-gray-400">{t('teacher.attendance.percentage')}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {attendanceReport.attendance.students.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-gray-400">{t('teacher.attendance.noStudentsFound')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {attendanceReport.attendance.students.map((student) => (
                  <div key={student.student_id} className="flex items-center justify-between p-3 border border-gray-600 rounded-lg bg-gray-700/30">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${student.is_present ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <div>
                        <p className="font-medium text-white">
                          {student.student_name} {student.student_surname}
                        </p>
                        <p className="text-sm text-gray-400">{t('teacher.attendance.studentId')}: {student.matricola}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        student.is_present 
                          ? 'bg-green-600/20 text-green-400 border border-green-600/30' 
                          : 'bg-red-600/20 text-red-400 border border-red-600/30'
                      }`}>
                        {student.is_present ? t('teacher.attendance.present') : t('teacher.attendance.absent')}
                      </span>
                      {student.is_present && student.confidence > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {t('teacher.attendance.confidence')}: {Math.round(student.confidence * 100)}%
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveLesson;