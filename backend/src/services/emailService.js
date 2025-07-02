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
      const result = await Promise.race([
        this.transporter.verify(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
      ]);
      console.log('✅ Email service configurato correttamente');
      return { success: true };
    } catch (error) {
      console.warn('⚠️ Email service non configurato:', error.message);
      console.warn('📧 Per abilitare le email, configura le variabili SMTP_* nel .env');
      return { success: false, error: error.message };
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

      // Con il nuovo sistema automatico, ogni studente dovrebbe avere un record
      const attendanceStatus = attendance ? 
        (attendance.is_present ? 'PRESENTE' : 'ASSENTE') : 
        'ASSENTE'; // Default ad ASSENTE se non trovato record

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
    const statusColor = attendanceStatus === 'PRESENTE' ? '#10B981' : '#EF4444';
    
    const statusIcon = attendanceStatus === 'PRESENTE' ? '✅' : '❌';

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
                '<p style="color: #EF4444;">⚠️ <strong>Attenzione:</strong> Sei risultato ASSENTE durante la lezione. Se ritieni ci sia stato un errore, contatta il docente.</p>'
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
      const result = await Promise.race([
        this.transporter.verify(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
      ]);
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

  /**
   * Invia notifica di assenza a uno studente
   */
  async sendAbsenceNotification(student, lesson) {
    try {
      console.log(`📧 Invio email assenza a ${student.email} per lezione ${lesson.id}`);

      const subject = '⚠️ Assenza Rilevata - Contattare la Segreteria';
      const html = this.generateAbsenceEmailTemplate(student, lesson);

      const mailOptions = {
        from: process.env.SMTP_FROM || 'attendance@unicantemir.it',
        to: student.email,
        subject: subject,
        html: html
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Email assenza inviata a ${student.email}: ${result.messageId}`);
      
      return {
        success: true,
        messageId: result.messageId,
        studentEmail: student.email
      };

    } catch (error) {
      console.error(`❌ Errore invio email assenza a ${student.email}:`, error);
      return {
        success: false,
        error: error.message,
        studentEmail: student.email
      };
    }
  }

  generateAbsenceEmailTemplate(student, lesson) {
    const studentName = `${student.name} ${student.surname}`;
    const courseName = lesson.course?.name || 'Corso';
    const lessonName = lesson.name || `Lezione del ${new Date(lesson.lesson_date).toLocaleDateString('it-IT')}`;
    const lessonDate = new Date(lesson.lesson_date).toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const classroomName = lesson.classroom?.name || 'Aula';

    return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Notifica Assenza</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .warning-card { background: #fff3cd; border-left: 5px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .info-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .info-label { font-weight: bold; color: #555; }
            .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #eee; }
            .action-box { background: #e7f3ff; border: 2px solid #0066cc; padding: 20px; margin: 20px 0; border-radius: 10px; text-align: center; }
            .urgent { color: #dc3545; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>⚠️ Notifica di Assenza</h1>
            <p>Sistema Automatico di Rilevamento Presenze</p>
        </div>
        
        <div class="content">
            <h2>Ciao ${studentName}!</h2>
            <p>Il nostro sistema di rilevamento automatico ha registrato la tua <span class="urgent">ASSENZA</span> per la seguente lezione:</p>
            
            <div class="warning-card">
                <div class="info-row">
                    <span class="info-label">Corso:</span>
                    <span>${courseName}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Lezione:</span>
                    <span>${lessonName}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Data e Ora:</span>
                    <span>${lessonDate}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Aula:</span>
                    <span>${classroomName}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Stato:</span>
                    <span class="urgent">❌ ASSENTE</span>
                </div>
            </div>

            <div class="action-box">
                <h3>🏢 Azione Richiesta</h3>
                <p><strong>Se ritieni che questa notifica sia un errore o se eri presente alla lezione, ti preghiamo di contattare immediatamente la segreteria per i chiarimenti necessari.</strong></p>
                <p>📞 <strong>Contatti Segreteria:</strong><br>
                Email: segreteria@unicantemir.it<br>
                Telefono: [Inserire numero]<br>
                Orari: Lunedì-Venerdì 9:00-17:00</p>
            </div>

            <p><strong>Nota importante:</strong> Questo sistema utilizza il riconoscimento facciale automatico per registrare le presenze. Se non sei stato riconosciuto dal sistema, potrebbero esserci diverse ragioni:</p>
            <ul>
                <li>Posizione non ottimale rispetto alla camera</li>
                <li>Illuminazione insufficiente</li>
                <li>Aggiornamento necessario della foto profilo</li>
                <li>Effettiva assenza dalla lezione</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>📧 Questa email è stata generata automaticamente dal Sistema di Rilevamento Presenze</p>
            <p>🏫 Università Cantemiroğlu - Sistema Automatico</p>
            <p>Per problemi tecnici contatta: supporto.tecnico@unicantemir.it</p>
        </div>
    </body>
    </html>
    `;
  }
}

module.exports = new EmailService();