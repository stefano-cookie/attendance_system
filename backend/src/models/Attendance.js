const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Attendance = sequelize.define('Attendance', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'userId'
    },
    lessonId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'lessonId'
    },
    is_present: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_present'
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
      field: 'timestamp'
    },
    confidence: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: true,
      defaultValue: 0,
      field: 'confidence'
    },
    screenshotId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'screenshotId'
    },
    imageId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'LessonImages',
        key: 'id'
      },
      field: 'imageId'
    },
    imageFile: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'imageFile'
    },
    detection_method: {
      type: DataTypes.ENUM('manual', 'face_recognition', 'qr_code', 'mixed'),
      allowNull: false,
      defaultValue: 'face_recognition',
      field: 'detection_method'
    },
    verified_by_teacher: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'verified_by_teacher'
    },
    manual_override: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'manual_override'
    },
    override_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'override_reason'
    },
    arrival_time: {
      type: DataTypes.TIME,
      allowNull: true,
      field: 'arrival_time'
    },
    is_late: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_late'
    },
    needs_review: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'needs_review'
    },
    review_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'review_notes'
    }
  }, {
    tableName: 'Attendances',
    timestamps: true,
    underscored: false,
    indexes: [
      {
        fields: ['userId', 'lessonId'],
        name: 'attendance_user_lesson_index'
      },
      {
        fields: ['timestamp'],
        name: 'attendance_timestamp_index'
      }
    ]
  });

  Attendance.associate = function(models) {
    Attendance.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'student'
    });

    Attendance.belongsTo(models.Lesson, {
      foreignKey: 'lessonId',
      as: 'lesson'
    });

    Attendance.belongsTo(models.Screenshot, {
      foreignKey: 'screenshotId',
      as: 'screenshot'
    });

    if (models.LessonImage) {
      Attendance.belongsTo(models.LessonImage, {
        foreignKey: 'imageId',
        as: 'image'
      });
    }
  };

  return Attendance;
};