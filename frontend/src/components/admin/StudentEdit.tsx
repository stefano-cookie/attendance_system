// frontend/src/components/admin/StudentEdit.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { Student, Course, getCourses } from '../../services/api';

const StudentEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
        
        // Inizializza il form con i dati dello studente
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
        setError('Si è verificato un errore nel caricamento dei dati. Riprova più tardi.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!id || !name || !surname || !email) {
      setError('Nome, cognome ed email sono campi obbligatori');
      return;
    }
    
    try {
      const updatedData = {
        name,
        surname,
        email,
        matricola,
        courseId
      };
      
      // Usa l'endpoint di aggiornamento appena aggiunto
      await api.put(`/users/students/${id}`, updatedData);
      
      setSuccessMessage('Studente aggiornato con successo!');
      setTimeout(() => {
        navigate('/admin/students');
      }, 1500);
    } catch (err) {
      console.error('Errore durante l\'aggiornamento dello studente:', err);
      setError('Si è verificato un errore durante l\'aggiornamento. Riprova più tardi.');
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
        <h2 className="text-3xl font-bold text-gray-800">Modifica Studente</h2>
        <button
          onClick={() => navigate('/admin/students')}
          className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded transition"
        >
          Torna all'elenco
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
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="name">Nome</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="surname">Cognome</label>
              <input
                id="surname"
                type="text"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="matricola">Matricola</label>
              <input
                id="matricola"
                type="text"
                value={matricola}
                onChange={(e) => setMatricola(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="course">Corso</label>
              <select
                id="course"
                value={courseId || ''}
                onChange={(e) => setCourseId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleziona un corso</option>
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
              Annulla
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
            >
              Salva modifiche
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentEdit;