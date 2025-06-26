const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
dotenv.config();

const config = {
  development: {
    username: process.env.DB_USER || 'stebbi',
    password: process.env.DB_PASSWORD || 'stebbi',
    database: process.env.DB_NAME || 'attendance_system',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log
  },
  test: {
    username: process.env.DB_USER || 'stebbi',
    password: process.env.DB_PASSWORD || 'stebbi',
    database: process.env.DB_NAME || 'attendance_system_test',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
};

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

let sequelize;
if (dbConfig.use_env_variable) {
  sequelize = new Sequelize(process.env[dbConfig.use_env_variable], dbConfig);
} else {
  sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    dbConfig
  );
}

module.exports = { sequelize, config };