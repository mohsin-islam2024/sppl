# SPPL: কনটেন্ট ম্যানেজার + বাগ ফিক্স

নিচের ফাইলগুলো আপনার প্রজেক্টে একই পাথে কপি করে বসান (পুরনো ফাইল রিপ্লেস হবে)।
নতুন কোনো প্যাকেজ লাগবে না।

## নতুন ফাইল
- shared/validation/contentSchemas.js
- server/src/controllers/adminContent.controller.js
- server/src/routes/adminContent.routes.js
- client/src/services/adminContentService.js
- client/src/hooks/useAdminContent.js
- client/src/components/admin/ImageUploader.jsx
- client/src/components/admin/ManagerShell.jsx
- client/src/components/common/AnnouncementBanner.jsx  (হোম পেজে ঘোষণা দেখানোর অংশ)
- client/src/pages/public/{News,NewsArticle,Sponsors}.jsx  (সংবাদ তালিকা, সংবাদ পড়ার পেজ, স্পনসর পেজ)
- client/src/pages/admin/{News,Gallery,Sponsor,Award,Announcement}Manager.jsx

## বদলানো ফাইল (বাগ ফিক্স)
- server/src/controllers/content.controller.js : নিউজ/গ্যালারি/অ্যাওয়ার্ড/ঘোষণার পাবলিক API মডেলের সাথে মেলানো
- shared/validation/schemas.js : paginationSchema এ .passthrough() (season/search/team ফিল্টার আর হারাবে না)
- server/src/config/cloudinary.js : ভাঙা uploadUrl ঠিক, news ফোল্ডার যোগ
- server/src/config/env.js, client/vite.config.js, client/index.html (গুগল ফন্ট),
  client/public/robots.txt, SEO.jsx, TeamDetail.jsx, MatchManager.jsx : ভাঙা লিংক ঠিক

## বদলানো ফাইল (নতুন ফিচার যুক্ত)
- server/src/routes/admin.routes.js : নতুন রুট মাউন্ট
- client/src/pages/public/Home.jsx : ঘোষণা ব্যানার বসানো
- client/src/components/layout/PublicLayout.jsx : ফুটারে /news লিংক
- client/src/router/index.jsx : ৫টি placeholder রুট আসল পেজে
- client/src/components/layout/AdminLayout.jsx : সাইডবারে "সংবাদ" লিংক
- client/src/i18n/locales/{bn,en}.json : নতুন লেখা (দুই ভাষায় সমান)

## চালু করতে যা করতে হবে
Render এর Environment এ এই তিনটি যোগ করুন, তারপর redeploy:
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

## দ্বিতীয় ধাপ: ভিডিও, ইউজার, পয়েন্ট টেবিল, সুপার ওভার, ফাইনাল

নতুন ফাইল:
- server/src/utils/video.js, server/src/utils/superOver.js
- server/src/controllers/adminPoints.controller.js
- shared/validation/adminSchemas.js
- client/src/pages/public/Videos.jsx
- client/src/pages/admin/{Video,User,Points}Manager.jsx, SuperOver.jsx
- client/src/services/adminOpsService.js, client/src/hooks/useAdminOps.js

বদলানো ফাইল:
- server/src/services/scoringService.js : পয়েন্ট টেবিল শুধু লিগ ম্যাচ গোনে; ফাইনালের পর চ্যাম্পিয়ন বসে; undo করলে সুপার ওভার ও চ্যাম্পিয়ন সরে
- server/src/controllers/scoring.controller.js : সুপার ওভার সেভ; "ইনিংস শেষ" চাপলে ম্যাচ শেষ হলে পয়েন্ট টেবিল হালনাগাদ (আগে হতো না)
- server/src/controllers/user.controller.js : ইউজার সার্চ নিরাপদ, অ্যাকাউন্ট চালু/বন্ধ
- server/src/routes/{admin,adminContent,scoring,user}.routes.js
- shared/validation/contentSchemas.js
- client: router, AdminLayout, PublicLayout, MatchManager, adminContentService, i18n (বাংলা ও ইংরেজি)
- ১৪টি অনুপস্থিত অনুবাদ যোগ (স্কোরিং স্ক্রিনের লেখা)

## তৃতীয় ধাপ: প্রতি ম্যাচে আলাদা ওভার

নতুন ফাইল:
- server/src/utils/matchRules.js

বদলানো ফাইল:
- server/src/models/Match.js : ম্যাচে oversPerInnings ফিল্ড (খালি থাকলে সিজনের নিয়ম)
- server/src/services/scoringService.js, server/src/controllers/scoring.controller.js : ইনিংস শেষের সীমা এখন ম্যাচের নিজের ওভার থেকে
- server/src/services/adminService.js : ম্যাচ শুরুর পর ওভার বদলানো যায় না
- server/src/services/seasonService.js : পাবলিক ম্যাচ কার্ডে ওভার
- shared/validation/schemas.js
- client: MatchManager (ওভার বাছাই), MatchDetail, MatchCard (ওভার দেখানো), i18n

## চতুর্থ ধাপ: চোট পাওয়া খেলোয়াড়ের বদলি (লাইভ স্কোরিং)

নতুন ফাইল:
- server/src/utils/substitution.js (বদলির নিয়ম)
- client/src/components/admin/ReplacePlayerSheet.jsx (স্কোরিং স্ক্রিনের "খেলোয়াড় বদল" ডায়ালগ)

বদলানো ফাইল:
- server/src/models/Match.js : substitutions তালিকা, ব্যাটিং লাইনে retiredHurt
- server/src/services/scoringService.js : আনডুর পর রিটায়ার্ড-হার্ট ব্যাটার ফিরে না আসা
- server/src/services/statsService.js : বদলি হওয়া খেলোয়াড়ের ম্যাচ গোনা, রিটায়ার্ড-হার্ট নটআউট ধরা
- server/src/controllers/scoring.controller.js, server/src/controllers/match.controller.js
- server/src/routes/scoring.routes.js, shared/validation/adminSchemas.js
- client: LiveScoringMatch, useScoring, MatchDetail, Scorecard, i18n

## পঞ্চম ধাপ: লাইভ স্কোরিং সুরক্ষা

নতুন ফাইল:
- client/src/utils/id.js (প্রতি বলের নিজস্ব আইডি, নেটওয়ার্ক সমস্যা চেনা)

বদলানো ফাইল:
- server/src/middleware/rateLimit.js : সাধারণ সীমা ১২০০, স্কোরিং আলাদা (দর্শকের ভিড়ে স্কোরার আটকাবে না)
- server/src/routes/scoring.routes.js : সব স্কোরিং রিকোয়েস্ট স্কোরিংয়ের নিজস্ব সীমায়
- shared/validation/schemas.js, server/src/models/Ball.js : বলের clientBallId
- server/src/services/scoringService.js : একই বল দুইবার না গোনা, আটকে থাকা বল নিজে সরানো, অল-আউট ও জয়ের ব্যবধান দলের আসল খেলোয়াড় সংখ্যা ধরে
- server/src/controllers/scoring.controller.js : ম্যাচ শুরুতে ৫ থেকে ৯ জন, খেলোয়াড় ও দল যাচাই
- server/src/utils/matchRules.js
- client: LiveScoringMatch (নেট কেটে গেলে নিজে আবার চেষ্টা, "আবার চেষ্টা" বোতাম), StartMatchForm, i18n

## ষষ্ঠ ধাপ: ভাষা বদলালে সংখ্যা ঠিক বদলানো

নতুন ফাইল:
- client/src/utils/digits.js

বদলানো ফাইল:
- client/src/utils/format.js : toBengaliDigits এখন নির্বাচিত ভাষা অনুযায়ী (ইংরেজিতে 0-9, বাংলায় ০-৯); ওভার, রান রেট, NRR, বোলিং ফিগার নিজেই ভাষা অনুযায়ী
- client/src/i18n/index.js : অনুবাদ করা সব লেখার ভেতরের সংখ্যা বাংলায় নিজে বাংলা অঙ্ক
- সিজনের নম্বর/সাল, জার্সি নম্বর, ম্যাচ নম্বর, স্কোর, স্ট্যাট কার্ড দেখানো ১৯টি ফাইল (পাবলিক ও অ্যাডমিন পেজ)
