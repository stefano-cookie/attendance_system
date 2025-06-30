'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🧹 Cleanup colonne inutilizzate e aggiunta sistema completamento lezioni...');

      // 1. LESSONS: Rimuovi colonne inutilizzate
      console.log('📚 Cleanup tabella Lessons...');
      
      // Verifica se le colonne esistono prima di rimuoverle
      const lessonColumns = await queryInterface.describeTable('Lessons');
      
      if (lessonColumns.description) {
        await queryInterface.removeColumn('Lessons', 'description', { transaction });
        console.log('   ✅ Rimossa colonna description');
      }
      
      if (lessonColumns.duration_minutes) {
        await queryInterface.removeColumn('Lessons', 'duration_minutes', { transaction });
        console.log('   ✅ Rimossa colonna duration_minutes');
      }
      
      if (lessonColumns.auto_capture_interval) {
        await queryInterface.removeColumn('Lessons', 'auto_capture_interval', { transaction });
        console.log('   ✅ Rimossa colonna auto_capture_interval');
      }
      
      if (lessonColumns.lesson_config) {
        await queryInterface.removeColumn('Lessons', 'lesson_config', { transaction });
        console.log('   ✅ Rimossa colonna lesson_config');
      }

      // Aggiungi colonne per il completamento
      if (!lessonColumns.is_completed) {
        await queryInterface.addColumn('Lessons', 'is_completed', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false
        }, { transaction });
        console.log('   ✅ Aggiunta colonna is_completed');
      }

      if (!lessonColumns.completed_at) {
        await queryInterface.addColumn('Lessons', 'completed_at', {
          type: Sequelize.DATE,
          allowNull: true
        }, { transaction });
        console.log('   ✅ Aggiunta colonna completed_at');
      }

      // 2. ATTENDANCE: Rimuovi colonne inutilizzate
      console.log('📊 Cleanup tabella Attendances...');
      
      const attendanceColumns = await queryInterface.describeTable('Attendances');
      
      if (attendanceColumns.screenshotId) {
        await queryInterface.removeColumn('Attendances', 'screenshotId', { transaction });
        console.log('   ✅ Rimossa colonna screenshotId');
      }
      
      if (attendanceColumns.imageId) {
        await queryInterface.removeColumn('Attendances', 'imageId', { transaction });
        console.log('   ✅ Rimossa colonna imageId');
      }
      
      if (attendanceColumns.imageFile) {
        await queryInterface.removeColumn('Attendances', 'imageFile', { transaction });
        console.log('   ✅ Rimossa colonna imageFile');
      }

      // 3. LESSON_IMAGES: Rimuovi colonne inutilizzate
      console.log('🖼️ Cleanup tabella LessonImages...');
      
      const imageColumns = await queryInterface.describeTable('LessonImages');
      
      if (imageColumns.original_filename) {
        await queryInterface.removeColumn('LessonImages', 'original_filename', { transaction });
        console.log('   ✅ Rimossa colonna original_filename');
      }
      
      if (imageColumns.camera_metadata) {
        await queryInterface.removeColumn('LessonImages', 'camera_metadata', { transaction });
        console.log('   ✅ Rimossa colonna camera_metadata');
      }
      
      if (imageColumns.analysis_confidence) {
        await queryInterface.removeColumn('LessonImages', 'analysis_confidence', { transaction });
        console.log('   ✅ Rimossa colonna analysis_confidence');
      }
      
      if (imageColumns.analysis_duration_ms) {
        await queryInterface.removeColumn('LessonImages', 'analysis_duration_ms', { transaction });
        console.log('   ✅ Rimossa colonna analysis_duration_ms');
      }
      
      if (imageColumns.analysis_metadata) {
        await queryInterface.removeColumn('LessonImages', 'analysis_metadata', { transaction });
        console.log('   ✅ Rimossa colonna analysis_metadata');
      }
      
      if (imageColumns.error_message) {
        await queryInterface.removeColumn('LessonImages', 'error_message', { transaction });
        console.log('   ✅ Rimossa colonna error_message');
      }
      
      if (imageColumns.privacy_level) {
        await queryInterface.removeColumn('LessonImages', 'privacy_level', { transaction });
        console.log('   ✅ Rimossa colonna privacy_level');
      }

      // 4. SCREENSHOTS: Rimuovi colonne inutilizzate (la tabella potrebbe essere eliminata completamente)
      console.log('📷 Cleanup tabella Screenshots...');
      
      const screenshotColumns = await queryInterface.describeTable('Screenshots');
      
      if (screenshotColumns.path) {
        await queryInterface.removeColumn('Screenshots', 'path', { transaction });
        console.log('   ✅ Rimossa colonna path');
      }
      
      if (screenshotColumns.original_filename) {
        await queryInterface.removeColumn('Screenshots', 'original_filename', { transaction });
        console.log('   ✅ Rimossa colonna original_filename');
      }

      await transaction.commit();
      console.log('✅ Cleanup completato con successo!');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Errore durante cleanup:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 Ripristino colonne...');

      // Ripristina colonne Lessons
      await queryInterface.addColumn('Lessons', 'description', {
        type: Sequelize.TEXT,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('Lessons', 'duration_minutes', {
        type: Sequelize.INTEGER,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('Lessons', 'auto_capture_interval', {
        type: Sequelize.INTEGER,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('Lessons', 'lesson_config', {
        type: Sequelize.JSONB,
        allowNull: true
      }, { transaction });

      // Rimuovi colonne di completamento
      await queryInterface.removeColumn('Lessons', 'is_completed', { transaction });
      await queryInterface.removeColumn('Lessons', 'completed_at', { transaction });

      // Ripristina colonne Attendances
      await queryInterface.addColumn('Attendances', 'screenshotId', {
        type: Sequelize.INTEGER,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('Attendances', 'imageId', {
        type: Sequelize.INTEGER,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('Attendances', 'imageFile', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      // Ripristina altre colonne...
      // (implementa solo se necessario per il rollback)

      await transaction.commit();
      console.log('✅ Rollback completato');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Errore durante rollback:', error);
      throw error;
    }
  }
};