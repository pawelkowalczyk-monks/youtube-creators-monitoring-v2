"""
Template filler utility for newsletter generation.
Fills the HTML template with structured data.
"""
import os
from datetime import datetime
from typing import Dict, List


class TemplateFiller:
    """Fills HTML email templates with structured data."""
    
    def __init__(self, template_path: str = None, community_template_path: str = None):
        """
        Initialize the template filler.
        
        Args:
            template_path: Path to the HTML template file. If None, uses default.
            community_template_path: Path to the G.E.O. template file.
        """
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        if template_path is None:
            # Default to the newsletter template in the templates directory
            template_path = os.path.join(
                os.path.dirname(current_dir), 
                'templates', 
                'newsletter.html'
            )
            
        if community_template_path is None:
            community_template_path = os.path.join(
                os.path.dirname(current_dir), 
                'templates', 
                'community_management.html'
            )
        
        self.template_path = template_path
        self.template_content = self._load_template(self.template_path)
        
        self.community_template_path = community_template_path
        try:
            with open(self.community_template_path, 'r', encoding='utf-8') as f:
                self.community_template_content = f.read()
        except FileNotFoundError:
            self.community_template_content = ""
    
    def _load_template(self, path: str) -> str:
        """Load the HTML template from file."""
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            raise FileNotFoundError(f"Template file not found: {path}")
    
    def fill_template(self, data: Dict) -> str:
        """
        Fill the template with provided data.
        
        Args:
            data: Dictionary containing:
                - date: Date string (optional, defaults to today)
                - tldr: TL;DR summary text
                - highlights: List of dicts with 'text' and 'link'
                - engagement_opportunities: List of dicts with 'text' and 'link'
                - videos: List of dicts with video analysis data (optional)
        
        Returns:
            Complete HTML string with all placeholders filled
        """
        html = self.template_content
        
        # Fill date
        date_str = data.get('date', datetime.now().strftime("%B %d, %Y"))
        html = html.replace('{{DATE}}', date_str)
        
        # Fill TL;DR
        tldr = data.get('tldr', '')
        html = html.replace('{{TLDR}}', tldr)
        
        # Fill highlights
        highlights_html = self._build_highlights(data.get('highlights', []))
        html = html.replace('{{HIGHLIGHTS}}', highlights_html)
        
        # Fill engagement opportunities
        opportunities_html = self._build_engagement_opportunities(data.get('engagement_opportunities', []))
        html = html.replace('{{ENGAGEMENT_OPPORTUNITIES}}', opportunities_html)
        
        # Fill video analysis section
        videos = data.get('videos', [])
        if videos:
            video_section_html = self._build_video_section(videos)
            html = html.replace('{{VIDEO_ANALYSIS_SECTION}}', video_section_html)
        else:
            # Show "no videos found" message if no videos
            video_section_html = self._build_no_videos_section()
            html = html.replace('{{VIDEO_ANALYSIS_SECTION}}', video_section_html)
        
        return html
    
    def _build_highlights(self, highlights: List[Dict]) -> str:
        """
        Build the highlights HTML section.
        
        Args:
            highlights: List of dicts with 'text' and 'link' keys
        
        Returns:
            HTML string for highlights
        """
        if not highlights:
            return ""
        
        rows = []
        for highlight in highlights:
            text = highlight.get('text', '')
            link = highlight.get('link', '#')
            
            row = f'''<tr>
                <td valign="top" width="20" style="padding-bottom: 16px;">
                    <span style="font-size: 18px; line-height: 18px; color: #1A73E8;">&bull;</span>
                </td>
                <td valign="top" style="padding-bottom: 16px; font-family: Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #202124; line-height: 1.5;">
                    {text} <a href="{link}" style="color: #1A73E8; text-decoration: none;">see post</a>
                </td>
            </tr>'''
            rows.append(row)
        
        return '\n'.join(rows)

    def _build_engagement_opportunities(self, opportunities: List[Dict]) -> str:
        """
        Build the engagement opportunities HTML section.
        
        Args:
            opportunities: List of dicts with 'text' and 'link' keys
        
        Returns:
            HTML string for engagement opportunities
        """
        if not opportunities:
            return ""
        
        rows = []
        for opp in opportunities:
            text = opp.get('text', '')
            link = opp.get('link', '#')
            
            row = f'''<tr>
                <td valign="top" width="20" style="padding-bottom: 16px;">
                    <span style="font-size: 18px; line-height: 18px; color: #EA4335;">&bull;</span>
                </td>
                <td valign="top" style="padding-bottom: 16px; font-family: Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #202124; line-height: 1.5;">
                    {text} <a href="{link}" style="color: #EA4335; text-decoration: none;">see post</a>
                </td>
            </tr>'''
            rows.append(row)
        
        return '\n'.join(rows)
    
    def _build_video_section(self, videos: List[Dict]) -> str:
        """
        Build the video analysis section HTML.
        
        Args:
            videos: List of dicts with video data:
                - creator_name: Creator's name
                - video_link: YouTube URL
                - summary: Video summary text
                - opportunities: List of opportunity strings
                - gemini_suggestions: List of Gemini suggestion strings
        
        Returns:
            HTML string for video analysis section
        """
        if not videos:
            return ""
        
        # Build the section header (only once)
        section_html = '''<tr>
                    <td align="left" style="background-color: #FFFFFF; padding: 30px 40px 10px 40px;">
                        <p style="margin: 0 0 10px 0; font-family: Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #1A73E8; text-transform: uppercase; letter-spacing: 1px;">CREATOR VIDEO ANALYSIS</p>
                    </td>
                </tr>'''
        
        # Build individual video cards
        video_cards = []
        
        for video in videos:
            creator_name = video.get('creator_name', 'Unknown Creator')
            video_link = video.get('video_link', '#')
            summary = video.get('summary', '')
            opportunities = video.get('opportunities', [])
            gemini_suggestions = video.get('gemini_suggestions', [])
            
            # Build opportunities list
            opportunities_html = self._build_list_items(opportunities)
            
            # Build Gemini suggestions list
            gemini_html = self._build_list_items(gemini_suggestions)
            
            # Build the card (without the section header)
            card = f'''<tr>
                    <td align="left" style="background-color: #FFFFFF; padding: 10px 40px 30px 40px;">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FFFFFF; border: 1px solid #DADCE0; border-radius: 12px; margin-top: 10px;">
                            <tr>
                                <td style="padding: 24px;">
                                    <p style="margin: 0; font-family: 'Google Sans', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 700; color: #202124;">{creator_name}</p>
                                    <a href="{video_link}" style="display:block; margin: 4px 0 16px 0; font-family: Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #1A73E8; text-decoration: none;">Watch Video</a>
                                    
                                    <p style="margin: 0 0 4px 0; font-family: Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; color: #5F6368; text-transform: uppercase;">SUMMARY</p>
                                    <p style="margin: 0; font-family: Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #202124; line-height: 1.5;">{summary}</p>
                                    
                                    <p style="margin: 16px 0 8px 0; font-family: Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; color: #5F6368; text-transform: uppercase;">KEY HIGHLIGHTS</p>
                                    <ul style="margin: 0; padding-left: 20px; font-family: Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #202124; line-height: 1.5;">
                                        {opportunities_html}
                                    </ul>

                                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #E8F0FE; border-radius: 8px; margin-top: 16px;">
                                        <tr>
                                            <td valign="top" style="padding: 12px;">
                                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                                    <tr>
                                                        <td valign="top" width="20" style="font-size: 16px; color: #174EA6; line-height: 1;">&#10022;</td>
                                                        <td valign="top">
                                                            <p style="margin: 0 0 8px 0; font-family: 'Google Sans', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 700; color: #174EA6;">Actionable Opportunities</p>
                                                            <ul style="margin: 0; padding-left: 16px; font-family: Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #174EA6; line-height: 1.5;">
                                                                {gemini_html}
                                                            </ul>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>'''
            
            video_cards.append(card)
        
        # Combine section header with all video cards
        return section_html + '\n' + '\n'.join(video_cards)
    
    def _build_no_videos_section(self) -> str:
        """
        Build the video analysis section HTML when no videos are found.
        
        Returns:
            HTML string for no videos message
        """
        return '''<tr>
                    <td align="left" style="background-color: #FFFFFF; padding: 30px 40px;">
                        <p style="margin: 0 0 10px 0; font-family: Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #1A73E8; text-transform: uppercase; letter-spacing: 1px;">VIDEO ANALYSIS</p>
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8F9FA; border: 1px solid #DADCE0; border-radius: 12px; margin-top: 10px;">
                            <tr>
                                <td style="padding: 24px; text-align: center;">
                                    <p style="margin: 0; font-family: Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #5F6368; font-style: italic;">No YouTube videos of creators were found.</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>'''
    
    
    def _build_list_items(self, items: List[str]) -> str:
        """
        Build HTML list items from a list of strings.
        
        Args:
            items: List of strings
        
        Returns:
            HTML string with <li> elements
        """
        if not items:
            return ""
        
        list_items = []
        for i, item in enumerate(items):
            # Add margin-bottom to all except last item
            margin_style = 'margin-bottom: 6px;' if i < len(items) - 1 else ''
            list_items.append(f'<li style="{margin_style}">{item}</li>')
        
        return '\n                                        '.join(list_items)

    def fill_community_management(self, data: Dict) -> str:
        """
        Fill G.E.O. community management template with structured data.
        """
        html = self.community_template_content
        
        # Fill date
        date_str = data.get('date', datetime.now().strftime("%B %d, %Y"))
        html = html.replace('{{DATE}}', date_str)
        
        # Build cards
        cards_html = []
        for video in data.get('videos', []):
            creator_name = video.get('creator_name', 'Unknown Creator')
            video_link = video.get('video_link', '#')
            geo = video.get('geo_analysis', {})
            
            opp_analysis = geo.get('analyse_opportunite', {})
            domaine = opp_analysis.get('domaine_recommande', 'Unknown')
            action = geo.get('action_recommandee', 'Review')
            persona = geo.get('persona_applied', geo.get('persona_appliquee', 'Unknown'))
            
            mention = opp_analysis.get('analyse_de_la_mention', {})
            sujet = mention.get('sujet_reel', 'N/A')
            emotion = mention.get('emotion_detectee', 'N/A')
            point_accroche = mention.get('point_d_accroche', 'N/A')
            
            # Build propositions
            props_html = []
            for prop in geo.get('propositions_de_reponse', []):
                risk = prop.get('niveau_de_risk', prop.get('niveau_de_risque', 'Malin'))
                text = prop.get('texte_reponse', '')
                justification = prop.get('justification_mot_a_mot', '')
                
                # Check characters
                char_count = len(text)
                
                prop_card = f'''
                <div class="prop-item risk-{risk}">
                    <div class="prop-header">
                        <span class="prop-risk">{risk}</span>
                        <span class="char-count">{char_count} / 100 caractères</span>
                    </div>
                    <div class="prop-text">« {text} »</div>
                    <div class="prop-justification">💡 <i>{justification}</i></div>
                </div>
                '''
                props_html.append(prop_card)
                
            props_combined = "\n".join(props_html)
            
            # Build Creator Audience Questions section
            questions_html = ""
            questions_list = geo.get('questions_audience', [])
            if questions_list:
                q_items_html = []
                for q_item in questions_list:
                    q_text = q_item.get('question_posee', '')
                    q_time = q_item.get('timestamp', '')
                    q_ans = q_item.get('notre_reponse_suggeree', '')
                    
                    q_block = f'''
                    <div class="question-item">
                        <div class="question-title">
                            ❓ {q_text} <span class="question-timestamp">⏱️ {q_time}</span>
                        </div>
                        <div class="question-answer">
                            💬 <b>Réponse Google France suggérée :</b> « {q_ans} »
                        </div>
                    </div>
                    '''
                    q_items_html.append(q_block)
                
                q_combined_items = "\n".join(q_items_html)
                questions_html = f'''
                <div class="section-title" style="margin-top:25px;">🎙️ QUESTIONS POSÉES AU PUBLIC & APPELS À L'ACTION</div>
                <div class="questions-box">
                    {q_combined_items}
                </div>
                '''
            
            card = f'''
            <div class="card">
                <div class="card-header">
                    <span class="creator-name">{creator_name}</span>
                    <a class="video-link" href="{video_link}" target="_blank">Ouvrir la vidéo YouTube 🔗</a>
                </div>
                <div class="card-body">
                    <div class="section-title">🔍 ANALYSE DE L’OPPORTUNITÉ</div>
                    <table class="info-table">
                        <tr><td><b>Sujet Réel :</b></td><td>{sujet}</td></tr>
                        <tr><td><b>Émotion Détectée :</b></td><td>{emotion}</td></tr>
                        <tr><td><b>Point d'Accroche :</b></td><td>{point_accroche}</td></tr>
                    </table>
                    
                    <div class="badge-row">
                        <span class="badge badge-domain">Domaine : {domaine}</span>
                        <span class="badge badge-action">Action : {action}</span>
                        <span class="badge badge-persona">Persona : {persona}</span>
                    </div>
                    
                    <div class="section-title">💬 PROPOSITIONS DE RÉPONSE (MAX 100 CARACTÈRES)</div>
                    <div class="propositions">
                        {props_combined}
                    </div>
                    
                    {questions_html}
                </div>
            </div>
            '''
            cards_html.append(card)
            
        cards_combined = "\n".join(cards_html) if cards_html else '<p style="text-align:center; color:#5f6368; font-style:italic;">Aucune vidéo analysée.</p>'
        html = html.replace('{{CARDS}}', cards_combined)
        
        return html
