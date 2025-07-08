import React, { useState, useEffect } from 'react';
import { Lesson, Course, Subject, Classroom, User } from '../../services/api';
import { useTranslation } from 'react-i18next';

interface LessonData {
  id?: number;
  name: string;
  lesson_date: string;
  lesson_start: string;
  lesson_end: string;
  course_id: number;
  subject_id?: number;
  classroom_id: number;
  teacher_id?: number;
}

interface LessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: LessonData) => void;
  lesson?: Lesson | null;
  courses: Course[];
  subjects: Subject[];
  classrooms: Classroom[];
  teachers: User[];
  lessons: Lesson[];
  defaultDate?: Date;
  defaultHour?: number;
}

const LessonModal: React.FC<LessonModalProps> = ({
  isOpen,
  onClose,
  onSave,
  lesson,
  courses,
  subjects,
  classrooms,
  teachers,
  lessons,
  defaultDate,
  defaultHour = 9
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<LessonData>({
    name: '',
    lesson_date: '',
    lesson_start: '',
    lesson_end: '',
    course_id: 0,
    subject_id: 0,
    classroom_id: 0,
    teacher_id: 0
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Function to check for classroom conflicts
  const checkClassroomConflicts = (data: LessonData) => {
    const { lesson_date, lesson_start, lesson_end, classroom_id, id } = data;
    
    if (!lesson_date || !lesson_start || !lesson_end || !classroom_id) {
      return { hasConflict: false, conflictingLessons: [], availableClassrooms: [] };
    }

    const startDateTime = new Date(`${lesson_date}T${lesson_start}`);
    const endDateTime = new Date(`${lesson_date}T${lesson_end}`);

    const conflictingLessons = lessons.filter(existingLesson => {
      // Skip the current lesson if editing
      if (id && existingLesson.id === id) return false;
      
      // Only check lessons in the same classroom
      if (existingLesson.classroom_id !== classroom_id) return false;

      const existingDate = new Date(existingLesson.lesson_date);
      const existingDay = existingDate.toISOString().split('T')[0];
      
      // Only check lessons on the same day
      if (existingDay !== lesson_date) return false;

      const existingStart = new Date(existingLesson.lesson_date);
      // Try to get actual end time from lesson data, otherwise assume 60 minutes
      const existingEnd = existingLesson.lesson_end 
        ? new Date(`${existingDay}T${existingLesson.lesson_end}`)
        : new Date(existingStart.getTime() + 60 * 60 * 1000);

      // Check for overlap
      return (
        (startDateTime < existingEnd && endDateTime > existingStart) ||
        (existingStart < endDateTime && existingEnd > startDateTime)
      );
    });

    // Find available classrooms at the same time
    const availableClassrooms = classrooms.filter(classroom => {
      const hasConflict = lessons.some(existingLesson => {
        // Skip the current lesson if editing
        if (id && existingLesson.id === id) return false;
        
        // Only check lessons in this classroom
        if (existingLesson.classroom_id !== classroom.id) return false;

        const existingDate = new Date(existingLesson.lesson_date);
        const existingDay = existingDate.toISOString().split('T')[0];
        
        // Only check lessons on the same day
        if (existingDay !== lesson_date) return false;

        const existingStart = new Date(existingLesson.lesson_date);
        // Try to get actual end time from lesson data, otherwise assume 60 minutes
        const existingEnd = existingLesson.lesson_end 
          ? new Date(`${existingDay}T${existingLesson.lesson_end}`)
          : new Date(existingStart.getTime() + 60 * 60 * 1000);

        // Check for overlap
        return (
          (startDateTime < existingEnd && endDateTime > existingStart) ||
          (existingStart < endDateTime && existingEnd > startDateTime)
        );
      });

      return !hasConflict;
    });

    return {
      hasConflict: conflictingLessons.length > 0,
      conflictingLessons,
      availableClassrooms
    };
  };

  useEffect(() => {
    if (isOpen) {
      if (lesson) {
        const lessonDate = new Date(lesson.lesson_date);
        
        // Usa il fuso orario locale per evitare problemi di conversione
        const dateStr = lessonDate.toISOString().split('T')[0];
        
        // Usa i campi lesson_start e lesson_end se disponibili, altrimenti estrai dalla lesson_date
        let startTime, endTime;
        
        if (lesson.lesson_start) {
          startTime = lesson.lesson_start;
        } else {
          // Estrai l'orario dalla lesson_date, gestendo il fuso orario locale
          startTime = String(lessonDate.getHours()).padStart(2, '0') + ':' + String(lessonDate.getMinutes()).padStart(2, '0');
        }
        
        if (lesson.lesson_end) {
          endTime = lesson.lesson_end;
        } else {
          // Calcola l'orario di fine aggiungendo 60 minuti
          const endDate = new Date(lessonDate.getTime() + 60 * 60 * 1000);
          endTime = String(endDate.getHours()).padStart(2, '0') + ':' + String(endDate.getMinutes()).padStart(2, '0');
        }

        console.log('📝 Loading lesson for edit:', {
          lesson_date: lesson.lesson_date,
          lesson_start: lesson.lesson_start,
          lesson_end: lesson.lesson_end,
          calculated_date: dateStr,
          calculated_start: startTime,
          calculated_end: endTime
        });

        setFormData({
          id: lesson.id,
          name: lesson.name || '',
          lesson_date: dateStr,
          lesson_start: startTime,
          lesson_end: endTime,
          course_id: lesson.course_id || 0,
          subject_id: lesson.subject_id || 0,
          classroom_id: lesson.classroom_id || 0,
          teacher_id: lesson.teacher_id || 0
        });
      } else if (defaultDate) {
        const dateStr = defaultDate.toISOString().split('T')[0];
        const startTime = `${defaultHour.toString().padStart(2, '0')}:00`;
        const endTime = `${(defaultHour + 1).toString().padStart(2, '0')}:00`;

        setFormData({
          name: '',
          lesson_date: dateStr,
          lesson_start: startTime,
          lesson_end: endTime,
          course_id: 0,
          subject_id: 0,
          classroom_id: 0,
          teacher_id: 0
        });
      } else {
        setFormData({
          name: '',
          lesson_date: '',
          lesson_start: '09:00',
          lesson_end: '10:00',
          course_id: 0,
          subject_id: 0,
          classroom_id: 0,
          teacher_id: 0
        });
      }
      setErrors([]);
    }
  }, [isOpen, lesson, defaultDate, defaultHour]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const validationErrors = [];
    if (!formData.name.trim()) validationErrors.push(t('admin.lessons.form.validation.nameRequired'));
    if (!formData.lesson_date) validationErrors.push(t('admin.lessons.form.validation.dateRequired'));
    if (!formData.lesson_start) validationErrors.push(t('admin.lessons.form.validation.startTimeRequired'));
    if (!formData.lesson_end) validationErrors.push(t('admin.lessons.form.validation.endTimeRequired'));
    if (!formData.course_id) validationErrors.push(t('admin.lessons.form.validation.courseRequired'));
    if (!formData.classroom_id) validationErrors.push(t('admin.lessons.form.validation.classroomRequired'));

    const startTime = new Date(`${formData.lesson_date}T${formData.lesson_start}`);
    const endTime = new Date(`${formData.lesson_date}T${formData.lesson_end}`);
    if (endTime <= startTime) {
      validationErrors.push(t('admin.lessons.form.validation.endTimeAfterStart'));
    }

    // Check for classroom conflicts
    const conflictCheck = checkClassroomConflicts(formData);
    if (conflictCheck.hasConflict) {
      const selectedClassroom = classrooms.find(c => c.id === formData.classroom_id);
      const classroomName = selectedClassroom ? selectedClassroom.name : 'Sconosciuta';
      
      const conflictTimes = conflictCheck.conflictingLessons.map(lesson => {
        // Use lesson_start and lesson_end directly, or provide defaults
        const startTime = lesson.lesson_start 
          ? lesson.lesson_start.substring(0, 5) // Remove seconds (17:00:00 -> 17:00)
          : '09:00';
        
        const endTime = lesson.lesson_end 
          ? lesson.lesson_end.substring(0, 5) // Remove seconds (18:00:00 -> 18:00)
          : '10:00';
        
        return `${startTime}-${endTime}`;
      }).join(', ');

      validationErrors.push(t('admin.lessons.form.validation.classroomConflict', {
        classroomName,
        conflictTime: conflictTimes
      }));

      // Add suggestions for alternative classrooms
      if (conflictCheck.availableClassrooms.length > 0) {
        const alternatives = conflictCheck.availableClassrooms.map(c => c.name).join(', ');
        validationErrors.push(t('admin.lessons.form.validation.alternativeClassrooms', {
          alternatives
        }));
      }
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      onSave(formData);
      onClose();
    } catch (error) {
      setErrors([t('admin.lessons.messages.errorSaving')]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof LessonData, value: string | number | undefined) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Solo per nuove lezioni (non in editing), suggerisci un orario di fine quando viene impostato l'inizio
    // Ma solo se l'orario di fine è ancora quello di default
    if (field === 'lesson_start' && !lesson && value) {
      setFormData(prev => {
        // Calcola l'orario di fine solo se è ancora quello di default (10:00) o vuoto
        const isDefaultEndTime = !prev.lesson_end || prev.lesson_end === '10:00';
        
        if (isDefaultEndTime) {
          const startTime = new Date(`2000-01-01T${value}`);
          const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
          const endTimeStr = String(endTime.getHours()).padStart(2, '0') + ':' + String(endTime.getMinutes()).padStart(2, '0');
          
          return {
            ...prev,
            lesson_end: endTimeStr
          };
        }
        
        return prev;
      });
    }
  };

  const filteredSubjects = subjects.filter(subject => 
    !formData.course_id || subject.course_id === formData.course_id
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">
            {lesson ? t('admin.lessons.form.editTitle') : t('admin.lessons.form.newTitle')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {errors.length > 0 && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded">
            {errors.map((error, index) => (
              <div key={index} className="text-red-300 text-sm">{error}</div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">{t('admin.lessons.form.nameLabel')}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t('admin.lessons.form.namePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">{t('admin.lessons.form.dateLabel')}</label>
            <input
              type="date"
              value={formData.lesson_date}
              onChange={(e) => handleInputChange('lesson_date', e.target.value)}
              className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">{t('admin.lessons.form.startTimeLabel')}</label>
              <input
                type="time"
                value={formData.lesson_start}
                onChange={(e) => handleInputChange('lesson_start', e.target.value)}
                className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">{t('admin.lessons.form.endTimeLabel')}</label>
              <input
                type="time"
                value={formData.lesson_end}
                onChange={(e) => handleInputChange('lesson_end', e.target.value)}
                className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">{t('admin.lessons.form.courseLabel')}</label>
            <select
              value={formData.course_id}
              onChange={(e) => handleInputChange('course_id', parseInt(e.target.value))}
              className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={0}>{t('admin.lessons.form.selectCourse')}</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">{t('admin.lessons.form.subjectLabel')}</label>
            <select
              value={formData.subject_id || 0}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                handleInputChange('subject_id', value || undefined);
              }}
              className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              disabled={!formData.course_id}
            >
              <option value={0}>{t('admin.lessons.form.selectSubject')}</option>
              {filteredSubjects.map(subject => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">{t('admin.lessons.form.classroomLabel')}</label>
            <select
              value={formData.classroom_id}
              onChange={(e) => handleInputChange('classroom_id', parseInt(e.target.value))}
              className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={0}>{t('admin.lessons.form.selectClassroom')}</option>
              {classrooms.map(classroom => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">{t('admin.lessons.form.teacherLabel')}</label>
            <select
              value={formData.teacher_id || 0}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                handleInputChange('teacher_id', value || undefined);
              }}
              className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={0}>{t('admin.lessons.form.selectTeacher')}</option>
              {teachers.map(teacher => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name} {teacher.surname}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 transition-colors"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('admin.lessons.form.saving') : (lesson ? t('admin.lessons.form.update') : t('admin.lessons.form.create'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LessonModal;