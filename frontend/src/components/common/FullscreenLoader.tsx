import React from 'react';
import DynamicLoader from './DynamicLoader';

interface FullscreenLoaderProps {
  message?: string;
  stages?: string[];
  stageDuration?: number;
}

const FullscreenLoader: React.FC<FullscreenLoaderProps> = (props) => {
  return (
    <div className="min-h-screen bg-gray-900 flex justify-center items-center">
      <DynamicLoader 
        size="md"
        {...props}
      />
    </div>
  );
};

export default FullscreenLoader;