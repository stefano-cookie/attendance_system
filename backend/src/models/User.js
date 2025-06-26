const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    surname: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    role: {
      type: DataTypes.ENUM('admin', 'student', 'teacher', 'technician'),
      allowNull: false,
      defaultValue: 'student'
    },
    matricola: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true
    },
    courseId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'courseId'
    },
    
    photoPath: {
      type: DataTypes.BLOB('long'),
      allowNull: true,
      field: 'photoPath',
      comment: 'Dati binari della foto (BLOB)',
      get() {
        const data = this.getDataValue('photoPath');
        return data ? Buffer.from(data) : null;
      },
      set(value) {
        if (value) {
          this.setDataValue('photoPath', Buffer.isBuffer(value) ? value : Buffer.from(value));
        } else {
          this.setDataValue('photoPath', null);
        }
      }
    },
    
    hasPhoto: {
      type: DataTypes.VIRTUAL,
      get() {
        const photoData = this.getDataValue('photoPath');
        return !!(photoData && photoData.length > 0);
      }
    },
    
    photoBase64: {
      type: DataTypes.VIRTUAL,
      get() {
        const photoData = this.getDataValue('photoPath');
        if (photoData) {
          return `data:image/jpeg;base64,${Buffer.from(photoData).toString('base64')}`;
        }
        return null;
      }
    },
    
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
    },
    reset_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'reset_token'
    },
    reset_token_expiry: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reset_token_expiry'
    }
  }, {
    tableName: 'Users',
    timestamps: true,
    
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      }
    }
  });

  User.prototype.validatePassword = async function(password) {
    return bcrypt.compare(password, this.password);
  };

  User.prototype.hasValidPhoto = function() {
    return !!(this.photoPath && this.photoPath.length > 0);
  };

  User.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    
    delete values.password;
    delete values.reset_token;
    delete values.reset_token_expiry;
    
    delete values.photoPath;
    
    values.hasPhoto = this.hasValidPhoto();
    
    return values;
  };

  User.associate = function(models) {
    User.belongsTo(models.Course, {
      foreignKey: 'courseId',
      as: 'course'
    });

    User.hasMany(models.Attendance, {
      foreignKey: 'userId',
      as: 'attendances'
    });

    User.belongsToMany(models.Subject, {
      through: models.StudentSubject,
      foreignKey: 'student_id',
      as: 'subjects'
    });

    User.hasMany(models.UserToken, {
      foreignKey: 'userId',
      as: 'tokens'
    });
  };

  return User;
};