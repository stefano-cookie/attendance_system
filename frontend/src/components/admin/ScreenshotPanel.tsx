// frontend/src/components/admin/ScreenshotPanel.tsx - UI REDESIGN
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

interface Screenshot {
  id: number;
  path: string;
  url?: string;
  timestamp: string;
  lessonId?: number;
  detectedFaces?: number;
  lesson?: {
    id: number;
    name: string;
    date: string;
  };
  classroom?: {
    id: number;
    name: string;
  };
  Lesson?: {
    id: number;
    name: string;
    lesson_date: string;
    classroomId: number;
    Classroom?: {
      id: number;
      name: string;
    };
  };
}

interface Filters {
  startDate: string;
  endDate: string;
  classroomId: number | null;
  lessonId: number | null;
  sortOrder: 'latest' | 'oldest';
  minFaces: number;
}

const ScreenshotPanel: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [filteredScreenshots, setFilteredScreenshots] = useState<Screenshot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<Screenshot | null>(null);
  const [showFullscreen, setShowFullscreen] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // Dati per filtri
  const [classrooms, setClassrooms] = useState<{ id: number; name: string }[]>([]);
  const [lessons, setLessons] = useState<{ id: number; name: string; lesson_date: string }[]>([]);
  
  // Filtri
  const [filters, setFilters] = useState<Filters>({
    startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    classroomId: null,
    lessonId: null,
    sortOrder: 'latest',
    minFaces: 0
  });
  
  // Modalità visualizzazione
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  useEffect(() => {
    loadInitialData();
  }, []);
  
  useEffect(() => {
    applyFilters();
  }, [screenshots, filters]);
  
  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchScreenshots(),
        fetchClassrooms(),
        fetchLessons()
      ]);
    } catch (err) {
      console.error('Errore caricamento dati iniziali:', err);
      setError(t('admin.screenshots.errors.loading'));
    } finally {
      setLoading(false);
    }
  };
  
  const fetchScreenshots = async () => {
    try {
      const response = await api.get('/admin/screenshots', {
        params: {
          include: 'lesson,classroom'
        }
      });
      
      const screenshotsData = (response.data.screenshots || response.data || []).map((screenshot: Screenshot) => {
        // Normalizza la struttura dei dati
        const normalizedScreenshot = {
          ...screenshot,
          // Gestisci diverse strutture di risposta
          lesson: screenshot.lesson || (screenshot.Lesson ? {
            id: screenshot.Lesson.id,
            name: screenshot.Lesson.name,
            date: screenshot.Lesson.lesson_date
          } : undefined),
          classroom: screenshot.classroom || (screenshot.Lesson?.Classroom ? {
            id: screenshot.Lesson.Classroom.id,
            name: screenshot.Lesson.Classroom.name
          } : undefined)
        };
        
        // Assicurati che l'URL sia presente
        if (!normalizedScreenshot.url && normalizedScreenshot.path) {
          // Estrai il percorso relativo dalla directory reports
          const reportsDir = '/Users/stebbi/attendance-system/data/reports';
          let relativePath;
          
          if (normalizedScreenshot.path.includes(reportsDir)) {
            relativePath = normalizedScreenshot.path.replace(reportsDir, '').replace(/^\/+/, '');
          } else if (normalizedScreenshot.path.includes('/data/reports/')) {
            const parts = normalizedScreenshot.path.split('/data/reports/');
            relativePath = parts[1] || normalizedScreenshot.path;
          } else {
            relativePath = normalizedScreenshot.path.split('/').pop(); // fallback
          }
          
          normalizedScreenshot.url = `http://localhost:4321/static/screenshots/${relativePath}`;
        }
        
        return normalizedScreenshot;
      });
      
      setScreenshots(screenshotsData);
      setError(null);
    } catch (err) {
      console.error('Errore nel caricamento degli screenshots:', err);
      throw err;
    }
  };
  
  const fetchClassrooms = async () => {
    try {
      const response = await api.get('/classrooms');
      setClassrooms(response.data.data || []);
    } catch (err) {
      console.error('Errore nel caricamento delle aule:', err);
    }
  };
  
  const fetchLessons = async () => {
    try {
      const response = await api.get('/lessons');
      setLessons(response.data || []);
    } catch (err) {
      console.error('Errore nel caricamento delle lezioni:', err);
    }
  };
  
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchScreenshots();
    } catch (err) {
      setError(t('admin.screenshots.errors.refreshing'));
    } finally {
      setRefreshing(false);
    }
  };
  
  const applyFilters = () => {
    let filtered = [...screenshots];
    
    // Filtra per data (aggiungi ore per includere tutto il giorno)
    if (filters.startDate && filters.endDate) {
      const startDate = new Date(filters.startDate + 'T00:00:00');
      const endDate = new Date(filters.endDate + 'T23:59:59');
      
      filtered = filtered.filter(screenshot => {
        if (!screenshot.timestamp) return true;
        const screenshotDate = new Date(screenshot.timestamp);
        return screenshotDate >= startDate && screenshotDate <= endDate;
      });
    }
    
    // Filtra per aula
    if (filters.classroomId) {
      filtered = filtered.filter(screenshot => 
        screenshot.classroom?.id === filters.classroomId
      );
    }
    
    // Filtra per lezione
    if (filters.lessonId) {
      filtered = filtered.filter(screenshot => 
        screenshot.lessonId === filters.lessonId
      );
    }
    
    // Filtra per numero minimo di volti
    if (filters.minFaces > 0) {
      filtered = filtered.filter(screenshot => 
        (screenshot.detectedFaces || 0) >= filters.minFaces
      );
    }
    
    // Ordina per data
    filtered.sort((a, b) => {
      const dateA = new Date(a.timestamp || 0).getTime();
      const dateB = new Date(b.timestamp || 0).getTime();
      return filters.sortOrder === 'latest' ? dateB - dateA : dateA - dateB;
    });
    
    setFilteredScreenshots(filtered);
  };
  
  const handleFilterChange = (key: keyof Filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const resetFilters = () => {
    setFilters({
      startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      classroomId: null,
      lessonId: null,
      sortOrder: 'latest',
      minFaces: 0
    });
  };
  
  const handleImageClick = (screenshot: Screenshot) => {
    setSelectedImage(screenshot);
    setShowFullscreen(true);
  };
  
  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getFacesColor = (faces: number) => {
    if (faces >= 10) return 'bg-red-500';
    if (faces >= 5) return 'bg-orange-500';
    if (faces >= 1) return 'bg-green-500';
    return 'bg-gray-500';
  };

  const handleDownload = async (screenshot: Screenshot) => {
    try {
      // Genera nome file con informazioni utili
      const date = new Date(screenshot.timestamp).toISOString().split('T')[0];
      const time = new Date(screenshot.timestamp).toTimeString().split(' ')[0].replace(/:/g, '');
      const lessonName = screenshot.lesson?.name || `Lezione_${screenshot.lessonId}`;
      const classroomName = screenshot.classroom?.name || 'Aula_Unknown';
      
      const fileName = `Screenshot_${lessonName}_${classroomName}_${date}_${time}.jpg`
        .replace(/[^a-zA-Z0-9._-]/g, '_'); // Rimuovi caratteri non validi
      
      // Fetch dell'immagine
      const response = await fetch(screenshot.url || screenshot.path);
      const blob = await response.blob();
      
      // Crea link di download temporaneo
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Errore durante il download:', error);
      // Fallback: apri in nuova finestra
      window.open(screenshot.url || screenshot.path, '_blank');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex justify-center items-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <h3 className="text-xl font-semibold text-gray-700">{t('admin.screenshots.loading.title')}</h3>
          <p className="text-gray-500 mt-2">{t('admin.screenshots.loading.subtitle')}</p>
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
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 rounded-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">{t('admin.screenshots.title')}</h1>
                <p className="text-gray-600">{t('admin.screenshots.subtitle')}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {filteredScreenshots.length} {t('admin.screenshots.stats.totalScreenshots')}
              </span>
              
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
              >
                <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{refreshing ? t('admin.screenshots.stats.refreshing') : t('admin.screenshots.stats.refresh')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow">
            <div className="flex items-center">
              <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}
        
        {/* Pannello Filtri */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800">{t('admin.screenshots.filters.title')}</h3>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={resetFilters}
                  className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  {t('admin.screenshots.filters.reset')}
                </button>
                
                {/* Modalità visualizzazione */}
                <div className="flex flex-col md:flex-row rounded-lg shadow-sm" role="group">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${
                      viewMode === 'grid'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    {t('admin.screenshots.viewModes.grid')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`px-4 py-2 text-sm font-medium rounded-r-lg border ${
                      viewMode === 'list'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    {t('admin.screenshots.viewModes.list')}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {/* Periodo */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.screenshots.filters.period')}</label>
                <div className="flex flex-col md:flex-row">
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="self-center text-gray-500 px-3">-</span>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              {/* Aula */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.screenshots.filters.classroom')}</label>
                <select
                  value={filters.classroomId || ''}
                  onChange={(e) => handleFilterChange('classroomId', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t('admin.screenshots.filters.allClassrooms')}</option>
                  {classrooms.map(classroom => (
                    <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Lezione */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.screenshots.filters.lesson')}</label>
                <select
                  value={filters.lessonId || ''}
                  onChange={(e) => handleFilterChange('lessonId', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t('admin.screenshots.filters.allLessons')}</option>
                  {lessons
                    .map(lesson => (
                      <option key={lesson.id} value={lesson.id}>
                        {lesson.name || `Lezione ${lesson.id}`} - {new Date(lesson.lesson_date).toLocaleDateString('it-IT')}
                      </option>
                    ))}
                </select>
              </div>
              
              {/* Volti minimi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.screenshots.filters.minFaces')}</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={filters.minFaces}
                  onChange={(e) => handleFilterChange('minFaces', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
            </div>
            
            {/* Ordinamento */}
            <div className="mt-4 flex justify-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.screenshots.filters.sorting')}</label>
                <select
                  value={filters.sortOrder}
                  onChange={(e) => handleFilterChange('sortOrder', e.target.value as 'latest' | 'oldest')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="latest">{t('admin.screenshots.filters.latestFirst')}</option>
                  <option value="oldest">{t('admin.screenshots.filters.oldestFirst')}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        
        {/* Contenuto Screenshots */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredScreenshots.length > 0 ? (
              filteredScreenshots.map((screenshot) => (
                <div
                  key={screenshot.id}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-105"
                  onClick={() => handleImageClick(screenshot)}
                >
                  <div className="relative">
                    <img
                      src={screenshot.url || screenshot.path}
                      alt={`Screenshot ${screenshot.id}`}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        console.error('Errore caricamento immagine:', screenshot);
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBOL0E8L3RleHQ+PC9zdmc+';
                      }}
                    />
                    
                    {/* Badge volti rilevati */}
                    <div className={`absolute top-3 right-3 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-lg ${getFacesColor(screenshot.detectedFaces || 0)}`}>
                      {screenshot.detectedFaces || 0} 👥
                    </div>
                    
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="flex items-center justify-between text-white">
                          <div className="flex items-center space-x-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span className="text-sm font-medium">{t('admin.screenshots.actions.view')}</span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(screenshot);
                              }}
                              className="bg-green-600 hover:bg-green-700 p-2 rounded-lg transition-colors shadow-lg"
                              title={t('admin.screenshots.actions.download')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </button>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(screenshot.url || screenshot.path, '_blank');
                              }}
                              className="bg-blue-600 hover:bg-blue-700 p-2 rounded-lg transition-colors shadow-lg"
                              title={t('admin.screenshots.actions.openNewWindow')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="text-sm text-gray-500 mb-1">
                          {formatDateTime(screenshot.timestamp)}
                        </p>
                        <p className="font-medium text-gray-800 truncate">
                          {screenshot.classroom?.name || screenshot.lesson?.name || t('admin.screenshots.messages.classroomNotSpecified')}
                        </p>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(screenshot);
                          }}
                          className="text-green-600 hover:text-green-800 transition-colors p-1"
                          title={t('admin.screenshots.actions.download')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(screenshot.url || screenshot.path, '_blank');
                          }}
                          className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                          title={t('admin.screenshots.actions.openNewWindow')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      {screenshot.lesson?.name || `${t('admin.screenshots.filters.lesson')} ${screenshot.lessonId || t('admin.screenshots.messages.lessonNA')}`}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-16 bg-white rounded-2xl shadow-lg">
                <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 className="text-xl font-medium text-gray-900 mb-2">{t('admin.screenshots.emptyState.noScreenshots')}</h3>
                <p className="text-gray-500 mb-4">
                  {t('admin.screenshots.emptyState.noScreenshotsDesc')}
                </p>
                <button
                  onClick={resetFilters}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t('admin.screenshots.emptyState.resetFilters')}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Vista Lista */
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.screenshots.table.preview')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.screenshots.table.dateTime')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.screenshots.table.classroom')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.screenshots.table.lesson')}
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.screenshots.table.faces')}
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.screenshots.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredScreenshots.map((screenshot) => (
                    <tr 
                      key={screenshot.id} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleImageClick(screenshot)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <img
                          src={screenshot.url || screenshot.path}
                          alt={`Screenshot ${screenshot.id}`}
                          className="h-16 w-16 object-cover rounded-lg shadow"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2RkZCI+PHBhdGggZD0iTTAgMGgyNHYyNEgweiIvPjx0ZXh0IHg9IjEyIiB5PSIxMiIgZm9udC1zaXplPSI2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tk88L3RleHQ+PC9zdmc+';
                          }}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatDateTime(screenshot.timestamp)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {screenshot.classroom?.name || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {screenshot.lesson?.name || `${t('admin.screenshots.filters.lesson')} ${screenshot.lessonId || t('admin.screenshots.messages.lessonNA')}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${getFacesColor(screenshot.detectedFaces || 0)}`}>
                          {screenshot.detectedFaces || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(screenshot);
                            }}
                            className="text-green-600 hover:text-green-900 transition-colors p-1"
                            title={t('admin.screenshots.actions.download')}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(screenshot.url || screenshot.path, '_blank');
                            }}
                            className="text-blue-600 hover:text-blue-900 transition-colors p-1"
                            title={t('admin.screenshots.actions.openNewWindow')}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Modal Fullscreen */}
        {showFullscreen && selectedImage && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center p-4">
            <div className="relative w-full max-w-6xl">
              <div className="absolute top-0 right-0 -mt-16 -mr-4 flex items-center space-x-2 z-10">
                <button
                  onClick={() => handleDownload(selectedImage)}
                  className="bg-green-600 bg-opacity-90 backdrop-blur-sm rounded-full p-3 text-white hover:bg-green-700 transition-colors shadow-lg"
                  title={t('admin.screenshots.actions.download')}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
                
                <button
                  onClick={() => window.open(selectedImage.url || selectedImage.path, '_blank')}
                  className="bg-blue-600 bg-opacity-90 backdrop-blur-sm rounded-full p-3 text-white hover:bg-blue-700 transition-colors shadow-lg"
                  title={t('admin.screenshots.actions.openNewWindow')}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
                
                <button
                  onClick={() => setShowFullscreen(false)}
                  className="bg-white bg-opacity-20 backdrop-blur-sm rounded-full p-3 text-white hover:bg-opacity-30 transition-colors"
                  aria-label={t('admin.screenshots.modal.close')}
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src={selectedImage.url || selectedImage.path}
                  alt={`Screenshot ${selectedImage.id}`}
                  className="w-full h-auto max-h-[70vh] object-contain"
                />
                
                <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div className="bg-blue-100 rounded-full p-3 w-16 h-16 flex items-center justify-center mx-auto mb-2">
                        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-600">{t('admin.screenshots.modal.dateTime')}</p>
                      <p className="text-lg font-bold text-gray-800">{formatDateTime(selectedImage.timestamp)}</p>
                    </div>
                    
                    <div className="text-center">
                      <div className="bg-green-100 rounded-full p-3 w-16 h-16 flex items-center justify-center mx-auto mb-2">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-600">{t('admin.screenshots.modal.classroom')}</p>
                      <p className="text-lg font-bold text-gray-800">{selectedImage.classroom?.name || 'N/A'}</p>
                    </div>
                    
                    <div className="text-center">
                      <div className="bg-purple-100 rounded-full p-3 w-16 h-16 flex items-center justify-center mx-auto mb-2">
                        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-600">{t('admin.screenshots.modal.lesson')}</p>
                      <p className="text-lg font-bold text-gray-800">{selectedImage.lesson?.name || `${t('admin.screenshots.filters.lesson')} ${selectedImage.lessonId || t('admin.screenshots.messages.lessonNA')}`}</p>
                    </div>
                    
                    <div className="text-center">
                      <div className={`rounded-full p-3 w-16 h-16 flex items-center justify-center mx-auto mb-2 text-white ${getFacesColor(selectedImage.detectedFaces || 0).replace('bg-', 'bg-')}`}>
                        <span className="text-2xl font-bold">{selectedImage.detectedFaces || 0}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-600">{t('admin.screenshots.modal.facesDetected')}</p>
                      <p className="text-sm text-gray-500">{t('admin.screenshots.modal.inAnalyzedFrame')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScreenshotPanel;