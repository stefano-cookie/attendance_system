// src/components/admin/Dashboard.tsx - REDESIGN COMPLETO
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { authService } from '../../services/authService';

// Interfacce aggiornate
interface AttendanceRecord {
  id: number;
  userId: number;
  lessonId: number;
  is_present: boolean;
  timestamp: string;
  confidence: number;
  imageFile?: string;
  
  // Dati studente (diverse strutture possibili)
  student?: {
    id: number;
    name: string;
    surname: string;
    email: string;
    matricola?: string;
  };
  User?: {
    id: number;
    name: string;
    surname: string;
    email: string;
    matricola?: string;
  };
  
  // Dati lezione
  lesson?: {
    id: number;
    name: string;
    lesson_date: string;
  };
}

interface DashboardStats {
  totalStudents: number;
  totalCourses: number;
  totalSubjects: number;
  totalLessons: number;
  todayAttendance: number;
}

interface ProcessedStats {
  totalStudents: number;
  totalCourses: number;
  totalSubjects: number;
  totalLessons: number;
  todayPresent: number;
  todayAbsent: number;
  todayTotal: number;
  attendanceRate: number;
  recentAttendance: AttendanceRecord[];
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [stats, setStats] = useState<ProcessedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // Controlla l'autenticazione
  useEffect(() => {
    if (!authService.isAuthenticated() || !authService.hasRole('admin')) {
      navigate('/login');
    }
  }, [navigate]);
  
  // Carica dati
  useEffect(() => {
    fetchDashboardData();
  }, []);
  
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Carica statistiche di base e presenze in parallelo
      const [statsResponse, attendanceResponse] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/attendance')
      ]);
      
      console.log('Stats Response:', statsResponse.data);
      console.log('Attendance Response:', attendanceResponse.data);
      
      const baseStats: DashboardStats = statsResponse.data;
      const attendanceData: AttendanceRecord[] = attendanceResponse.data.attendances || attendanceResponse.data || [];
      
      // Filtra presenze di oggi
      const today = new Date().toISOString().split('T')[0];
      const todayAttendance = attendanceData.filter(record => {
        const recordDate = new Date(record.timestamp).toISOString().split('T')[0];
        return recordDate === today;
      });
      
      // Calcola statistiche presenze oggi
      const todayPresent = todayAttendance.filter(record => record.is_present).length;
      const todayAbsent = todayAttendance.filter(record => !record.is_present).length;
      const todayTotal = todayAttendance.length;
      const attendanceRate = todayTotal > 0 ? (todayPresent / todayTotal) * 100 : 0;
      
      // Prendi le ultime 10 presenze effettive (solo quelle con is_present = true)
      const recentPresences = attendanceData
        .filter(record => record.is_present)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);
      
      const processedStats: ProcessedStats = {
        totalStudents: baseStats.totalStudents || 0,
        totalCourses: baseStats.totalCourses || 0,
        totalSubjects: baseStats.totalSubjects || 0,
        totalLessons: baseStats.totalLessons || 0,
        todayPresent,
        todayAbsent,
        todayTotal,
        attendanceRate,
        recentAttendance: recentPresences
      };
      
      console.log('Processed Stats:', processedStats);
      setStats(processedStats);
      
    } catch (err: any) {
      console.error('Errore caricamento dati dashboard:', err);
      setError(err.response?.data?.message || t('admin.dashboard.errorLoading'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };
  
  const getStudentName = (record: AttendanceRecord): string => {
    if (record.student) {
      return `${record.student.name} ${record.student.surname}`;
    }
    if (record.User) {
      return `${record.User.name} ${record.User.surname}`;
    }
    return t('admin.dashboard.attendance.unknownStudent');
  };
  
  const getStudentEmail = (record: AttendanceRecord): string => {
    if (record.student?.email) return record.student.email;
    if (record.User?.email) return record.User.email;
    return 'N/A';
  };
  
  const getStudentMatricola = (record: AttendanceRecord): string => {
    if (record.student?.matricola) return record.student.matricola;
    if (record.User?.matricola) return record.User.matricola;
    return 'N/A';
  };
  
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    if (confidence >= 0.4) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };
  
  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return '🎯';
    if (confidence >= 0.6) return '✅';
    if (confidence >= 0.4) return '⚠️';
    return '❌';
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex justify-center items-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <h3 className="text-xl font-semibold text-gray-700">{t('admin.dashboard.loading')}</h3>
          <p className="text-gray-500 mt-2">{t('admin.dashboard.loadingSubtext')}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex-col md:flex-row md:flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">{t('admin.dashboard.title')}</h1>
                <p className="text-gray-600">{t('admin.dashboard.subtitle')}</p>
              </div>
            </div>
            
            <div className="flex justify-between md:justify-start items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
              >
                <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{refreshing ? t('admin.dashboard.refreshing') : t('admin.dashboard.refresh')}</span>
              </button>
              
              <button
                onClick={() => authService.logout()}
                className="flex items-center space-x-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>{t('common.logout')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          </div>
        )}
        
        {stats && (
          <>
            {/* Statistiche principali */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Totale Studenti */}
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.dashboard.stats.registeredStudents')}</p>
                    <p className="text-3xl font-bold text-gray-800">{stats.totalStudents}</p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-xl">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                </div>
              </div>
              
              {/* Corsi Attivi */}
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.dashboard.stats.activeCourses')}</p>
                    <p className="text-3xl font-bold text-gray-800">{stats.totalCourses}</p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-xl">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                </div>
              </div>
              
              {/* Materie */}
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.dashboard.stats.totalSubjects')}</p>
                    <p className="text-3xl font-bold text-gray-800">{stats.totalSubjects}</p>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-xl">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                </div>
              </div>
              
              {/* Lezioni Totali */}
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.dashboard.stats.totalLessons')}</p>
                    <p className="text-3xl font-bold text-gray-800">{stats.totalLessons}</p>
                  </div>
                  <div className="bg-orange-100 p-3 rounded-xl">
                    <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Statistiche presenze oggi */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Presenti Oggi */}
              <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-2xl shadow-lg text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 mb-1">{t('admin.dashboard.stats.presentToday')}</p>
                    <p className="text-4xl font-bold">{stats.todayPresent}</p>
                    <p className="text-green-100 text-sm mt-1">{t('admin.dashboard.stats.onDetections', { count: stats.todayTotal })}</p>
                  </div>
                  <div className="bg-white bg-opacity-20 p-3 rounded-xl">
                    <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              
              {/* Assenti Oggi */}
              <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 rounded-2xl shadow-lg text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-100 mb-1">{t('admin.dashboard.stats.absentToday')}</p>
                    <p className="text-4xl font-bold">{stats.todayAbsent}</p>
                    <p className="text-red-100 text-sm mt-1">{t('admin.dashboard.stats.studentsAbsent')}</p>
                  </div>
                  <div className="bg-white bg-opacity-20 p-3 rounded-xl">
                    <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              
              {/* Percentuale Presenze */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg text-white">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-blue-100 mb-1">{t('admin.dashboard.stats.attendanceRateToday')}</p>
                    <p className="text-4xl font-bold">{stats.attendanceRate.toFixed(1)}%</p>
                    <div className="mt-3 w-full bg-white bg-opacity-20 rounded-full h-2">
                      <div 
                        className="bg-white h-2 rounded-full transition-all duration-500"
                        style={{ width: `${stats.attendanceRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="bg-white bg-opacity-20 p-3 rounded-xl">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Ultime Presenze Effettive */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                      <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800">{t('admin.dashboard.stats.recentAttendance')}</h3>
                  </div>
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
                    {t('admin.dashboard.stats.attendances', { count: stats.recentAttendance.length })}
                  </span>
                </div>
              </div>
              
              <div className="p-6">
                {stats.recentAttendance.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-4 text-lg font-medium text-gray-900">{t('admin.dashboard.attendance.noRecords')}</h3>
                    <p className="mt-2 text-gray-500">{t('admin.dashboard.attendance.willAppear')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats.recentAttendance.map((record, index) => (
                      <div 
                      key={record.id} 
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-semibold text-lg">
                            {getStudentName(record).split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{getStudentName(record)}</h4>
                            <div className="flex items-center space-x-3 text-sm text-gray-600">
                              <span className="flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                                </svg>
                                {getStudentEmail(record)}
                              </span>
                              <span className="flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V4a2 2 0 114 0v2m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                                </svg>
                                {getStudentMatricola(record)}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {formatDateTime(record.timestamp)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {record.lesson?.name || t('admin.dashboard.attendance.lessonNA')}
                            </p>
                          </div>
                          
                          <div className="text-center">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(record.confidence)}`}>
                              <span className="mr-1">{getConfidenceIcon(record.confidence)}</span>
                              {(record.confidence * 100).toFixed(0)}%
                            </span>
                            <p className="text-xs text-gray-500 mt-1">{t('admin.dashboard.attendance.reliability')}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Azioni Rapide */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <button
                onClick={() => navigate('/admin/technician/register')}
                className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
              >
                <div className="flex items-center justify-center space-x-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-xl font-semibold">{t('admin.dashboard.actions.registerStudent')}</span>
                </div>
              </button>
              
              <button
                onClick={() => navigate('/admin/students')}
                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
              >
                <div className="flex items-center justify-center space-x-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  <span className="text-xl font-semibold">{t('admin.dashboard.actions.manageStudents')}</span>
                </div>
              </button>
              
              <button
                onClick={() => navigate('/admin/attendance')}
                className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
              >
                <div className="flex items-center justify-center space-x-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="text-xl font-semibold">{t('admin.dashboard.actions.attendanceReport')}</span>
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;