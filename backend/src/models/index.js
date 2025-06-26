const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const { sequelize } = require('../config/database');

const db = {};

console.log('=== FASE 1: Caricamento definizioni modelli ===');

const modelOrder = [
  'User',
  'UserToken',
  'Course', 
  'Classroom',
  'Subject',
  'Lesson',
  'Screenshot',
  'Attendance',
  'StudentSubject',
  'LessonImage',
  'CameraLog'
];

modelOrder.forEach(modelName => {
  try {
    const modelPath = path.join(__dirname, `${modelName}.js`);
    if (fs.existsSync(modelPath)) {
      const model = require(modelPath)(sequelize, Sequelize.DataTypes);
      db[modelName] = model;
      console.log(`✅ Modello ${modelName} caricato`);
    } else {
      console.log(`⚠️  File modello ${modelName}.js non trovato`);
    }
  } catch (error) {
    console.error(`❌ Errore caricamento ${modelName}:`, error.message);
  }
});

console.log('=== FASE 2: Configurazione associazioni ===');

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    console.log(`🔗 Configurando associazioni per ${modelName}`);
    db[modelName].associate(db);
  }
});

console.log('✅ Tutte le associazioni configurate');

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;