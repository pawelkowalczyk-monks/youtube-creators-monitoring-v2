import React from 'react';
import { useLocalization } from '../services/localization';

export const LanguageSwitcher: React.FC = () => {
    const { language, setLanguage } = useLocalization();

    const toggleLanguage = () => {
        setLanguage(language === 'fr' ? 'en' : 'fr');
    };

    return (
        <button
            onClick={toggleLanguage}
            className="text-sm font-medium text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/10"
            aria-label={`Switch language to ${language === 'fr' ? 'English' : 'Français'}`}
        >
            {language === 'fr' ? 'EN' : 'FR'}
        </button>
    );
};