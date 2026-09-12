# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0](https://github.com/msyamsudin/velopulse-dashboard/compare/v0.2.0...v0.3.0) (2026-09-12)


### Features

* **history:** redraw the intensity card as zone histograms with a macro TID split ([00f3de7](https://github.com/msyamsudin/velopulse-dashboard/commit/00f3de7c0056e426a71999cea5bba78dfe518067))


### Bug Fixes

* **db:** correct the reference row types to match the real columns ([7735413](https://github.com/msyamsudin/velopulse-dashboard/commit/7735413cf7e43541f597ff981c9d694eb5cccce1))

## [0.2.0](https://github.com/msyamsudin/velopulse-dashboard/compare/v0.1.0...v0.2.0) (2026-09-11)


### Features

* **release:** stamp the build identity on exports and cloud error logs ([39661d5](https://github.com/msyamsudin/velopulse-dashboard/commit/39661d5bc3badc4d45f1301fa3aacf20aa77942b))


### Bug Fixes

* **ci:** keep release tags as v-version so release-please can find them ([041b8e8](https://github.com/msyamsudin/velopulse-dashboard/commit/041b8e823b94207312e6ebbda7222afe99ea8587))

## [0.1.0] - 2026-09-11

Reconstructed from the complete git history: this project accumulated 113 commits before it had a version number. Commits that predate the Conventional Commits convention are listed under the Other Changes section rather than dropped.

_113 commit(s), 2026-05-24 → 2026-09-11_

### Features

- add CloudStatusIndicator component and connection status hook ([`2f514d3`](https://github.com/msyamsudin/velopulse-dashboard/commit/2f514d3ac80bd269ffedd83da8cdc66328dffffb))
- **share-card:** add comparison metrics vs last workout option ([`3589489`](https://github.com/msyamsudin/velopulse-dashboard/commit/3589489108b1f8d958d8c04c4d01c700d15ed84c))
- add heart rate plausibility checks and bike heart rate fallback logic ([`8f5e45f`](https://github.com/msyamsudin/velopulse-dashboard/commit/8f5e45f26a644b288d5bb5c4ec608bd8285e8173))
- add lap-level summary elements to TCX export ([`9dd8ef1`](https://github.com/msyamsudin/velopulse-dashboard/commit/9dd8ef16f00a0d25a5975f1f96299357aa5ad8ad))
- **history:** add milestone & PR detection with social media share card generator ([`7972226`](https://github.com/msyamsudin/velopulse-dashboard/commit/79722268be34133fb033d8c3cc3ba282a447fe44))
- **cockpit:** add on-demand PR Target Pacer for real-time record chasing ([`c546d18`](https://github.com/msyamsudin/velopulse-dashboard/commit/c546d18520e6ec3b83c753450e8ad001418f07e9))
- add PWA support with service worker and manifest ([`055598b`](https://github.com/msyamsudin/velopulse-dashboard/commit/055598b47389438b125500d2cdfa17cd7589b36f))
- **history:** add the advanced analysis panel and a fitness model ([`3620df5`](https://github.com/msyamsudin/velopulse-dashboard/commit/3620df52a0bbdd1c7726f0eb72a291f3c1d2ded0))
- **records:** add the best-efforts power and split curve ([`e9505e0`](https://github.com/msyamsudin/velopulse-dashboard/commit/e9505e0512cb55c2ff04b93aa6579744fd6ecde9))
- **history:** add the intensity block and fix zone time accounting ([`0837061`](https://github.com/msyamsudin/velopulse-dashboard/commit/083706176144226c9df81bda5814a74d63e7f39c))
- add unit tests for various utilities and components ([`de66af1`](https://github.com/msyamsudin/velopulse-dashboard/commit/de66af1b49c593a3873f7e9c2744a4751e89a310))
- add workout deletion and Supabase auth with per-user data access ([`9f43699`](https://github.com/msyamsudin/velopulse-dashboard/commit/9f43699f6f1691a215488f0193802c7c1f8b29e9))
- **share-card:** add workout number (Ride #N) and enhance visibility of comparison metrics ([`038095b`](https://github.com/msyamsudin/velopulse-dashboard/commit/038095b5ff81a27d7742589a95fb0b02ce86f2cc))
- **workout:** add workout session management with persistence and stats calculation ([`eaff316`](https://github.com/msyamsudin/velopulse-dashboard/commit/eaff316ac48944a4878f8c2cb1f7597155580cd5))
- **history:** dedicated Records page and record-focused live PR pacer ([`319f5e3`](https://github.com/msyamsudin/velopulse-dashboard/commit/319f5e379c82bbe1c9e627528231957e557f895a))
- **summary:** draw the fitness/fatigue model as an area chart in L2 ([`b5a6072`](https://github.com/msyamsudin/velopulse-dashboard/commit/b5a60729967bf2dbfecd6ee9821ef10ba699e1da))
- enforce heart rate strap requirement for workout sessions and update related UI messages ([`12faa00`](https://github.com/msyamsudin/velopulse-dashboard/commit/12faa00d40350412b7154a1e651fc6ad4129abf3))
- enhance CloudStatusIndicator with action handlers and update translations ([`32823da`](https://github.com/msyamsudin/velopulse-dashboard/commit/32823da6e880974b5936bcdef5f97139a1fa5d6a))
- enhance type safety and error handling across components and hooks ([`d397a16`](https://github.com/msyamsudin/velopulse-dashboard/commit/d397a1695ad6835f1cc78e4d3e08d4ec749101ad))
- enhance workout tracking and metrics ([`8886a47`](https://github.com/msyamsudin/velopulse-dashboard/commit/8886a471cbc47faf4981d6658f4afa244d363b9a))
- export and import resistance level in TCX workout files ([`f655440`](https://github.com/msyamsudin/velopulse-dashboard/commit/f655440c2c2f7c016666bbd014da7ed2dc10d855))
- **summary:** gate power zones and body-mass metrics behind the profile ([`31309bb`](https://github.com/msyamsudin/velopulse-dashboard/commit/31309bb8c6509f19b714c1f310ab65b461fc15b4))
- implement auto-reconnect logic for heart rate and bike devices with exponential backoff ([`6b5967b`](https://github.com/msyamsudin/velopulse-dashboard/commit/6b5967bafdace95c946a67da6ddf8adcc77074eb))
- implement auto-sync functionality with notifications for success and failure ([`4ecf08e`](https://github.com/msyamsudin/velopulse-dashboard/commit/4ecf08ea11b710f48018dd8c817dcc0ef4663ffe))
- implement probe client caching for Supabase connection status ([`6280cfa`](https://github.com/msyamsudin/velopulse-dashboard/commit/6280cfadadc3a8feaf0c49757bf5f8524cb4304c))
- implement save session progress feature with animated UI updates ([`bb54067`](https://github.com/msyamsudin/velopulse-dashboard/commit/bb5406760595f14fbc1f2836b1c30079de50c757))
- **store:** keep a dated body history for W/kg and resting HR ([`0495a17`](https://github.com/msyamsudin/velopulse-dashboard/commit/0495a173d1ba92b0de9f93ec6090756d14afaa1f))
- overhaul ride cockpit with functional columns, focus mode, and richer live metrics ([`dad1124`](https://github.com/msyamsudin/velopulse-dashboard/commit/dad1124c914b0a5f6d07dfda92c3a40bdd0f0a54))
- **store:** rate the ride 1-10 and compare perception with load ([`ff4223d`](https://github.com/msyamsudin/velopulse-dashboard/commit/ff4223d7eb43a00fdc58fe2ae29034eb8d77d571))
- reconnect HR/bike mid-session, fix distance tracking, and readable sub-km display ([`658cb0a`](https://github.com/msyamsudin/velopulse-dashboard/commit/658cb0a6ac81d36b3f977e1a23b6600a2ef43f3c))
- remove DevicePanel component and update PreRideCockpit for device connection management ([`c5e9ea6`](https://github.com/msyamsudin/velopulse-dashboard/commit/c5e9ea6eb35f94982a3b7799879ffb600aa1c667))
- remove saved devices management and reconnect logic from Bluetooth store ([`461bff9`](https://github.com/msyamsudin/velopulse-dashboard/commit/461bff9f044f6be0cce655fcd54c827f45190878))
- remove session prop from PreRideCockpit and update related UI components ([`99331ee`](https://github.com/msyamsudin/velopulse-dashboard/commit/99331ee03c4ac304886e7519efdc22f62b099268))
- **store:** save the pre-ride HRV reading with the session ([`d96669b`](https://github.com/msyamsudin/velopulse-dashboard/commit/d96669b2bb92893347d03d77b96c598f385c8972))
- show detailed backend error message on profile fetch fail ([`5f19911`](https://github.com/msyamsudin/velopulse-dashboard/commit/5f19911d5081673753ed322de8e3f89ec9039519))
- show detailed backend error message on profile fetch fail ([`59400ce`](https://github.com/msyamsudin/velopulse-dashboard/commit/59400ceb2610b6b86c21a0e565aeedbe15587af3))
- show live calorie source indicator (power vs sensor) in ride cockpit ([`c5df65e`](https://github.com/msyamsudin/velopulse-dashboard/commit/c5df65eb95f604402a330f1e875ea0528982b5f9))
- show TRIMP during workouts and switch load ratio chart to weekly ([`ddf5a02`](https://github.com/msyamsudin/velopulse-dashboard/commit/ddf5a0200824924894d6a17d25b73757e156d0f4))
- simplify History UI across summary, list, and detail views ([`68df22a`](https://github.com/msyamsudin/velopulse-dashboard/commit/68df22aa88ab8527a2b7d6f9d45c2aebad448b57))
- **summary:** split the zone mix by session type ([`9f0a719`](https://github.com/msyamsudin/velopulse-dashboard/commit/9f0a719e8889e55060cdc688adadda9281b4f695))
- tambah auto-save sesi latihan dan auto-reconnect bluetooth ([`e69e213`](https://github.com/msyamsudin/velopulse-dashboard/commit/e69e213c206760d65f25383ed546f6d420c2ea29))
- tambahkan ekspor batch TCX (ZIP & gabungan) pada riwayat latihan ([`bd112d4`](https://github.com/msyamsudin/velopulse-dashboard/commit/bd112d4156b2562762c878cf9848ba22ff5502dc))

### Bug Fixes

- **i18n:** follow the app locale in exports, share card and import flow ([`60b7fb2`](https://github.com/msyamsudin/velopulse-dashboard/commit/60b7fb2d172a7a9b1536e4a19fd90173192dfc3b))
- **ui:** let utilities override custom classes and simplify the trend chart ([`bb6ebe8`](https://github.com/msyamsudin/velopulse-dashboard/commit/bb6ebe8905743ea3a20e4c4c58ba730df65ec36c))
- **share-card:** remove redundant ride number repetitions and 'vs prev' text from metric pills ([`c0cd13a`](https://github.com/msyamsudin/velopulse-dashboard/commit/c0cd13a9d9f50fa6068db6c03576fca7b7368a6c))
- **history:** repair frozen legacy session durations and guard impossible avg-speed records ([`61b93f4`](https://github.com/msyamsudin/velopulse-dashboard/commit/61b93f4ab30fafda7ae431b942cded6f34fa5433))
- **i18n:** translate hardcoded UI text and store HRR levels as codes ([`1c5cec3`](https://github.com/msyamsudin/velopulse-dashboard/commit/1c5cec3bb23c5581e98b3f5a780f8f1bedf9d527))
- **i18n:** translate the rest of the app and enforce the check in CI ([`e7e7786`](https://github.com/msyamsudin/velopulse-dashboard/commit/e7e7786df303bd7b2cdcd39d01f4fc9e44685ea3))
- **share-card:** update comparison metrics to use ride average instead of last workout ([`67cc9b3`](https://github.com/msyamsudin/velopulse-dashboard/commit/67cc9b3588f480c669fa838ba5b78eee2004e86c))

### Documentation

- add repository URL to setup instructions ([`fc00eb5`](https://github.com/msyamsudin/velopulse-dashboard/commit/fc00eb5a9e83293a484f6a1c2e17595a4a80e8a4))

### Code Refactoring

- **history:** cut the Summary view down to five blocks ([`5f6b6d6`](https://github.com/msyamsudin/velopulse-dashboard/commit/5f6b6d68e2f77f5713f3352e8a550f0c8e23ebe8))
- **history:** fold load and recovery into one Summary card ([`1072489`](https://github.com/msyamsudin/velopulse-dashboard/commit/10724896eadc6c0902a27b5e26b76eb14380aa5e))
- Remove Google Fit integration and related configurations ([`b53395d`](https://github.com/msyamsudin/velopulse-dashboard/commit/b53395d038326588602e4e104967301de8d8f6d2))
- remove WorkoutJourney component and related journey metrics ([`94c4c77`](https://github.com/msyamsudin/velopulse-dashboard/commit/94c4c77386ad961f7d8c1fc9970f26efe6f189af))
- **share-card:** simplify theme palette structure and enhance share card rendering ([`53173f8`](https://github.com/msyamsudin/velopulse-dashboard/commit/53173f83c4854f8b9b63f3b298fb696fb1df7a97))
- update linting configuration and dependencies ([`3c0da9d`](https://github.com/msyamsudin/velopulse-dashboard/commit/3c0da9d6ea64b1c9fe5ab5c86c8ab46b363181d0))

### Miscellaneous Chores

- add pnpm workspace configuration for build scripts ([`8e074f8`](https://github.com/msyamsudin/velopulse-dashboard/commit/8e074f868ced5c5de96bae28a92499814a6b8933))
- **lint:** drop the stale ROADMAP reference from the eslint config ([`b228082`](https://github.com/msyamsudin/velopulse-dashboard/commit/b228082ca5baf745deb8e4eb695cf5b6ec7ee17d))
- ignore benchmark cache dir and untrack stray scratch scripts ([`2fd8ca9`](https://github.com/msyamsudin/velopulse-dashboard/commit/2fd8ca907d2658760b5799ad813e0b0593de024c))
- **deps:** update motion 13, jest-dom 7, jsdom 30, @types/node 24 ([`aa65841`](https://github.com/msyamsudin/velopulse-dashboard/commit/aa65841d1ec0be4bce40dca22920e2aee0f47617))
- update Node.js version to 24 in CI configuration and documentation ([`9f9517b`](https://github.com/msyamsudin/velopulse-dashboard/commit/9f9517be36ec64d24862a123df8e98f80b4e28c0))

### Other Changes

- Add app i18n support and language selector ([`5090073`](https://github.com/msyamsudin/velopulse-dashboard/commit/5090073fd13bb0ba445adfe1c2353ecc68ab015d))
- Add average and cumulative modes to history charts ([`18ba594`](https://github.com/msyamsudin/velopulse-dashboard/commit/18ba5940d66f78d55bd827e015fe1f68e5ba5b59))
- Add journey preview to cockpit views ([`24b77f1`](https://github.com/msyamsudin/velopulse-dashboard/commit/24b77f1765e8f3957bf932acaa544c887e76f938))
- Add resistance plan feature with advisor and UI panel ([`8c640a1`](https://github.com/msyamsudin/velopulse-dashboard/commit/8c640a17a285276e47b808bc442c5dbdf4322d71))
- Add Supabase history pagination ([`bb717fe`](https://github.com/msyamsudin/velopulse-dashboard/commit/bb717fe0bbd7e29642eeec3ee17c471590ce58de))
- Add Supabase sync retry and HRR session tracking ([`75950e3`](https://github.com/msyamsudin/velopulse-dashboard/commit/75950e3c0903f662a2750a927a0ce368100b3dc5))
- Add TCX import with duplicate detection ([`9e809a3`](https://github.com/msyamsudin/velopulse-dashboard/commit/9e809a32d480513b7e00ccc04909fe0abb529249))
- Add UI redesign foundation ([`259b7c4`](https://github.com/msyamsudin/velopulse-dashboard/commit/259b7c4bb580032c631dc28f35299ee270b72e95))
- Batasi efek zona HR pada kartu detak jantung ([`2d6b620`](https://github.com/msyamsudin/velopulse-dashboard/commit/2d6b6206926cafca485f335f8e766147b7da2851))
- Consolidate dashboard empty and notice states ([`ab2a7c6`](https://github.com/msyamsudin/velopulse-dashboard/commit/ab2a7c62b8c1df109c8d1d37a2ee9456da1d3cc6))
- Defer remote history loading until needed ([`36b2626`](https://github.com/msyamsudin/velopulse-dashboard/commit/36b2626a030278bf24e3973c9bc57facb7e84491))
- Enhance error handling and synchronization for Supabase integration across components ([`6ca0c41`](https://github.com/msyamsudin/velopulse-dashboard/commit/6ca0c414232a1814d29a43883cd6a28ef65d9e7b))
- Enhance PreRideCockpit layout with overflow handling and update ResistancePlanPanel for improved UI and functionality ([`8248576`](https://github.com/msyamsudin/velopulse-dashboard/commit/8248576b600fd0eecc5513359bce30a21b5496ca))
- Expand history summary to support multi-metric charts ([`f0250be`](https://github.com/msyamsudin/velopulse-dashboard/commit/f0250befe9ed683d7c17c5bf2a221d620ea4de04))
- Fix workout date mapping and TCX import fallback ([`aa55ed3`](https://github.com/msyamsudin/velopulse-dashboard/commit/aa55ed307f85c1df729ba300327120191070db0c))
- hash bcrypt untuk master password, backup/restore terenkripsi, hapus file test dari track ([`7362e38`](https://github.com/msyamsudin/velopulse-dashboard/commit/7362e38abb49fdae07daf09356df5a79384201d3))
- Ignore docs directory ([`2d0036e`](https://github.com/msyamsudin/velopulse-dashboard/commit/2d0036e33cd404752735eeead684ffc0860bac16))
- Improve button accessibility and confirmation prompts ([`1db0440`](https://github.com/msyamsudin/velopulse-dashboard/commit/1db0440e5d585dd6edd5e0190a552da04784006a))
- Improve calorie tracking and training load summary ([`7d253c6`](https://github.com/msyamsudin/velopulse-dashboard/commit/7d253c681de4a3738c5c9152e8c82e454a70c884))
- Initial commit ([`00be1aa`](https://github.com/msyamsudin/velopulse-dashboard/commit/00be1aa915f2c00dfc3e3bc0b95a8a27b18822e3))
- Lazy-load heavy dashboard panels and reduce idle render overhead ([`11f733a`](https://github.com/msyamsudin/velopulse-dashboard/commit/11f733a13b8fa413a624cda18a5684300c4d31b3))
- Move chart access into recording cockpit ([`46df321`](https://github.com/msyamsudin/velopulse-dashboard/commit/46df321fef43cd7bf60b6eada75ce05fc2405637))
- Optimize chart history data rendering ([`9845296`](https://github.com/msyamsudin/velopulse-dashboard/commit/984529635e38fa6859cbda0d8b38e855e7577ef4))
- Optimize live workout stats updates ([`13e93df`](https://github.com/msyamsudin/velopulse-dashboard/commit/13e93df75e337553047b12942f0ca4a1293d611b))
- penyesuaian footer dan deskripsi aplikasi ([`93d0954`](https://github.com/msyamsudin/velopulse-dashboard/commit/93d09545ab895ed60704119a2b8d9780c930942d))
- Perbaiki tampilan history latihan ([`77555c6`](https://github.com/msyamsudin/velopulse-dashboard/commit/77555c6843a8ed656857f832d2c54f6c14bb2337))
- Refactor code structure for improved readability and maintainability ([`d069d00`](https://github.com/msyamsudin/velopulse-dashboard/commit/d069d006115e0d13f55291ba162f243a97a37034))
- Refactor dashboard layout and data flow ([`49b819d`](https://github.com/msyamsudin/velopulse-dashboard/commit/49b819d48d2ff083cc114dd0cef3f1220a7514a1))
- Refactor history heatmap consistency map layout ([`9db85e5`](https://github.com/msyamsudin/velopulse-dashboard/commit/9db85e5da3c1da57d43596bb0342ea1639b87f02))
- Refactor pre-ride cockpit UI ([`d1775a9`](https://github.com/msyamsudin/velopulse-dashboard/commit/d1775a9ea5b3900d12429988386c886c002d74b8))
- Refine app surface modes ([`3f3407a`](https://github.com/msyamsudin/velopulse-dashboard/commit/3f3407aae65f53b46a967eb720ee0bd5e55d817b))
- Refine device controls styling ([`853548f`](https://github.com/msyamsudin/velopulse-dashboard/commit/853548f05c774265a487e431c2391e57f0dbcd84))
- Refine pre-ride workout UI ([`11d0cab`](https://github.com/msyamsudin/velopulse-dashboard/commit/11d0caba85f2f3b22d32942e31d6bef3a35b3924))
- Refresh dashboard shell and branding ([`33410d6`](https://github.com/msyamsudin/velopulse-dashboard/commit/33410d690b4fd9696deac080a9d75ca9d43bceea))
- Refresh performance chart controls and styling ([`ae7c272`](https://github.com/msyamsudin/velopulse-dashboard/commit/ae7c27247905f46631521ad5fbd13e22ed8d87e3))
- Refresh session summary modal layout and export handling ([`612b591`](https://github.com/msyamsudin/velopulse-dashboard/commit/612b59169a3d56d88717d50a78bdb2265b1c8840))
- Refresh settings modal and tabs ([`ad0783d`](https://github.com/msyamsudin/velopulse-dashboard/commit/ad0783d511b6018a9aad79c0b1029c6804095240))
- Refresh workout history UI for new vp theme ([`04097a9`](https://github.com/msyamsudin/velopulse-dashboard/commit/04097a991d5c736687ac9c5c632e5fd5c809686f))
- Remove duplicate font loading and lazy-load exports ([`5f93dcc`](https://github.com/msyamsudin/velopulse-dashboard/commit/5f93dcc933d2023f65a07a9d2870705d34ec4027))
- Remove obsolete test files for i18n, journey metrics, Google Fit mapping, physics calculations, TCX import, training load, and workout store ([`c503100`](https://github.com/msyamsudin/velopulse-dashboard/commit/c503100216e7f4a9cbbf4fb6053395b49c6b88ba))
- Remove redundant summary KPI cards ([`24ad362`](https://github.com/msyamsudin/velopulse-dashboard/commit/24ad3620acc97fe25a38cc1b86572222884603de))
- Remove UI redesign documentation ([`6c6d6b2`](https://github.com/msyamsudin/velopulse-dashboard/commit/6c6d6b2f02de5a94bd20d2ce77c96b8ab9a1f941))
- Simplify workout history localStorage fallback ([`058481f`](https://github.com/msyamsudin/velopulse-dashboard/commit/058481fbe7be7c36034474c3dcee059ab8c20aa0))
- Start heart rate recovery measurement immediately ([`f2b8caf`](https://github.com/msyamsudin/velopulse-dashboard/commit/f2b8cafe6b8ec0933ee36bb881fd5200d40b160d))
- Swap distance and cadence metrics in recording cockpit ([`e585eff`](https://github.com/msyamsudin/velopulse-dashboard/commit/e585eff6b7ab54bec7d5a6f5b7e382bcdbaa9f04))
- Tambah insight latihan otomatis ([`13d3437`](https://github.com/msyamsudin/velopulse-dashboard/commit/13d3437086903ba3e244c449e000390fa3552a26))
- Tambah pencarian dan grup history ([`f0fe32a`](https://github.com/msyamsudin/velopulse-dashboard/commit/f0fe32afa8d43d0972527be92858be2e4a518b12))
- Tambah personal best klik dan ekspor PDF ringkasan ([`26ef01f`](https://github.com/msyamsudin/velopulse-dashboard/commit/26ef01f23ab9ffbe7180af5f38e46d6c1d8d3a87))
- Tambah rekor dan export ringkasan ([`663ff68`](https://github.com/msyamsudin/velopulse-dashboard/commit/663ff684a845fce2326f0f62ffdc1e9fa4a504f2))
- Throttle active session persistence ([`800c9bf`](https://github.com/msyamsudin/velopulse-dashboard/commit/800c9bfe61b0eb66bcaba63bbed1d6c02193798b))
- Update HistorySummary component layout and improve UI elements ([`55e49c9`](https://github.com/msyamsudin/velopulse-dashboard/commit/55e49c970d88a76e824e213a80754dc93a19ca51))

<!-- 113 commit(s) scanned, 1 merge/revert/release skipped, 0 hidden behind --include-internal. -->
