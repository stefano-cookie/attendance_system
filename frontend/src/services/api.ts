// frontend/src/services/api.ts - FIX SENZA COLOR
import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Creazione di un'istanza di axios
const api: AxiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4321/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Aggiunge il token di autenticazione se presente
const token = localStorage.getItem('token');
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Tipi per gli oggetti di risposta - ORIGINALI
export interface User {
  id: number;
  name: string;
  surname: string;
  email: string;
  role: string;
}

export interface Student extends User {
  course_id?: number;
  matricola?: string;
  photoPath?: string;
}

export interface Course {
  id: number;
  name: string;
  description?: string | null;
  year?: number | null;
  color?: string;
  createdAt?: string;
  updatedAt?: string;   
}

export interface CourseData {
  name: string;
  description?: string;
  year?: number;
  color?: string;  
}

export interface Classroom {
  id: number;
  name: string;
  camera_id?: string;
  capacity?: number;
}

export interface Lesson {
  id: number;
  name?: string;
  lesson_date: string;
  classroom_id: number;
  course_id: number;
  subject_id?: number;
  Course?: Course;
  Classroom?: Classroom;
  Subject?: Subject;
}

export interface Attendance {
  id: number;
  student_id: number;
  lesson_id: number;
  is_present: boolean;
  timestamp?: string;
}

export interface Subject {
  id: number;
  name: string;
  course_id: number;
  Course?: {
    id: number;
    name: string;
    // color?: string; // ✅ Commentato temporaneamente
  };
}

export interface Screenshot {
  id: number;
  path: string;
  timestamp: string;
  lessonId?: number;
}

// Autenticazione
export const login = async (credentials: { email: string; password: string }): Promise<any> => {
  const response: AxiosResponse = await api.post('/auth/login', credentials);
  return response.data;
};

// Studenti
export const getStudents = async (params?: any): Promise<Student[]> => {
  const response: AxiosResponse = await api.get('/users/students', { params });
  
  // Adatta i dati per assicurarti che tutti i campi siano presenti
  const students = Array.isArray(response.data) ? response.data : (response.data?.students || []);
  
  // Mappa i dati e converti i percorsi delle foto in URL
  return students.map((student: any) => {
    // Estrai il percorso dell'immagine
    let photoPath = student.photoPath || student.photo_path || '';
    
    // Converti il percorso in URL se necessario
    if (photoPath && !photoPath.startsWith('http')) {
      // Estrai solo il nome del file dalla path completa
      const filename = photoPath.split('/').pop();
      // Crea l'URL completo
      photoPath = `http://localhost:4321/static/photos/${filename}`;
    }
    
    return {
      id: student.id,
      name: student.name || '',
      surname: student.surname || '',
      email: student.email || '',
      matricola: student.matricola || '',
      course_id: student.course_id || student.courseId || null,
      role: student.role || 'student',
      photoPath: photoPath
    };
  });
};

export const getStudent = async (id: number): Promise<Student> => {
  const response = await api.get(`/users/students/${id}`);
  return response.data;
};

export const createStudent = async (data: Partial<Student>): Promise<Student> => {
  const response: AxiosResponse = await api.post('/students', data);
  return response.data;
};

// Aggiorna uno studente
export const updateStudent = async (id: number, data: Partial<Student>): Promise<Student> => {
  const response = await api.put(`/users/students/${id}`, data);
  return response.data.student || response.data;
};

// Elimina uno studente
export const deleteStudent = async (id: number): Promise<any> => {
  const response = await api.delete(`/users/students/${id}`);
  return response.data;
};

// ===================================
// CORSI - ✅ SENZA COLOR (FIX)
// ===================================

export const getCourses = async (params?: any): Promise<Course[]> => {
  try {
    const response = await api.get('/users/courses', { params });
    console.log('Risposta courses:', response.data);
    return response.data.courses || [];
  } catch (error: any) {
    console.error('Errore nel recupero dei corsi:', error);
    throw error;
  }
};

export const createCourse = async (data: Partial<Course>): Promise<Course> => {
  // ✅ FIX: INCLUDE color nei dati inviati
  const { name, description, color } = data;
  const courseData = { name, description, color }; // ✅ Include color
  
  console.log('📤 api.ts - createCourse invio:', courseData);
  
  const response: AxiosResponse = await api.post('/users/courses', courseData);
  
  console.log('📥 api.ts - createCourse risposta:', response.data);
  
  return response.data.course || response.data;
};

export const updateCourse = async (id: number, data: Partial<Course>): Promise<Course> => {
  // ✅ FIX: INCLUDE color nei dati inviati
  const { name, description, color } = data;
  const courseData = { name, description, color }; // ✅ Include color
  
  console.log('📤 api.ts - updateCourse invio:', courseData);
  
  const response: AxiosResponse = await api.put(`/users/courses/${id}`, courseData);
  
  console.log('📥 api.ts - updateCourse risposta:', response.data);
  
  return response.data.course || response.data;
};

export const deleteCourse = async (id: number): Promise<any> => {
  const response: AxiosResponse = await api.delete(`/users/courses/${id}`);
  return response.data;
};

// Aule
export const getClassrooms = async (params?: any): Promise<Classroom[]> => {
  try {
    const response = await api.get('/classrooms', { params });
    return response.data || [];
  } catch (error: any) {
    console.error('Errore nel recupero delle aule:', error);
    throw error;
  }
};

export const getClassroom = async (id: number): Promise<Classroom> => {
  const response: AxiosResponse = await api.get(`/classrooms/${id}`);
  return response.data;
};

export const createClassroom = async (data: Partial<Classroom>): Promise<Classroom> => {
  const response: AxiosResponse = await api.post('/classrooms', data);
  return response.data;
};

export const updateClassroom = async (id: number, data: Partial<Classroom>): Promise<Classroom> => {
  const response: AxiosResponse = await api.put(`/classrooms/${id}`, data);
  return response.data;
};

export const deleteClassroom = async (id: number): Promise<any> => {
  const response: AxiosResponse = await api.delete(`/classrooms/${id}`);
  return response.data;
};

// Lezioni
export const getLessons = async (params?: any): Promise<Lesson[]> => {
  try {
    const response = await api.get('/lessons', { params });
    console.log('Risposta lessons:', response.data);
    return response.data || [];
  } catch (error: any) {
    console.error('Errore nel recupero delle lezioni:', error);
    throw error;
  }
};

export const getLesson = async (id: number): Promise<Lesson> => {
  try {
    const response = await api.get(`/lessons/${id}`);
    return response.data;
  } catch (error: any) {
    console.error(`Errore nel recupero della lezione ${id}:`, error);
    throw error;
  }
};

export const createLesson = async (data: Partial<Lesson>): Promise<Lesson> => {
  try {
    console.log('Dati inviati per la creazione della lezione:', data);
    const response = await api.post('/lessons', data);
    return response.data;
  } catch (error: any) {
    console.error('Errore nella creazione della lezione:', error);
    
    // Log dettagliato dell'errore
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    
    throw error;
  }
};

export const updateLesson = async (id: number, data: Partial<Lesson>): Promise<Lesson> => {
  try {
    const response = await api.put(`/lessons/${id}`, data);
    return response.data;
  } catch (error: any) {
    console.error(`Errore nell'aggiornamento della lezione ${id}:`, error);
    throw error;
  }
};

export const deleteLesson = async (id: number): Promise<any> => {
  try {
    const response = await api.delete(`/lessons/${id}`);
    return response.data;
  } catch (error: any) {
    console.error(`Errore nell'eliminazione della lezione ${id}:`, error);
    throw error;
  }
};

// Presenze
export const getAttendance = async (params?: any): Promise<Attendance[]> => {
  const response: AxiosResponse = await api.get('/attendance', { params });
  return response.data.attendances || [];
};

export const createAttendance = async (data: Partial<Attendance>): Promise<Attendance> => {
  const response: AxiosResponse = await api.post('/attendance', data);
  return response.data;
};

export const updateAttendance = async (id: number, data: Partial<Attendance>): Promise<Attendance> => {
  const response: AxiosResponse = await api.put(`/attendance/${id}`, data);
  return response.data;
};

// Materie
export const getSubjects = async (params?: any): Promise<Subject[]> => {
  try {
    console.log('Chiamata getSubjects con params:', params);
    const response = await api.get('/subjects', { params });
    console.log('Risposta subjects:', response.data);
    return response.data || [];
  } catch (error: any) {
    console.error('Errore nel recupero delle materie:', error);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    throw error;
  }
};

export const createSubject = async (data: Partial<Subject>): Promise<Subject> => {
  const response: AxiosResponse = await api.post('/subjects', data);
  return response.data;
};

export const updateSubject = async (id: number, data: Partial<Subject>): Promise<Subject> => {
  const response: AxiosResponse = await api.put(`/subjects/${id}`, data);
  return response.data;
};

export const deleteSubject = async (id: number): Promise<any> => {
  const response: AxiosResponse = await api.delete(`/subjects/${id}`);
  return response.data;
};

// Materie superate
export interface StudentSubject {
  id: number;
  student_id: number;
  subject_id: number;
  passed: boolean;
  passed_date?: string;
  User?: User;
  Subject?: Subject;
}

export const getStudentSubjects = async (params?: any): Promise<StudentSubject[]> => {
  const response: AxiosResponse = await api.get('/student-subjects', { params });
  return response.data;
};

export const createStudentSubject = async (data: Partial<StudentSubject>): Promise<StudentSubject> => {
  const response: AxiosResponse = await api.post('/student-subjects', data);
  return response.data;
};

export const updateStudentSubject = async (id: number, data: Partial<StudentSubject>): Promise<StudentSubject> => {
  const response: AxiosResponse = await api.put(`/student-subjects/${id}`, data);
  return response.data;
};

export const deleteStudentSubject = async (id: number): Promise<any> => {
  const response: AxiosResponse = await api.delete(`/student-subjects/${id}`);
  return response.data;
};

// Screenshots
export const getScreenshots = async (params?: any): Promise<Screenshot[]> => {
  const response: AxiosResponse = await api.get('/admin/screenshots', { params });
  
  // Converti i percorsi delle immagini in URL utilizzabili
  const screenshots = response.data.screenshots || response.data || [];
  return screenshots.map((screenshot: any) => {
    let path = screenshot.path || '';
    
    // Converti il percorso in URL se necessario
    if (path && !path.startsWith('http')) {
      const filename = path.split('/').pop();
      path = `http://localhost:4321/static/screenshots/${filename}`;
    }
    
    return {
      ...screenshot,
      path
    };
  });
};

export default api;