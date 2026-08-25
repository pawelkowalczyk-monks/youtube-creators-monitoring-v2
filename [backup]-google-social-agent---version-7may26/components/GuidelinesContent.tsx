import React from 'react';
import { useLocalization } from '../services/localization';

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h2 className="text-2xl font-bold text-gray-100 mb-4 mt-6 border-b border-gray-800 pb-2 first:mt-0">{children}</h2>
);
const SubTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-xl font-semibold text-gray-200 mb-3 mt-5">{children}</h3>
);
const SubSubTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h4 className="text-lg font-medium text-gray-300 mb-2 mt-4">{children}</h4>
);
const List: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ul className="list-disc list-inside space-y-2 mb-4 pl-4 text-gray-400">{children}</ul>
);
const ListItem: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <li className="leading-relaxed">{children}</li>
);
const Paragraph: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="text-gray-400 mb-4 leading-relaxed">{children}</p>
);

const GuidelinesContent: React.FC = () => {
    const { t } = useLocalization();

    return (
        <div className="text-gray-300">
            <SectionTitle>{t('section1_title')}</SectionTitle>
            <SubTitle>Defining Community Management (CM)</SubTitle>
            <Paragraph>
                Community management is the process of interacting with users on social media to turn brand fans into brand advocates. CM engages on brand-owned content (reactive) and on third-party content (proactive) in order to:
            </Paragraph>
            <List>
                <ListItem>Build brand connection beyond posts by engaging with our audience directly.</ListItem>
                <ListItem>Learn from our users in real time, as they share feedback.</ListItem>
                <ListItem>Transform people from liking to loving the brand by making them feel heard, seen, and valued.</ListItem>
            </List>
            <Paragraph>
                If in Marketing we: Know the user. Know the magic. Connect the two.
                <br />
                Then in CM we: <strong>Find the content. Find the Googley way in. Create the community.</strong>
            </Paragraph>

            <SectionTitle>{t('section2_title')}</SectionTitle>
            <SubTitle>Our Vision and Foundations</SubTitle>
            <Paragraph>We are Google our vision is to be the <strong>most helpful company on the planet.</strong></Paragraph>
            <Paragraph>We are a multi-trillion dollar company that helps billions of people every day. The stakes are different.</Paragraph>
            <List>
                <ListItem>We are a company of humans, but we should not LARP (Live Action Role Play) as a creator or influencer.</ListItem>
                <ListItem>Generally, we are <strong>helpful, optimistic, and unconventional</strong> (sparingly).</ListItem>
                <ListItem>We are humble, but it doesnt mean we cant also be confident. We can have some swagger.</ListItem>
                <ListItem>Meet people where they are, but avoid overtly pandering to them it dilutes who we are.</ListItem>
            </List>
            <SubTitle>Content Pillars</SubTitle>
            <Paragraph>We engage with content & craft responses to drive three content pillars:</Paragraph>
            <SubSubTitle>Real Product Magic</SubSubTitle>
            <Paragraph>Celebrating uses of Googles ecosystem of products and features that make peoples daily lives better, and providing our expertise where helpful.</Paragraph>
            <SubSubTitle>Real Culture</SubSubTitle>
            <Paragraph>Adding value to culture, conversation, and trending content in ways only Google can.</Paragraph>
            <SubSubTitle>Real Impact</SubSubTitle>
            <Paragraph>Building on Googles dedication to innovation and Al leadership all while humanizing Google by interacting with content and communities that align with our core values and commitments to better society.</Paragraph>

            <SectionTitle>{t('section3_title')}</SectionTitle>
            <SubTitle>Golden Ground Rules</SubTitle>
            <List>
                <ListItem><strong>Steer clear of being too cute.</strong> Avoid being overly punny, and bring out more confidence.</ListItem>
                <ListItem><strong>Dont feign familiarity.</strong> Google should never seem like its full on stanning, or act like someone we're not.</ListItem>
                <ListItem><strong>Generic is the enemy.</strong> If it feels like any company can say this, we havent done enough. Always ask why Google is choosing to engage and how we make it unmistakably Google.</ListItem>
            </List>
            <SubTitle>The Google-Grade Sweetspot (Tone Attributes)</SubTitle>
            <List>
                <ListItem>Help, delivered with charm (the two are not mutually exclusive).</ListItem>
                <ListItem>A dash of humanity.</ListItem>
                <ListItem>Confidence.</ListItem>
                <ListItem>Specificity (to the creator or content).</ListItem>
            </List>
            <SubSubTitle>We aim to be:</SubSubTitle>
            <List>
                <ListItem>Witty not snarky</ListItem>
                <ListItem>Candid not tactless</ListItem>
                <ListItem>Provocative not controversial</ListItem>
                <ListItem>Expressive not pretentious</ListItem>
            </List>
            <SubTitle>General Copy Guidelines</SubTitle>
            <SubSubTitle>Voice and Perspective:</SubSubTitle>
            <List>
                <ListItem>Google speaks in the communal first person (we/our/us) to the second person (you/yours).</ListItem>
                <ListItem><strong>CRITICAL: Never use the first person singular (I/me/my)</strong> unless operating a specific alias (e.g., Discord moderators). As a corporation we dont have a single map or a single Google Docs.</ListItem>
                <ListItem>Focus on the person. Use 'you' or 'people', never 'users' or 'customers'.</ListItem>
                <ListItem><strong>Do not use Google as a verb.</strong> Alternatives: 'Searched', 'Looked this up'.</ListItem>
            </List>
             <SubSubTitle>Clarity and Style:</SubSubTitle>
            <List>
                <ListItem>Speak like a human. Be friendly and witty, but always humble.</ListItem>
                <ListItem>Copy should be inclusive. Write with screen-readers in mind (avoid ASCII/alt-characters).</ListItem>
                <ListItem>Avoid jargon and corporate/tech-speak.</ListItem>
                <ListItem>Copy should be short, ideally 60 characters or less.</ListItem>
                <ListItem>Copy should never be superlative or boastful.</ListItem>
            </List>

            <SectionTitle>{t('section6_title')}</SectionTitle>
            <SubTitle>Content & Creator Vetting (Brand Safety Check)</SubTitle>
            <Paragraph>All content and creators must pass a brand safety check before engagement:</Paragraph>
            <List>
                <ListItem><strong>Profile Review:</strong> Confirm profile is appropriate, appears 18+, and is not a media publication or journalist.</ListItem>
                <ListItem><strong>Content Review:</strong> Recent content (last 3 months) must be PG-13 and reviewed for risk categories (Hate Speech, Violence, Weapons, Medical Content, Misinformation, etc.).</ListItem>
                <ListItem><strong>Behavior Review:</strong> Account must not be used for trolling/fighting, or hyper-partisan content.</ListItem>
                <ListItem><strong>Partnership Check:</strong> No active partnership with competitors.</ListItem>
                <ListItem><strong>Child Safety:</strong> Exercise extra caution if content features a child. Default to no engagement if unsure.</ListItem>
            </List>
            <SubTitle>Response Guidelines Checklist</SubTitle>
            <List>
                <ListItem><strong>Channel Fit:</strong> Is @Google the best channel to respond?</ListItem>
                <ListItem><strong>Editorial Alignment:</strong> Does the opportunity align with our content pillars?</ListItem>
                <ListItem><strong>Brand Relevance:</strong> Is there an opportunity for Google to provide real help?</ListItem>
                <ListItem><strong>Meaningful Value:</strong> Is Googles response natural, relevant & additive?</ListItem>
                <ListItem><strong>Google-Grade:</strong> Does the response align with platform tonality & copy guidelines? (See Sections 3 & 4).</ListItem>
            </List>
            <SubTitle>ABSOLUTE DO NOTS (Do Not Engage With):</SubTitle>
             <List>
                <ListItem>Implies brand solves health issues or spreads misinformation.</ListItem>
                <ListItem>Touches on sensitive subjects: policy issues (misinfo, privacy), politics, religion, finances, or revenue.</ListItem>
                <ListItem>Features alcohol, drugs, or discussion of drinking.</ListItem>
                <ListItem>References or involves nudity or sexual content.</ListItem>
                <ListItem>Directly references competitors (Apple, Amazon, Microsoft, OpenAl, etc).</ListItem>
                <ListItem>Expresses negativity towards Google or shows a product fault.</ListItem>
                <ListItem>The creator is under 18 years of age.</ListItem>
                <ListItem>Post implies that Google is 'free' (The @google handle is global; avoid the word free).</ListItem>
            </List>

            <SectionTitle>{t('section9_title')}</SectionTitle>
            <SubTitle>AI Persona</SubTitle>
            <Paragraph>You are an expert social media copywriter for @Google social media channels. Your primary role is to craft concise, helpful, and on-brand responses, always reflecting Google's official voice and guidelines.</Paragraph>
            <SubTitle>Key Responsibilities for AI</SubTitle>
            <SubSubTitle>Adhere to Google's Brand Voice:</SubSubTitle>
            <List>
                <ListItem>Optimistic, Clear, Human, Helpful, Respectful & Inclusive, Unconventional (playful, clever), Culturally-Relevant (specific to the niche or topic).</ListItem>
            </List>
            <SubSubTitle>Follow Copy Guidelines:</SubSubTitle>
            <List>
                <ListItem>Conciseness, Clarity, Accuracy, Platform Appropriateness.</ListItem>
                <ListItem>Emojis: Use sparingly and only when they genuinely add warmth, never to replace words.</ListItem>
                <ListItem>Hashtags: Avoid unless specifically requested.</ListItem>
            </List>
            <SubTitle>Constraints & Limitations for AI</SubTitle>
             <List>
                <ListItem>No Personal Opinions or debate.</ListItem>
                <ListItem>No Speculation on future products or decisions.</ListItem>
                <ListItem>No Off-Brand Language (avoid excessive slang).</ListItem>
                <ListItem>Character Limits: Aim for brevity.</ListItem>
            </List>
        </div>
    );
};

export default GuidelinesContent;