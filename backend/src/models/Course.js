module.exports = (sequelize, DataTypes) => {
  const Course = sequelize.define('Course', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Nome del corso'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descrizione del corso'
    },
    color: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '#3498db',
      comment: 'Colore identificativo del corso'
    },
    years: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
      comment: 'Durata del corso in anni'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Corso attivo'
    }
  }, {
    tableName: 'Courses',
    timestamps: true,
    
    indexes: [
      {
        name: 'course_active_idx',
        fields: ['is_active']
      }
    ]
  });

  Course.prototype.getDisplayName = function() {
    return this.name;
  };

  Course.prototype.getStudentCount = async function() {
    const { User } = require('./');
    return await User.count({
      where: { 
        courseId: this.id,
        role: 'student',
        is_active: true
      }
    });
  };

  Course.associate = function(models) {
    if (models.Lesson) {
      Course.hasMany(models.Lesson, {
        foreignKey: 'course_id',
        as: 'lessons'
      });
    }
    
    if (models.User) {
      Course.hasMany(models.User, {
        foreignKey: 'courseId',
        as: 'students'
      });
    }

    if (models.Subject) {
      Course.hasMany(models.Subject, {
        foreignKey: 'course_id',
        as: 'subjects'
      });
    }
  };

  return Course;
};