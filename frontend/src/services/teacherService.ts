import api from './api';

export interface TeacherDashboardData {
  teacher: {
    id: number;
    name: string;
  };
  today: {
    date: string;
    lessons: Array<{
      id: number;
      name: string;
      lesson_date: string;
      course: { id: number; name: string };
      classroom: { id: number; name: string; hasCamera?: boolean };
      subject?: { id: number; name: string };
    }>;
    count: number;
  };
  stats: {
    total_lessons: number;
    completed_lessons: number;
    active_lessons: number;
  };
}

export interface Course {
  id: number;
  name: string;
}

export interface Classroom {
  id: number;
  name: string;
  hasCamera: boolean;
}

export interface Subject {
  id: number;
  name: string;
  course_id: number;
}

export interface CreateLessonData {
  name?: string;
  lesson_date: string;
  course_id: number;
  subject_id?: number;
  classroom_id: number;
}

export interface AttendanceReport {
  lesson: {
    id: number;
    name: string;
    date: string;
    course: string;
    classroom: string;
  };
  attendance: {
    students: Array<{
      student_id: number;
      student_name: string;
      student_surname: string;
      matricola: string;
      is_present: boolean;
      confidence: number;
      detection_method: string | null;
    }>;
    summary: {
      total: number;
      present: number;
      absent: number;
      percentage: number;
    };
    last_updated: string | null;
  };
}

export interface LessonImage {
  id: number;
  source: string;
  captured_at: string;
  is_analyzed: boolean;
  detected_faces: number;
  recognized_faces: number;
  camera_ip: string;
  url: string;
  thumbnail_url: string;
}

class TeacherService {
  
  async getDashboard(): Promise<TeacherDashboardData> {
    const response = await api.get('/teacher/dashboard');
    return response.data.data;
  }

  async getCourses(): Promise<Course[]> {
    const response = await api.get('/teacher/courses');
    return response.data.courses;
  }

  async getClassrooms(): Promise<Classroom[]> {
    const response = await api.get('/teacher/classrooms');
    return response.data.classrooms;
  }

  async getSubjects(courseId?: number): Promise<Subject[]> {
    const params = courseId ? { course_id: courseId } : {};
    const response = await api.get('/teacher/subjects', { params });
    return response.data.subjects;
  }

  async createLesson(lessonData: CreateLessonData) {
    const response = await api.post('/teacher/lessons', lessonData);
    return response.data;
  }

  async getLesson(lessonId: number) {
    const response = await api.get(`/teacher/lessons/${lessonId}`);
    return response.data.lesson;
  }

  async getAttendanceReport(lessonId: number): Promise<AttendanceReport> {
    const response = await api.get(`/teacher/lessons/${lessonId}/attendance-report`);
    return response.data.data;
  }

  async captureAndAnalyze(lessonId: number) {
    const response = await api.post(`/teacher/lessons/${lessonId}/capture-and-analyze`);
    return response.data;
  }

  async getLessonImages(lessonId: number): Promise<LessonImage[]> {
    const response = await api.get(`/teacher/lessons/${lessonId}/images`);
    return response.data.images;
  }

  async getSystemStatus() {
    const response = await api.get('/teacher/system-status');
    return response.data.status;
  }

}

export default new TeacherService();