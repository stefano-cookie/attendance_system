import React, { useState, useEffect } from 'react';
import { Lesson, Course, Subject, Classroom, User } from '../../services/api';
import { useTranslation } from 'react-i18next';

interface LessonData {
  id?: number;
  name: string;
  lesson_date: string;
  planned_start_time: string;
  planned_end_time: string;
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
  defaultDate,
  defaultHour = 9
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<LessonData>({
    name: '',
    lesson_date: '',
    planned_start_time: '',
    planned_end_time: '',
    course_id: 0,
    subject_id: 0,
    classroom_id: 0,
    teacher_id: 0
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (lesson) {
        const lessonDate = new Date(lesson.lesson_date);
        const dateStr = lessonDate.toISOString().split('T')[0];
        const startTime = lessonDate.toTimeString().slice(0, 5);
        const endTime = new Date(lessonDate.getTime() + 90 * 60 * 1000).toTimeString().slice(0, 5);

        setFormData({
          id: lesson.id,
          name: lesson.name || '',
          lesson_date: dateStr,
          planned_start_time: startTime,
          planned_end_time: endTime,
          course_id: lesson.course_id || 0,
          subject_id: lesson.subject_id || 0,
          classroom_id: lesson.classroom_id || 0,
          teacher_id: lesson.teacher_id || 0
        });
      } else if (defaultDate) {
        const dateStr = defaultDate.toISOString().split('T')[0];
        const startTime = `${defaultHour.toString().padStart(2, '0')}:00`;
        const endHour = defaultHour + 1;
        const endTime = `${endHour.toString().padStart(2, '0')}:30`;

        setFormData({
          name: '',
          lesson_date: dateStr,
          planned_start_time: startTime,
          planned_end_time: endTime,
          course_id: 0,
          subject_id: 0,
          classroom_id: 0,
          teacher_id: 0
        });
      } else {
        setFormData({
          name: '',
          lesson_date: '',
          planned_start_time: '09:00',
          planned_end_time: '10:30',
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
    if (!formData.planned_start_time) validationErrors.push(t('admin.lessons.form.validation.startTimeRequired'));
    if (!formData.planned_end_time) validationErrors.push(t('admin.lessons.form.validation.endTimeRequired'));
    if (!formData.course_id) validationErrors.push(t('admin.lessons.form.validation.courseRequired'));
    if (!formData.classroom_id) validationErrors.push(t('admin.lessons.form.validation.classroomRequired'));

    const startTime = new Date(`${formData.lesson_date}T${formData.planned_start_time}`);
    const endTime = new Date(`${formData.lesson_date}T${formData.planned_end_time}`);
    if (endTime <= startTime) {
      validationErrors.push(t('admin.lessons.form.validation.endTimeAfterStart'));
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(formData);
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

    if (field === 'planned_start_time') {
      const startTime = new Date(`2000-01-01T${value}`);
      const endTime = new Date(startTime.getTime() + 90 * 60 * 1000);
      const endTimeStr = endTime.toTimeString().slice(0, 5);
      setFormData(prev => ({
        ...prev,
        planned_end_time: endTimeStr
      }));
    }
  };

  const filteredSubjects = subjects.filter(subject => 
    !formData.course_id || subject.course_id === formData.course_id
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {lesson ? t('admin.lessons.form.editTitle') : t('admin.lessons.form.newTitle')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {errors.length > 0 && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded">
            {errors.map((error, index) => (
              <div key={index} className="text-red-700 text-sm">{error}</div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('admin.lessons.form.nameLabel')}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
              placeholder={t('admin.lessons.form.namePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('admin.lessons.form.dateLabel')}</label>
            <input
              type="date"
              value={formData.lesson_date}
              onChange={(e) => handleInputChange('lesson_date', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('admin.lessons.form.startTimeLabel')}</label>
              <input
                type="time"
                value={formData.planned_start_time}
                onChange={(e) => handleInputChange('planned_start_time', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('admin.lessons.form.endTimeLabel')}</label>
              <input
                type="time"
                value={formData.planned_end_time}
                onChange={(e) => handleInputChange('planned_end_time', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('admin.lessons.form.courseLabel')}</label>
            <select
              value={formData.course_id}
              onChange={(e) => handleInputChange('course_id', parseInt(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded"
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
            <label className="block text-sm font-medium mb-1">{t('admin.lessons.form.subjectLabel')}</label>
            <select
              value={formData.subject_id || 0}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                handleInputChange('subject_id', value || undefined);
              }}
              className="w-full p-2 border border-gray-300 rounded"
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
            <label className="block text-sm font-medium mb-1">{t('admin.lessons.form.classroomLabel')}</label>
            <select
              value={formData.classroom_id}
              onChange={(e) => handleInputChange('classroom_id', parseInt(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded"
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
            <label className="block text-sm font-medium mb-1">{t('admin.lessons.form.teacherLabel')}</label>
            <select
              value={formData.teacher_id || 0}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                handleInputChange('teacher_id', value || undefined);
              }}
              className="w-full p-2 border border-gray-300 rounded"
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
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
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