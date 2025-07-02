import axios, { AxiosInstance, AxiosResponse } from 'axios';

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

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
  hasPhoto?: boolean;
}

export interface Course {
  id: number;
  name: string;
  description?: string | null;
  years: number;
  color?: string;
  is_active?: boolean;
  createdAt?: string;
  updatedAt?: string;   
}

export interface CourseData {
  name: string;
  description?: string;
  years: number;
  color?: string;
  is_active?: boolean;
}

export interface Classroom {
  id: number;
  name: string;
  code?: string;
  has_projector?: boolean;
  has_whiteboard?: boolean;
  camera_ip?: string;
  camera_port?: number;
  camera_username?: string;
  camera_password?: string;
  camera_model?: string;
  camera_manufacturer?: string;
  camera_status?: 'unknown' | 'online' | 'offline' | 'error' | 'disabled';
  camera_last_check?: string;
  camera_last_success?: string;
  camera_preferred_method?: string;
  camera_capabilities?: any;
  camera_resolution?: string;
  camera_fps?: number;
  camera_position?: string;
  camera_angle?: string;
  camera_notes?: string;
  is_active?: boolean;
  maintenance_mode?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Lesson {
  id: number;
  name?: string;
  lesson_date: string;
  classroom_id: number;
  course_id: number;
  subject_id?: number;
  teacher_id?: number;
  status?: string;
  is_completed?: boolean;
  completed_at?: string;
  planned_start_time?: string;
  planned_end_time?: string;
  course?: Course;
  classroom?: Classroom;
  subject?: Subject;
  teacher?: User;
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
  course_id: number | null;
  Course?: {
    id: number;
    name: string;
  };
}

export interface Screenshot {
  id: number;
  path: string;
  timestamp: string;
  lessonId?: number;
}

export const login = async (credentials: { email: string; password: string }): Promise<any> => {
  const response: AxiosResponse = await api.post('/auth/login', credentials);
  return response.data;
};

export const getStudents = async (params?: any): Promise<Student[]> => {
  const response: AxiosResponse = await api.get('/users/students', { params });
  
  const students = Array.isArray(response.data) ? response.data : (response.data?.students || []);
  
  return students.map((student: any) => {
    let photoPath = '';
    
    if (student.photoPath || student.photo_path || student.hasPhoto) {
      photoPath = `http://localhost:4321/api/users/students/${student.id}/photo`;
    }
    
    return {
      id: student.id,
      name: student.name || '',
      surname: student.surname || '',
      email: student.email || '',
      matricola: student.matricola || '',
      course_id: student.course_id || student.courseId || null,
      role: student.role || 'student',
      photoPath: photoPath,
      hasPhoto: !!(student.photoPath || student.photo_path || student.hasPhoto)
    };
  });
};

export const getStudent = async (id: number): Promise<Student> => {
  const response = await api.get(`/users/students/${id}`);
  const student = response.data;
  
  if (student.photoPath || student.photo_path || student.hasPhoto) {
    student.photoPath = `http://localhost:4321/api/users/students/${student.id}/photo`;
  } else {
    student.photoPath = '';
  }
  
  return student;
};

export const createStudent = async (data: Partial<Student>): Promise<Student> => {
  const response: AxiosResponse = await api.post('/students', data);
  return response.data;
};

export const updateStudent = async (id: number, data: Partial<Student>): Promise<Student> => {
  const response = await api.put(`/users/students/${id}`, data);
  return response.data.student || response.data;
};

export const deleteStudent = async (id: number): Promise<any> => {
  const response = await api.delete(`/users/students/${id}`);
  return response.data;
};

export const getTeachers = async (): Promise<User[]> => {
  const response: AxiosResponse = await api.get('/users/teachers');
  return response.data.teachers || [];
};


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
  const { name, description, color } = data;
  const courseData = { name, description, color };
  
  console.log('📤 api.ts - createCourse invio:', courseData);
  
  const response: AxiosResponse = await api.post('/users/courses', courseData);
  
  console.log('📥 api.ts - createCourse risposta:', response.data);
  
  return response.data.course || response.data;
};

export const updateCourse = async (id: number, data: Partial<Course>): Promise<Course> => {
  const { name, description, color, years, is_active } = data;
  const courseData = { name, description, color, years, is_active };
  
  console.log('📤 api.ts - updateCourse invio:', courseData);
  
  const response: AxiosResponse = await api.put(`/users/courses/${id}`, courseData);
  
  console.log('📥 api.ts - updateCourse risposta:', response.data);
  
  return response.data.course || response.data;
};

export const deleteCourse = async (id: number): Promise<any> => {
  const response: AxiosResponse = await api.delete(`/users/courses/${id}`);
  return response.data;
};

export const getClassrooms = async (params?: any): Promise<Classroom[]> => {
  try {
    const response = await api.get('/classrooms', { params });
    console.log('Risposta classrooms:', response.data);
    return response.data.data || [];
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

export const getScreenshots = async (params?: any): Promise<Screenshot[]> => {
  const response: AxiosResponse = await api.get('/admin/screenshots', { params });
  
  const screenshots = response.data.screenshots || response.data || [];
  return screenshots.map((screenshot: any) => {
    let path = screenshot.path || '';
    
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

export const testCameraConnection = async (classroomId: number): Promise<any> => {
  const response: AxiosResponse = await api.post(`/cameras/${classroomId}/test`);
  return response.data;
};

export const discoverCameras = async (): Promise<any> => {
  const response: AxiosResponse = await api.post('/cameras/discover');
  return response.data;
};

export const assignCameraToClassroom = async (classroomId: number, cameraData: any, classroomName?: string): Promise<any> => {
  // Se non abbiamo il nome, lo recuperiamo prima
  let name = classroomName;
  if (!name) {
    const classroomResponse: AxiosResponse = await api.get(`/classrooms/${classroomId}`);
    name = classroomResponse.data.name;
  }
  
  const response: AxiosResponse = await api.put(`/classrooms/${classroomId}`, {
    name, // Campo obbligatorio richiesto dal backend
    camera_ip: cameraData.ip,
    camera_username: cameraData.workingCredentials?.username || 'admin',
    camera_password: cameraData.workingCredentials?.password || 'Mannoli2025',
    camera_model: cameraData.model,
    camera_manufacturer: cameraData.model.includes('IMOU') ? 'IMOU' : 'Generic'
  });
  return response.data;
};

export const getCameraHealth = async (): Promise<any> => {
  const response: AxiosResponse = await api.get('/cameras/health');
  return response.data;
};

export const testAllCameras = async (): Promise<any> => {
  const response: AxiosResponse = await api.post('/cameras/test-all');
  return response.data;
};

export const sendAttendanceEmails = async (lessonId: number): Promise<any> => {
  const response: AxiosResponse = await api.post(`/teacher/lessons/${lessonId}/send-attendance-emails`);
  return response.data;
};

export const sendStudentEmail = async (lessonId: number, studentId: number): Promise<any> => {
  const response: AxiosResponse = await api.post(`/teacher/lessons/${lessonId}/send-student-email/${studentId}`);
  return response.data;
};

export const getTeacherSystemStatus = async (): Promise<any> => {
  const response: AxiosResponse = await api.get('/teacher/system-status');
  return response.data;
};

export default api;