
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Mention, ShortlistedMention, GeneratedResponseSet, AppStep, ProductArea, ToneMatrixItem, AIPersonality, Trait, ChatMessage, GeoMood, LikeCandidate, ModerationCandidate } from './types';
import { PRODUCT_AREA_COLORS } from './constants';
import { analyzeAndTagMentions, generateResponsesForMention, magnifyResponse, analyzeMethodologyForPersonality, getPersonalityChat, resetPersonalityChat, updatePersonalityFromChat, generateToneMatrixFromMethodology, sharpenResponse } from './services/geminiService';
import { useLocalization } from './services/localization';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import GuidelinesContent from './components/GuidelinesContent';
import FunnelSidebar from './components/FunnelSidebar';

declare const Papa: any;
declare const pdfjsLib: any;
declare const XLSX: any;
declare const JSZip: any;

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// --- Icons ---
const UploadIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const FileIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>;
const LinkIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"/></svg>;
const CopyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
const ScissorsIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>;
const CheckIcon = ({className}: {className?: string}) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"/></svg>;
const XIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const MessageSquareIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const RefreshCwIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 2v6h6"/><path d="M21 22v-6h-6"/><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/></svg>;
const SparklesIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9.5 8.5L12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z"/><path d="M5 21L6 17"/><path d="M19 21L18 17"/></svg>;
const SlidersIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>;
const TrashIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;
const AlertTriangleIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const ShieldIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const EyeIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;

// --- Step Indicator Component ---
const StepIndicator: React.FC<{ currentStep: AppStep }> = ({ currentStep }) => {
    const steps = [
        { id: AppStep.Welcome, label: '01 SETUP' },
        { id: AppStep.Analyzing, label: '02 ANALYZE' },
        { id: AppStep.Validating, label: '03 VALIDATE' },
        { id: AppStep.Generating, label: '04 GENERATE' },
        { id: AppStep.Results, label: '05 REFINE' },
        { id: AppStep.Export, label: '06 EXPORT' },
    ];

    return (
        <div className="fixed top-0 left-0 w-full z-40 h-24 flex items-center justify-between px-12 pointer-events-none">
             <div className="flex items-center space-x-3 pointer-events-auto">
                 <div className="w-8 h-8 bg-white text-black flex items-center justify-center font-bold text-xs rounded-none border border-transparent">GS</div>
                 <span className="text-white font-bold tracking-tighter text-xl">AGENT</span>
            </div>
            
            <div className="flex items-center space-x-12 backdrop-blur-md bg-black/40 px-8 py-3 rounded-full border border-white/5 pointer-events-auto">
                {steps.map((step, index) => {
                     const isActive = currentStep === step.id || (currentStep > step.id && step.id !== AppStep.Analyzing && step.id !== AppStep.Generating);
                     const isCurrent = currentStep === step.id;
                     
                     return (
                        <div key={step.id} className={`flex items-center space-x-3 ${isActive || isCurrent ? 'text-white' : 'text-gray-700'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-white animate-pulse shadow-[0_0_10px_white]' : isActive ? 'bg-white' : 'bg-gray-800'}`}></div>
                            <span className={`text-[10px] font-bold tracking-widest font-mono ${isCurrent ? 'text-white' : 'text-gray-600'}`}>{step.label}</span>
                        </div>
                     );
                })}
            </div>

            <div className="flex items-center space-x-4 pointer-events-auto">
                <LanguageSwitcher />
            </div>
        </div>
    );
};

// --- Standard UI Components (Redis Style) ---

const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, children, ...props }) => (
    <button 
        className={`px-8 py-4 bg-[#4285F4] text-white font-black uppercase tracking-widest text-xs hover:bg-[#3367D6] hover:shadow-[0_0_15px_rgba(66,133,244,0.5)] disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all rounded-none ${className}`}
        {...props}
    >
        {children}
    </button>
);

const SecondaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, children, ...props }) => (
    <button 
        className={`px-6 py-3 bg-transparent border border-white/20 text-white font-bold uppercase tracking-widest text-xs hover:bg-white/5 hover:border-white disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded-sm ${className}`}
        {...props}
    >
        {children}
    </button>
);

const SectionHeader: React.FC<{ title: string, subtitle?: string, rightElement?: React.ReactNode }> = ({ title, subtitle, rightElement }) => (
    <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-6">
        <div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase font-sans">{title}</h2>
            {subtitle && <p className="text-gray-400 mt-2 font-mono text-xs uppercase tracking-wide leading-relaxed max-w-2xl">{subtitle}</p>}
        </div>
        {rightElement}
    </div>
);

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
    <div className="w-64 h-1 bg-gray-800 mt-8 relative overflow-hidden">
        <div 
            className="h-full bg-gradient-to-r from-[#4285F4] via-[#EA4335] to-[#34A853] transition-all duration-300 ease-out shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
            style={{ width: `${progress}%` }}
        />
    </div>
);

// --- Modals & Loaders ---

const TerminalLoader: React.FC<{ message: string, progress: number }> = ({ message, progress }) => {
    const logs = useRef<string[]>([]);
    const [displayLogs, setDisplayLogs] = useState<string[]>([]);
    
    useEffect(() => {
        const technicalLogs = [
            "INIT_GEMINI_MODEL: SUCCESS",
            "CONNECTING_TO_KNOWLEDGE_GRAPH...",
            "AUTHENTICATED: [SECURE_CONNECTION]",
            "PARSING_INPUT_STREAMS...",
            "IDENTIFYING_ENTITIES: [OK]",
            "CHECKING_BRAND_GUIDELINES...",
            "ANALYZING_SENTIMENT_VECTORS...",
            "CALCULATING_OPPORTUNITY_SCORES...",
            "FILTERING_NOISE...",
            "OPTIMIZING_OUTPUT_BUFFERS..."
        ];
        
        const interval = setInterval(() => {
            const randomLog = technicalLogs[Math.floor(Math.random() * technicalLogs.length)];
            const timestamp = new Date().toISOString().split('T')[1].slice(0,8);
            logs.current = [`> [${timestamp}] ${randomLog}`, ...logs.current].slice(0, 5);
            setDisplayLogs([...logs.current]);
        }, 800);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center text-center p-12 space-y-8 h-[60vh] animate-fade-in-up w-full max-w-2xl">
            <div className="w-full bg-black border border-white/20 p-4 font-mono text-xs text-left text-green-400 h-48 flex flex-col justify-end shadow-[0_0_30px_rgba(0,255,0,0.05)] rounded-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-20"></div>
                {displayLogs.map((log, i) => (
                    <div key={i} className="opacity-80 pb-1">{log}</div>
                ))}
                <div className="animate-pulse">_</div>
            </div>
            
            <div className="w-full flex flex-col items-center">
                <p className="text-sm text-gray-300 font-mono tracking-widest uppercase mb-4 animate-pulse">{message}</p>
                <ProgressBar progress={progress} />
            </div>
        </div>
    );
};

const ThinkingLoader: React.FC<{ message: string, progress: number }> = ({ message, progress }) => (
    <div className="flex flex-col items-center justify-center text-center p-12 space-y-12 h-[60vh] animate-fade-in-up">
        <div className="relative w-32 h-32">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#EA4335] rounded-full animate-[subtle-bob_2s_infinite]"></div>
            <div className="absolute bottom-0 left-0 w-4 h-4 bg-[#4285F4] rounded-full animate-[subtle-bob_2.5s_infinite_0.5s]"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#34A853] rounded-full animate-[subtle-bob_2.2s_infinite_1s]"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-[#FBBC05] rounded-full animate-pulse shadow-[0_0_20px_#FBBC05]"></div>
            
            <svg className="absolute inset-0 w-full h-full animate-[spin_10s_linear_infinite]" style={{ opacity: 0.3 }}>
                 <circle cx="64" cy="64" r="40" fill="none" stroke="white" strokeWidth="1" strokeDasharray="4 4" />
            </svg>
        </div>

        <div className="flex flex-col items-center">
            <p className="text-xl text-white font-mono uppercase tracking-widest font-bold mb-2">GENERATING CONTENT</p>
            <p className="text-xs text-gray-400 font-mono uppercase tracking-wide mb-6">{message}</p>
            <ProgressBar progress={progress} />
        </div>
    </div>
);

// --- File Upload Module ---
interface FileUploadModuleProps {
  title: string;
  dropzoneProps: any;
  inputProps: any;
  isDragActive: boolean;
  fileName: string;
  onRemove: () => void;
  formats: string;
  t: (key: string, replacements?: any) => string;
  required?: boolean;
}

const FileUploadModule: React.FC<FileUploadModuleProps> = ({ title, dropzoneProps, inputProps, isDragActive, fileName, onRemove, formats, t, required }) => {
  return (
    <div className={`relative h-32 border transition-all duration-300 group flex flex-col justify-center ${fileName ? 'border-white bg-[#0F0F0F]' : 'border-white/10 bg-black hover:border-white/40'}`}>
        
        {fileName ? (
            <div className="flex items-center justify-between px-6">
                <div className="flex items-center space-x-4">
                    <div className="p-2 bg-[#34A853]/10 rounded-full border border-[#34A853]/20">
                        <FileIcon className="text-[#34A853] w-5 h-5" />
                    </div>
                    <div>
                         <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">{title}</p>
                        <p className="text-white font-mono text-sm truncate max-w-[200px]">{fileName}</p>
                    </div>
                </div>
                 <button onClick={onRemove} className="text-gray-500 hover:text-[#EA4335] transition-colors">
                    <XIcon className="w-5 h-5" />
                </button>
            </div>
        ) : (
            <div {...dropzoneProps} className="flex items-center justify-between px-6 cursor-pointer h-full">
                <input {...inputProps} />
                <div>
                    <p className="text-white font-bold text-sm uppercase tracking-wider mb-1 flex items-center">
                        {title} {required && <span className="text-[#EA4335] ml-1">*</span>}
                    </p>
                    <p className="text-gray-500 text-[10px] font-mono">{formats}</p>
                </div>
                <div className={`p-3 rounded-full border transition-all duration-300 ${isDragActive ? 'bg-white text-black' : 'border-white/10 text-gray-600 group-hover:text-white group-hover:border-white'}`}>
                    <UploadIcon className="w-5 h-5" />
                </div>
            </div>
        )}
    </div>
  );
};

// --- App Component ---

const App: React.FC = () => {
    // State
    const [appStep, setAppStep] = useState<AppStep>(AppStep.Welcome);
    const [rawEarnedMentions, setRawEarnedMentions] = useState<Mention[]>([]);
    const [rawOwnedMentions, setRawOwnedMentions] = useState<Mention[]>([]);
    const [rawSlrrMentions, setRawSlrrMentions] = useState<Mention[]>([]);
    const [earnedMentionsFileName, setEarnedMentionsFileName] = useState<string>('');
    const [ownedMentionsFileName, setOwnedMentionsFileName] = useState<string>('');
    const [slrrFiles, setSlrrFiles] = useState<{ name: string; count: number }[]>([]);
    const [ownedZipFileName, setOwnedZipFileName] = useState<string>('');
    const [methodologyText, setMethodologyText] = useState<string>('');
    const [methodologyFileName, setMethodologyFileName] = useState<string>('');
    
    // Shortlisted lists
    const [shortlistedEarnedMentions, setShortlistedEarnedMentions] = useState<ShortlistedMention[]>([]);
    const [shortlistedOwnedMentions, setShortlistedOwnedMentions] = useState<ShortlistedMention[]>([]);
    const [shortlistedSlrrMentions, setShortlistedSlrrMentions] = useState<ShortlistedMention[]>([]);
    const [likeOnlyMentions, setLikeOnlyMentions] = useState<ShortlistedMention[]>([]);
    
    // Triage lists (No Review)
    const [mentionsToHide, setMentionsToHide] = useState<ModerationCandidate[]>([]);
    const [mentionsToDelete, setMentionsToDelete] = useState<ModerationCandidate[]>([]);

    const [likeReasons, setLikeReasons] = useState<Map<string, string>>(new Map());
    const [selectedMentionIds, setSelectedMentionIds] = useState<Set<string>>(new Set());
    const [selectedLikeMentionIds, setSelectedLikeMentionIds] = useState<Set<string>>(new Set());
    const [selectedModerationIds, setSelectedModerationIds] = useState<Set<string>>(new Set());

    const [generatedResponses, setGeneratedResponses] = useState<Map<string, GeneratedResponseSet>>(new Map());
    const [responseHints, setResponseHints] = useState<Map<string, string>>(new Map());
    const [customResponses, setCustomResponses] = useState<Map<string, string>>(new Map());
    const [selectedFinalAnswers, setSelectedFinalAnswers] = useState<Map<string, { type: 'generated' | 'custom'; index: number; content: string }>>(new Map());
    
    const [regeneratingMentionId, setRegeneratingMentionId] = useState<string | null>(null);
    const [magnifyingMentionId, setMagnifyingMentionId] = useState<string | null>(null);
    const [sharpeningResponseId, setSharpeningResponseId] = useState<string | null>(null);
    const [error, setError] = useState<string>('');
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [progress, setProgress] = useState<number>(0);
    const [showMethodologyModal, setShowMethodologyModal] = useState(false);
    const [showGuidelinesModal, setShowGuidelinesModal] = useState(false);
    const [showHowToUseModal, setShowHowToUseModal] = useState(false);
    const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
    const [availableEarnedPlatforms, setAvailableEarnedPlatforms] = useState<string[]>([]);
    const [selectedEarnedPlatforms, setSelectedEarnedPlatforms] = useState<Set<string>>(new Set());
    const [availableOwnedPlatforms, setAvailableOwnedPlatforms] = useState<string[]>([]);
    const [selectedOwnedPlatforms, setSelectedOwnedPlatforms] = useState<Set<string>>(new Set());
    const [availableSlrrPlatforms, setAvailableSlrrPlatforms] = useState<string[]>([]);
    const [selectedSlrrPlatforms, setSelectedSlrrPlatforms] = useState<Set<string>>(new Set());
    const [ignoreTwitterRepliesEarned, setIgnoreTwitterRepliesEarned] = useState<boolean>(true);
    const [ignoreTwitterRepliesOwned, setIgnoreTwitterRepliesOwned] = useState<boolean>(true);
    const [ignoreTwitterRepliesSlrr, setIgnoreTwitterRepliesSlrr] = useState<boolean>(true);
    const [editingToneMatrixFor, setEditingToneMatrixFor] = useState<string | null>(null);
    const [toneMatrices, setToneMatrices] = useState<Map<string, ToneMatrixItem[]>>(new Map());
    const [baseToneMatrix, setBaseToneMatrix] = useState<ToneMatrixItem[]>([]);
    const [aiPersonality, setAiPersonality] = useState<AIPersonality | null>(null);
    const [isAnalyzingPersonality, setIsAnalyzingPersonality] = useState(false);
    const [showPersonalityCard, setShowPersonalityCard] = useState(false);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isChatting, setIsChatting] = useState(false);
    const [isUpdatingPersonality, setIsUpdatingPersonality] = useState(false);
    const [geoMood, setGeoMood] = useState<GeoMood>('idle');
    const [geoGreeting, setGeoGreeting] = useState('');
    const [tableCopied, setTableCopied] = useState(false);

    const processingTriggered = useRef(false);
    const moodTimeoutRef = useRef<number | null>(null);
    // REDUCED LIMIT TO PREVENT JSON TRUNCATION ERRORS
    const MENTION_PROCESSING_LIMIT = 50; 
    const { t, language } = useLocalization();

    // Mouse tracking for background
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const x = e.clientX;
            const y = e.clientY;
            document.documentElement.style.setProperty('--mouse-x', `${x}px`);
            document.documentElement.style.setProperty('--mouse-y', `${y}px`);
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const handleReset = () => {
        setAppStep(AppStep.Welcome);
        setRawEarnedMentions([]); setRawOwnedMentions([]); setRawSlrrMentions([]); setEarnedMentionsFileName(''); setOwnedMentionsFileName(''); setSlrrFiles([]); setOwnedZipFileName(''); setMethodologyText(''); setMethodologyFileName(''); 
        setShortlistedEarnedMentions([]); setShortlistedOwnedMentions([]); setShortlistedSlrrMentions([]); setLikeOnlyMentions([]); 
        setMentionsToHide([]); setMentionsToDelete([]);
        setLikeReasons(new Map()); 
        setSelectedMentionIds(new Set()); setSelectedLikeMentionIds(new Set()); setSelectedModerationIds(new Set());
        setGeneratedResponses(new Map()); setResponseHints(new Map()); setCustomResponses(new Map()); setSelectedFinalAnswers(new Map()); setRegeneratingMentionId(null); setMagnifyingMentionId(null); setSharpeningResponseId(null); setError(''); setLoadingMessage(''); setProgress(0); processingTriggered.current = false; setShowMethodologyModal(false); setShowGuidelinesModal(false); setShowHowToUseModal(false); setEditingToneMatrixFor(null); setToneMatrices(new Map()); setBaseToneMatrix([]); setAvailableEarnedPlatforms([]); setSelectedEarnedPlatforms(new Set()); setAvailableOwnedPlatforms([]); setSelectedOwnedPlatforms(new Set()); setAvailableSlrrPlatforms([]); setSelectedSlrrPlatforms(new Set()); setIgnoreTwitterRepliesEarned(true); setIgnoreTwitterRepliesOwned(true); setIgnoreTwitterRepliesSlrr(true); setAiPersonality(null); setIsAnalyzingPersonality(false); setShowPersonalityCard(false); resetPersonalityChat(); setChatHistory([]); setIsChatting(false); setIsUpdatingPersonality(false); setGeoMood('idle'); if (moodTimeoutRef.current) clearTimeout(moodTimeoutRef.current);
    };

    const mentionDateRange = useMemo(() => {
        const allDates = [...rawEarnedMentions, ...rawOwnedMentions, ...rawSlrrMentions].map(m => m.rawDate).filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()));
        if (allDates.length === 0) return "N/A";
        const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
        const formatter = new Intl.DateTimeFormat(language, options);
        if (minDate.toDateString() === maxDate.toDateString()) return formatter.format(minDate);
        return `${formatter.format(minDate)} — ${formatter.format(maxDate)}`;
    }, [rawEarnedMentions, rawOwnedMentions, rawSlrrMentions, language]);

    const startDate = useMemo(() => {
        const allDates = [...rawEarnedMentions, ...rawOwnedMentions, ...rawSlrrMentions].map(m => m.rawDate).filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()));
        return allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : null;
    }, [rawEarnedMentions, rawOwnedMentions, rawSlrrMentions]);

    // Consolidate "Candidates for Response" (No Review)
    const allShortlistedMentions = useMemo(() => {
        return [...shortlistedEarnedMentions, ...shortlistedOwnedMentions, ...shortlistedSlrrMentions];
    }, [shortlistedEarnedMentions, shortlistedOwnedMentions, shortlistedSlrrMentions]);

    const setTemporaryMood = (mood: GeoMood, duration: number) => { setGeoMood(mood); if (moodTimeoutRef.current) clearTimeout(moodTimeoutRef.current); moodTimeoutRef.current = window.setTimeout(() => { setGeoMood('idle'); }, duration); };

    // ... File Processing Logic (Identical to before) ...
    const processEarnedMentionData = useCallback((rows: any[][]): Mention[] => { 
        const headerRowIndex = rows.findIndex(row => { if (!Array.isArray(row)) return false; const lowercasedRow = row.map(cell => String(cell ?? '').toLowerCase().trim()); return lowercasedRow.includes('full text') || lowercasedRow.includes('mention') || lowercasedRow.includes('author'); });
        if (headerRowIndex === -1) { setError(t('error_missingHeader')); setAppStep(AppStep.Error); return []; }
        const headers = rows[headerRowIndex].map(h => String(h || '').trim().toLowerCase());
        const mentionIndex = headers.findIndex(h => h === 'full text' || h === 'mention');
        const authorIndex = headers.indexOf('author');
        const platformIndex = headers.findIndex(h => h === 'platform' || h === 'domain');
        const dateIndex = headers.findIndex(h => h === 'date' || h === 'published');
        const urlIndex = headers.findIndex(h => h === 'url');
        if (mentionIndex === -1) { setError(t('error_missingMentionColumn')); setAppStep(AppStep.Error); return []; }
        const dataRows = rows.slice(headerRowIndex + 1);
        return dataRows.map((row, index): Mention | null => { 
            if (!Array.isArray(row) || row.length === 0) return null; 
            const stringRow = row.map(cell => cell !== null && cell !== undefined ? String(cell) : ''); 
            let mentionText = stringRow[mentionIndex]?.trim(); 
            if (!mentionText) return null; 

            // Hardcoded Rule 1: Remove if only emojis
            const noEmojis = mentionText.replace(/\p{Extended_Pictographic}/gu, '').replace(/\s/g, '');
            if (noEmojis.length === 0) return null;

            // Hardcoded Rule 2: Truncate to 400 characters
            if (mentionText.length > 400) {
                mentionText = mentionText.substring(0, 400);
            }

            const platform = stringRow[platformIndex] || 'N/A'; 
            const prettyPlatform = platform.split('.')[0]; 
            const rawDateObj = dateIndex !== -1 ? new Date(stringRow[dateIndex]) : undefined; 
            return { 
                id: `mention_earned_${Date.now()}_${index}`, 
                mention: mentionText, 
                author: authorIndex !== -1 ? stringRow[authorIndex] : 'N/A', 
                platform: platformIndex !== -1 ? (prettyPlatform.charAt(0).toUpperCase() + prettyPlatform.slice(1)) : 'N/A', 
                date: rawDateObj && !isNaN(rawDateObj.getTime()) ? rawDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A', 
                rawDate: rawDateObj && !isNaN(rawDateObj.getTime()) ? rawDateObj : undefined, 
                url: urlIndex !== -1 ? stringRow[urlIndex] : '', 
                source: 'EARNED', 
            }; 
        }).filter((mention): mention is Mention => mention !== null);
    }, [t]);

    const processOwnedMentionData = useCallback((rows: any[][]): Mention[] => { 
        const headerRowIndex = rows.findIndex(row => { if (!Array.isArray(row)) return false; const lowercasedRow = row.map(cell => String(cell ?? '').toLowerCase().trim()); return lowercasedRow.includes('message') && lowercasedRow.includes('senderscreenname'); });
        if (headerRowIndex === -1) { setError(t('error_missingHeaderOwned')); setAppStep(AppStep.Error); return []; }
        const headers = rows[headerRowIndex].map(h => String(h || '').trim().toLowerCase());
        const idIndex = headers.indexOf('universalmessageid');
        const messageIndex = headers.indexOf('message');
        const authorIndex = headers.indexOf('senderscreenname');
        const platformIndex = headers.indexOf('socialnetwork');
        const dateIndex = headers.indexOf('createdtime');
        const urlIndex = headers.indexOf('permalink');
        if (messageIndex === -1 || authorIndex === -1 || idIndex === -1) { setError(t('error_missingColumnOwned')); setAppStep(AppStep.Error); return []; }
        const dataRows = rows.slice(headerRowIndex + 1);
        return dataRows.map((row, index): Mention | null => { 
            if (!Array.isArray(row) || row.length < headers.length) return null; 
            const stringRow = row.map(cell => cell !== null && cell !== undefined ? String(cell) : ''); 
            let mentionText = stringRow[messageIndex]?.trim(); 
            if (!mentionText) return null; 

            // Hardcoded Rule 1: Remove if only emojis
            const noEmojis = mentionText.replace(/\p{Extended_Pictographic}/gu, '').replace(/\s/g, '');
            if (noEmojis.length === 0) return null;

            // Hardcoded Rule 2: Truncate to 400 characters
            if (mentionText.length > 400) {
                mentionText = mentionText.substring(0, 400);
            }

            const platform = stringRow[platformIndex] || 'N/A'; 
            const prettyPlatform = platform.split('.')[0]; 
            const rawDateObj = dateIndex !== -1 ? new Date(stringRow[dateIndex]) : undefined; 
            return { 
                id: stringRow[idIndex] || `mention_owned_${Date.now()}_${index}`, 
                mention: mentionText, 
                author: stringRow[authorIndex] || 'N/A', 
                platform: platformIndex !== -1 ? (prettyPlatform.charAt(0).toUpperCase() + prettyPlatform.slice(1)) : 'N/A', 
                date: rawDateObj && !isNaN(rawDateObj.getTime()) ? rawDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A', 
                rawDate: rawDateObj && !isNaN(rawDateObj.getTime()) ? rawDateObj : undefined, 
                url: urlIndex !== -1 ? stringRow[urlIndex] : '', 
                source: 'OWNED', 
            }; 
        }).filter((mention): mention is Mention => mention !== null);
    }, [t]);

    const processSlrrMentionData = useCallback((rows: any[][]): Mention[] => { 
        // Data starts from row 3 (index 2)
        // Two header rows: 0 and 1. We look for headers in row 1 (index 1)
        if (rows.length < 3) return [];
        
        const headers = rows[1].map(h => String(h || '').trim().toLowerCase());
        const authorIndex = headers.indexOf('author_handle');
        const dateIndex = headers.indexOf('date_of_post');
        const snippetIndex = headers.indexOf('snippet');
        const urlIndex = headers.indexOf('link');
        const languageIndex = headers.indexOf('language');

        if (snippetIndex === -1) { setError(t('error_missingMentionColumn')); setAppStep(AppStep.Error); return []; }
        
        const dataRows = rows.slice(2);
        return dataRows.map((row, index): Mention | null => { 
            if (!Array.isArray(row) || row.length === 0) return null; 
            const stringRow = row.map(cell => cell !== null && cell !== undefined ? String(cell) : ''); 
            let mentionText = stringRow[snippetIndex]?.trim(); 
            if (!mentionText) return null; 

            // Hardcoded Rule 1: Remove if only emojis
            const noEmojis = mentionText.replace(/\p{Extended_Pictographic}/gu, '').replace(/\s/g, '');
            if (noEmojis.length === 0) return null;

            // Hardcoded Rule 2: Truncate to 400 characters
            if (mentionText.length > 400) {
                mentionText = mentionText.substring(0, 400);
            }

            // For SLRR, we might need to infer platform from URL if not present
            const url = urlIndex !== -1 ? stringRow[urlIndex] : '';
            let platform = 'N/A';
            if (url.includes('x.com') || url.includes('twitter.com')) platform = 'Twitter';
            else if (url.includes('facebook.com')) platform = 'Facebook';
            else if (url.includes('instagram.com')) platform = 'Instagram';
            else if (url.includes('youtube.com')) platform = 'YouTube';

            const rawDateObj = dateIndex !== -1 ? new Date(stringRow[dateIndex]) : undefined; 
            return { 
                id: `mention_slrr_${Date.now()}_${index}`, 
                mention: mentionText, 
                author: authorIndex !== -1 ? stringRow[authorIndex] : 'N/A', 
                platform: platform, 
                date: rawDateObj && !isNaN(rawDateObj.getTime()) ? rawDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A', 
                rawDate: rawDateObj && !isNaN(rawDateObj.getTime()) ? rawDateObj : undefined, 
                url: url, 
                source: 'SLRR', 
            }; 
        }).filter((mention): mention is Mention => mention !== null);
    }, [t]);

    const handleFileProcessing = useCallback((file: File, type: 'EARNED' | 'OWNED' | 'SLRR') => { 
        setError(''); const parts = file.name.split('.'); const ext = parts.pop(); const fileExtension = ext ? ext.toLowerCase() : '';
        const processData = (data: any[]) => {
            let parsedMentions: Mention[] = [];
            if (type === 'EARNED') parsedMentions = processEarnedMentionData(data as any[][]);
            else if (type === 'OWNED') parsedMentions = processOwnedMentionData(data as any[][]);
            else if (type === 'SLRR') parsedMentions = processSlrrMentionData(data as any[][]);

            if (parsedMentions.length === 0 && appStep !== AppStep.Error) { setError(t('error_noValidMentions')); return; }
            const uniquePlatforms: string[] = Array.from(new Set(parsedMentions.map(m => m.platform)));
            const priorityOrder = ['x', 'twitter', 'instagram', 'youtube', 'facebook'];
            const sortedPlatforms = uniquePlatforms.sort((a, b) => { const aLower = String(a).toLowerCase(); const bLower = String(b).toLowerCase(); const aIndex = priorityOrder.indexOf(aLower); const bIndex = priorityOrder.indexOf(bLower); if (aIndex > -1 && bIndex > -1) return aIndex - bIndex; if (aIndex > -1) return -1; if (bIndex > -1) return 1; return aLower.localeCompare(bLower); });
            
            if(type === 'EARNED') { 
                setRawEarnedMentions(parsedMentions); 
                setEarnedMentionsFileName(file.name); 
                setAvailableEarnedPlatforms(sortedPlatforms); 
                const defaultPlatforms = ['twitter', 'x', 'instagram', 'youtube', 'facebook']; 
                setSelectedEarnedPlatforms(new Set(sortedPlatforms.filter(p => defaultPlatforms.includes(p.toLowerCase())))); 
            } else if (type === 'OWNED') { 
                setRawOwnedMentions(parsedMentions); 
                setOwnedMentionsFileName(file.name); 
                setAvailableOwnedPlatforms(sortedPlatforms); 
                setSelectedOwnedPlatforms(new Set(sortedPlatforms)); 
            } else if (type === 'SLRR') {
                setRawSlrrMentions(prev => [...prev, ...parsedMentions]);
                setSlrrFiles(prev => [...prev, { name: file.name, count: parsedMentions.length }]);
                setAvailableSlrrPlatforms(prev => Array.from(new Set([...prev, ...sortedPlatforms])));
                setSelectedSlrrPlatforms(prev => new Set([...Array.from(prev), ...sortedPlatforms]));
            }
        };
        if (fileExtension === 'csv' || fileExtension === 'tsv') { 
            Papa.parse(file, { 
                delimiter: fileExtension === 'tsv' ? '\t' : ',', 
                complete: (results: any) => { 
                    if (results.errors.length > 0) { 
                        setError(t('error_csvParse', {message: String(results.errors[0].message)})); 
                        return; 
                    } 
                    processData(results.data); 
                }, 
                error: (err: any) => { 
                    setError(t('error_csvParse', {message: String(err.message || err)})); 
                } 
            }); 
        } else if (fileExtension === 'xls' || fileExtension === 'xlsx') { const reader = new FileReader(); reader.onload = (event) => { try { if (!event.target?.result) throw new Error("File could not be read."); const data = new Uint8Array(event.target.result as ArrayBuffer); const workbook = XLSX.read(data, {type: 'array', cellDates: true}); const sheetName = workbook.SheetNames[0]; const worksheet = workbook.Sheets[sheetName]; const json = XLSX.utils.sheet_to_json(worksheet, {header: 1, defval: '', raw: false}); processData(json); } catch (e) { setError(e instanceof Error ? e.message : t('error_excelRead')); } }; reader.onerror = () => { setError(t('error_failedFileRead')); }; reader.readAsArrayBuffer(file); } else { setError(t('error_unsupportedFormat')); }
    }, [t, processEarnedMentionData, processOwnedMentionData, appStep]);

    const onDropEarnedMentions = useCallback((acceptedFiles: File[]) => { if (acceptedFiles[0]) handleFileProcessing(acceptedFiles[0], 'EARNED'); }, [handleFileProcessing]);
    const onDropOwnedMentions = useCallback(async (acceptedFiles: File[]) => { 
        const file = acceptedFiles[0]; if (!file) return; setError(''); const parts = file.name.split('.'); const ext = parts.pop(); const fileExtension = ext ? ext.toLowerCase() : ''; setOwnedZipFileName('');
        if (fileExtension === 'zip') { setOwnedZipFileName(file.name); try { const reader = new FileReader(); reader.onload = async (event) => { if (!event.target?.result) { setError(t('error_failedFileRead')); setOwnedZipFileName(''); return; } try { const zip = await JSZip.loadAsync(event.target.result); let excelFile = null; let excelFileName = ''; for (const filename in zip.files) { if (!zip.files[filename].dir && (filename.toLowerCase().endsWith('.xlsx') || filename.toLowerCase().endsWith('.xls'))) { excelFile = zip.files[filename]; excelFileName = filename.split('/').pop() || filename; break; } } if (excelFile) { const content = await excelFile.async('arraybuffer'); const blob = new Blob([content]); const newFile = new File([blob], excelFileName, { type: blob.type }); handleFileProcessing(newFile, 'OWNED'); } else { setError(t('error_noExcelInZip')); setOwnedZipFileName(''); } } catch (e) { setError(t('error_zipRead')); setOwnedZipFileName(''); } }; reader.onerror = () => { setError(t('error_failedFileRead')); setOwnedZipFileName(''); }; reader.readAsArrayBuffer(file); } catch (e) { setError(t('error_zipRead')); setOwnedZipFileName(''); } } else { handleFileProcessing(file, 'OWNED'); }
    }, [handleFileProcessing, t]);
    const onDropSlrrMentions = useCallback((acceptedFiles: File[]) => { 
        acceptedFiles.forEach(file => handleFileProcessing(file, 'SLRR')); 
    }, [handleFileProcessing]);
    const onDropMethodology = useCallback(async (acceptedFiles: File[]) => { 
        const file = acceptedFiles[0]; if (!file) return; setError(''); setMethodologyFileName(file.name); const reader = new FileReader(); reader.onload = async (event) => { if (event.target?.result) { try { const pdf = await pdfjsLib.getDocument(event.target.result).promise; let textContent = ''; for (let i = 1; i <= pdf.numPages; i++) { const page = await pdf.getPage(i); const text = await page.getTextContent(); textContent += text.items.map((s: any) => s.str).join(' '); } setMethodologyText(textContent); if (textContent.trim()) { setIsAnalyzingPersonality(true); setAiPersonality(null); setBaseToneMatrix([]); try { const [personality, toneMatrix] = await Promise.all([analyzeMethodologyForPersonality(textContent, language), generateToneMatrixFromMethodology(textContent, language)]); setAiPersonality(personality); setBaseToneMatrix(toneMatrix); resetPersonalityChat(); } catch (e) { console.error("Failed to analyze methodology:", e); setError(t('error_methodologyAnalysisFailed')); } finally { setIsAnalyzingPersonality(false); } } } catch (err) { const details = err instanceof Error ? err.message : String(err); setError(t('error_pdfRead', { details })); setMethodologyFileName(''); setAiPersonality(null); setBaseToneMatrix([]); } } }; reader.readAsArrayBuffer(file);
    }, [language, t]);

    const { getRootProps: getEarnedMentionsRootProps, getInputProps: getEarnedMentionsInputProps, isDragActive: isEarnedMentionsDragActive } = useDropzone({ onDrop: onDropEarnedMentions, accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.xls'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }, multiple: false } as any);
    const { getRootProps: getOwnedMentionsRootProps, getInputProps: getOwnedMentionsInputProps, isDragActive: isOwnedMentionsDragActive } = useDropzone({ onDrop: onDropOwnedMentions, accept: { 'text/csv': ['.csv', '.tsv'], 'application/vnd.ms-excel': ['.xls'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/zip': ['.zip'], 'application/x-zip-compressed': ['.zip'] }, multiple: false } as any);
    const { getRootProps: getSlrrMentionsRootProps, getInputProps: getSlrrMentionsInputProps, isDragActive: isSlrrMentionsDragActive } = useDropzone({ onDrop: onDropSlrrMentions, accept: { 'text/csv': ['.csv', '.tsv'], 'application/vnd.ms-excel': ['.xls'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }, multiple: true } as any);
    const { getRootProps: getMethodologyRootProps, getInputProps: getMethodologyInputProps, isDragActive: isMethodologyDragActive } = useDropzone({ onDrop: onDropMethodology, accept: { 'application/pdf': ['.pdf'] }, multiple: false } as any);

    // --- MAIN ANALYSIS LOGIC ---
    const handleStartAnalysis = async () => { 
        if (!methodologyText || (rawEarnedMentions.length === 0 && rawOwnedMentions.length === 0 && rawSlrrMentions.length === 0) || processingTriggered.current) return;
        processingTriggered.current = true;
        setProgress(0);
        const filteredEarned = rawEarnedMentions.filter(m => { if (!selectedEarnedPlatforms.has(m.platform)) return false; const isTwitter = m.platform.toLowerCase() === 'twitter' || m.platform.toLowerCase() === 'x'; if (ignoreTwitterRepliesEarned && isTwitter && m.mention.trim().startsWith('@')) return false; return true; });
        const filteredOwned = rawOwnedMentions.filter(m => { if (!selectedOwnedPlatforms.has(m.platform)) return false; const isTwitter = m.platform.toLowerCase() === 'twitter' || m.platform.toLowerCase() === 'x'; if (ignoreTwitterRepliesOwned && isTwitter && m.mention.trim().startsWith('@')) return false; return true; });
        const filteredSlrr = rawSlrrMentions; // Always include all SLRR mentions
        
        const mentionsToAnalyze = [...filteredEarned, ...filteredOwned, ...filteredSlrr];
        if (mentionsToAnalyze.length === 0) { setError(t('error_noMentionsForFilters')); processingTriggered.current = false; return; }
        setAppStep(AppStep.Analyzing); setError('');
        
        try { 
            const batches: Mention[][] = []; 
            for (let i = 0; i < mentionsToAnalyze.length; i += MENTION_PROCESSING_LIMIT) { batches.push(mentionsToAnalyze.slice(i, i + MENTION_PROCESSING_LIMIT)); } 
            
            let finalResult: { 
                earnedForResponse: any[]; 
                ownedForResponse: any[]; 
                slrrForResponse: any[];
                mentionsForLike: LikeCandidate[]; 
                mentionsToHide: ModerationCandidate[];
                mentionsToDelete: ModerationCandidate[];
            } = { earnedForResponse: [], ownedForResponse: [], slrrForResponse: [], mentionsForLike: [], mentionsToHide: [], mentionsToDelete: [] }; 
            
            for (let i = 0; i < batches.length; i++) { 
                setLoadingMessage(t('loading_analyzingBatch', { current: i + 1, total: batches.length})); 
                setProgress(Math.round(((i + 1) / batches.length) * 100));
                const batchResult = await analyzeAndTagMentions(batches[i], methodologyText, language); 
                finalResult.earnedForResponse.push(...(batchResult.earnedForResponse || [])); 
                finalResult.ownedForResponse.push(...(batchResult.ownedForResponse || [])); 
                finalResult.slrrForResponse.push(...(batchResult.slrrForResponse || []));
                finalResult.mentionsForLike.push(...(batchResult.mentionsForLike || []));
                finalResult.mentionsToHide.push(...(batchResult.mentionsToHide || []));
                finalResult.mentionsToDelete.push(...(batchResult.mentionsToDelete || []));
            } 
            
            const mentionMap = new Map([...rawEarnedMentions, ...rawOwnedMentions, ...rawSlrrMentions].map(m => [m.id, m])); 
            
            const mapToShortlisted = (results: any[]): ShortlistedMention[] => { return results.map(result => { if (!result || !result.id) return null; const originalMention = mentionMap.get(result.id); if (!originalMention) return null; return { ...originalMention, tag: result.tag, opportunityScore: result.opportunityScore || 1, respectsGuidelines: result.respectsGuidelines }; }).filter((m): m is ShortlistedMention => m !== null); }; 
            const mapToModeration = (results: any[], action: 'Hide' | 'Delete'): ModerationCandidate[] => { return results.map(result => { if (!result || !result.id) return null; return { id: result.id, action, reason: result.reason }; }).filter((m): m is ModerationCandidate => m !== null); };

            const allResponseCandidates = [
                ...mapToShortlisted(finalResult.earnedForResponse),
                ...mapToShortlisted(finalResult.ownedForResponse),
                ...mapToShortlisted(finalResult.slrrForResponse)
            ];
            const shortlistedEarned = allResponseCandidates.filter(m => m.source === 'EARNED');
            const shortlistedOwned = allResponseCandidates.filter(m => m.source === 'OWNED');
            let shortlistedSlrr = allResponseCandidates.filter(m => m.source === 'SLRR');
            const hides = mapToModeration(finalResult.mentionsToHide, 'Hide');
            const deletes = mapToModeration(finalResult.mentionsToDelete, 'Delete');

            // Ensure NO SLRR mentions are lost (if AI ignored them, force them into SLRR response bucket)
            const processedSlrrIds = new Set([
                ...shortlistedSlrr.map(m => m.id),
                ...finalResult.mentionsForLike.filter(l => mentionMap.get(l.id)?.source === 'SLRR').map(l => l.id),
                ...finalResult.mentionsToHide.filter(h => mentionMap.get(h.id)?.source === 'SLRR').map(h => h.id),
                ...finalResult.mentionsToDelete.filter(d => mentionMap.get(d.id)?.source === 'SLRR').map(d => d.id)
            ]);

            const missingSlrr = rawSlrrMentions.filter(m => !processedSlrrIds.has(m.id));
            if (missingSlrr.length > 0) {
                const autoShortlistedSlrr = missingSlrr.map(m => ({
                    ...m,
                    tag: ['BrandCulture'] as ProductArea[],
                    opportunityScore: 1,
                    respectsGuidelines: true
                }));
                shortlistedSlrr = [...shortlistedSlrr, ...autoShortlistedSlrr];
            }

            setShortlistedEarnedMentions(shortlistedEarned); 
            setShortlistedOwnedMentions(shortlistedOwned); 
            setShortlistedSlrrMentions(shortlistedSlrr);
            setMentionsToHide(hides);
            setMentionsToDelete(deletes);

            const newLikeReasons = new Map<string, string>(); 
            const newLikeMentions: ShortlistedMention[] = finalResult.mentionsForLike.map(likeCandidate => { if (!likeCandidate || !likeCandidate.id) return null; const originalMention = mentionMap.get(likeCandidate.id); if (!originalMention) return null; newLikeReasons.set(likeCandidate.id, likeCandidate.reason); return { ...originalMention, tag: likeCandidate.tag || ['BrandCulture'], opportunityScore: 0, respectsGuidelines: true, }; }).filter((m): m is ShortlistedMention => m !== null); 
            setLikeOnlyMentions(newLikeMentions); 
            setLikeReasons(newLikeReasons); 

            // --- AUTO-SELECTION FOR SLRR ---
            const slrrIdsForResponse = new Set(shortlistedSlrr.map(m => m.id));
            const slrrIdsForLike = new Set(newLikeMentions.filter(m => m.source === 'SLRR').map(m => m.id));
            const slrrIdsForMod = new Set([
                ...hides.filter(h => mentionMap.get(h.id)?.source === 'SLRR').map(h => h.id),
                ...deletes.filter(d => mentionMap.get(d.id)?.source === 'SLRR').map(d => d.id)
            ]);

            setSelectedMentionIds(slrrIdsForResponse);
            setSelectedLikeMentionIds(slrrIdsForLike);
            setSelectedModerationIds(slrrIdsForMod);

            setAppStep(AppStep.Validating); 
        } catch (err: any) { setError(err instanceof Error ? err.message : String(err)); setAppStep(AppStep.Error); }
    };
    
    // ... Selection Logic ...
    const handleEarnedPlatformSelectionToggle = (platform: string) => { setSelectedEarnedPlatforms(prev => { const newSet = new Set(prev); if (newSet.has(platform)) { newSet.delete(platform); } else { newSet.add(platform); } return newSet; }); };
    const handleSelectAllEarnedPlatforms = () => { if (selectedEarnedPlatforms.size === availableEarnedPlatforms.length) { setSelectedEarnedPlatforms(new Set()); } else { setSelectedEarnedPlatforms(new Set(availableEarnedPlatforms)); } };
    const handleOwnedPlatformSelectionToggle = (platform: string) => { setSelectedOwnedPlatforms(prev => { const newSet = new Set(prev); if (newSet.has(platform)) { newSet.delete(platform); } else { newSet.add(platform); } return newSet; }); };
    const handleSelectAllOwnedPlatforms = () => { if (selectedOwnedPlatforms.size === availableOwnedPlatforms.length) { setSelectedOwnedPlatforms(new Set()); } else { setSelectedOwnedPlatforms(new Set(availableOwnedPlatforms)); } };
    const handleSlrrPlatformSelectionToggle = (platform: string) => { setSelectedSlrrPlatforms(prev => { const newSet = new Set(prev); if (newSet.has(platform)) { newSet.delete(platform); } else { newSet.add(platform); } return newSet; }); };
    const handleSelectAllSlrrPlatforms = () => { if (selectedSlrrPlatforms.size === availableSlrrPlatforms.length) { setSelectedSlrrPlatforms(new Set()); } else { setSelectedSlrrPlatforms(new Set(availableSlrrPlatforms)); } };
    
    // Modified to handle Response selections
    const handleSelectionToggle = (mentionId: string) => { setSelectedMentionIds(prev => { const newSet = new Set(prev); if (newSet.has(mentionId)) { newSet.delete(mentionId); } else { newSet.add(mentionId); } return newSet; }); };
    const handleLikeSelectionToggle = (mentionId: string) => { setSelectedLikeMentionIds(prev => { const newSet = new Set(prev); if (newSet.has(mentionId)) { newSet.delete(mentionId); } else { newSet.add(mentionId); } return newSet; }); };
    const handleModerationSelectionToggle = (mentionId: string) => { setSelectedModerationIds(prev => { const newSet = new Set(prev); if (newSet.has(mentionId)) { newSet.delete(mentionId); } else { newSet.add(mentionId); } return newSet; }); };

    // New Specific Select All Handlers
    const handleSelectAllReplyOwned = () => {
        const targets = shortlistedOwnedMentions.map(m => m.id);
        const allSelected = targets.every(id => selectedMentionIds.has(id));
        if (allSelected) { setSelectedMentionIds(prev => { const next = new Set(prev); targets.forEach(id => next.delete(id)); return next; }); }
        else { setSelectedMentionIds(prev => { const next = new Set(prev); targets.forEach(id => next.add(id)); return next; }); }
    };
    const handleSelectAllReplyEarned = () => {
        const targets = shortlistedEarnedMentions.map(m => m.id);
        const allSelected = targets.every(id => selectedMentionIds.has(id));
        if (allSelected) { setSelectedMentionIds(prev => { const next = new Set(prev); targets.forEach(id => next.delete(id)); return next; }); }
        else { setSelectedMentionIds(prev => { const next = new Set(prev); targets.forEach(id => next.add(id)); return next; }); }
    };
    const handleSelectAllReplySlrr = () => {
        const targets = shortlistedSlrrMentions.map(m => m.id);
        const allSelected = targets.every(id => selectedMentionIds.has(id));
        if (allSelected) { setSelectedMentionIds(prev => { const next = new Set(prev); targets.forEach(id => next.delete(id)); return next; }); }
        else { setSelectedMentionIds(prev => { const next = new Set(prev); targets.forEach(id => next.add(id)); return next; }); }
    };

    const handleSelectAllLikesOwned = () => {
        const targets = likeOnlyMentions.filter(m => m.source === 'OWNED').map(m => m.id);
        const allSelected = targets.every(id => selectedLikeMentionIds.has(id));
        if (allSelected) { setSelectedLikeMentionIds(prev => { const next = new Set(prev); targets.forEach(id => next.delete(id)); return next; }); }
        else { setSelectedLikeMentionIds(prev => { const next = new Set(prev); targets.forEach(id => next.add(id)); return next; }); }
    };
    const handleSelectAllLikesEarned = () => {
        const targets = likeOnlyMentions.filter(m => m.source === 'EARNED').map(m => m.id);
        const allSelected = targets.every(id => selectedLikeMentionIds.has(id));
        if (allSelected) { setSelectedLikeMentionIds(prev => { const next = new Set(prev); targets.forEach(id => next.delete(id)); return next; }); }
        else { setSelectedLikeMentionIds(prev => { const next = new Set(prev); targets.forEach(id => next.add(id)); return next; }); }
    };
    const handleSelectAllLikesSlrr = () => {
        const targets = likeOnlyMentions.filter(m => m.source === 'SLRR').map(m => m.id);
        const allSelected = targets.every(id => selectedLikeMentionIds.has(id));
        if (allSelected) { setSelectedLikeMentionIds(prev => { const next = new Set(prev); targets.forEach(id => next.delete(id)); return next; }); }
        else { setSelectedLikeMentionIds(prev => { const next = new Set(prev); targets.forEach(id => next.add(id)); return next; }); }
    };

    const handleSelectAllModOwned = () => {
        const allMentionsMap = new Map([...rawEarnedMentions, ...rawOwnedMentions].map(m => [m.id, m]));
        const targets = [...mentionsToHide, ...mentionsToDelete].filter(m => {
            const original = allMentionsMap.get(m.id);
            return original?.source === 'OWNED';
        }).map(m => m.id);
        const allSelected = targets.every(id => selectedModerationIds.has(id));
        if (allSelected) { setSelectedModerationIds(prev => { const next = new Set(prev); targets.forEach(id => next.delete(id)); return next; }); }
        else { setSelectedModerationIds(prev => { const next = new Set(prev); targets.forEach(id => next.add(id)); return next; }); }
    };
    const handleSelectAllModEarned = () => {
        const allMentionsMap = new Map([...rawEarnedMentions, ...rawOwnedMentions, ...rawSlrrMentions].map(m => [m.id, m]));
        const targets = [...mentionsToHide, ...mentionsToDelete].filter(m => {
            const original = allMentionsMap.get(m.id);
            return original?.source === 'EARNED';
        }).map(m => m.id);
        const allSelected = targets.every(id => selectedModerationIds.has(id));
        if (allSelected) { setSelectedModerationIds(prev => { const next = new Set(prev); targets.forEach(id => next.delete(id)); return next; }); }
        else { setSelectedModerationIds(prev => { const next = new Set(prev); targets.forEach(id => next.add(id)); return next; }); }
    };
    const handleSelectAllModSlrr = () => {
        const allMentionsMap = new Map([...rawEarnedMentions, ...rawOwnedMentions, ...rawSlrrMentions].map(m => [m.id, m]));
        const targets = [...mentionsToHide, ...mentionsToDelete].filter(m => {
            const original = allMentionsMap.get(m.id);
            return original?.source === 'SLRR';
        }).map(m => m.id);
        const allSelected = targets.every(id => selectedModerationIds.has(id));
        if (allSelected) { setSelectedModerationIds(prev => { const next = new Set(prev); targets.forEach(id => next.delete(id)); return next; }); }
        else { setSelectedModerationIds(prev => { const next = new Set(prev); targets.forEach(id => next.add(id)); return next; }); }
    };


    const handleGenerateResponses = async () => { 
        if (selectedMentionIds.size === 0 && selectedLikeMentionIds.size > 0) {
            setAppStep(AppStep.Results);
            return;
        }
        if (selectedMentionIds.size === 0) return; 
        setAppStep(AppStep.Generating); setError(''); setProgress(0);
        
        const responsesMap = new Map<string, GeneratedResponseSet>(); 
        const mentionsToProcess = allShortlistedMentions.filter(m => selectedMentionIds.has(m.id)); 
        const totalMentions = mentionsToProcess.length; 
        const batchSize = 3; // Reduced batch size for better quota management
        try { 
            for (let i = 0; i < totalMentions; i += batchSize) { 
                const batch = mentionsToProcess.slice(i, i + batchSize); 
                const start = i + 1; 
                const end = i + batch.length; 
                setLoadingMessage(t('loading_generating_progress', { start, end, total: totalMentions })); 
                setProgress(Math.round((end / totalMentions) * 100));
                
                const promises = batch.map(mention => generateResponsesForMention(mention, methodologyText, language)); 
                const results = await Promise.all(promises); 
                results.forEach((responses, index) => { const mention = batch[index]; if (mention) { responsesMap.set(mention.id, responses); } }); 
                
                // Small delay between batches to respect rate limits
                if (i + batchSize < totalMentions) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } 
            setGeneratedResponses(responsesMap); 
            setAppStep(AppStep.Results); 
        } catch(err) { setError(err instanceof Error ? err.message : String(err)); setAppStep(AppStep.Error); }
    };

    const getValidationRows = () => {
        const rows: any[] = [];
        const clean = (str: string) => str ? String(str).replace(/(\r\n|\n|\r|\t)/gm, " ").trim() : "";
        const today = new Date().toLocaleDateString('fr-FR');
        const allMentionsMap = new Map([...rawEarnedMentions, ...rawOwnedMentions, ...rawSlrrMentions].map(m => [m.id, m]));

        // 1. Selected Replies
        allShortlistedMentions.forEach(mention => {
            if (selectedMentionIds.has(mention.id)) {
                let tag = mention.tag[0] || '';
                const platform = mention.platform.toUpperCase();
                const source = mention.source === 'EARNED' ? 'Earned' : mention.source === 'OWNED' ? 'Owned' : 'SLRR';
                const hyperlinkFormula = `=HYPERLINK("${mention.url || ''}","${mention.author}")`;
                rows.push({
                    col1_date: today, col2_status: 'NEW', col3_pa: tag, col4_platform: platform, col5_source: source, col6_userTag: hyperlinkFormula, col7_post: clean(mention.mention), col8_interaction: 'Reply', col9_answer: '', col10_commentPmm: '', col11_pm: 'To Check'
                });
            }
        });

        // 2. Selected Likes
        likeOnlyMentions.forEach(mention => {
            if (selectedLikeMentionIds.has(mention.id)) {
                let tag = mention.tag[0] || '';
                const platform = mention.platform.toUpperCase();
                const source = mention.source === 'EARNED' ? 'Earned' : mention.source === 'OWNED' ? 'Owned' : 'SLRR';
                const hyperlinkFormula = `=HYPERLINK("${mention.url || ''}","${mention.author}")`;
                rows.push({
                    col1_date: today, col2_status: 'NEW', col3_pa: tag, col4_platform: platform, col5_source: source, col6_userTag: hyperlinkFormula, col7_post: clean(mention.mention), col8_interaction: 'Like', col9_answer: '', col10_commentPmm: '', col11_pm: 'To Check'
                });
            }
        });

        // 3. Selected Moderation
        const modItems = [...mentionsToHide, ...mentionsToDelete];
        modItems.forEach(mod => {
            if (selectedModerationIds.has(mod.id)) {
                const original = allMentionsMap.get(mod.id);
                if (original) {
                    const platform = original.platform.toUpperCase();
                    const source = original.source === 'EARNED' ? 'Earned' : original.source === 'OWNED' ? 'Owned' : 'SLRR';
                    const hyperlinkFormula = `=HYPERLINK("${original.url || ''}","${original.author}")`;
                    rows.push({
                        col1_date: today, col2_status: 'NEW', col3_pa: '', col4_platform: platform, col5_source: source, col6_userTag: hyperlinkFormula, col7_post: clean(original.mention), col8_interaction: mod.action, col9_answer: '', col10_commentPmm: mod.reason, col11_pm: 'To Check'
                    });
                }
            }
        });

        return rows;
    };

    const handleDownloadValidationCSV = () => {
        const rows = getValidationRows();
        if (rows.length === 0) return;
        const headers = ["Date", "Status", "Product Area", "Platform", "Source", "User", "Post", "Interaction", "Answer", "Comment PMM", "PM Status"];
        const csvContent = [
            headers.join(","),
            ...rows.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
        ].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `validation_export_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleCopyValidationTable = () => {
        const rows = getValidationRows();
        if (rows.length === 0) return;
        const rowsString = rows.map(row => Object.values(row).join('\t')).join('\n');
        navigator.clipboard.writeText(rowsString);
        setTableCopied(true);
        setTimeout(() => setTableCopied(false), 2000);
    };

    // ... Other handlers identical ...
    const handleRegenerateResponse = async (mentionId: string, matrix?: ToneMatrixItem[]) => { 
        const mention = allShortlistedMentions.find(m => m.id === mentionId); if (!mention) return; setRegeneratingMentionId(mentionId); setError(''); const hint = responseHints.get(mentionId); const toneMatrix = matrix || toneMatrices.get(mentionId); try { const newResponses = await generateResponsesForMention(mention, methodologyText, language, hint, toneMatrix); setGeneratedResponses(prev => new Map(prev).set(mentionId, newResponses)); } catch (err) { const message = err instanceof Error ? err.message : String(err); setError(t('error_regenerationFailed', { message })); } finally { setRegeneratingMentionId(null); setEditingToneMatrixFor(null); }
    };
    const handleResponseTextChange = (mentionId: string, responseIndex: number, newText: string) => { setGeneratedResponses((prev: Map<string, GeneratedResponseSet>) => { const newMap = new Map(prev); const currentResponses = newMap.get(mentionId); if (currentResponses && currentResponses[responseIndex]) { const newResponses = [...currentResponses]; newResponses[responseIndex] = { ...newResponses[responseIndex], responseText: newText }; newMap.set(mentionId, newResponses); } return newMap; }); };
    const handleHintChange = (mentionId: string, hint: string) => { setResponseHints(prev => new Map(prev).set(mentionId, hint)); };
    const handleCopyToClipboard = (text: string, id: string) => { navigator.clipboard.writeText(text); setCopiedStates(prev => ({ ...prev, [id]: true })); setTimeout(() => { setCopiedStates(prev => ({ ...prev, [id]: false })); }, 1500); };
    const handleCustomResponseChange = (mentionId: string, text: string) => { setCustomResponses(prev => new Map(prev).set(mentionId, text)); const selection = selectedFinalAnswers.get(mentionId); if (selection?.type === 'custom') { handleSelectFinalAnswer(mentionId, 'custom', 3, text); } };
    const handleMagnifyResponse = async (mentionId: string) => { 
        const mention = allShortlistedMentions.find(m => m.id === mentionId); const userResponse = customResponses.get(mentionId); if (!mention || !userResponse || !userResponse.trim()) return; setMagnifyingMentionId(mentionId); setError(''); try { const magnifiedText = await magnifyResponse(mention, methodologyText, userResponse, language); setCustomResponses(prev => new Map(prev).set(mentionId, magnifiedText)); const selection = selectedFinalAnswers.get(mentionId); if (selection && selection.type === 'custom') { handleSelectFinalAnswer(mentionId, 'custom', 3, magnifiedText); } } catch (err) { const message = err instanceof Error ? err.message : String(err); setError(t('error_magnifyFailed', { message })); } finally { setMagnifyingMentionId(null); }
    };
    const handleSharpenResponse = async (mentionId: string, responseIndex: number) => { 
        const responseKey = `${mentionId}-${responseIndex}`; const currentResponse = generatedResponses.get(mentionId)?.[responseIndex]; if (!currentResponse || !methodologyText) return; setSharpeningResponseId(responseKey); setError(''); try { const sharpenedText = await sharpenResponse(currentResponse.responseText, methodologyText, language); setGeneratedResponses((prev: Map<string, GeneratedResponseSet>) => { const newMap = new Map(prev); const currentResponses = newMap.get(mentionId); if (currentResponses && currentResponses[responseIndex]) { const newResponses = [...currentResponses]; newResponses[responseIndex] = { ...newResponses[responseIndex], responseText: sharpenedText }; newMap.set(mentionId, newResponses); } return newMap; }); const selection = selectedFinalAnswers.get(mentionId); if (selection && selection.type === 'generated' && selection.index === responseIndex) { handleSelectFinalAnswer(mentionId, 'generated', responseIndex, sharpenedText); } } catch (err) { const message = err instanceof Error ? err.message : String(err); setError(t('error_sharpenFailed', { message })); } finally { setSharpeningResponseId(null); }
    };
    const handleSelectFinalAnswer = (mentionId: string, type: 'generated' | 'custom', index: number, content: string) => { setSelectedFinalAnswers((prev: Map<string, { type: 'generated' | 'custom'; index: number; content: string }>) => { const newMap = new Map(prev); const currentSelection = newMap.get(mentionId); if (currentSelection && currentSelection.type === type && currentSelection.index === index) { newMap.delete(mentionId); } else { newMap.set(mentionId, { type, index, content }); } return newMap; }); };

    // ... Export Logic ...
    const exportData = useMemo(() => {
        if (appStep !== AppStep.Export) return [];
        const rows: any[] = [];
        const clean = (str: string) => str ? String(str).replace(/(\r\n|\n|\r|\t)/gm, " ").trim() : "";
        const today = new Date().toLocaleDateString('fr-FR'); 

        // 1. Replies
        allShortlistedMentions.forEach(mention => {
            const selection = selectedFinalAnswers.get(mention.id);
            if (selection) {
                let tag = mention.tag[0] || '';
                const platform = mention.platform.toUpperCase();
                const source = mention.source === 'EARNED' ? 'Earned' : mention.source === 'OWNED' ? 'Owned' : 'SLRR';
                const hyperlinkFormula = `=HYPERLINK("${mention.url || ''}","${mention.author}")`;
                rows.push({
                    col1_date: today, col2_status: 'NEW', col3_pa: tag, col4_platform: platform, col5_source: source, col6_userTag: hyperlinkFormula, col7_post: clean(mention.mention), col8_interaction: 'Reply', col9_answer: clean(selection.content), col10_commentPmm: '', col11_pm: 'To Check',
                    ui_author: mention.author, ui_url: mention.url
                });
            }
        });

        // 2. Likes
        likeOnlyMentions.forEach(mention => {
            if (selectedLikeMentionIds.has(mention.id)) {
                let tag = mention.tag[0] || '';
                const platform = mention.platform.toUpperCase();
                const source = mention.source === 'EARNED' ? 'Earned' : mention.source === 'OWNED' ? 'Owned' : 'SLRR';
                const hyperlinkFormula = `=HYPERLINK("${mention.url || ''}","${mention.author}")`;
                rows.push({
                    col1_date: today, col2_status: 'NEW', col3_pa: tag, col4_platform: platform, col5_source: source, col6_userTag: hyperlinkFormula, col7_post: clean(mention.mention), col8_interaction: 'Like', col9_answer: '', col10_commentPmm: '', col11_pm: 'To Check',
                    ui_author: mention.author, ui_url: mention.url
                });
            }
        });

        // 3. Moderation (Hide/Delete)
        // Find original data for moderation items
        const allMentionsMap = new Map([...rawEarnedMentions, ...rawOwnedMentions, ...rawSlrrMentions].map(m => [m.id, m]));
        const modItems = [...mentionsToHide, ...mentionsToDelete];
        modItems.forEach(mod => {
            if (selectedModerationIds.has(mod.id)) {
                 const original = allMentionsMap.get(mod.id);
                 if (original) {
                     // Tag isn't available for mod items in current schema, we can leave PA empty or infer. Leaving empty for now as per instructions "don't invent".
                     // However, AI doesn't tag them in the schema.
                     const platform = original.platform.toUpperCase();
                     const source = original.source === 'EARNED' ? 'Earned' : original.source === 'OWNED' ? 'Owned' : 'SLRR';
                     const hyperlinkFormula = `=HYPERLINK("${original.url || ''}","${original.author}")`;
                     rows.push({
                        col1_date: today, col2_status: 'NEW', col3_pa: '', col4_platform: platform, col5_source: source, col6_userTag: hyperlinkFormula, col7_post: clean(original.mention), col8_interaction: mod.action, col9_answer: '', col10_commentPmm: mod.reason, col11_pm: 'To Check',
                        ui_author: original.author, ui_url: original.url
                    });
                 }
            }
        });

        return rows;
    }, [appStep, allShortlistedMentions, selectedFinalAnswers, likeOnlyMentions, selectedLikeMentionIds, mentionsToHide, mentionsToDelete, selectedModerationIds, rawEarnedMentions, rawOwnedMentions]);

    const handleCopyTable = () => {
        const rowsString = exportData.map(row => [
            row.col1_date, row.col2_status, row.col3_pa, row.col4_platform, row.col5_source, row.col6_userTag, row.col7_post, row.col8_interaction, row.col9_answer, row.col10_commentPmm, row.col11_pm
        ].join('\t')).join('\n');
        navigator.clipboard.writeText(rowsString);
        setTableCopied(true);
        setTimeout(() => setTableCopied(false), 2000);
    };

    // ... Chat handlers ...
    const handleSendChatMessage = async (message: string) => { if (!message.trim() || !aiPersonality) return; setTemporaryMood('thinking', 3000); const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: message }] }; setChatHistory(prev => [...prev, newUserMessage]); setIsChatting(true); try { const chat = getPersonalityChat(aiPersonality, language); const response = await chat.sendMessage({ message }); setTemporaryMood('happy', 2000); const modelResponse: ChatMessage = { role: 'model', parts: [{ text: response.text }] }; setChatHistory(prev => [...prev, modelResponse]); } catch (err) { const message = err instanceof Error ? err.message.toLowerCase() : ''; const is503Error = message.includes('503') || message.includes('unavailable'); const errorMessageText = is503Error ? t('error_503') : t('error_chatFailed'); const errorMessage: ChatMessage = { role: 'model', parts: [{ text: errorMessageText }] }; setChatHistory(prev => [...prev, errorMessage]); setError(err instanceof Error ? err.message : String(err)); } finally { setIsChatting(false); } };
    const handleApplyChatChanges = async () => { if (!methodologyText || chatHistory.length === 0) return; setIsUpdatingPersonality(true); setError(''); try { const updatedPersonality = await updatePersonalityFromChat(chatHistory, methodologyText, language); setAiPersonality(updatedPersonality); setTemporaryMood('happy', 2000); resetPersonalityChat(); setChatHistory([]); } catch (err) { const message = err instanceof Error ? err.message : String(err); setError(t('error_updateFailed', { message })); } finally { setIsUpdatingPersonality(false); } };
    
    // ... Counts ...
    const mentionsToAnalyzeCount = useMemo(() => {
        const earnedToAnalyze = rawEarnedMentions.filter(m => { if (!selectedEarnedPlatforms.has(m.platform)) return false; const isTwitter = m.platform.toLowerCase() === 'twitter' || m.platform.toLowerCase() === 'x'; if (ignoreTwitterRepliesEarned && isTwitter && m.mention.trim().startsWith('@')) return false; return true; });
        const ownedToAnalyze = rawOwnedMentions.filter(m => { if (!selectedOwnedPlatforms.has(m.platform)) return false; const isTwitter = m.platform.toLowerCase() === 'twitter' || m.platform.toLowerCase() === 'x'; if (ignoreTwitterRepliesOwned && isTwitter && m.mention.trim().startsWith('@')) return false; return true; });
        const slrrToAnalyze = rawSlrrMentions; // Always include all SLRR mentions
        return earnedToAnalyze.length + ownedToAnalyze.length + slrrToAnalyze.length;
    }, [rawEarnedMentions, rawOwnedMentions, rawSlrrMentions, selectedEarnedPlatforms, selectedOwnedPlatforms, ignoreTwitterRepliesEarned, ignoreTwitterRepliesOwned]);

    useEffect(() => { let lifeCycleInterval: number | null = null; if (showPersonalityCard) { const GREETINGS = [ t('geoGreeting1'), t('geoGreeting2'), t('geoGreeting3'), t('geoGreeting4'), t('geoGreeting5'), t('geoGreeting6'), t('geoGreeting7') ]; const MOODS: GeoMood[] = ['idle', 'happy', 'thinking', 'winking']; lifeCycleInterval = window.setInterval(() => { const randomMood = MOODS[Math.floor(Math.random() * MOODS.length)]; const randomGreeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)]; setGeoMood(randomMood); setGeoGreeting(randomGreeting); }, 5000); setGeoGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]); setGeoMood('happy'); } else { if (moodTimeoutRef.current) clearTimeout(moodTimeoutRef.current); resetPersonalityChat(); setChatHistory([]); setGeoMood('idle'); setGeoGreeting(''); } return () => { if (lifeCycleInterval) clearInterval(lifeCycleInterval); }; }, [showPersonalityCard, t]);

    const renderContent = () => {
        switch(appStep) {
          case AppStep.Welcome:
            const isAnalysisReady = methodologyText && (rawEarnedMentions.length > 0 || rawOwnedMentions.length > 0 || rawSlrrMentions.length > 0);
            return (
              <div className="flex items-center min-h-[80vh] w-full max-w-[1600px] mx-auto px-8 py-24 animate-fade-in-up">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-32 w-full items-center">
                    <div className="space-y-8">
                        <h1 className="text-[7rem] lg:text-[9rem] leading-[0.85] font-serif-display font-medium text-white tracking-tighter">
                            <span className="text-[#4285F4]">G</span><span className="text-[#EA4335]">o</span><span className="text-[#FBBC05]">o</span><span className="text-[#4285F4]">g</span><span className="text-[#34A853]">l</span><span className="text-[#EA4335]">e</span><br/>Social<br/><span className="italic text-gray-500">Agent</span>
                        </h1>
                        <div className="h-1 w-24 bg-gradient-to-r from-[#4285F4] via-[#EA4335] to-[#34A853]"></div>
                        <p className="text-xl text-gray-400 font-light max-w-md leading-relaxed font-sans">{t('welcomeSubtitle')}</p>
                    </div>
                    <div className="space-y-4 w-full max-w-md ml-auto">
                         <FileUploadModule title={t('earnedMentionsTitle')} dropzoneProps={getEarnedMentionsRootProps()} inputProps={getEarnedMentionsInputProps()} isDragActive={isEarnedMentionsDragActive} fileName={earnedMentionsFileName} onRemove={() => { setRawEarnedMentions([]); setEarnedMentionsFileName(''); setAvailableEarnedPlatforms([]); setSelectedEarnedPlatforms(new Set()); }} formats={t('fileFormatsExcel')} t={t} required />
                         <FileUploadModule title={t('ownedMentionsTitle')} dropzoneProps={getOwnedMentionsRootProps()} inputProps={getOwnedMentionsInputProps()} isDragActive={isOwnedMentionsDragActive} fileName={ownedMentionsFileName} onRemove={() => { setRawOwnedMentions([]); setOwnedMentionsFileName(''); setOwnedZipFileName(''); setAvailableOwnedPlatforms([]); setSelectedOwnedPlatforms(new Set()); }} formats={t('fileFormatsZip')} t={t} />
                         <FileUploadModule 
                            title={t('slrrMentionsTitle')} 
                            dropzoneProps={getSlrrMentionsRootProps()} 
                            inputProps={getSlrrMentionsInputProps()} 
                            isDragActive={isSlrrMentionsDragActive} 
                            fileName={slrrFiles.length > 0 ? `${slrrFiles.length} files uploaded` : ''} 
                            onRemove={() => { setRawSlrrMentions([]); setSlrrFiles([]); setAvailableSlrrPlatforms([]); setSelectedSlrrPlatforms(new Set()); }} 
                            formats={t('fileFormatsExcel')} 
                            t={t} 
                        />
                         <FileUploadModule title={t('methodologyTitle')} dropzoneProps={getMethodologyRootProps()} inputProps={getMethodologyInputProps()} isDragActive={isMethodologyDragActive} fileName={methodologyFileName} onRemove={() => { setMethodologyText(''); setMethodologyFileName(''); setAiPersonality(null); setBaseToneMatrix([]); }} formats={t('fileFormatsPdf')} t={t} required />
                        <div className="pt-4"><PrimaryButton onClick={handleStartAnalysis} disabled={!isAnalysisReady} className="w-full h-20 text-sm">{isAnalysisReady ? t('startAnalysis', { count: mentionsToAnalyzeCount }) : "AWAITING DATA UPLOAD"}</PrimaryButton></div>
                    </div>
                </div>
              </div>
            );
    
          case AppStep.Analyzing:
            return <TerminalLoader message={loadingMessage} progress={progress} />;
          
          case AppStep.Generating:
            return <ThinkingLoader message={loadingMessage} progress={progress} />;
    
          case AppStep.Validating:
             const validationCounts = { 
                response: shortlistedEarnedMentions.length + shortlistedOwnedMentions.length + shortlistedSlrrMentions.length, 
                like: likeOnlyMentions.length, 
                mod: mentionsToHide.length + mentionsToDelete.length 
             };
             const canProceed = selectedMentionIds.size > 0 || selectedLikeMentionIds.size > 0;
             const proceedButtonText = selectedMentionIds.size > 0 ? t('generateResponses', { count: selectedMentionIds.size }) : "PROCEED TO NEXT STEP"; 
             
             // Prepare data slices for the 9 sections
             const ownedLikes = likeOnlyMentions.filter(m => m.source === 'OWNED');
             const earnedLikes = likeOnlyMentions.filter(m => m.source === 'EARNED');
             const slrrLikes = likeOnlyMentions.filter(m => m.source === 'SLRR');
             
             const allMentionsMap = new Map([...rawEarnedMentions, ...rawOwnedMentions, ...rawSlrrMentions].map(m => [m.id, m]));
             const allModeration = [...mentionsToHide, ...mentionsToDelete];
             const ownedModeration = allModeration.filter(m => {
                 const original = allMentionsMap.get(m.id);
                 return original?.source === 'OWNED';
             });
             const earnedModeration = allModeration.filter(m => {
                 const original = allMentionsMap.get(m.id);
                 return original?.source === 'EARNED';
             });
             const slrrModeration = allModeration.filter(m => {
                 const original = allMentionsMap.get(m.id);
                 return original?.source === 'SLRR';
             });

             const totalSelected = selectedMentionIds.size + selectedLikeMentionIds.size + selectedModerationIds.size;

            return (
              <div className="w-full max-w-[1600px] mx-auto mt-16">
                 <SectionHeader 
                    title={t('humanValidation')}
                    subtitle={t('validationSubtitle', { responseCount: validationCounts.response, likeCount: validationCounts.like, modCount: validationCounts.mod })}
                    rightElement={
                        <div className="flex items-center space-x-4">
                            <SecondaryButton 
                                onClick={handleDownloadValidationCSV} 
                                disabled={totalSelected === 0}
                                className="flex items-center space-x-2"
                            >
                                <UploadIcon className="w-4 h-4 rotate-180" />
                                <span>DOWNLOAD CSV</span>
                            </SecondaryButton>
                            <SecondaryButton 
                                onClick={handleCopyValidationTable} 
                                disabled={totalSelected === 0}
                                className="flex items-center space-x-2"
                            >
                                {tableCopied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon />}
                                <span>{tableCopied ? 'COPIED' : 'COPY TABLE'}</span>
                            </SecondaryButton>
                            <PrimaryButton onClick={handleGenerateResponses} disabled={!canProceed}>{proceedButtonText}</PrimaryButton>
                        </div>
                    }
                 />
                <div className="space-y-16 pb-24">
                    
                    {/* 1. REPLY - OWNED */}
                    {shortlistedOwnedMentions.length > 0 && (
                        <section className="animate-fade-in-up">
                            <div className="flex justify-between items-end mb-6">
                                <h3 className="text-sm font-bold text-white uppercase tracking-widest bg-white/10 px-3 py-1 inline-block">01 // {t('bento_ownedTitle')}</h3>
                                <button onClick={handleSelectAllReplyOwned} className="text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-widest border border-white/10 hover:border-white px-3 py-1 transition-all">
                                    {/* FIX: Corrected from 'id' to 'm.id' */}
                                    {shortlistedOwnedMentions.every(m => selectedMentionIds.has(m.id)) ? t('deselectAll') : t('selectAll')}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {shortlistedOwnedMentions.map(mention => (
                                    <div key={mention.id} onClick={() => handleSelectionToggle(mention.id)} className={`group relative p-6 border transition-all duration-200 cursor-pointer ${selectedMentionIds.has(mention.id) ? 'bg-[#1a1a1a] border-white shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'bg-[#0A0A0A] border-white/10 hover:border-white/40'}`}>
                                        <div className="flex justify-between mb-4">
                                            <div className="flex gap-2">
                                                {mention.tag.map(t => <span key={t} className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${PRODUCT_AREA_COLORS[t]}`}>{t}</span>)}
                                            </div>
                                            <span className="font-mono text-xs text-gray-500">{mention.opportunityScore}/5</span>
                                        </div>
                                        <p className="text-gray-300 text-sm leading-relaxed font-mono line-clamp-4 mb-4">{mention.mention}</p>
                                        <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wide flex justify-between pt-4 border-t border-white/5"><span>{mention.author} // {mention.platform}</span><span>{mention.date}</span></div>
                                         {selectedMentionIds.has(mention.id) && <div className="absolute top-0 right-0 p-2"><div className="w-2 h-2 bg-[#4285F4] rounded-full"></div></div>}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* 2. REPLY - EARNED */}
                    {shortlistedEarnedMentions.length > 0 && (
                        <section className="animate-fade-in-up">
                            <div className="flex justify-between items-end mb-6">
                                <h3 className="text-sm font-bold text-white uppercase tracking-widest bg-white/10 px-3 py-1 inline-block">02 // {t('bento_earnedTitle')}</h3>
                                <button onClick={handleSelectAllReplyEarned} className="text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-widest border border-white/10 hover:border-white px-3 py-1 transition-all">
                                    {/* FIX: Corrected from 'id' to 'm.id' */}
                                    {shortlistedEarnedMentions.every(m => selectedMentionIds.has(m.id)) ? t('deselectAll') : t('selectAll')}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {shortlistedEarnedMentions.map(mention => (
                                    <div key={mention.id} onClick={() => handleSelectionToggle(mention.id)} className={`group relative p-6 border transition-all duration-200 cursor-pointer ${selectedMentionIds.has(mention.id) ? 'bg-[#1a1a1a] border-white shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'bg-[#0A0A0A] border-white/10 hover:border-white/40'}`}>
                                        <div className="flex justify-between mb-4">
                                            <div className="flex gap-2">
                                                {mention.tag.map(t => <span key={t} className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${PRODUCT_AREA_COLORS[t]}`}>{t}</span>)}
                                            </div>
                                            <span className="font-mono text-xs text-gray-500">{mention.opportunityScore}/5</span>
                                        </div>
                                        <p className="text-gray-300 text-sm leading-relaxed font-mono line-clamp-4 mb-4">{mention.mention}</p>
                                        <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wide flex justify-between pt-4 border-t border-white/5"><span>{mention.author} // {mention.platform}</span><span>{mention.date}</span></div>
                                        {selectedMentionIds.has(mention.id) && <div className="absolute top-0 right-0 p-2"><div className="w-2 h-2 bg-[#4285F4] rounded-full"></div></div>}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* 2.5 REPLY - SLRR */}
                    {shortlistedSlrrMentions.length > 0 && (
                        <section className="animate-fade-in-up">
                            <div className="flex justify-between items-end mb-6">
                                <h3 className="text-sm font-bold text-white uppercase tracking-widest bg-white/10 px-3 py-1 inline-block">02.5 // {t('slrrMentionsTitle')}</h3>
                                <button onClick={handleSelectAllReplySlrr} className="text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-widest border border-white/10 hover:border-white px-3 py-1 transition-all">
                                    {shortlistedSlrrMentions.every(m => selectedMentionIds.has(m.id)) ? t('deselectAll') : t('selectAll')}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {shortlistedSlrrMentions.map(mention => (
                                    <div key={mention.id} onClick={() => handleSelectionToggle(mention.id)} className={`group relative p-6 border transition-all duration-200 cursor-pointer ${selectedMentionIds.has(mention.id) ? 'bg-[#1a1a1a] border-white shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'bg-[#0A0A0A] border-white/10 hover:border-white/40'}`}>
                                        <div className="flex justify-between mb-4">
                                            <div className="flex gap-2">
                                                {mention.tag.map(t => <span key={t} className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${PRODUCT_AREA_COLORS[t]}`}>{t}</span>)}
                                            </div>
                                            <span className="font-mono text-xs text-gray-500">{mention.opportunityScore}/5</span>
                                        </div>
                                        <p className="text-gray-300 text-sm leading-relaxed font-mono line-clamp-4 mb-4">{mention.mention}</p>
                                        <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wide flex justify-between pt-4 border-t border-white/5"><span>{mention.author} // {mention.platform}</span><span>{mention.date}</span></div>
                                        {selectedMentionIds.has(mention.id) && <div className="absolute top-0 right-0 p-2"><div className="w-2 h-2 bg-[#4285F4] rounded-full"></div></div>}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* 3. LIKES - OWNED */}
                    {ownedLikes.length > 0 && (
                         <section className="animate-fade-in-up">
                            <div className="flex justify-between items-end mb-6">
                                <h3 className="text-sm font-bold text-white uppercase tracking-widest bg-white/10 px-3 py-1 inline-block">03 // MENTIONS TO LIKE (OWNED)</h3>
                                <button onClick={handleSelectAllLikesOwned} className="text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-widest border border-white/10 hover:border-white px-3 py-1 transition-all">
                                    {/* FIX: Corrected from 'id' to 'm.id' */}
                                    {ownedLikes.every(m => selectedLikeMentionIds.has(m.id)) ? t('deselectAll') : t('selectAll')}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {ownedLikes.map(mention => {
                                    const reason = likeReasons.get(mention.id) || "Reasoning unavailable.";
                                    return (
                                        <div key={mention.id} onClick={() => handleLikeSelectionToggle(mention.id)} className={`group relative p-6 border transition-all duration-200 cursor-pointer ${selectedLikeMentionIds.has(mention.id) ? 'bg-[#1a1a1a] border-white shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'bg-[#0A0A0A] border-white/10 hover:border-white/40'}`}>
                                            <div className="flex justify-between mb-4">
                                                <div className="flex gap-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#34A853] border border-[#34A853]/20 bg-[#34A853]/10 px-1.5 py-0.5">LIKE</span>
                                                    {mention.tag.map(t => <span key={t} className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${PRODUCT_AREA_COLORS[t]}`}>{t}</span>)}
                                                </div>
                                            </div>
                                            <p className="text-gray-300 text-sm leading-relaxed font-mono line-clamp-3 mb-2">{mention.mention}</p>
                                            <div className="my-3 p-3 bg-white/5 border-l-2 border-[#4285F4]">
                                                <p className="text-[10px] text-gray-400 font-mono leading-tight">{t('likeReason')} {reason}</p>
                                            </div>
                                            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wide flex justify-between pt-2 border-t border-white/5"><span>{mention.author} // {mention.platform}</span></div>
                                            {selectedLikeMentionIds.has(mention.id) && <div className="absolute top-0 right-0 p-2"><div className="w-2 h-2 bg-[#34A853] rounded-full"></div></div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* 4. LIKES - EARNED */}
                    {earnedLikes.length > 0 && (
                         <section className="animate-fade-in-up">
                            <div className="flex justify-between items-end mb-6">
                                <h3 className="text-sm font-bold text-white uppercase tracking-widest bg-white/10 px-3 py-1 inline-block">04 // MENTIONS TO LIKE (EARNED)</h3>
                                <button onClick={handleSelectAllLikesEarned} className="text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-widest border border-white/10 hover:border-white px-3 py-1 transition-all">
                                    {/* FIX: Corrected from 'id' to 'm.id' */}
                                    {earnedLikes.every(m => selectedLikeMentionIds.has(m.id)) ? t('deselectAll') : t('selectAll')}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {earnedLikes.map(mention => {
                                    const reason = likeReasons.get(mention.id) || "Reasoning unavailable.";
                                    return (
                                        <div key={mention.id} onClick={() => handleLikeSelectionToggle(mention.id)} className={`group relative p-6 border transition-all duration-200 cursor-pointer ${selectedLikeMentionIds.has(mention.id) ? 'bg-[#1a1a1a] border-white shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'bg-[#0A0A0A] border-white/10 hover:border-white/40'}`}>
                                            <div className="flex justify-between mb-4">
                                                <div className="flex gap-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#34A853] border border-[#34A853]/20 bg-[#34A853]/10 px-1.5 py-0.5">LIKE</span>
                                                    {mention.tag.map(t => <span key={t} className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${PRODUCT_AREA_COLORS[t]}`}>{t}</span>)}
                                                </div>
                                            </div>
                                            <p className="text-gray-300 text-sm leading-relaxed font-mono line-clamp-3 mb-2">{mention.mention}</p>
                                            <div className="my-3 p-3 bg-white/5 border-l-2 border-[#4285F4]">
                                                <p className="text-[10px] text-gray-400 font-mono leading-tight">{t('likeReason')} {reason}</p>
                                            </div>
                                            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wide flex justify-between pt-2 border-t border-white/5"><span>{mention.author} // {mention.platform}</span></div>
                                            {selectedLikeMentionIds.has(mention.id) && <div className="absolute top-0 right-0 p-2"><div className="w-2 h-2 bg-[#34A853] rounded-full"></div></div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* 4.5 LIKES - SLRR */}
                    {slrrLikes.length > 0 && (
                         <section className="animate-fade-in-up">
                            <div className="flex justify-between items-end mb-6">
                                <h3 className="text-sm font-bold text-white uppercase tracking-widest bg-white/10 px-3 py-1 inline-block">04.5 // MENTIONS TO LIKE (SLRR)</h3>
                                <button onClick={handleSelectAllLikesSlrr} className="text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-widest border border-white/10 hover:border-white px-3 py-1 transition-all">
                                    {slrrLikes.every(m => selectedLikeMentionIds.has(m.id)) ? t('deselectAll') : t('selectAll')}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {slrrLikes.map(mention => {
                                    const reason = likeReasons.get(mention.id) || "Reasoning unavailable.";
                                    return (
                                        <div key={mention.id} onClick={() => handleLikeSelectionToggle(mention.id)} className={`group relative p-6 border transition-all duration-200 cursor-pointer ${selectedLikeMentionIds.has(mention.id) ? 'bg-[#1a1a1a] border-white shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'bg-[#0A0A0A] border-white/10 hover:border-white/40'}`}>
                                            <div className="flex justify-between mb-4">
                                                <div className="flex gap-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#34A853] border border-[#34A853]/20 bg-[#34A853]/10 px-1.5 py-0.5">LIKE</span>
                                                    {mention.tag.map(t => <span key={t} className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${PRODUCT_AREA_COLORS[t]}`}>{t}</span>)}
                                                </div>
                                            </div>
                                            <p className="text-gray-300 text-sm leading-relaxed font-mono line-clamp-3 mb-2">{mention.mention}</p>
                                            <div className="my-3 p-3 bg-white/5 border-l-2 border-[#4285F4]">
                                                <p className="text-[10px] text-gray-400 font-mono leading-tight">{t('likeReason')} {reason}</p>
                                            </div>
                                            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wide flex justify-between pt-2 border-t border-white/5"><span>{mention.author} // {mention.platform}</span></div>
                                            {selectedLikeMentionIds.has(mention.id) && <div className="absolute top-0 right-0 p-2"><div className="w-2 h-2 bg-[#34A853] rounded-full"></div></div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* 5. MODERATION - OWNED */}
                    {ownedModeration.length > 0 && (
                        <section className="animate-fade-in-up">
                            <div className="flex justify-between items-end mb-6">
                                <h3 className="text-sm font-bold text-[#EA4335] uppercase tracking-widest bg-[#EA4335]/10 px-3 py-1 inline-block border border-[#EA4335]/20">05 // MENTIONS TO HIDE / DELETE (OWNED)</h3>
                                <button onClick={handleSelectAllModOwned} className="text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-widest border border-white/10 hover:border-white px-3 py-1 transition-all">
                                    {/* FIX: Corrected from 'id' to 'm.id' */}
                                    {ownedModeration.every(m => selectedModerationIds.has(m.id)) ? t('deselectAll') : t('selectAll')}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {ownedModeration.map(mod => {
                                    const original = allMentionsMap.get(mod.id);
                                    if (!original) return null;
                                    const isHide = mod.action === 'Hide';
                                    return (
                                        <div key={mod.id} onClick={() => handleModerationSelectionToggle(mod.id)} className={`group relative p-6 border transition-all duration-200 cursor-pointer ${selectedModerationIds.has(mod.id) ? 'bg-[#1a1a1a] border-[#EA4335] shadow-[0_0_15px_rgba(234,67,53,0.1)]' : 'bg-[#0A0A0A] border-white/10 hover:border-[#EA4335]/50'}`}>
                                            <div className="flex justify-between mb-4">
                                                <div className="flex gap-2">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider border px-1.5 py-0.5 flex items-center ${isHide ? 'text-gray-400 border-gray-600 bg-gray-800' : 'text-[#EA4335] border-[#EA4335]/20 bg-[#EA4335]/10'}`}>
                                                        {isHide ? <EyeIcon className="w-3 h-3 mr-1"/> : <TrashIcon className="w-3 h-3 mr-1"/>} {mod.action.toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-gray-400 text-sm leading-relaxed font-mono line-clamp-3 mb-2 italic">"{original.mention}"</p>
                                            <div className="my-3 p-3 bg-[#EA4335]/5 border-l-2 border-[#EA4335]">
                                                <p className="text-[10px] text-gray-400 font-mono leading-tight">{t('modReason')} {mod.reason}</p>
                                            </div>
                                             {selectedModerationIds.has(mod.id) && <div className="absolute top-0 right-0 p-2"><div className="w-2 h-2 bg-[#EA4335] rounded-full"></div></div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* 6. MODERATION - EARNED */}
                    {earnedModeration.length > 0 && (
                        <section className="animate-fade-in-up">
                            <div className="flex justify-between items-end mb-6">
                                <h3 className="text-sm font-bold text-[#EA4335] uppercase tracking-widest bg-[#EA4335]/10 px-3 py-1 inline-block border border-[#EA4335]/20">06 // MENTIONS TO HIDE / DELETE (EARNED)</h3>
                                <button onClick={handleSelectAllModEarned} className="text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-widest border border-white/10 hover:border-white px-3 py-1 transition-all">
                                    {/* FIX: Corrected from 'id' to 'm.id' */}
                                    {earnedModeration.every(m => selectedModerationIds.has(m.id)) ? t('deselectAll') : t('selectAll')}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {earnedModeration.map(mod => {
                                    const original = allMentionsMap.get(mod.id);
                                    if (!original) return null;
                                    const isHide = mod.action === 'Hide';
                                    return (
                                        <div key={mod.id} onClick={() => handleModerationSelectionToggle(mod.id)} className={`group relative p-6 border transition-all duration-200 cursor-pointer ${selectedModerationIds.has(mod.id) ? 'bg-[#1a1a1a] border-[#EA4335] shadow-[0_0_15px_rgba(234,67,53,0.1)]' : 'bg-[#0A0A0A] border-white/10 hover:border-[#EA4335]/50'}`}>
                                            <div className="flex justify-between mb-4">
                                                <div className="flex gap-2">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider border px-1.5 py-0.5 flex items-center ${isHide ? 'text-gray-400 border-gray-600 bg-gray-800' : 'text-[#EA4335] border-[#EA4335]/20 bg-[#EA4335]/10'}`}>
                                                        {isHide ? <EyeIcon className="w-3 h-3 mr-1"/> : <TrashIcon className="w-3 h-3 mr-1"/>} {mod.action.toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-gray-400 text-sm leading-relaxed font-mono line-clamp-3 mb-2 italic">"{original.mention}"</p>
                                            <div className="my-3 p-3 bg-[#EA4335]/5 border-l-2 border-[#EA4335]">
                                                <p className="text-[10px] text-gray-400 font-mono leading-tight">{t('modReason')} {mod.reason}</p>
                                            </div>
                                             {selectedModerationIds.has(mod.id) && <div className="absolute top-0 right-0 p-2"><div className="w-2 h-2 bg-[#EA4335] rounded-full"></div></div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* 6.5 MODERATION - SLRR */}
                    {slrrModeration.length > 0 && (
                        <section className="animate-fade-in-up">
                            <div className="flex justify-between items-end mb-6">
                                <h3 className="text-sm font-bold text-[#EA4335] uppercase tracking-widest bg-[#EA4335]/10 px-3 py-1 inline-block border border-[#EA4335]/20">06.5 // MENTIONS TO HIDE / DELETE (SLRR)</h3>
                                <button onClick={handleSelectAllModSlrr} className="text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-widest border border-white/10 hover:border-white px-3 py-1 transition-all">
                                    {slrrModeration.every(m => selectedModerationIds.has(m.id)) ? t('deselectAll') : t('selectAll')}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {slrrModeration.map(mod => {
                                    const original = allMentionsMap.get(mod.id);
                                    if (!original) return null;
                                    const isHide = mod.action === 'Hide';
                                    return (
                                        <div key={mod.id} onClick={() => handleModerationSelectionToggle(mod.id)} className={`group relative p-6 border transition-all duration-200 cursor-pointer ${selectedModerationIds.has(mod.id) ? 'bg-[#1a1a1a] border-[#EA4335] shadow-[0_0_15px_rgba(234,67,53,0.1)]' : 'bg-[#0A0A0A] border-white/10 hover:border-[#EA4335]/50'}`}>
                                            <div className="flex justify-between mb-4">
                                                <div className="flex gap-2">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider border px-1.5 py-0.5 flex items-center ${isHide ? 'text-gray-400 border-gray-600 bg-gray-800' : 'text-[#EA4335] border-[#EA4335]/20 bg-[#EA4335]/10'}`}>
                                                        {isHide ? <EyeIcon className="w-3 h-3 mr-1"/> : <TrashIcon className="w-3 h-3 mr-1"/>} {mod.action.toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-gray-400 text-sm leading-relaxed font-mono line-clamp-3 mb-2 italic">"{original.mention}"</p>
                                            <div className="my-3 p-3 bg-[#EA4335]/5 border-l-2 border-[#EA4335]">
                                                <p className="text-[10px] text-gray-400 font-mono leading-tight">{t('modReason')} {mod.reason}</p>
                                            </div>
                                             {selectedModerationIds.has(mod.id) && <div className="absolute top-0 right-0 p-2"><div className="w-2 h-2 bg-[#EA4335] rounded-full"></div></div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                </div>
              </div>
            );
            
          case AppStep.Results:
             const mentionsWithResponses = allShortlistedMentions.filter(m => selectedMentionIds.has(m.id) && generatedResponses.has(m.id));
             const mentionsToExport = mentionsWithResponses.filter(m => selectedFinalAnswers.has(m.id));
             const likesToExport = likeOnlyMentions.filter(m => selectedLikeMentionIds.has(m.id));
             const moderationToExport = [...mentionsToHide, ...mentionsToDelete].filter(m => selectedModerationIds.has(m.id));

            return (
              <div className="w-full max-w-[1600px] mx-auto mt-16">
                 <SectionHeader 
                    title={t('generatedResponsesTitle')}
                    subtitle={t('resultsPrompt')}
                    rightElement={
                        <PrimaryButton onClick={() => setAppStep(AppStep.Export)} disabled={mentionsToExport.length === 0 && likesToExport.length === 0 && moderationToExport.length === 0}>
                             {t('exportSelections', { count: mentionsToExport.length + likesToExport.length + moderationToExport.length })}
                        </PrimaryButton>
                    }
                 />
                {/* Grid Layout for Mentions */}
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-8 pb-24">
                    {mentionsWithResponses.map(mention => {
                        const responses = generatedResponses.get(mention.id) || [];
                        const customResponse = customResponses.get(mention.id) || '';
                        const hint = responseHints.get(mention.id) || '';
                        const isRegenerating = regeneratingMentionId === mention.id;
                        const currentFinalSelection = selectedFinalAnswers.get(mention.id);

                        return (
                            <div key={mention.id} className="border border-white/10 bg-[#0A0A0A] flex flex-col relative group hover:border-white/30 transition-all duration-500">
                                <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                                     <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center space-x-2">
                                            {mention.tag.map(t => <span key={t} className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${PRODUCT_AREA_COLORS[t]}`}>{t}</span>)}
                                            <span className="text-[10px] font-mono text-gray-500 uppercase">// {mention.author} @ {mention.platform}</span>
                                        </div>
                                        <span className="text-[10px] font-mono text-gray-600 uppercase">{mention.date}</span>
                                     </div>
                                     <p className="text-white/90 text-sm leading-relaxed font-mono">"{mention.mention}"</p>
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow">
                                    {responses.map((resp, index) => {
                                         const isSelected = currentFinalSelection?.type === 'generated' && currentFinalSelection?.index === index;
                                        return (
                                            <div key={index} className={`flex flex-col p-4 border transition-all h-full ${isSelected ? 'bg-[#151515] border-[#4285F4] ring-1 ring-[#4285F4]' : 'bg-black border-white/10 hover:border-white/30'}`}>
                                                <div className="flex justify-between items-center mb-3">
                                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${isSelected ? 'text-white bg-[#4285F4] border-[#4285F4]' : 'text-gray-400 border-white/20'}`}>{resp.tone}</span>
                                                    <div className="flex gap-2 opacity-50 hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handleSharpenResponse(mention.id, index)} className="text-gray-400 hover:text-white"><ScissorsIcon className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => handleCopyToClipboard(resp.responseText, `${mention.id}-${index}`)} className="text-gray-400 hover:text-white"><CopyIcon /></button>
                                                    </div>
                                                </div>
                                                <textarea value={resp.responseText} onChange={(e) => handleResponseTextChange(mention.id, index, e.target.value)} className="w-full bg-transparent text-xs text-gray-300 font-mono focus:outline-none resize-none flex-grow mb-4 leading-relaxed custom-scrollbar" rows={5} />
                                                 <button onClick={() => handleSelectFinalAnswer(mention.id, 'generated', index, resp.responseText)} className={`w-full py-2 text-[9px] font-bold uppercase tracking-widest border transition-all ${isSelected ? 'bg-[#4285F4] text-white border-[#4285F4]' : 'bg-transparent text-gray-600 border-white/10 hover:border-white hover:text-white'}`}>{isSelected ? 'SELECTED' : 'SELECT'}</button>
                                            </div>
                                        );
                                    })}
                                     <div className={`flex flex-col p-4 border transition-all h-full ${currentFinalSelection?.type === 'custom' ? 'bg-[#151515] border-[#4285F4] ring-1 ring-[#4285F4]' : 'bg-black border-white/10 hover:border-white/30'}`}>
                                         <div className="flex justify-between items-center mb-3">
                                            <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${currentFinalSelection?.type === 'custom' ? 'text-white bg-[#4285F4] border-[#4285F4]' : 'text-gray-400 border-white/20'}`}>CUSTOM</span>
                                             <button onClick={() => handleMagnifyResponse(mention.id)} className="flex items-center text-[9px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#4285F4] via-[#EA4335] to-[#FBBC05] hover:opacity-80 uppercase tracking-widest"><SparklesIcon className="w-3 h-3 mr-1 text-[#EA4335]"/> AI</button>
                                         </div>
                                         <textarea value={customResponse} onChange={(e) => handleCustomResponseChange(mention.id, e.target.value)} placeholder="Write custom response..." className="w-full bg-transparent text-xs text-gray-300 font-mono focus:outline-none resize-none flex-grow mb-4 leading-relaxed custom-scrollbar" rows={5} />
                                        <button onClick={() => handleSelectFinalAnswer(mention.id, 'custom', 3, customResponse)} className={`w-full py-2 text-[9px] font-bold uppercase tracking-widest border transition-all ${currentFinalSelection?.type === 'custom' ? 'bg-[#4285F4] text-white border-[#4285F4]' : 'bg-transparent text-gray-600 border-white/10 hover:border-white hover:text-white'}`}>{currentFinalSelection?.type === 'custom' ? 'SELECTED' : 'SELECT'}</button>
                                     </div>
                                </div>
                                <div className="p-4 border-t border-white/10 bg-black/40 mt-auto flex items-center gap-3">
                                    <div className="relative flex-grow"><input type="text" value={hint} onChange={(e) => handleHintChange(mention.id, e.target.value)} placeholder="Directives for next generation..." className="w-full bg-transparent text-xs text-gray-400 font-mono placeholder-gray-700 focus:outline-none" /></div>
                                    <div className="h-4 w-px bg-white/10"></div>
                                    <button onClick={() => setEditingToneMatrixFor(mention.id)} className="text-gray-500 hover:text-white transition-colors"><SlidersIcon className="w-4 h-4"/></button>
                                    <button onClick={() => handleRegenerateResponse(mention.id)} disabled={isRegenerating} className="text-[10px] font-bold uppercase tracking-widest text-[#4285F4] hover:text-white disabled:opacity-50">{isRegenerating ? <RefreshCwIcon className="w-4 h-4 animate-spin"/> : "REGEN"}</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
              </div>
            );
            
          case AppStep.Export:
            return (
                <div className="w-full max-w-[1400px] mx-auto animate-fade-in-up mt-16 mb-24">
                    <div className="bg-[#0A0A0A] p-8 border border-white/10 mb-8 flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tighter uppercase">EXPORT DATA</h2>
                            <p className="text-gray-400 font-mono text-xs mt-1">Ready for transfer to Google Sheets.</p>
                        </div>
                        <div className="flex gap-4">
                            <SecondaryButton onClick={() => setAppStep(AppStep.Results)}>{t('backToResults')}</SecondaryButton>
                             <PrimaryButton onClick={handleCopyTable}>{tableCopied ? "COPIED TO CLIPBOARD!" : "COPY TABLE"}</PrimaryButton>
                        </div>
                    </div>
                    <div className="overflow-x-auto border border-white/10 bg-black custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#111] border-b border-white/10">
                                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">{t('col_date')}</th>
                                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">{t('col_status')}</th>
                                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">{t('col_pa')}</th>
                                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">{t('col_platform')}</th>
                                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">{t('col_source')}</th>
                                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">{t('col_userTag')}</th>
                                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono w-1/4">{t('col_userPost')}</th>
                                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">{t('col_googleInteraction')}</th>
                                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono w-1/4">{t('col_proposedAnswer')}</th>
                                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">{t('col_commentPMM')}</th>
                                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">{t('col_pm')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {exportData.map((row, index) => (
                                    <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="p-4 text-xs font-mono text-gray-400 whitespace-nowrap">{row.col1_date}</td>
                                        <td className="p-4 text-xs font-mono text-gray-500">{row.col2_status}</td>
                                        <td className="p-4 text-xs font-mono text-gray-300">{row.col3_pa}</td>
                                        <td className="p-4 text-xs font-mono text-gray-400">{row.col4_platform}</td>
                                        <td className="p-4 text-xs font-mono text-gray-400">{row.col5_source}</td>
                                        <td className="p-4 text-xs font-bold text-white">
                                            <a href={row.ui_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{row.ui_author}</a>
                                        </td>
                                        <td className="p-4 text-xs font-mono text-gray-400 line-clamp-2 max-w-xs" title={row.col7_post}>{row.col7_post.length > 100 ? row.col7_post.substring(0, 100) + '...' : row.col7_post}</td>
                                        <td className="p-4">
                                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${row.col8_interaction === 'Like' ? 'bg-[#34A853]/20 text-[#34A853]' : row.col8_interaction === 'Hide' || row.col8_interaction === 'Delete' ? 'bg-[#EA4335]/20 text-[#EA4335]' : 'bg-[#4285F4]/20 text-[#4285F4]'}`}>
                                                {row.col8_interaction}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs font-mono text-white line-clamp-2 max-w-xs" title={row.col9_answer}>{row.col9_answer}</td>
                                        <td className="p-4 text-xs font-mono text-gray-500">{row.col10_commentPMM}</td>
                                        <td className="p-4 text-xs font-mono text-gray-300">{row.col11_pm}</td>
                                    </tr>
                                ))}
                                {exportData.length === 0 && (
                                    <tr>
                                        <td colSpan={11} className="p-12 text-center text-gray-600 font-mono uppercase text-sm">No data selected for export.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
          
          default:
            return null;
        }
    };

    return (
        <div className="min-h-screen text-gray-200 flex flex-col relative pb-12 overflow-x-hidden">
            <StepIndicator currentStep={appStep} />
            <FunnelSidebar 
                appStep={appStep}
                uploadedCounts={{ earned: rawEarnedMentions.length, owned: rawOwnedMentions.length, slrr: rawSlrrMentions.length }}
                shortlistedCounts={{ 
                    earnedForReply: shortlistedEarnedMentions.length, 
                    ownedForReply: shortlistedOwnedMentions.length, 
                    slrrForReply: shortlistedSlrrMentions.length,
                    forLikes: likeOnlyMentions.length, 
                    earnedForLike: likeOnlyMentions.filter(m => m.source === 'EARNED').length, 
                    ownedForLike: likeOnlyMentions.filter(m => m.source === 'OWNED').length, 
                    slrrForLike: likeOnlyMentions.filter(m => m.source === 'SLRR').length,
                    forModeration: mentionsToHide.length + mentionsToDelete.length 
                }}
                generationCount={selectedMentionIds.size}
                selectedMentionIds={selectedMentionIds}
                exportCounts={{ replies: selectedFinalAnswers.size, likes: selectedLikeMentionIds.size, moderation: selectedModerationIds.size }}
                allShortlistedMentions={allShortlistedMentions}
                selectedFinalAnswers={selectedFinalAnswers}
                mentionDateRange={mentionDateRange}
                startDate={startDate}
                rawEarnedMentions={rawEarnedMentions}
                rawOwnedMentions={rawOwnedMentions}
                rawSlrrMentions={rawSlrrMentions}
            />
            <main className="flex-grow flex items-center justify-center p-4 md:p-8 z-10 relative">
                {error ? <div className="border border-red-500/50 p-8 bg-red-900/10 text-red-500 font-mono text-sm max-w-lg text-center uppercase tracking-widest">{error} <br/><button onClick={handleReset} className="mt-4 underline text-white">RESET SYSTEM</button></div> : renderContent()}
            </main>
        </div>
    );
};

export default App;
