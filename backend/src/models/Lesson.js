module.exports = (sequelize, DataTypes) => {
  const Lesson = sequelize.define('Lesson', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    lesson_date: {
      type: DataTypes.DATE,
      allowNull: false
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
      defaultValue: 'draft'
    },
    attendance_mode: {
      type: DataTypes.ENUM('manual', 'face_detection', 'qr_code', 'mixed'),
      allowNull: false,
      defaultValue: 'face_detection'
    },
    
    face_detection_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    
    total_students_expected: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    total_students_present: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    attendance_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    
    started_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    last_capture_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    is_completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    planned_start_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    planned_end_time: {
      type: DataTypes.DATE,
      allowNull: true
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
    return this.is_completed === true;
  };

  Lesson.prototype.canAccess = function(userRole) {
    if (userRole === 'admin') return true;
    
    if (userRole === 'teacher' && this.is_completed) return false;
    
    return true;
  };

  Lesson.prototype.markAsCompleted = async function() {
    this.is_completed = true;
    this.completed_at = new Date();
    this.status = 'completed';
    return await this.save();
  };

  Lesson.prototype.canStart = function() {
    return ['draft', 'scheduled'].includes(this.status);
  };

  Lesson.prototype.canEnd = function() {
    return this.status === 'active';
  };

  Lesson.prototype.getDuration = function() {
    if (this.planned_start_time && this.planned_end_time) {
      return Math.round((new Date(this.planned_end_time) - new Date(this.planned_start_time)) / (1000 * 60));
    }
    if (this.started_at && this.ended_at) {
      return Math.round((new Date(this.ended_at) - new Date(this.started_at)) / (1000 * 60));
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