'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🧹 Inizio rimozione colonne inutilizzate con valori NULL...\n');
    
    // Subjects - rimuovi code, credits, semester
    console.log('📚 Rimozione colonne da Subjects...');
    try {
      await queryInterface.removeColumn('Subjects', 'code');
      console.log('  ✅ Rimossa colonna code');
    } catch (error) {
      console.log('  ⚠️  Colonna code non trovata o già rimossa');
    }
    
    try {
      await queryInterface.removeColumn('Subjects', 'credits');
      console.log('  ✅ Rimossa colonna credits');
    } catch (error) {
      console.log('  ⚠️  Colonna credits non trovata o già rimossa');
    }
    
    try {
      await queryInterface.removeColumn('Subjects', 'semester');
      console.log('  ✅ Rimossa colonna semester');
    } catch (error) {
      console.log('  ⚠️  Colonna semester non trovata o già rimossa');
    }
    
    // Attendances - rimuovi 6 colonne
    console.log('\n📋 Rimozione colonne da Attendances...');
    const attendanceColumns = [
      'face_detection_metadata',
      'override_reason', 
      'arrival_time',
      'late_minutes',
      'quality_score',
      'review_notes'
    ];
    
    for (const col of attendanceColumns) {
      try {
        await queryInterface.removeColumn('Attendances', col);
        console.log(`  ✅ Rimossa colonna ${col}`);
      } catch (error) {
        console.log(`  ⚠️  Colonna ${col} non trovata o già rimossa`);
      }
    }
    
    // LessonImages - rimuovi 7 colonne
    console.log('\n🖼️  Rimozione colonne da LessonImages...');
    const lessonImageColumns = [
      'image_hash',
      'image_quality',
      'resolution_width',
      'resolution_height',
      'optimization_applied',
      'image_category',
      'display_order'
    ];
    
    for (const col of lessonImageColumns) {
      try {
        await queryInterface.removeColumn('LessonImages', col);
        console.log(`  ✅ Rimossa colonna ${col}`);
      } catch (error) {
        console.log(`  ⚠️  Colonna ${col} non trovata o già rimossa`);
      }
    }
    
    // Screenshots - rimuovi analysis_metadata
    console.log('\n📸 Rimozione colonne da Screenshots...');
    try {
      await queryInterface.removeColumn('Screenshots', 'analysis_metadata');
      console.log('  ✅ Rimossa colonna analysis_metadata');
    } catch (error) {
      console.log('  ⚠️  Colonna analysis_metadata non trovata o già rimossa');
    }
    
    // UserTokens - rimuovi 5 colonne
    console.log('\n🔑 Rimozione colonne da UserTokens...');
    const userTokenColumns = [
      'expires_at',
      'device_info',
      'last_used_at',
      'revoked_at',
      'revoked_reason'
    ];
    
    for (const col of userTokenColumns) {
      try {
        await queryInterface.removeColumn('UserTokens', col);
        console.log(`  ✅ Rimossa colonna ${col}`);
      } catch (error) {
        console.log(`  ⚠️  Colonna ${col} non trovata o già rimossa`);
      }
    }
    
    console.log('\n🎉 Rimozione colonne completata! Totale: 19 colonne rimosse.');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Ripristino colonne rimosse...\n');
    
    // Ripristina Subjects
    console.log('📚 Ripristino colonne Subjects...');
    await queryInterface.addColumn('Subjects', 'code', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('Subjects', 'credits', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('Subjects', 'semester', {
      type: Sequelize.ENUM('first', 'second', 'annual'),
      allowNull: true
    });
    
    // Ripristina Attendances
    console.log('\n📋 Ripristino colonne Attendances...');
    await queryInterface.addColumn('Attendances', 'face_detection_metadata', {
      type: Sequelize.JSONB,
      allowNull: true
    });
    await queryInterface.addColumn('Attendances', 'override_reason', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('Attendances', 'arrival_time', {
      type: Sequelize.TIME,
      allowNull: true
    });
    await queryInterface.addColumn('Attendances', 'late_minutes', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('Attendances', 'quality_score', {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: true
    });
    await queryInterface.addColumn('Attendances', 'review_notes', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    
    // Ripristina LessonImages
    console.log('\n🖼️  Ripristino colonne LessonImages...');
    await queryInterface.addColumn('LessonImages', 'image_hash', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('LessonImages', 'image_quality', {
      type: Sequelize.ENUM('low', 'medium', 'high'),
      allowNull: true
    });
    await queryInterface.addColumn('LessonImages', 'resolution_width', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('LessonImages', 'resolution_height', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('LessonImages', 'optimization_applied', {
      type: Sequelize.JSONB,
      allowNull: true
    });
    await queryInterface.addColumn('LessonImages', 'image_category', {
      type: Sequelize.ENUM('face_detection', 'attendance', 'general'),
      allowNull: true
    });
    await queryInterface.addColumn('LessonImages', 'display_order', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    
    // Ripristina Screenshots
    console.log('\n📸 Ripristino colonne Screenshots...');
    await queryInterface.addColumn('Screenshots', 'analysis_metadata', {
      type: Sequelize.JSONB,
      allowNull: true
    });
    
    // Ripristina UserTokens
    console.log('\n🔑 Ripristino colonne UserTokens...');
    await queryInterface.addColumn('UserTokens', 'expires_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('UserTokens', 'device_info', {
      type: Sequelize.JSONB,
      allowNull: true
    });
    await queryInterface.addColumn('UserTokens', 'last_used_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('UserTokens', 'revoked_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('UserTokens', 'revoked_reason', {
      type: Sequelize.STRING,
      allowNull: true
    });
    
    console.log('\n✅ Ripristino colonne completato');
  }
};