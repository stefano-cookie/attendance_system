import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const TechnicianDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          {t('technician.dashboard.welcome')}
        </h2>
        <p className="text-gray-300">
          {t('technician.dashboard.subtitle')}
        </p>
      </div>

      {/* Main Action Card - Register Student */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg shadow-lg border border-green-500/20 p-8">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-white mb-3">
              {t('technician.dashboard.actions.registerStudent')}
            </h3>
            <p className="text-green-100 text-lg mb-6">
              {t('technician.dashboard.actions.registerStudentDesc')}
            </p>
            <button 
              onClick={() => navigate('/technician/register')}
              className="inline-flex items-center space-x-3 bg-white text-green-700 px-6 py-3 rounded-lg hover:bg-green-50 transition-all hover:scale-105 font-semibold shadow-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>{t('technician.registration.title')}</span>
            </button>
          </div>
          <div className="hidden md:block">
            <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center">
              <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Camera Setup */}
        <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6 hover:shadow-xl transition-all hover:scale-105">
          <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-white mb-2">{t('technician.dashboard.actions.cameraSetup')}</h4>
          <p className="text-gray-400 text-sm">{t('technician.dashboard.actions.cameraSetupDesc')}</p>
        </div>

        {/* System Info */}
        <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6 hover:shadow-xl transition-all hover:scale-105">
          <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-white mb-2">{t('technician.dashboard.actions.systemInfo')}</h4>
          <p className="text-gray-400 text-sm">{t('technician.dashboard.actions.systemInfoDesc')}</p>
        </div>

        {/* Documentation */}
        <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6 hover:shadow-xl transition-all hover:scale-105">
          <div className="w-12 h-12 bg-cyan-600/20 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-white mb-2">{t('technician.dashboard.actions.documentation')}</h4>
          <p className="text-gray-400 text-sm">{t('technician.dashboard.actions.documentationDesc')}</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-lg font-semibold text-blue-300 mb-2">{t('technician.dashboard.info.title')}</h4>
            <div className="space-y-2 text-blue-200">
              <p>• {t('technician.dashboard.info.photoRequired')}</p>
              <p>• {t('technician.dashboard.info.wellLit')}</p>
              <p>• {t('technician.dashboard.info.clearFace')}</p>
              <p>• {t('technician.dashboard.info.validData')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{t('technician.dashboard.help.title')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-yellow-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-white">{t('technician.dashboard.help.troubleshooting')}</h4>
              <p className="text-sm text-gray-400">{t('technician.dashboard.help.troubleshootingDesc')}</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-green-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-white">{t('technician.dashboard.help.bestPractices')}</h4>
              <p className="text-sm text-gray-400">{t('technician.dashboard.help.bestPracticesDesc')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechnicianDashboard;