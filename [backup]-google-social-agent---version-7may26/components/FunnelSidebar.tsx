
import React, { useState, useMemo } from 'react';
import { AppStep, ShortlistedMention, ProductArea, Mention } from '../types';
import { useLocalization } from '../services/localization';

const FunnelIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M3 2h18v4l-7 8v6l-4 2v-8L3 6V2z"></path>
    </svg>
);

const CopyIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

interface FunnelData {
  appStep: AppStep;
  uploadedCounts: {
    earned: number;
    owned: number;
    slrr: number;
  };
  shortlistedCounts: {
    earnedForReply: number;
    ownedForReply: number;
    slrrForReply: number;
    forLikes: number;
    earnedForLike: number;
    ownedForLike: number;
    slrrForLike: number;
    forModeration: number;
  };
  generationCount: number;
  selectedMentionIds: Set<string>;
  exportCounts: {
    replies: number;
    likes: number;
    moderation: number;
  };
  allShortlistedMentions: ShortlistedMention[];
  selectedFinalAnswers: Map<string, { type: 'generated' | 'custom'; index: number; content: string }>;
  mentionDateRange: string;
  startDate: Date | null;
  rawEarnedMentions: Mention[];
  rawOwnedMentions: Mention[];
  rawSlrrMentions: Mention[];
}

const FunnelSidebar: React.FC<FunnelData> = ({
  appStep,
  uploadedCounts,
  shortlistedCounts,
  generationCount,
  selectedMentionIds,
  exportCounts,
  allShortlistedMentions,
  selectedFinalAnswers,
  mentionDateRange,
  startDate,
  rawEarnedMentions,
  rawOwnedMentions,
  rawSlrrMentions,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const { t } = useLocalization();

    const { shortlistedPaCounts, generatedPaCounts } = useMemo(() => {
        // Tracking the specific PAs required for the spreadsheet
        const paMap: { [key in ProductArea]?: string } = {
            [ProductArea.Gemini]: 'Gemini',
            [ProductArea.BrandCulture]: 'Brand',
            [ProductArea.Search]: 'Search',
            [ProductArea.Pixel]: 'Pixel',
            [ProductArea.Android]: 'Android',
        };
        
        const displayPAs = ['Gemini', 'Brand', 'Search', 'Pixel', 'Android'];
        const shortlistedCounts: Record<string, number> = Object.fromEntries(displayPAs.map(pa => [pa, 0]));
        const generatedCounts: Record<string, number> = Object.fromEntries(displayPAs.map(pa => [pa, 0]));
        
        const mentionsToGenerate = allShortlistedMentions.filter(m => selectedFinalAnswers.has(m.id));

        const countTags = (mentions: ShortlistedMention[], counts: Record<string, number>) => {
            mentions.forEach(mention => {
                mention.tag.forEach(tag => {
                    const displayTag = paMap[tag as ProductArea];
                    if (displayTag && counts.hasOwnProperty(displayTag)) {
                        counts[displayTag]++;
                    }
                });
            });
        };

        countTags(allShortlistedMentions, shortlistedCounts);
        countTags(mentionsToGenerate, generatedCounts);
        
        return { shortlistedPaCounts: shortlistedCounts, generatedPaCounts: generatedCounts };
    }, [allShortlistedMentions, selectedFinalAnswers]);

    const totalUploaded = uploadedCounts.earned + uploadedCounts.owned + uploadedCounts.slrr;
    const totalShortlistedForReply = shortlistedCounts.earnedForReply + shortlistedCounts.ownedForReply + shortlistedCounts.slrrForReply;
    const totalShortlisted = totalShortlistedForReply + shortlistedCounts.forLikes + shortlistedCounts.forModeration;
    const shouldShowShortlisted = appStep >= AppStep.Validating;
    const shouldShowExport = appStep >= AppStep.Results;

    const StatItem: React.FC<{ label: string; value: number | string; isSub?: boolean }> = ({ label, value, isSub }) => (
        <div className={`flex justify-between items-center ${isSub ? 'pl-4 py-1' : 'py-2'}`}>
            <span className={`uppercase font-mono ${isSub ? 'text-[10px] text-gray-500' : 'text-xs font-bold text-gray-400 tracking-wider'}`}>{label}</span>
            <span className={`font-mono ${isSub ? 'text-gray-400 text-xs' : 'text-white text-sm font-bold'}`}>{value}</span>
        </div>
    );

    const handleCopy = () => {
        /**
         * TARGET SPREADSHEET ORDER:
         * 0. Date
         * 1. Total Count Uploaded
         * 2. Earned Count Uploaded
         * 3. Owned Count Uploaded
         * 4. SLRR Count Uploaded
         * 5. Gemini Shortlisted
         * 6. Brand Shortlisted (mapped from BrandCulture)
         * 7. Search Shortlisted
         * 8. Pixel Shortlisted
         * 9. Android Shortlisted
         * 10. Gemini Generated Response
         * 11. Brand Generated Response (mapped from BrandCulture)
         * 12. Search Generated Response
         * 13. Pixel Generated Response
         * 14. Android Generated Response
         * 15. Gemini with "Go"
         * 16. Brand with "Go"
         * 17. Search with "Go"
         * 18. Pixel with "Go"
         * 19. Android with "Go"
         */
        const today = new Date();
        const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(today);
        
        let earnedUploaded = 0, ownedUploaded = 0, slrrUploaded = 0;
        let sGemini = 0, sBrand = 0, sSearch = 0, sPixel = 0, sAndroid = 0;
        let gGemini = 0, gBrand = 0, gSearch = 0, gPixel = 0, gAndroid = 0;
        let fGemini = 0, fBrand = 0, fSearch = 0, fPixel = 0, fAndroid = 0;
        
        const allUploadedMentions = [...rawEarnedMentions, ...rawOwnedMentions, ...rawSlrrMentions];
        allUploadedMentions.forEach(m => { 
            if (m.source === 'EARNED') earnedUploaded++; 
            else if (m.source === 'OWNED') ownedUploaded++; 
            else if (m.source === 'SLRR') slrrUploaded++;
        });
        
        allShortlistedMentions.forEach(m => { 
            m.tag.forEach(tag => { 
                if (tag === ProductArea.Gemini) sGemini++; 
                if (tag === ProductArea.BrandCulture) sBrand++; 
                if (tag === ProductArea.Search) sSearch++; 
                if (tag === ProductArea.Pixel) sPixel++; 
                if (tag === ProductArea.Android) sAndroid++; 
            }); 
        });

        const generatedMentions = allShortlistedMentions.filter(m => selectedMentionIds.has(m.id));
        generatedMentions.forEach(m => { 
            m.tag.forEach(tag => { 
                if (tag === ProductArea.Gemini) gGemini++; 
                if (tag === ProductArea.BrandCulture) gBrand++; 
                if (tag === ProductArea.Search) gSearch++; 
                if (tag === ProductArea.Pixel) gPixel++; 
                if (tag === ProductArea.Android) gAndroid++; 
            }); 
        });

        const finalMentions = allShortlistedMentions.filter(m => selectedFinalAnswers.has(m.id));
        finalMentions.forEach(m => { 
            m.tag.forEach(tag => { 
                if (tag === ProductArea.Gemini) fGemini++; 
                if (tag === ProductArea.BrandCulture) fBrand++; 
                if (tag === ProductArea.Search) fSearch++; 
                if (tag === ProductArea.Pixel) fPixel++; 
                if (tag === ProductArea.Android) fAndroid++; 
            }); 
        });

        const dataRow = [
            formattedDate, 
            totalUploaded, 
            earnedUploaded, 
            ownedUploaded, 
            slrrUploaded,
            sGemini, sBrand, sSearch, sPixel, sAndroid,
            gGemini, gBrand, gSearch, gPixel, gAndroid,
            fGemini, fBrand, fSearch, fPixel, fAndroid
        ].join('\t');
        
        navigator.clipboard.writeText(dataRow).then(() => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); });
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed top-24 right-0 z-40 flex items-center justify-center p-3 bg-black text-white border-l border-t border-b border-white/20 hover:bg-white hover:text-black transition-all duration-300"
                title={t('funnelSidebarTitle')}
            >
                <FunnelIcon className="h-5 w-5" />
            </button>
            
            <div className={`fixed top-0 right-0 h-full bg-[#050505] shadow-[0_0_50px_rgba(0,0,0,0.8)] z-50 transition-transform duration-300 ease-in-out border-l border-white/10 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: '320px' }}>
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h2 className="text-sm font-bold text-white tracking-tighter uppercase font-mono">_PROCESS_DATA</h2>
                    <div className="flex items-center space-x-2">
                        {shouldShowShortlisted && (
                            <button onClick={handleCopy} className="p-2 text-gray-400 hover:text-white border border-transparent hover:border-white/20 rounded transition-all">
                                {copySuccess ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
                            </button>
                        )}
                        <button onClick={() => setIsOpen(false)} className="p-2 text-gray-400 hover:text-white">&times;</button>
                    </div>
                </div>
                
                <div className="flex-grow p-6 overflow-y-auto space-y-8 custom-scrollbar">
                    {/* Stage 0: Dates */}
                    {appStep >= AppStep.Validating && mentionDateRange !== "N/A" && (
                        <div className="border border-white/10 p-4">
                             <div className="text-[10px] text-gray-500 uppercase font-mono mb-2">Analysis Period</div>
                             <div className="font-mono text-white text-xs">{mentionDateRange}</div>
                        </div>
                    )}

                    {/* Stage 1: Uploaded */}
                    <div>
                        <div className="flex items-center justify-between mb-2 border-b border-white/10 pb-2">
                            <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded-sm">01. INGEST</span>
                        </div>
                        <StatItem label={t('funnel_total')} value={totalUploaded} />
                        <StatItem label={t('funnel_earned')} value={uploadedCounts.earned} isSub />
                        <StatItem label={t('funnel_owned')} value={uploadedCounts.owned} isSub />
                        <StatItem label={t('funnel_slrr')} value={uploadedCounts.slrr} isSub />
                    </div>

                    {/* Stage 2: Shortlisted */}
                    {shouldShowShortlisted && (
                         <div className="animate-fade-in-up">
                            <div className="flex items-center justify-between mb-2 border-b border-white/10 pb-2">
                                <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded-sm">02. FILTER</span>
                            </div>
                            <StatItem label={t('funnel_total')} value={totalShortlisted} />
                            <StatItem label={t('funnel_forReplying')} value={totalShortlistedForReply} isSub />
                            <StatItem label={t('funnel_forLiking')} value={shortlistedCounts.forLikes} isSub />
                            <StatItem label={t('funnel_forModeration')} value={shortlistedCounts.forModeration} isSub />
                        </div>
                    )}

                    {/* Stage 3: Selected for Generation */}
                    {shouldShowExport && (
                         <div className="animate-fade-in-up">
                            <div className="flex items-center justify-between mb-2 border-b border-white/10 pb-2">
                                <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded-sm">03. GENERATE</span>
                            </div>
                            <StatItem label="Candidates" value={generationCount} />
                        </div>
                    )}
                    
                    {/* Stage 4: Final Export */}
                    {shouldShowExport && (
                         <div className="animate-fade-in-up">
                             <div className="flex items-center justify-between mb-2 border-b border-white/10 pb-2">
                                <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded-sm">04. EXPORT</span>
                            </div>
                            <StatItem label={t('funnel_total')} value={exportCounts.replies + exportCounts.likes + exportCounts.moderation} />
                            <StatItem label="Replies" value={exportCounts.replies} isSub />
                            <StatItem label="Likes" value={exportCounts.likes} isSub />
                            <StatItem label="Mod." value={exportCounts.moderation} isSub />
                        </div>
                    )}

                    {/* Stage 5: PA Breakdown */}
                    {shouldShowShortlisted && (
                        <div className="animate-fade-in-up pt-4 border-t border-white/10">
                            <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-widest font-mono">Breakdown (Shortlisted/Gen)</div>
                            <div className="space-y-1">
                                {Object.keys(shortlistedPaCounts).map(pa => {
                                    const shortlistedCount = shortlistedPaCounts[pa] || 0;
                                    const generatedCount = generatedPaCounts[pa] || 0;
                                    if (shortlistedCount === 0 && generatedCount === 0) return null;
                                    return <StatItem key={pa} label={pa} value={`${shortlistedCount}/${generatedCount}`} isSub />;
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default FunnelSidebar;
