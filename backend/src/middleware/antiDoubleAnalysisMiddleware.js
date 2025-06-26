const activeAnalysis = new Map();
const analysisHistory = new Map();

const antiDoubleAnalysisMiddleware = (req, res, next) => {
  const lessonId = req.params.id || req.params.lessonId || req.body.lessonId;
  
  if (!lessonId) {
    return next();
  }
  
  const key = "lesson_" + lessonId + "_analysis";
  const now = Date.now();
  
  if (activeAnalysis.has(key)) {
    const startTime = activeAnalysis.get(key);
    const duration = now - startTime;
    
    console.log("⚠️ DOPPIA ANALISI BLOCCATA per lezione " + lessonId + " (in corso da " + duration + "ms)");
    
    return res.status(429).json({
      success: false,
      error: "Analisi già in corso per questa lezione",
      code: "ANALYSIS_IN_PROGRESS",
      lessonId: lessonId,
      waitTime: Math.max(0, 30000 - duration)
    });
  }
  
  if (analysisHistory.has(key)) {
    const lastAnalysis = analysisHistory.get(key);
    const timeSince = now - lastAnalysis;
    
    if (timeSince < 30000) {
      console.log("⚠️ ANALISI TROPPO FREQUENTE per lezione " + lessonId + " (" + timeSince + "ms fa)");
      
      return res.status(429).json({
        success: false,
        error: "Analisi effettuata troppo di recente",
        code: "ANALYSIS_TOO_FREQUENT",
        lessonId: lessonId,
        lastAnalysis: new Date(lastAnalysis).toISOString(),
        waitTime: 30000 - timeSince
      });
    }
  }
  
  activeAnalysis.set(key, now);
  console.log("🔒 Analisi avviata per lezione " + lessonId);
  
  const timeoutId = setTimeout(() => {
    if (activeAnalysis.has(key)) {
      console.log("⏰ Timeout analisi per lezione " + lessonId + " - cleanup automatico");
      activeAnalysis.delete(key);
    }
  }, 120000);
  
  const originalSend = res.send;
  res.send = function(data) {
    activeAnalysis.delete(key);
    analysisHistory.set(key, Date.now());
    setTimeout(() => {
      analysisHistory.delete(key);
    }, 300000);
    clearTimeout(timeoutId);
    
    console.log("🔓 Analisi completata per lezione " + lessonId);
    
    originalSend.call(this, data);
  };
  
  next();
};

const getAnalysisStats = () => {
  return {
    activeAnalysis: Array.from(activeAnalysis.entries()).map(([key, startTime]) => ({
      key,
      startTime: new Date(startTime).toISOString(),
      duration: Date.now() - startTime
    })),
    recentAnalysis: Array.from(analysisHistory.entries()).map(([key, time]) => ({
      key,
      completedAt: new Date(time).toISOString(),
      timeSince: Date.now() - time
    }))
  };
};

const forceCleanup = (lessonId = null) => {
  if (lessonId) {
    const key = "lesson_" + lessonId + "_analysis";
    activeAnalysis.delete(key);
    analysisHistory.delete(key);
    console.log("🧹 Cleanup forzato per lezione " + lessonId);
  } else {
    activeAnalysis.clear();
    analysisHistory.clear();
    console.log("🧹 Cleanup completo di tutte le analisi");
  }
};

module.exports = { 
  antiDoubleAnalysisMiddleware, 
  getAnalysisStats, 
  forceCleanup 
};