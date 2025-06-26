import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import teacherService, { Course, Classroom, Subject, CreateLessonData } from '../../services/teacherService';

const CreateLesson: React.FC = () => {
  const navigate = useNavigate();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lessonData, setLessonData] = useState<CreateLessonData>({
    name: '',
    lesson_date: new Date().toISOString().slice(0, 16), // formato datetime-local
    course_id: 0,
    subject_id: undefined,
    classroom_id: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (lessonData.course_id > 0) {
      loadSubjects(lessonData.course_id);
    } else {
      setSubjects([]);
    }
  }, [lessonData.course_id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [coursesData, classroomsData] = await Promise.all([
        teacherService.getCourses(),
        teacherService.getClassrooms()
      ]);
      setCourses(coursesData);
      setClassrooms(classroomsData);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore caricamento dati');
    } finally {
      setLoading(false);
    }
  };

  const loadSubjects = async (courseId: number) => {
    try {
      const subjectsData = await teacherService.getSubjects(courseId);
      setSubjects(subjectsData);
    } catch (err: any) {
      console.error('Errore caricamento materie:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setLessonData(prev => ({
      ...prev,
      [name]: name === 'course_id' || name === 'classroom_id' || name === 'subject_id' 
        ? parseInt(value) || undefined 
        : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!lessonData.course_id || !lessonData.classroom_id) {
      setError('Corso e aula sono obbligatori');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      
      const result = await teacherService.createLesson(lessonData);
      
      if (result.success) {
        // Naviga direttamente alla lezione creata per iniziare il riconoscimento facciale
        navigate(`/teacher/lessons/${result.lesson.id}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante la creazione della lezione');
    } finally {
      setCreating(false);
    }
  };

  const selectedClassroom = classrooms.find(c => c.id === lessonData.classroom_id);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-xl">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Nuova Lezione</h1>
          </div>
          <button 
            onClick={() => navigate('/teacher')}
            className="text-gray-600 hover:text-gray-900"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nome Lezione */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Nome Lezione (opzionale)
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={lessonData.name}
              onChange={handleInputChange}
              placeholder="Es. Lezione di Matematica - Algebra..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Data e Ora */}
          <div>
            <label htmlFor="lesson_date" className="block text-sm font-medium text-gray-700 mb-2">
              Data e Ora *
            </label>
            <input
              type="datetime-local"
              id="lesson_date"
              name="lesson_date"
              value={lessonData.lesson_date}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Corso */}
          <div>
            <label htmlFor="course_id" className="block text-sm font-medium text-gray-700 mb-2">
              Corso *
            </label>
            <select
              id="course_id"
              name="course_id"
              value={lessonData.course_id}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Seleziona un corso...</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>

          {/* Materia */}
          {subjects.length > 0 && (
            <div>
              <label htmlFor="subject_id" className="block text-sm font-medium text-gray-700 mb-2">
                Materia (opzionale)
              </label>
              <select
                id="subject_id"
                name="subject_id"
                value={lessonData.subject_id || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Nessuna materia specifica</option>
                {subjects.map(subject => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Aula */}
          <div>
            <label htmlFor="classroom_id" className="block text-sm font-medium text-gray-700 mb-2">
              Aula *
            </label>
            <select
              id="classroom_id"
              name="classroom_id"
              value={lessonData.classroom_id}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Seleziona un'aula...</option>
              {classrooms.map(classroom => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name} {classroom.hasCamera ? '📹' : ''}
                </option>
              ))}
            </select>
            
            {/* Camera Status Display */}
            {selectedClassroom && (
              <div className="mt-3 p-4 rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${selectedClassroom.hasCamera ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <div>
                      <h4 className="font-medium text-gray-900">{selectedClassroom.name}</h4>
                      <p className="text-sm text-gray-600">
                        {selectedClassroom.hasCamera 
                          ? 'Camera IP configurata - Riconoscimento facciale disponibile' 
                          : 'Nessuna camera configurata - Presenza manuale richiesta'
                        }
                      </p>
                    </div>
                  </div>
                  {selectedClassroom.hasCamera && (
                    <div className="flex items-center space-x-2 text-green-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium">Auto Rilevamento</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/teacher')}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {creating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Creazione...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Crea Lezione</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateLesson;