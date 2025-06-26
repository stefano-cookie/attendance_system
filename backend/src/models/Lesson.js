module.exports = (sequelize, DataTypes) => {
  const Lesson = sequelize.define('Lesson', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      comment: 'Nome/titolo della lezione'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descrizione dettagliata della lezione'
    },
    lesson_date: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Data e ora della lezione'
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 90,
      comment: 'Durata prevista in minuti'
    },
    
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Courses', key: 'id' }
    },
    subject_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Subjects', key: 'id' }
    },
    classroom_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Classrooms', key: 'id' }
    },
    teacher_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' }
    },
    
    status: {
      type: DataTypes.ENUM('draft', 'scheduled', 'active', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'draft',
      comment: 'Stato della lezione'
    },
    attendance_mode: {
      type: DataTypes.ENUM('manual', 'face_detection', 'qr_code', 'mixed'),
      allowNull: false,
      defaultValue: 'face_detection',
      comment: 'Modalità di rilevamento presenze'
    },
    
    face_detection_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Face detection attivo per questa lezione'
    },
    auto_capture_interval: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Intervallo auto-scatto in minuti (null = manuale)'
    },
    
    total_students_expected: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Numero studenti attesi'
    },
    total_students_present: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Numero studenti rilevati presenti'
    },
    attendance_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Percentuale presenza calcolata'
    },
    
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp inizio effettivo lezione'
    },
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp fine effettiva lezione'
    },
    last_capture_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Ultimo scatto automatico camera'
    },
    
    lesson_config: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Configurazione specifica lezione (JSON)'
    }
  }, {
    tableName: 'Lessons',
    timestamps: true,
    
    indexes: [
      {
        name: 'lesson_date_idx',
        fields: ['lesson_date']
      },
      {
        name: 'lesson_status_idx',
        fields: ['status']
      },
      {
        name: 'lesson_course_idx',
        fields: ['course_id']
      },
      {
        name: 'lesson_teacher_idx',
        fields: ['teacher_id']
      },
      {
        name: 'lesson_classroom_idx',
        fields: ['classroom_id']
      }
    ]
  });

  Lesson.prototype.isActive = function() {
    return this.status === 'active';
  };

  Lesson.prototype.isCompleted = function() {
    return this.status === 'completed';
  };

  Lesson.prototype.canStart = function() {
    return ['draft', 'scheduled'].includes(this.status);
  };

  Lesson.prototype.canEnd = function() {
    return this.status === 'active';
  };

  Lesson.prototype.getDuration = function() {
    if (this.started_at && this.ended_at) {
      return Math.round((new Date(this.ended_at) - new Date(this.started_at)) / (1000 * 60)); // minuti
    }
    return this.duration_minutes || 90;
  };

  Lesson.prototype.updateAttendanceStats = async function(attendanceData) {
    const { present, total } = attendanceData;
    const percentage = total > 0 ? Math.round((present / total) * 100 * 100) / 100 : 0;
    
    return await this.update({
      total_students_present: present,
      total_students_expected: total,
      attendance_percentage: percentage
    });
  };

  Lesson.associate = function(models) {
    Lesson.belongsTo(models.Course, {
      foreignKey: 'course_id',
      as: 'course'
    });
    
    Lesson.belongsTo(models.Classroom, {
      foreignKey: 'classroom_id',
      as: 'classroom'
    });
    
    Lesson.belongsTo(models.Subject, {
      foreignKey: 'subject_id',
      as: 'subject'
    });
    
    Lesson.belongsTo(models.User, {
      foreignKey: 'teacher_id',
      as: 'teacher'
    });
    
    Lesson.hasMany(models.Attendance, {
      foreignKey: 'lessonId',
      as: 'attendances'
    });
    
    Lesson.hasMany(models.LessonImage, {
      foreignKey: 'lesson_id',
      as: 'images'
    });
  };

  return Lesson;
};