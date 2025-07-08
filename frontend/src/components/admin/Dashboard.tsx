// src/components/admin/Dashboard.tsx - DARK MODE MINIMAL
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Tooltip } from 'recharts';
import api from '../../services/api';
import { authService } from '../../services/authService';
import FullscreenLoader from '../common/FullscreenLoader';

// Interfacce aggiornate
interface AttendanceRecord {
  id: number;
  userId: number;
  lessonId: number;
  is_present: boolean;
  timestamp: string;
  confidence: number;
  imageFile?: string;
  sourceInfo?: {
    capture_source: string;
    captured_by_role: string;
    captured_by_name: string | null;
    captured_by_email: string | null;
    capture_timestamp: string | null;
    source_label: string;
  } | null;
  
  student?: {
    id: number;
    name: string;
    surname: string;
    email: string;
    matricola?: string;
    photoPath?: string;
    hasPhoto?: boolean;
  };
  User?: {
    id: number;
    name: string;
    surname: string;
    email: string;
    matricola?: string;
    photoPath?: string;
    hasPhoto?: boolean;
  };
  
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
  weeklyData: Array<{ day: string; presenti: number; assenti: number }>;
  pieData: Array<{ name: string; value: number; color: string }>;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [stats, setStats] = useState<ProcessedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  useEffect(() => {
    if (!authService.isAuthenticated() || !authService.hasRole('admin')) {
      navigate('/login');
    }
  }, [navigate]);
  
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Auto-refresh dashboard every 60 seconds
  useEffect(() => {
    const autoRefreshInterval = setInterval(() => {
      if (!loading && !refreshing) {
        console.log('🔄 Auto-refreshing dashboard data...');
        fetchDashboardData();
      }
    }, 60000); // 60 seconds

    return () => clearInterval(autoRefreshInterval);
  }, [loading, refreshing]);
  
  // Genera dati per grafici settimanali
  const generateWeeklyData = (attendanceData: AttendanceRecord[]) => {
    const last7Days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayAttendance = attendanceData.filter(record => {
        const recordDate = new Date(record.timestamp).toISOString().split('T')[0];
        return recordDate === dateStr;
      });
      
      const presenti = dayAttendance.filter(record => record.is_present).length;
      const assenti = dayAttendance.filter(record => !record.is_present).length;
      
      last7Days.push({
        day: date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' }),
        presenti,
        assenti
      });
    }
    
    return last7Days;
  };
  
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [statsResponse, attendanceResponse] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/attendance')
      ]);
      
      const baseStats: DashboardStats = statsResponse.data;
      const attendanceData: AttendanceRecord[] = attendanceResponse.data.attendances || attendanceResponse.data || [];
      
      // Filtra presenze di oggi
      const today = new Date().toISOString().split('T')[0];
      const todayAttendance = attendanceData.filter(record => {
        const recordDate = new Date(record.timestamp).toISOString().split('T')[0];
        return recordDate === today;
      });
      
      const todayPresent = todayAttendance.filter(record => record.is_present).length;
      const todayAbsent = todayAttendance.filter(record => !record.is_present).length;
      const todayTotal = todayAttendance.length;
      const attendanceRate = todayTotal > 0 ? (todayPresent / todayTotal) * 100 : 0;
      
      // Dati recenti presenze - PRIORITÀ AGLI ASSENTI
      const recentAttendances = attendanceData
        .sort((a, b) => {
          // Prima gli assenti (priorità), poi per timestamp
          if (a.is_present !== b.is_present) {
            return a.is_present ? 1 : -1; // Assenti prima (false < true)
          }
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        })
        .slice(0, 6);
      
      // Genera dati per grafici
      const weeklyData = generateWeeklyData(attendanceData);
      const pieData = [
        { name: t('admin.dashboard.stats.present'), value: todayPresent, color: '#10b981' },
        { name: t('admin.dashboard.stats.absent'), value: todayAbsent, color: '#ef4444' }
      ];
      
      const processedStats: ProcessedStats = {
        totalStudents: baseStats.totalStudents || 0,
        totalCourses: baseStats.totalCourses || 0,
        totalSubjects: baseStats.totalSubjects || 0,
        totalLessons: baseStats.totalLessons || 0,
        todayPresent,
        todayAbsent,
        todayTotal,
        attendanceRate,
        recentAttendance: recentAttendances,
        weeklyData,
        pieData
      };
      
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
  
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 p-3 rounded-lg shadow-xl border border-gray-700">
          <p className="text-white font-medium text-sm">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };
  
  if (loading) {
    return (
      <FullscreenLoader 
        message={t('admin.dashboard.loading')}
        stages={[
          t('admin.dashboard.loading'),
          t('common.processing'),
          t('common.finalizing')
        ]}
        stageDuration={1500}
      />
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Aggiungi background al body */}
      <style>{`body { background-color: #111827 !important; }`}</style>
      
      {/* Header Dark */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
            <div>
              <h1 className="text-xl font-semibold text-white mb-0">{t('admin.dashboard.title')}</h1>
              <p className="text-gray-400 text-sm mb-0">{new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{refreshing ? '...' : t('common.refresh')}</span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 bg-red-900/20 border border-red-800 text-red-300 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        {stats && (
          <>
            {/* KPI Cards Dark */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{t('admin.dashboard.stats.registeredStudents')}</p>
                  <p className="text-2xl font-bold text-white mb-0">{stats.totalStudents}</p>
                </div>
              </div>
              
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{t('admin.dashboard.stats.activeCourses')}</p>
                  <p className="text-2xl font-bold text-white mb-0">{stats.totalCourses}</p>
                </div>
              </div>
              
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{t('admin.dashboard.stats.presentToday')}</p>
                  <p className="text-2xl font-bold text-emerald-400 mb-0">{stats.todayPresent}</p>
                </div>
              </div>
              
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{t('admin.dashboard.stats.attendanceRateToday')}</p>
                  <p className="text-2xl font-bold text-blue-400 mb-0">{stats.attendanceRate.toFixed(0)}%</p>
                </div>
              </div>
            </div>
            
            {/* Grafici Dark */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Andamento Settimanale */}
              <div className="lg:col-span-2 bg-gray-800 p-6 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-semibold text-white mb-0">{t('admin.dashboard.weeklyChart')}</h3>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                      <span className="text-gray-400">{t('admin.dashboard.stats.present')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-gray-400">{t('admin.dashboard.stats.absent')}</span>
                    </div>
                  </div>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="day" 
                        stroke="#9ca3af" 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#9ca3af" 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line 
                        type="monotone" 
                        dataKey="presenti" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="assenti" 
                        stroke="#ef4444" 
                        strokeWidth={3}
                        dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Distribuzione Oggi */}
              <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <h3 className="text-base font-semibold text-white mb-6">{t('admin.dashboard.todayChart')}</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {stats.pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-3">
                  {stats.pieData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span className="text-sm text-gray-400">{item.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-white">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Presenze Recenti + Azioni */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Presenze Recenti */}
              <div className="bg-gray-800 rounded-lg border border-gray-700">
                <div className="p-4 border-b border-gray-700">
                  <h3 className="text-base font-semibold text-white mb-0">{t('admin.dashboard.stats.recentAttendance')}</h3>
                </div>
                <div className="p-4">
                  {stats.recentAttendance.length === 0 ? (
                    <div className="text-center py-6">
                      <svg className="mx-auto h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="mt-2 text-sm text-gray-400 mb-0">{t('admin.dashboard.attendance.noRecords')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {stats.recentAttendance.map((record) => (
                        <div key={record.id} className="flex items-center justify-between py-2">
                          <div className="flex items-center space-x-3">
                            {/* Foto studente o iniziali */}
                            {(record.student?.hasPhoto || record.User?.hasPhoto) ? (
                              <img 
                                src={`${process.env.REACT_APP_API_URL || 'http://localhost:4321/api'}/users/students/${record.student?.id || record.User?.id}/photo`}
                                alt={getStudentName(record)}
                                className="w-8 h-8 rounded-lg object-cover border border-gray-600"
                                onError={(e) => {
                                  // Solo nascondere l'immagine, non sostituire tutto il contenuto
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  
                                  // Creare fallback avatar accanto al nome esistente
                                  const avatarDiv = document.createElement('div');
                                  avatarDiv.className = 'w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center';
                                  avatarDiv.innerHTML = `
                                    <span class="text-xs font-medium text-gray-300">
                                      ${getStudentName(record).split(' ').map(n => n[0]).join('')}
                                    </span>
                                  `;
                                  target.parentElement?.insertBefore(avatarDiv, target);
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                                <span className="text-xs font-medium text-gray-300">
                                  {getStudentName(record).split(' ').map(n => n[0]).join('')}
                                </span>
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-200 mb-0">{getStudentName(record)}</p>
                              <p className="text-xs text-gray-500 mb-0">{formatDateTime(record.timestamp)}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                                record.is_present 
                                  ? 'bg-emerald-900/30 text-emerald-400' 
                                  : 'bg-red-900/30 text-red-400'
                              }`}>
                                {record.is_present ? `✓ ${t('admin.dashboard.stats.present')}` : `✗ ${t('admin.dashboard.stats.absent')}`}
                              </span>
                              {record.confidence && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-900/30 text-blue-400 text-xs font-medium">
                                  {(record.confidence * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                            {record.sourceInfo && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-900/30 text-purple-400 text-xs font-medium">
                                {record.sourceInfo.source_label}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Azioni Rapide */}
              <div className="bg-gray-800 rounded-lg border border-gray-700">
                <div className="p-4 border-b border-gray-700">
                  <h3 className="text-base font-semibold text-white mb-0">{t('admin.dashboard.actions.quickActions')}</h3>
                </div>
                <div className="p-4 space-y-3">
                  <button
                    onClick={() => navigate('/admin/technician/register')}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white p-3 rounded-lg transition-all text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span className="text-sm font-medium">{t('admin.dashboard.actions.registerStudent')}</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => navigate('/admin/students')}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white p-3 rounded-lg transition-all text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="text-sm font-medium">{t('admin.dashboard.actions.manageStudents')}</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => navigate('/admin/attendance')}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white p-3 rounded-lg transition-all text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="text-sm font-medium">{t('admin.dashboard.actions.attendanceReport')}</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;