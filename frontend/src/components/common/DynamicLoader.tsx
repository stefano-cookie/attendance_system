import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface DynamicLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  stages?: string[];
  stageDuration?: number; // milliseconds
  className?: string;
  forceStages?: boolean; // Force showing all stages even if operation completes quickly
}

const DynamicLoader: React.FC<DynamicLoaderProps> = ({
  size = 'md',
  message,
  stages = [],
  stageDuration = 2000,
  className = '',
  forceStages = false
}) => {
  const { t } = useTranslation();
  const [currentStage, setCurrentStage] = useState(0);

  // Default loading stages with colors
  const defaultStages = [
    { 
      message: t('common.loading'), 
      color: 'border-blue-500',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-400'
    },
    { 
      message: t('common.processing') || 'Elaborazione...', 
      color: 'border-yellow-500',
      bgColor: 'bg-yellow-500/10', 
      textColor: 'text-yellow-400'
    },
    { 
      message: t('common.finalizing') || 'Finalizzazione...', 
      color: 'border-green-500',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400'
    }
  ];

  const loadingStages = stages.length > 0 
    ? stages.map(stage => ({ message: stage, color: 'border-blue-500', bgColor: 'bg-blue-500/10', textColor: 'text-blue-400' }))
    : defaultStages;

  const currentStageData = loadingStages[currentStage] || loadingStages[0];

  useEffect(() => {
    if (loadingStages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentStage(prev => (prev + 1) % loadingStages.length);
    }, stageDuration);

    return () => clearInterval(interval);
  }, [loadingStages.length, stageDuration]);

  const sizeClasses = {
    sm: {
      spinner: 'h-6 w-6 border-2',
      container: 'p-4',
      text: 'text-sm'
    },
    md: {
      spinner: 'h-8 w-8 border-2', 
      container: 'p-8',
      text: 'text-base'
    },
    lg: {
      spinner: 'h-12 w-12 border-4',
      container: 'p-12', 
      text: 'text-lg'
    }
  };

  const { spinner, container, text } = sizeClasses[size];

  return (
    <div className={`text-center bg-gray-800 rounded-lg border border-gray-700 transition-all duration-500 ${currentStageData.bgColor} ${container} ${className}`}>
      <div className={`animate-spin rounded-full border-gray-600 border-t-transparent mx-auto mb-4 transition-all duration-700 ${spinner} ${currentStageData.color}`}></div>
      <h3 className={`font-medium text-gray-300 mb-0 transition-all duration-500 ${text} ${currentStageData.textColor}`}>
        {message || currentStageData.message}
      </h3>
      
      {/* Progress dots for multi-stage loading */}
      {loadingStages.length > 1 && (
        <div className="flex justify-center space-x-2 mt-4">
          {loadingStages.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentStage 
                  ? currentStageData.color.replace('border-', 'bg-')
                  : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DynamicLoader;