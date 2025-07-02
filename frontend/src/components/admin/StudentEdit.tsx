// frontend/src/components/admin/StudentEdit.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { Student, Course, getCourses } from '../../services/api';
import { useTranslation } from 'react-i18next';

const StudentEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [student, setStudent] = useState<Student | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState<string>('');
  const [surname, setSurname] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [matricola, setMatricola] = useState<string>('');
  const [courseId, setCourseId] = useState<number | null>(null);
  
  // Carica lo studente e i corsi
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        // Carica lo studente usando il nuovo endpoint
        const response = await api.get(`/users/students/${id}`);
        const studentData = response.data;
        
        setStudent(studentData);
        
        setName(studentData.name || '');
        setSurname(studentData.surname || '');
        setEmail(studentData.email || '');
        setMatricola(studentData.matricola || '');
        setCourseId(studentData.courseId || null);
        
        // Carica la lista dei corsi
        const coursesResponse = await api.get('/users/courses');
        setCourses(coursesResponse.data.courses || []);
        
      } catch (err) {
        console.error('Errore nel caricamento dei dati:', err);
        setError(t('admin.users.studentEdit.errors.loadingData'));
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    
    if (!id || !name.trim() || !surname.trim() || !email.trim()) {
      setError(t('admin.users.studentEdit.errors.requiredFields'));
      return;
    }
    
    if (!matricola.trim()) {
      setError(t('admin.users.studentEdit.errors.studentIdRequired'));
      return;
    }
    
    try {
      const updatedData = {
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim(),
        matricola: matricola.trim(),
        courseId
      };
      
      console.log('Sending update data:', updatedData);
      
      // Usa l'endpoint di aggiornamento
      const response = await api.put(`/users/students/${id}`, updatedData);
      console.log('Update response:', response.data);
      
      setSuccessMessage(t('admin.users.studentEdit.messages.updateSuccess'));
      setTimeout(() => {
        navigate('/admin/students');
      }, 1500);
    } catch (err: any) {
      console.error('Errore durante l\'aggiornamento dello studente:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || t('admin.users.studentEdit.errors.updateFailed');
      setError(errorMessage);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">{t('admin.users.studentEdit.title')}</h2>
        <button
          onClick={() => navigate('/admin/students')}
          className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded transition"
        >
          {t('admin.users.studentEdit.backToList')}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md p-6">
        {student && (
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold text-blue-800 mb-2">{t('admin.users.studentEdit.studentBeingEdited')}:</h3>
            <p className="text-blue-700">{student.name} {student.surname} ({student.matricola})</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <p className="text-sm text-gray-600 mb-4">
            {t('admin.users.studentEdit.requiredFieldsNote')}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="name">
                {t('admin.users.studentEdit.fields.firstName')} <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                placeholder={t('admin.users.studentEdit.placeholders.firstName')}
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="surname">
                {t('admin.users.studentEdit.fields.lastName')} <span className="text-red-500">*</span>
              </label>
              <input
                id="surname"
                type="text"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                placeholder={t('admin.users.studentEdit.placeholders.lastName')}
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="email">
                {t('admin.users.studentEdit.fields.email')} <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                placeholder={t('admin.users.studentEdit.placeholders.email')}
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="matricola">
                {t('admin.users.studentEdit.fields.studentId')} <span className="text-red-500">*</span>
              </label>
              <input
                id="matricola"
                type="text"
                value={matricola}
                onChange={(e) => setMatricola(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                placeholder={t('admin.users.studentEdit.placeholders.studentId')}
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="course">{t('admin.users.studentEdit.fields.course')}</label>
              <select
                id="course"
                value={courseId || ''}
                onChange={(e) => setCourseId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('admin.users.studentEdit.placeholders.selectCourse')}</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex justify-end mt-6">
            <button
              type="button"
              onClick={() => navigate('/admin/students')}
              className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded transition mr-2"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
            >
              {t('admin.users.studentEdit.saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentEdit;