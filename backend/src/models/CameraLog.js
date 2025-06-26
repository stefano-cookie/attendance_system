module.exports = (sequelize, DataTypes) => {
  const CameraLog = sequelize.define('CameraLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    classroom_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Classrooms',
        key: 'id'
      }
    },
    event_type: {
      type: DataTypes.ENUM(
        'connection_test', 
        'capture_attempt', 
        'capture_success', 
        'capture_failure', 
        'discovery', 
        'health_check',
        'configuration_change'
      ),
      allowNull: false
    },
    camera_ip: {
      type: DataTypes.STRING(45),
      allowNull: false
    },
    method_used: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    success: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    response_time_ms: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    lesson_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Lessons',
        key: 'id'
      }
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    }
  }, {
    tableName: 'CameraLogs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['classroom_id'] },
      { fields: ['event_type'] },
      { fields: ['success'] },
      { fields: ['created_at'] }
    ]
  });

  CameraLog.associate = function(models) {
    CameraLog.belongsTo(models.Classroom, {
      foreignKey: 'classroom_id',
      as: 'classroom'
    });

    if (models.Lesson) {
      CameraLog.belongsTo(models.Lesson, {
        foreignKey: 'lesson_id',
        as: 'lesson'
      });
    }
  };

  return CameraLog;
};