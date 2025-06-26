// frontend/src/components/admin/AttendancePanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

// TypeScript interfaces
interface Student {
  id: number;
  name: string;
  surname: string;
  email: string;
  matricola: string;
  courseId?: number;
}

interface Lesson {
  id: number;
  name: string;
  lesson_date: string;
  course?: {
    id: number;
    name: string;
  };
  subject?: {
    id: number;
    name: string;
  };
}

interface Attendance {
  id: number | null;
  userId: number;
  lessonId: number;
  is_present: boolean;
  timestamp: string | null;
  confidence: number;
  screenshotId?: number | null;
  imageFile?: string;
  student: Student;
  lesson?: Lesson;
}

interface AttendanceStats {
  totalStudents: number;
  totalLessons: number;
  presentStudents: number;
  absentStudents: number;
  averageAttendance: number;
  attendanceByLesson: {
    [key: number]: {
      lessonName: string;
      date: string;
      presentCount: number;
      absentCount: number;
      totalCount: number;
      percentage: number;
    };
  };
  attendanceByStudent: {
    [key: number]: {
      studentName: string;
      matricola: string;
      presentCount: number;
      absentCount: number;
      totalLessons: number;
      percentage: number;
    };
  };
}

interface FilterOptions {
  startDate: string;
  endDate: string;
  courseId: number | null;
  subjectId: number | null;
  lessonId: number | null;
  studentSearch: string;
  showOnlyPresent: boolean;
  showOnlyAbsent: boolean;
}

const AttendancePanel: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  // Main states
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [filteredAttendances, setFilteredAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  
  // States for selection options
  const [courses, setCourses] = useState<{ id: number; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; name: string }[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  
  // Filters
  const [filters, setFilters] = useState<FilterOptions>({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    courseId: null,
    subjectId: null,
    lessonId: null,
    studentSearch: '',
    showOnlyPresent: false,
    showOnlyAbsent: false
  });
  
  // Display mode
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'stats'>('list');
  
  // Initial loading
  useEffect(() => {
    loadInitialData();
  }, []);
  
  // Reload attendance when main filters change
  useEffect(() => {
    fetchAttendanceData();
  }, [filters.lessonId, filters.courseId]);
  
  // Apply filters when they change
  useEffect(() => {
    applyFilters();
  }, [attendances, filters]);
  
  const loadInitialData = async () => {
    try {
      // Load courses, subjects and lessons in parallel
      const [coursesRes, subjectsRes, lessonsRes] = await Promise.all([
        api.get('/users/courses'),
        api.get('/subjects'),
        api.get('/lessons')
      ]);
      
      setCourses(coursesRes.data.courses || coursesRes.data || []);
      setSubjects(subjectsRes.data || []);
      setLessons(lessonsRes.data || []);
      
    } catch (err) {
      console.error(t('admin.attendance.errors.loadingInitialData'), err);
    }
  };
  
  const fetchAttendanceData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let response;
      
      // Format dates for backend
      const formatDateForBackend = (dateString: string, isEndDate: boolean = false) => {
        if (!dateString) return dateString;
        
        if (isEndDate) {
          return dateString + 'T23:59:59.999Z';
        } else {
          return dateString + 'T00:00:00.000Z';
        }
      };
      
      // If there's a specific lesson filter, use the complete endpoint
      if (filters.lessonId) {
        response = await api.get(`/attendance/lesson/${filters.lessonId}/complete`);
        
        if (response.data.attendances) {
          setAttendances(response.data.attendances);
          
          if (response.data.stats) {
            const lessonInfo = response.data.lessonInfo;
            setStats({
              totalStudents: response.data.stats.totalStudents,
              presentStudents: response.data.stats.presentStudents,
              absentStudents: response.data.stats.absentStudents,
              totalLessons: 1,
              averageAttendance: parseFloat(response.data.stats.attendanceRate),
              attendanceByLesson: {
                [filters.lessonId]: {
                  lessonName: lessonInfo.lesson_name,
                  date: new Date(lessonInfo.lesson_date).toLocaleDateString(),
                  presentCount: response.data.stats.presentStudents,
                  absentCount: response.data.stats.absentStudents,
                  totalCount: response.data.stats.totalStudents,
                  percentage: parseFloat(response.data.stats.attendanceRate)
                }
              },
              attendanceByStudent: calculateStudentStats(response.data.attendances)
            });
          }
        }
      } 
      else if (filters.courseId) {
        response = await api.get(`/attendance/course/${filters.courseId}/complete`, {
          params: {
            startDate: formatDateForBackend(filters.startDate, false),
            endDate: formatDateForBackend(filters.endDate, true)
          }
        });
        
        const allAttendances: Attendance[] = [];
        const lessonStats: any = {};
        
        response.data.attendancesByLesson.forEach((lessonData: any) => {
          lessonData.students.forEach((student: any) => {
            allAttendances.push({
              id: null,
              userId: student.id,
              lessonId: lessonData.lesson.id,
              is_present: student.is_present,
              timestamp: student.timestamp,
              confidence: student.confidence,
              screenshotId: null,
              student: {
                id: student.id,
                name: student.name,
                surname: student.surname,
                email: student.email,
                matricola: student.matricola
              },
              lesson: lessonData.lesson
            });
          });
          
          const presentCount = lessonData.students.filter((s: any) => s.is_present).length;
          const totalCount = lessonData.students.length;
          
          lessonStats[lessonData.lesson.id] = {
            lessonName: lessonData.lesson.name,
            date: new Date(lessonData.lesson.date).toLocaleDateString(),
            presentCount: presentCount,
            absentCount: totalCount - presentCount,
            totalCount: totalCount,
            percentage: totalCount > 0 ? (presentCount / totalCount * 100) : 0
          };
        });
        
        setAttendances(allAttendances);
        calculateCompleteStats(allAttendances, lessonStats);
      }
      else {
        response = await api.get('/attendance', {
          params: {
            startDate: formatDateForBackend(filters.startDate, false),
            endDate: formatDateForBackend(filters.endDate, true)
          }
        });
        
        const attendanceData = response.data.attendances || response.data || [];
        setAttendances(attendanceData);
        calculateStats(attendanceData);
      }
      
    } catch (err) {
      console.error(t('admin.attendance.errors.loadingAttendance'), err);
      setError(t('admin.attendance.errors.loadingAttendanceData'));
    } finally {
      setLoading(false);
    }
  }, [filters.lessonId, filters.courseId, filters.startDate, filters.endDate]);
  
  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await fetchAttendanceData();
    setRefreshing(false);
  };
  
  const applyFilters = () => {
    let filtered = [...attendances];
    
    if (!filters.lessonId && filters.startDate && filters.endDate) {
      filtered = filtered.filter(att => {
        if (!att.lesson?.lesson_date) return true;
        const lessonDate = new Date(att.lesson.lesson_date).toISOString().split('T')[0];
        return lessonDate >= filters.startDate && lessonDate <= filters.endDate;
      });
    }
    
    if (filters.subjectId) {
      filtered = filtered.filter(att => 
        att.lesson?.subject?.id === filters.subjectId
      );
    }
    
    if (filters.studentSearch) {
      const searchTerm = filters.studentSearch.toLowerCase();
      filtered = filtered.filter(att => {
        const fullName = `${att.student.name} ${att.student.surname}`.toLowerCase();
        const matricola = att.student.matricola?.toLowerCase() || '';
        return fullName.includes(searchTerm) || matricola.includes(searchTerm);
      });
    }
    
    if (filters.showOnlyPresent) {
      filtered = filtered.filter(att => att.is_present);
    } else if (filters.showOnlyAbsent) {
      filtered = filtered.filter(att => !att.is_present);
    }
    
    setFilteredAttendances(filtered);
  };
  
  const calculateStudentStats = (data: Attendance[]) => {
    const studentStats: any = {};
    
    data.forEach(att => {
      const studentId = att.userId;
      
      if (!studentStats[studentId]) {
        studentStats[studentId] = {
          studentName: `${att.student.name} ${att.student.surname}`,
          matricola: att.student.matricola || '',
          presentCount: 0,
          absentCount: 0,
          totalLessons: 1,
          percentage: 0
        };
      }
      
      if (att.is_present) {
        studentStats[studentId].presentCount++;
      } else {
        studentStats[studentId].absentCount++;
      }
      
      studentStats[studentId].percentage = 
        (studentStats[studentId].presentCount / studentStats[studentId].totalLessons) * 100;
    });
    
    return studentStats;
  };
  
  const calculateStats = (data: Attendance[]) => {
    if (!data.length) {
      setStats(null);
      return;
    }
    
    const uniqueStudentIds = new Set(data.map(att => att.userId));
    const uniqueLessonIds = new Set(data.map(att => att.lessonId));
    
    const presentCount = data.filter(att => att.is_present).length;
    const totalCount = data.length;
    
    setStats({
      totalStudents: uniqueStudentIds.size,
      totalLessons: uniqueLessonIds.size,
      presentStudents: presentCount,
      absentStudents: totalCount - presentCount,
      averageAttendance: totalCount > 0 ? (presentCount / totalCount * 100) : 0,
      attendanceByLesson: {},
      attendanceByStudent: calculateStudentStats(data)
    });
  };
  
  const calculateCompleteStats = (data: Attendance[], lessonStats: any) => {
    const uniqueStudentIds = new Set(data.map(att => att.userId));
    const totalPresences = data.filter(att => att.is_present).length;
    const totalRecords = data.length;
    
    setStats({
      totalStudents: uniqueStudentIds.size,
      totalLessons: Object.keys(lessonStats).length,
      presentStudents: totalPresences,
      absentStudents: totalRecords - totalPresences,
      averageAttendance: totalRecords > 0 ? (totalPresences / totalRecords * 100) : 0,
      attendanceByLesson: lessonStats,
      attendanceByStudent: calculateStudentStats(data)
    });
  };
  
  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const resetFilters = () => {
    setFilters({
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      courseId: null,
      subjectId: null,
      lessonId: null,
      studentSearch: '',
      showOnlyPresent: false,
      showOnlyAbsent: false
    });
  };
  
  const exportToExcel = () => {
    const worksheetData = [
      [t('admin.attendance.export.title')],
      [t('admin.attendance.export.generatedOn'), new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()],
      [''],
      [t('admin.attendance.export.generalSummary')],
      [t('admin.attendance.export.totalStudents'), stats?.totalStudents || 0],
      [t('admin.attendance.export.totalLessons'), stats?.totalLessons || 0],
      [t('admin.attendance.export.totalPresent'), stats?.presentStudents || 0],
      [t('admin.attendance.export.totalAbsent'), stats?.absentStudents || 0],
      [t('admin.attendance.export.averageAttendance'), `${(stats?.averageAttendance || 0).toFixed(2)}%`],
      [''],
      [t('admin.attendance.export.attendanceDetails')],
      [t('admin.attendance.export.headers.student'), t('admin.attendance.export.headers.studentId'), t('admin.attendance.export.headers.lesson'), t('admin.attendance.export.headers.date'), t('admin.attendance.export.headers.status'), t('admin.attendance.export.headers.reliability'), t('admin.attendance.export.headers.timestamp')]
    ];
    
    filteredAttendances.forEach(att => {
      worksheetData.push([
        `${att.student.name} ${att.student.surname}`,
        att.student.matricola || t('common.noData'),
        att.lesson?.name || t('common.noData'),
        att.lesson?.lesson_date ? new Date(att.lesson.lesson_date).toLocaleDateString() : t('common.noData'),
        att.is_present ? t('admin.attendance.status.present') : t('admin.attendance.status.absent'),
        att.is_present && att.confidence > 0 ? `${(att.confidence * 100).toFixed(0)}%` : '-',
        att.timestamp ? new Date(att.timestamp).toLocaleString() : '-'
      ]);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Presenze');
    
    if (stats?.attendanceByLesson && Object.keys(stats.attendanceByLesson).length > 0) {
      const lessonStatsData = [
        [t('admin.attendance.export.lessonStatistics')],
        [t('admin.attendance.export.headers.lesson'), t('admin.attendance.export.headers.date'), t('admin.attendance.export.headers.present'), t('admin.attendance.export.headers.absent'), t('admin.attendance.export.headers.total'), t('admin.attendance.export.headers.attendancePercentage')]
      ];
      
      Object.values(stats.attendanceByLesson).forEach(lesson => {
        lessonStatsData.push([
          `${lesson.lessonName}`,
          `${lesson.date}`,
          `${lesson.presentCount}`,
          `${lesson.absentCount}`,
          `${lesson.totalCount}`,
          `${lesson.percentage.toFixed(2)}%`
        ]);
      });
      
      const wsLessons = XLSX.utils.aoa_to_sheet(lessonStatsData);
      XLSX.utils.book_append_sheet(wb, wsLessons, t('admin.attendance.export.lessonStatsSheet'));
    }
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const fileName = `${t('admin.attendance.export.filename')}_${filters.lessonId ? `${t('admin.attendance.export.lesson')}_${filters.lessonId}_` : ''}${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(data, fileName);
  };
  
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    if (confidence >= 0.4) return 'text-orange-600';
    return 'text-red-600';
  };
  
  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return t('admin.attendance.confidence.high');
    if (confidence >= 0.6) return t('admin.attendance.confidence.medium');
    if (confidence >= 0.4) return t('admin.attendance.confidence.low');
    return t('admin.attendance.confidence.veryLow');
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex justify-center items-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-500 border-t-transparent mx-auto mb-4"></div>
          <h3 className="text-xl font-semibold text-gray-700">{t('admin.attendance.loading.title')}</h3>
          <p className="text-gray-500 mt-2">{t('admin.attendance.loading.subtitle')}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-3 rounded-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">{t('admin.attendance.title')}</h1>
                <p className="text-gray-600">{t('admin.attendance.subtitle')}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 bg-green-100 text-green-700 px-4 py-2 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
              >
                <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{refreshing ? t('common.loading') : t('common.refresh')}</span>
              </button>

              <button
                onClick={exportToExcel}
                disabled={!stats || filteredAttendances.length === 0}
                className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-2.5 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold">{t('admin.attendance.actions.exportExcel')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-6 py-8">
        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.attendance.stats.totalStudents')}</p>
                  <p className="text-3xl font-bold text-gray-800">{stats.totalStudents}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-xl">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.attendance.stats.lessons')}</p>
                  <p className="text-3xl font-bold text-gray-800">{stats.totalLessons}</p>
                </div>
                <div className="bg-indigo-100 p-3 rounded-xl">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.attendance.stats.present')}</p>
                  <p className="text-3xl font-bold text-green-600">{stats.presentStudents}</p>
                </div>
                <div className="bg-green-100 p-3 rounded-xl">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.attendance.stats.absent')}</p>
                  <p className="text-3xl font-bold text-red-600">{stats.absentStudents}</p>
                </div>
                <div className="bg-red-100 p-3 rounded-xl">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{t('admin.attendance.stats.attendancePercentage')}</p>
                  <p className="text-3xl font-bold text-emerald-600">{stats.averageAttendance.toFixed(1)}%</p>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${stats.averageAttendance}%` }}
                    />
                  </div>
                </div>
                <div className="bg-emerald-100 p-3 rounded-xl">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-8">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800">{t('admin.attendance.filters.title')}</h3>
              </div>
              <button
                onClick={resetFilters}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {t('admin.attendance.filters.reset')}
              </button>
            </div>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              {/* Course Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.attendance.filters.course')}</label>
                <select
                  value={filters.courseId || ''}
                  onChange={(e) => handleFilterChange('courseId', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                >
                  <option value="">{t('admin.attendance.filters.allCourses')}</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Lesson Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.attendance.filters.specificLesson')}</label>
                <select
                  value={filters.lessonId || ''}
                  onChange={(e) => handleFilterChange('lessonId', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                >
                  <option value="">{t('admin.attendance.filters.allLessons')}</option>
                  {lessons
                    .filter(lesson => !filters.courseId || lesson.course?.id === filters.courseId)
                    .map(lesson => (
                      <option key={lesson.id} value={lesson.id}>
                        {lesson.name} - {lesson.course?.name || t('common.noData')} ({new Date(lesson.lesson_date).toLocaleDateString()})
                      </option>
                    ))}
                </select>
              </div>
              
              {/* Subject Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.attendance.filters.subject')}</label>
                <select
                  value={filters.subjectId || ''}
                  onChange={(e) => handleFilterChange('subjectId', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all disabled:bg-gray-100"
                  disabled={!!filters.lessonId}
                >
                  <option value="">{t('admin.attendance.filters.allSubjects')}</option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Student Search */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.attendance.filters.searchStudent')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-3 flex items-center pl-4 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path>
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={filters.studentSearch}
                    onChange={(e) => handleFilterChange('studentSearch', e.target.value)}
                    placeholder={t('admin.attendance.filters.studentSearchPlaceholder')}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>
            
            {/* Second row of filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Date Range */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.attendance.filters.period')}</label>
                <div className="flex flex-col md:flex-row">
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all disabled:bg-gray-100"
                    disabled={!!filters.lessonId}
                  />
                  <span className="self-center text-gray-500 font-medium px-3">-</span>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all disabled:bg-gray-100"
                    disabled={!!filters.lessonId}
                  />
                </div>
              </div>
              
              {/* Status Filters */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.attendance.filters.showOnly')}</label>
                <div className="flex space-x-6">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.showOnlyPresent}
                      onChange={(e) => {
                        handleFilterChange('showOnlyPresent', e.target.checked);
                        if (e.target.checked) handleFilterChange('showOnlyAbsent', false);
                      }}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">{t('admin.attendance.filters.onlyPresent')}</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.showOnlyAbsent}
                      onChange={(e) => {
                        handleFilterChange('showOnlyAbsent', e.target.checked);
                        if (e.target.checked) handleFilterChange('showOnlyPresent', false);
                      }}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">{t('admin.attendance.filters.onlyAbsent')}</span>
                  </label>
                </div>
              </div>
            </div>
            
            {/* View mode */}
            <div className="mt-6 flex justify-end">
              <div className="inline-flex rounded-lg shadow-sm border border-gray-200" role="group">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 text-sm font-medium rounded-l-lg border-r border-gray-200 ${
                    viewMode === 'list'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  } transition-colors`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                  {t('admin.attendance.viewModes.list')}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-4 py-2 text-sm font-medium border-r border-gray-200 ${
                    viewMode === 'grid'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  } transition-colors`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM13 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z" />
                  </svg>
                  {t('admin.attendance.viewModes.grid')}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('stats')}
                  className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
                    viewMode === 'stats'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  } transition-colors`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                  {t('admin.attendance.viewModes.statistics')}
                </button>
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
        
        {/* Main content */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800">
                  {viewMode === 'list' && t('admin.attendance.viewModes.detailedList')}
                  {viewMode === 'grid' && t('admin.attendance.viewModes.gridView')}
                  {viewMode === 'stats' && t('admin.attendance.viewModes.statisticalAnalysis')}
                </h3>
              </div>
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
                {filteredAttendances.length} {t('admin.attendance.recordCount', { count: filteredAttendances.length })}
              </span>
            </div>
          </div>
          
          <div className="p-6">
            {/* List View */}
            {viewMode === 'list' && (
              <>
                {filteredAttendances.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('admin.attendance.table.student')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('admin.attendance.table.studentId')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('admin.attendance.table.lesson')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('admin.attendance.table.date')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('admin.attendance.table.status')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('admin.attendance.table.reliability')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('admin.attendance.table.detectedAt')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAttendances.map((attendance, index) => (
                          <tr 
                            key={`${attendance.userId}-${attendance.lessonId}-${index}`}
                            className={`
                              ${attendance.is_present 
                                ? 'hover:bg-green-50' 
                                : 'bg-red-50 hover:bg-red-100'
                              } transition-colors
                            `}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-medium ${
                                  attendance.is_present ? 'bg-green-500' : 'bg-red-500'
                                }`}>
                                  {attendance.student.name.charAt(0)}{attendance.student.surname.charAt(0)}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {attendance.student.name} {attendance.student.surname}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {attendance.student.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{attendance.student.matricola || t('common.noData')}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {attendance.lesson?.name || t('common.noData')}
                              </div>
                              <div className="text-xs text-gray-500">
                                {attendance.lesson?.subject?.name || t('common.noData')}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">
                                {attendance.lesson?.lesson_date 
                                  ? new Date(attendance.lesson.lesson_date).toLocaleDateString()
                                  : t('common.noData')
                                }
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                attendance.is_present
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {attendance.is_present ? (
                                  <>
                                    <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    {t('admin.attendance.status.present')}
                                  </>
                                ) : (
                                  <>
                                    <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                    {t('admin.attendance.status.absent')}
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {attendance.is_present && attendance.confidence > 0 ? (
                                <div className="flex items-center">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">
                                      <span className={getConfidenceColor(attendance.confidence)}>
                                        {(attendance.confidence * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {getConfidenceLabel(attendance.confidence)}
                                    </div>
                                  </div>
                                  <div className="ml-2 w-16">
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                      <div 
                                        className={`h-1.5 rounded-full ${
                                          attendance.confidence >= 0.8 ? 'bg-green-500' :
                                          attendance.confidence >= 0.6 ? 'bg-yellow-500' :
                                          attendance.confidence >= 0.4 ? 'bg-orange-500' :
                                          'bg-red-500'
                                        }`}
                                        style={{ width: `${attendance.confidence * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {attendance.timestamp 
                                ? new Date(attendance.timestamp).toLocaleTimeString([], { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })
                                : '-'
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('admin.attendance.emptyState.noDataFound')}</h3>
                    <p className="text-gray-500 mb-8">
                      {t('admin.attendance.emptyState.noMatchingData')}
                    </p>
                    <button
                      onClick={resetFilters}
                      className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 font-semibold"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {t('admin.attendance.filters.reset')}
                    </button>
                  </div>
                )}
              </>
            )}
            
            {/* Grid View */}
            {viewMode === 'grid' && (
              <>
                {filteredAttendances.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAttendances.map((attendance, index) => (
                      <div 
                        key={`${attendance.userId}-${attendance.lessonId}-${index}`}
                        className={`
                          bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl hover:scale-105 transition-all duration-300
                          ${attendance.is_present 
                            ? 'border-l-4 border-l-green-500' 
                            : 'border-l-4 border-l-red-500'
                          }
                        `}
                      >
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center">
                              <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-medium ${
                                attendance.is_present ? 'bg-green-500' : 'bg-red-500'
                              }`}>
                                {attendance.student.name.charAt(0)}{attendance.student.surname.charAt(0)}
                              </div>
                              <div className="ml-3">
                                <p className="text-sm font-bold text-gray-900">
                                  {attendance.student.name} {attendance.student.surname}
                                </p>
                                <p className="text-xs text-gray-500">{attendance.student.matricola || t('common.noData')}</p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              attendance.is_present
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {attendance.is_present ? t('admin.attendance.status.present') : t('admin.attendance.status.absent')}
                            </span>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex items-center p-3 bg-blue-50 rounded-lg">
                              <svg className="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <div>
                                <p className="text-xs font-medium text-gray-700">{t('admin.attendance.gridView.lesson')}</p>
                                <p className="text-sm text-blue-700 font-semibold">
                                  {attendance.lesson?.name || t('common.noData')}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center p-3 bg-purple-50 rounded-lg">
                              <svg className="w-5 h-5 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <p className="text-xs font-medium text-gray-700">{t('admin.attendance.gridView.date')}</p>
                                <p className="text-sm text-purple-700 font-semibold">
                                  {attendance.lesson?.lesson_date 
                                    ? new Date(attendance.lesson.lesson_date).toLocaleDateString()
                                    : t('common.noData')
                                  }
                                </p>
                              </div>
                            </div>
                            
                            {attendance.is_present && attendance.confidence > 0 && (
                              <div className="flex items-center p-3 bg-green-50 rounded-lg">
                                <svg className="w-5 h-5 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-gray-700">{t('admin.attendance.gridView.reliability')}</p>
                                  <div className="flex items-center">
                                    <p className={`text-sm font-semibold ${getConfidenceColor(attendance.confidence)}`}>
                                      {(attendance.confidence * 100).toFixed(0)}%
                                    </p>
                                    <div className="ml-2 flex-1">
                                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                                        <div 
                                          className={`h-1.5 rounded-full ${
                                            attendance.confidence >= 0.8 ? 'bg-green-500' :
                                            attendance.confidence >= 0.6 ? 'bg-yellow-500' :
                                            attendance.confidence >= 0.4 ? 'bg-orange-500' :
                                            'bg-red-500'
                                          }`}
                                          style={{ width: `${attendance.confidence * 100}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {attendance.timestamp && (
                              <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                                <svg className="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div>
                                  <p className="text-xs font-medium text-gray-700">{t('admin.attendance.gridView.detectedAt')}</p>
                                  <p className="text-sm text-gray-900 font-semibold">
                                    {new Date(attendance.timestamp).toLocaleTimeString([], { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('admin.attendance.emptyState.noGridData')}</h3>
                    <p className="text-gray-500 mb-8">
                      {t('admin.attendance.emptyState.noGridDataDescription')}
                    </p>
                    <button
                      onClick={resetFilters}
                      className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 font-semibold"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {t('admin.attendance.filters.reset')}
                    </button>
                  </div>
                )}
              </>
            )}
            
            {/* Statistics View */}
            {viewMode === 'stats' && stats && (
              <div className="space-y-8">
                {/* Lesson Statistics */}
                {Object.keys(stats.attendanceByLesson).length > 0 && (
                  <div className="bg-gradient-to-br from-white to-blue-50 p-6 rounded-2xl shadow-lg border border-blue-100">
                    <div className="flex items-center space-x-3 mb-6">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-800">{t('admin.attendance.statistics.lessonStatistics')}</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {Object.entries(stats.attendanceByLesson).map(([lessonId, data]) => (
                        <div key={lessonId} className="bg-white p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="font-bold text-gray-900 text-lg">{data.lessonName}</h4>
                              <p className="text-sm text-gray-500">{data.date}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-3xl font-bold text-blue-600">{data.percentage.toFixed(1)}%</p>
                              <p className="text-sm text-gray-500">
                                {data.presentCount}/{data.totalCount} {t('admin.attendance.statistics.present')}
                              </p>
                            </div>
                          </div>
                          
                          <div className="mb-4">
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div 
                                className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                                style={{ width: `${data.percentage}%` }}
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-green-50 rounded-lg">
                              <p className="text-2xl font-bold text-green-600">{data.presentCount}</p>
                              <p className="text-xs text-green-700 font-medium">{t('admin.attendance.statistics.present')}</p>
                            </div>
                            <div className="text-center p-3 bg-red-50 rounded-lg">
                              <p className="text-2xl font-bold text-red-600">{data.absentCount}</p>
                              <p className="text-xs text-red-700 font-medium">{t('admin.attendance.statistics.absent')}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Student Statistics */}
                {Object.keys(stats.attendanceByStudent).length > 0 && (
                  <div className="bg-gradient-to-br from-white to-green-50 p-6 rounded-2xl shadow-lg border border-green-100">
                    <div className="flex items-center space-x-3 mb-6">
                      <div className="bg-green-100 p-2 rounded-lg">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-800">{t('admin.attendance.statistics.studentStatistics')}</h3>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {t('admin.attendance.statistics.student')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {t('admin.attendance.statistics.studentId')}
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {t('admin.attendance.statistics.present')}
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {t('admin.attendance.statistics.absent')}
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {t('admin.attendance.statistics.attendancePercentage')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {Object.entries(stats.attendanceByStudent)
                            .sort(([,a], [,b]) => b.percentage - a.percentage)
                            .map(([studentId, data]) => (
                            <tr key={studentId} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {data.studentName}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500">
                                  {data.matricola}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  {data.presentCount}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  {data.absentCount}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center justify-center space-x-2">
                                  <span className={`font-bold text-lg ${
                                    data.percentage >= 75 ? 'text-green-600' :
                                    data.percentage >= 50 ? 'text-yellow-600' :
                                    'text-red-600'
                                  }`}>
                                    {data.percentage.toFixed(1)}%
                                  </span>
                                  <div className="w-16">
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div 
                                        className={`h-2 rounded-full ${
                                          data.percentage >= 75 ? 'bg-green-500' :
                                          data.percentage >= 50 ? 'bg-yellow-500' :
                                          'bg-red-500'
                                        }`}
                                        style={{ width: `${data.percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendancePanel;