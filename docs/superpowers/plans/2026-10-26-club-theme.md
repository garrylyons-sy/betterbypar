# Club-wide configurable colours

Use saved primary/accent club settings to derive full readable theme: primary/hover/on-primary, accent/on-accent, page/surface/muted/border/text. WCAG4.5 normal text contrast for generated text+primary and accent pairs. Do not recolour semantic errors/warnings or uploadedlogos. No new optional design approval per userAGENTS.

Root client ClubThemeProvider fetches authenticated /api/club-theme => {clubs:[{id,name,primaryColor,accentColor}]} authorized active clubs only. Context useClubTheme(): {clubs,clubId,setClubId(id),refresh(),preview(primary,accent)|null,clearPreview()}. Provider applies CSS variables to documentElement, authenticatedclubs refreshonfocus/visibility and 60sinterval; sessionStorage activeclub checked againstserverauthorizedlist, updateevents triggerrefreshafterbranding saves. No unauthenticated/private club exposure.

API /api/club-theme GET: memberships/explicitadmins/activeoperator authorized only, normal colors defaults. Server storeuser context peractiveclub not CSSstateforaccesscontrol. Theme survivesroutechangeand followedbooking auto-clubselection. Anonymous/platformdefault Better By Par forest/gold.

Palette lib/club-theme.mjs exports buildClubTheme(primary,accent):Record<string,string> CSS vars and contrastRatio/foregroundFor. Legacy CSSvariables --pl-* and HSL tailwind tokens map to theme. Scoped compatibility CSS maps known inherited navy/purple and lesson green/cream utility colours onto semantic palette, including opacity/hover/focus variants; preserve errors/red warning orange and sportssemantic colours. Primary/surface/accent backgrounds set context text variables for nestedcards contrast. Avoid rewrite of standaloneSVGshareoutputs to unusable CSSvars; adjust helperendcolors and foreground frompassedclubcolors.

UI: AppShell selects theme by activeclubname (no clubId field incontexts); AdminLessons sets theme byclubId; MemberLessons selectedtime/booking'sclubId andselectedcoachdates; ClubBrandingPanel onclubselection sets theme, editdraft previews wholeportalpalette and discardrestores, save refreshesglobaltheme event; AdminDependants clubselectsets. Root coversprofile/family/adminwithselected authorizedclub. Newtheme-aware button classes/styles. Show text inbranding explaining allscreens themed.

Verify paletteextremes, invalidhex, identityscopes, crossclub switches, livepreview/save/discard and member/pro/admin flows with actualsavedcolor onlocaldemo thenrestore. Runfullsuite/typecheck/review. No commits/pushes.
