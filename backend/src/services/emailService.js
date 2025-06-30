// backend/src/services/emailService.js
const nodemailer = require('nodemailer');
const { User, Lesson, Course, Classroom, Attendance } = require('../models');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    // Configurazione SMTP (da personalizzare con le credenziali reali)
    const config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || 'attendance@unicantemir.it',
        pass: process.env.SMTP_PASSWORD || 'your-app-password'
      }
    };

    this.transporter = nodemailer.createTransport(config);
    
    // Test di connessione all'avvio
    this.testConnection();
  }

  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email service configurato correttamente');
    } catch (error) {
      console.warn('⚠️ Email service non configurato:', error.message);
      console.warn('📧 Per abilitare le email, configura le variabili SMTP_* nel .env');
    }
  }

  /**
   * Invia report presenze a uno studente
   */
  async sendAttendanceReportToStudent(studentId, lessonId) {
    try {
      // Recupera dati studente
      const student = await User.findByPk(studentId, {
        attributes: ['id', 'name', 'surname', 'email']
      });

      if (!student || !student.email) {
        console.warn(`⚠️ Studente ${studentId} non ha email configurata`);
        return { success: false, error: 'Email studente non trovata' };
      }

      // Recupera dati lezione
      const lesson = await Lesson.findByPk(lessonId, {
        include: [
          { model: Course, as: 'course', attributes: ['name'] },
          { model: Classroom, as: 'classroom', attributes: ['name'] }
        ]
      });

      if (!lesson) {
        return { success: false, error: 'Lezione non trovata' };
      }

      // Recupera presenza dello studente
      const attendance = await Attendance.findOne({
        where: { userId: studentId, lessonId: lessonId }
      });

      const attendanceStatus = attendance ? 
        (attendance.is_present ? 'PRESENTE' : 'ASSENTE') : 
        'NON RILEVATA';

      const confidenceInfo = attendance?.confidence ? 
        ` (Confidenza: ${Math.round(attendance.confidence * 100)}%)` : 
        '';

      // Componi email
      const subject = `📊 Report Presenze - ${lesson.course?.name} - ${new Date(lesson.lesson_date).toLocaleDateString('it-IT')}`;
      
      const html = this.generateAttendanceEmailHTML({
        studentName: `${student.name} ${student.surname}`,
        lessonName: lesson.name || `Lezione ${new Date(lesson.lesson_date).toLocaleDateString('it-IT')}`,
        courseName: lesson.course?.name || 'Corso non specificato',
        classroomName: lesson.classroom?.name || 'Aula non specificata',
        lessonDate: new Date(lesson.lesson_date).toLocaleDateString('it-IT'),
        attendanceStatus,
        confidenceInfo,
        detectionMethod: attendance?.detection_method || 'automatico'
      });

      // Invia email
      const mailOptions = {
        from: `"Sistema Presenze Unicantemir" <${process.env.SMTP_USER || 'attendance@unicantemir.it'}>`,
        to: student.email,
        subject: subject,
        html: html
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Email inviata a ${student.email} per lezione ${lessonId}`);
      
      return { 
        success: true, 
        messageId: result.messageId,
        studentEmail: student.email 
      };

    } catch (error) {
      console.error('❌ Errore invio email:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Invia report presenze a tutti gli studenti di una lezione
   */
  async sendAttendanceReportToAllStudents(lessonId) {
    try {
      // Recupera lezione con corso
      const lesson = await Lesson.findByPk(lessonId, {
        include: [{ model: Course, as: 'course' }]
      });

      if (!lesson) {
        return { success: false, error: 'Lezione non trovata' };
      }

      // Recupera tutti gli studenti del corso
      const students = await User.findAll({
        where: { 
          courseId: lesson.course_id,
          role: 'student'
        },
        attributes: ['id', 'name', 'surname', 'email']
      });

      const results = {
        total: students.length,
        sent: 0,
        failed: 0,
        errors: []
      };

      // Invia email a ogni studente
      for (const student of students) {
        const result = await this.sendAttendanceReportToStudent(student.id, lessonId);
        
        if (result.success) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push({
            studentId: student.id,
            studentName: `${student.name} ${student.surname}`,
            error: result.error
          });
        }

        // Pausa breve per evitare spam
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`📧 Report lezione ${lessonId}: ${results.sent} inviate, ${results.failed} fallite`);
      
      return {
        success: true,
        results
      };

    } catch (error) {
      console.error('❌ Errore invio report massivo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Genera HTML per email presenze
   */
  generateAttendanceEmailHTML({ studentName, lessonName, courseName, classroomName, lessonDate, attendanceStatus, confidenceInfo, detectionMethod }) {
    const statusColor = attendanceStatus === 'PRESENTE' ? '#10B981' : 
                       attendanceStatus === 'ASSENTE' ? '#EF4444' : '#6B7280';
    
    const statusIcon = attendanceStatus === 'PRESENTE' ? '✅' : 
                      attendanceStatus === 'ASSENTE' ? '❌' : '❓';

    return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Report Presenze</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .status-card { background: white; border-left: 5px solid ${statusColor}; padding: 20px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .info-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .info-label { font-weight: bold; color: #555; }
            .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #eee; }
            .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; background-color: ${statusColor}; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>📊 Report Presenze</h1>
            <p>Sistema di Rilevamento Automatico Presenze</p>
        </div>
        
        <div class="content">
            <h2>Ciao ${studentName}!</h2>
            <p>Ecco il report della tua presenza per la lezione di oggi:</p>
            
            <div class="status-card">
                <div class="info-row">
                    <span class="info-label">Corso:</span>
                    <span>${courseName}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Lezione:</span>
                    <span>${lessonName}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Data:</span>
                    <span>${lessonDate}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Aula:</span>
                    <span>${classroomName}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Stato Presenza:</span>
                    <span class="status-badge">${statusIcon} ${attendanceStatus}</span>
                </div>
                ${confidenceInfo ? `
                <div class="info-row">
                    <span class="info-label">Dettagli:</span>
                    <span>Rilevamento ${detectionMethod}${confidenceInfo}</span>
                </div>
                ` : ''}
            </div>
            
            ${attendanceStatus === 'PRESENTE' ? 
                '<p style="color: #10B981;">🎉 <strong>Ottimo!</strong> La tua presenza è stata registrata correttamente.</p>' :
                attendanceStatus === 'ASSENTE' ? 
                '<p style="color: #EF4444;">⚠️ <strong>Attenzione:</strong> Non sei stato rilevato durante la lezione. Se ritieni ci sia stato un errore, contatta il docente.</p>' :
                '<p style="color: #6B7280;">❓ La tua presenza non è stata rilevata automaticamente. Contatta il docente per chiarimenti.</p>'
            }
            
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
                <strong>Nota:</strong> Questo report è generato automaticamente dal sistema di riconoscimento facciale. 
                Per qualsiasi domanda o segnalazione, contatta il tuo docente di riferimento.
            </p>
        </div>
        
        <div class="footer">
            <p><strong>Università Cantemir</strong><br>
            Sistema Automatico di Rilevamento Presenze<br>
            <em>Questa è una email automatica, non rispondere a questo messaggio.</em></p>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Verifica configurazione email
   */
  async checkConfiguration() {
    try {
      await this.transporter.verify();
      return { 
        success: true, 
        message: 'Configurazione email corretta' 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        suggestion: 'Verifica le variabili SMTP_HOST, SMTP_USER, SMTP_PASSWORD nel file .env'
      };
    }
  }
}

module.exports = new EmailService();