import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import teacherService, { Course, Classroom, Subject, CreateLessonData } from '../../services/teacherService';
import { Lesson } from '../../services/api';
import FullscreenLoader from '../common/FullscreenLoader';
import DynamicButton from '../common/DynamicButton';

const CreateLesson: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const [lessonData, setLessonData] = useState({
    name: '',
    lesson_date: new Date().toISOString().split('T')[0],
    lesson_start: '09:00',
    lesson_end: '10:00',
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
      const [coursesData, classroomsData, lessonsData] = await Promise.all([
        teacherService.getCourses(),
        teacherService.getClassrooms(),
        teacherService.getLessons()
      ]);
      setCourses(coursesData);
      setClassrooms(classroomsData);
      setLessons(lessonsData);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || t('teacher.lessons.create.errorLoadingData'));
    } finally {
      setLoading(false);
    }
  };

  const loadSubjects = async (courseId: number) => {
    try {
      const subjectsData = await teacherService.getSubjects(courseId);
      setSubjects(subjectsData);
    } catch (err: any) {
      console.error(t('teacher.lessons.create.errorLoadingSubjects')+':', err);
    }
  };

  const handleInputChange = (field: string, value: string | number | undefined) => {
    setLessonData(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-calculate end time when start time changes
    if (field === 'lesson_start' && value) {
      const isDefaultEndTime = !lessonData.lesson_end || lessonData.lesson_end === '10:00';
      
      if (isDefaultEndTime) {
        const startTime = new Date(`2000-01-01T${value}`);
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
        const endTimeStr = String(endTime.getHours()).padStart(2, '0') + ':' + String(endTime.getMinutes()).padStart(2, '0');
        
        setLessonData(prev => ({
          ...prev,
          lesson_end: endTimeStr
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    
    const validationErrors = [];
    if (!lessonData.name.trim()) validationErrors.push(t('admin.lessons.form.validation.nameRequired'));
    if (!lessonData.lesson_date) validationErrors.push(t('admin.lessons.form.validation.dateRequired'));
    if (!lessonData.lesson_start) validationErrors.push(t('admin.lessons.form.validation.startTimeRequired'));
    if (!lessonData.lesson_end) validationErrors.push(t('admin.lessons.form.validation.endTimeRequired'));
    if (!lessonData.course_id) validationErrors.push(t('admin.lessons.form.validation.courseRequired'));
    if (!lessonData.classroom_id) validationErrors.push(t('admin.lessons.form.validation.classroomRequired'));

    const startTime = new Date(`${lessonData.lesson_date}T${lessonData.lesson_start}`);
    const endTime = new Date(`${lessonData.lesson_date}T${lessonData.lesson_end}`);
    if (endTime <= startTime) {
      validationErrors.push(t('admin.lessons.form.validation.endTimeAfterStart'));
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
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
      setError(err.response?.data?.error || t('teacher.lessons.create.errorCreatingLesson'));
    } finally {
      setCreating(false);
    }
  };

  const selectedClassroom = classrooms.find(c => c.id === lessonData.classroom_id);
  const filteredSubjects = subjects.filter(subject => 
    !lessonData.course_id || subject.course_id === lessonData.course_id
  );

  if (loading) {
    return (
      <FullscreenLoader 
        message={t('teacher.lessons.create.loading')}
        stages={[
          'Caricamento form...',
          'Preparazione corsi...',
          'Inizializzazione...'
        ]}
        stageDuration={800}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-xl">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">{t('teacher.lessons.create.title')}</h1>
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

      {/* Form */}
      <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nome Lezione */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
              {t('teacher.lessons.create.nameLabel')}
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={lessonData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder={t('admin.lessons.form.namePlaceholder')}
              className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
            />
          </div>

          {/* Data */}
          <div>
            <label htmlFor="lesson_date" className="block text-sm font-medium text-gray-300 mb-2">
              {t('admin.lessons.form.dateLabel')}
            </label>
            <input
              type="date"
              id="lesson_date"
              name="lesson_date"
              value={lessonData.lesson_date}
              onChange={(e) => handleInputChange('lesson_date', e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
            />
          </div>

          {/* Orario inizio e fine */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="lesson_start" className="block text-sm font-medium text-gray-300 mb-2">
                {t('admin.lessons.form.startTimeLabel')}
              </label>
              <input
                type="time"
                id="lesson_start"
                name="lesson_start"
                value={lessonData.lesson_start}
                onChange={(e) => handleInputChange('lesson_start', e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
              />
            </div>
            <div>
              <label htmlFor="lesson_end" className="block text-sm font-medium text-gray-300 mb-2">
                {t('admin.lessons.form.endTimeLabel')}
              </label>
              <input
                type="time"
                id="lesson_end"
                name="lesson_end"
                value={lessonData.lesson_end}
                onChange={(e) => handleInputChange('lesson_end', e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
              />
            </div>
          </div>

          {/* Corso */}
          <div>
            <label htmlFor="course_id" className="block text-sm font-medium text-gray-300 mb-2">
              {t('admin.lessons.form.courseLabel')}
            </label>
            <select
              id="course_id"
              name="course_id"
              value={lessonData.course_id}
              onChange={(e) => handleInputChange('course_id', parseInt(e.target.value))}
              required
              className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
            >
              <option value={0}>{t('admin.lessons.form.selectCourse')}</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>

          {/* Materia */}
          <div>
            <label htmlFor="subject_id" className="block text-sm font-medium text-gray-300 mb-2">
              {t('admin.lessons.form.subjectLabel')}
            </label>
            <select
              id="subject_id"
              name="subject_id"
              value={lessonData.subject_id || 0}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                handleInputChange('subject_id', value || undefined);
              }}
              className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 disabled:opacity-50"
              disabled={!lessonData.course_id}
            >
              <option value={0}>{t('admin.lessons.form.selectSubject')}</option>
              {filteredSubjects.map(subject => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          {/* Aula */}
          <div>
            <label htmlFor="classroom_id" className="block text-sm font-medium text-gray-300 mb-2">
              {t('admin.lessons.form.classroomLabel')}
            </label>
            <select
              id="classroom_id"
              name="classroom_id"
              value={lessonData.classroom_id}
              onChange={(e) => handleInputChange('classroom_id', parseInt(e.target.value))}
              required
              className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
            >
              <option value={0}>{t('admin.lessons.form.selectClassroom')}</option>
              {classrooms.map(classroom => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </option>
              ))}
            </select>
            
          </div>


          {/* Error Display */}
          {(error || errors.length > 0) && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4">
              {error && (
                <div className="flex items-center mb-2">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-red-300">{error}</span>
                </div>
              )}
              {errors.map((validationError, index) => (
                <div key={index} className="flex items-center mb-1">
                  <svg className="w-4 h-4 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-red-300 text-sm">{validationError}</span>
                </div>
              ))}
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-600">
            <button
              type="button"
              onClick={() => navigate('/teacher')}
              className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors text-sm"
            >
              {t('common.cancel')}
            </button>
            <DynamicButton
              type="submit"
              loading={creating}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 text-sm"
              loadingStages={[
                { message: 'Creazione...', color: 'border-blue-300' },
                { message: 'Validazione...', color: 'border-yellow-300' },
                { message: 'Salvataggio...', color: 'border-green-300' }
              ]}
              stageDuration={800}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>{t('admin.lessons.form.create')}</span>
            </DynamicButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateLesson;