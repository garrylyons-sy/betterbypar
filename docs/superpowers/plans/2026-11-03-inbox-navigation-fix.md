# Inbox navigation fix

Native root cause reproduced: Expo Router 58 maps href:null to hidden:true; useVisibleTabsWithRedirect replaces a focused hidden route with Home. Hide the Inbox and Record a round tab buttons through tabBarButton/tabBarItemStyle instead, leaving their routes declared and accessible. Simulator verified Inbox, settings and return to Inbox. Temporary route probe removed.

Website user reported bell failing. Live desktop bell/modal and drill destination worked in reproduction; replace bell with ordinary /inbox link for reliable direct navigation. New authenticated Inbox page reuses existing NotificationCenter inline; no modal visibility/scroll locks. Keep Inbox/Settings navigation and announcement links on /inbox. Existing notification deep-link modal remains supported.

Verification: 701 tests passed, including route visibility, direct bell link, inline page rendering, safe destinations and existing read/delete concurrency tests. Root/mobile TypeScript and native lint passed. Reviewer findings about settings navigation and announcement path preservation corrected. Isolated sample-data browser verified bell -> /inbox -> Settings -> Inbox with app menu intact. Signed physical build prepared separately; device currently unavailable, reconnect request pending. No commit/push.
Rollout: web deployment dpl_62UGoNdTDjnNJAcwZfDq53UBzRPh READY at www.betterbypar.com. Signed iPhone build succeeded and copied to /private/tmp/bbp-inbox-fix-ios/BetterByPar.app. Device remains unavailable, so physical installation is not yet complete.
