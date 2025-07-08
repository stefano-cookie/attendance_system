import React, { useState, useEffect } from 'react';

interface DynamicButtonProps {
  loading: boolean;
  children: React.ReactNode;
  className?: string;
  loadingStages?: { message: string; color: string }[];
  stageDuration?: number;
  [key: string]: any; // Allow other button props
}

const DynamicButton: React.FC<DynamicButtonProps> = ({
  loading,
  children,
  className = '',
  loadingStages = [
    { message: 'Elaborazione...', color: 'border-blue-300' },
    { message: 'Salvataggio...', color: 'border-yellow-300' },
    { message: 'Finalizzazione...', color: 'border-green-300' }
  ],
  stageDuration = 1000,
  ...buttonProps
}) => {
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    if (!loading || loadingStages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentStage(prev => (prev + 1) % loadingStages.length);
    }, stageDuration);

    return () => clearInterval(interval);
  }, [loading, loadingStages.length, stageDuration]);

  const currentStageData = loadingStages[currentStage] || loadingStages[0];

  return (
    <button
      {...buttonProps}
      disabled={loading || buttonProps.disabled}
      className={`${className} transition-all duration-300 ${loading ? 'animate-pulse' : ''}`}
    >
      {loading ? (
        <div className="flex items-center space-x-2">
          <div className={`animate-spin rounded-full h-4 w-4 border-2 border-t-transparent transition-all duration-500 ${currentStageData.color}`}></div>
          <span>{currentStageData.message}</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
};

export default DynamicButton;