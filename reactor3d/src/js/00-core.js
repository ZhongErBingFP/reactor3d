/* ============================================================
   CORE//07 — 3D audio-reactive control rod matrix
   Core setup, shared state and utilities
   ============================================================ */

const $ = (id) => document.getElementById(id);
const dom = {
  canvas: $('scene'),
  boot: $('boot'),
  bootFill: $('bootFill'),
  bootPct: $('bootPct'),
  status: $('systemStatus'),
  statusText: $('statusText'),
  statusSub: $('statusSub'),
  rodCount: $('rodCount'),
  exciteValue: $('exciteValue'),
  liftValue: $('liftValue'),
  gaugeFill: $('gaugeFill'),
  gaugeText: $('gaugeText'),
  sourceState: $('sourceState'),
  scope: $('scope'),
  bandBars: Array.from(document.querySelectorAll('.band')),
  igniteHint: $('igniteHint'),
  igniteBtn: $('igniteBtn'),
  dock: $('dock'),
  trackArt: $('trackArt'),
  artGrid: $('artGrid'),
  sourceLabel: $('sourceLabel'),
  trackSpec: $('trackSpec'),
  trackTitle: $('trackTitle'),
  playBtn: $('playBtn'),
  timeLabel: $('timeLabel'),
  durationLabel: $('durationLabel'),
  seek: $('seek'),
  seekFill: $('seekFill'),
  seekHead: $('seekHead'),
  seekBuffer: $('seekBuffer'),
  playState: $('playState'),
  seekTip: $('seekTip'),
  fileInput: $('fileInput'),
  audio: $('audio'),
  fileBtn: $('fileBtn'),
  systemBtn: $('systemBtn'),
  micBtn: $('micBtn'),
  demoBtn: $('demoBtn'),
  muteBtn: $('muteBtn'),
  volume: $('volume'),
  volumeText: $('volumeText'),
  volumePop: $('volumePop'),
  volumeSliders: Array.from(document.querySelectorAll('.volume-range')),
  volumeReadouts: Array.from(document.querySelectorAll('[data-vol-readout]')),
  helpBtn: $('helpBtn'),
  fullBtn: $('fullBtn'),
  helpLayer: $('helpLayer'),
  helpTitle: $('helpTitle'),
  helpGrid: $('helpGrid'),
  helpFootText: $('helpFootText'),
  helpClose: $('helpClose'),
  helpDemo: $('helpDemo'),
  sourceLayer: $('sourceLayer'),
  sourceTitle: $('sourceTitle'),
  sourceIntro: $('sourceIntro'),
  sourceSystemBtn: $('sourceSystemBtn'),
  sourceSystemTitle: $('sourceSystemTitle'),
  sourceSystemSub: $('sourceSystemSub'),
  sourceBuiltinBtn: $('sourceBuiltinBtn'),
  sourceBuiltinTitle: $('sourceBuiltinTitle'),
  sourceBuiltinSub: $('sourceBuiltinSub'),
  sourceLocalBtn: $('sourceLocalBtn'),
  sourceLocalTitle: $('sourceLocalTitle'),
  sourceLocalSub: $('sourceLocalSub'),
  sourceWebNote: $('sourceWebNote'),
  sourceAppsLabel: $('sourceAppsLabel'),
  sourceRefresh: $('sourceRefresh'),
  sourceRefreshText: $('sourceRefreshText'),
  sourceList: $('sourceList'),
  sourceNote: $('sourceNote'),
  sourceClose: $('sourceClose'),
  langBtn: $('langBtn'),
  langBtnText: $('langBtnText'),
  langWipe: $('langWipe'),
  sensitivitySliders: Array.from(document.querySelectorAll('.sens-slider')),
  sensReadouts: Array.from(document.querySelectorAll('[data-sens-readout]')),
  dropLayer: $('dropLayer'),
  toast: $('toast')
};

const I18N = {
  zh: {
    brandTag: '核反应堆 · 控制棒阵列',
    heroKicker: 'CONTROL ROD MATRIX / UNIT 07',
    title1: '控制棒',
    title2: '矩阵',
    heroLede: '让音乐进入堆芯，<br>控制棒阵列跃动成频谱。',
    specRods: '控制棒 / RODS',
    specBands: '频段响应 / BANDS',
    specLive: '实时渲染 / LIVE',
    legendCeramic: '陶瓷 / 反射层',
    legendAbsorber: '吸收体',
    legendModerator: '慢化体',
    disclaimer: '艺术可视化 · 非工程仿真',
    telemetryTitle: '堆芯遥测',
    excitationLabel: '声能激励 / EXCITATION',
    sensitivity: '灵敏度',
    sensitivityShort: '灵敏',
    playbackVolume: '播放音量',
    volumeShort: '音量',
    volumeNote: '控制内置 / 本地音乐与演示音量；系统声音请在原播放器中调节',
    avgLift: '平均棒位',
    igniteTitle: '选择音频',
    igniteSub: '系统声音 / 程序声音 / 内置音乐 / 本地文件',
    igniteTitleDesktop: '选择系统音频或程序音频',
    igniteSubDesktop: 'SYSTEM AUDIO / APPLICATION AUDIO / BUILT-IN MUSIC',
    shortcutPlay: '<kbd>SPACE</kbd> 播放 / 暂停',
    shortcutSystem: '<kbd>S</kbd> 电脑声音',
    shortcutHide: '<kbd>H</kbd> 隐藏界面',
    shortcutReset: '<kbd>R</kbd> 重置视角',
    shortcutOrbit: '拖拽旋转 · 滚轮缩放',
    defaultSpec: '音频驱动 / AUDIO REACTIVE',
    actionImport: '导入音乐',
    actionSystem: '电脑声音',
    actionMic: '麦克风',
    actionDemo: '演示节拍',
    actionImportTitle: '导入本地音乐',
    actionSystemTitle: '选择系统声音，或只捕获某一个程序',
    actionMicTitle: '使用麦克风采集环境声音',
    actionDemoTitle: '播放内置演示节拍',
    actionStopSystem: '停止捕获',
    actionStopMic: '关闭麦克风',
    actionPauseDemo: '暂停演示',
    actionResumeDemo: '继续演示',
    playLabel: '播放',
    pauseLabel: '暂停',
    close: '关闭',
    helpTitle: '反应堆操作台',
    helpFoot: '无需联网 · Three.js 本地渲染',
    helpDemo: '播放演示节拍',
    help1Title: '接入音乐',
    help1Body: '把 MP3 / WAV / M4A 拖入页面，或点击「导入音乐」。音乐只在本机浏览器内处理，不会上传。',
    help2Title: '电脑正在播放的声音',
    help2BodyDesktop: '点击「电脑声音」，然后直接选择「系统声音」或列表中的某个程序。桌面版通过 WASAPI 捕获，不需要共享屏幕。',
    help2BodyWeb: '点击「电脑声音」。在浏览器弹窗中选择<strong>「整个屏幕」</strong>，并勾选<strong>「分享系统音频」</strong>，再点「共享」。',
    help3Title: '现场收音',
    help3Body: '点击「麦克风」采集环境声。浏览器要求安全来源，直接双击打开时可能不可用，建议通过本地服务器访问；也可以启用「立体声混音」。',
    help4Title: '观察堆芯',
    help4Body: '控制棒从堆芯中心向外对应不同频率：中心响应低频，外圈响应高频；鼓点会让中心低频棒明显跃起。右下角灵敏度滑块可以直接控制棒位振幅。',
    help5Title: '视角与快捷键',
    help5Body: '<kbd>SPACE</kbd> 播放 / 暂停 · <kbd>S</kbd> 电脑声音 · <kbd>H</kbd> 隐藏界面 · <kbd>R</kbd> 重置视角。拖拽旋转，滚轮缩放。',
    help6Title: '隐私',
    help6Body: '音频分析全部在本机完成。桌面版的 WASAPI 采集不读取屏幕画面；网页版即使请求屏幕共享，也只使用音频轨道。',
    sourceTitle: '选择音频来源',
    sourceIntro: '选择内置音乐、整台电脑的声音，或只捕获某一个程序。',
    sourceSystemTitle: '系统声音',
    sourceSystemSub: '捕获整个 Windows 音频输出',
    sourceBuiltinTitle: '内置音乐',
    sourceBuiltinSub: '朋友的酒 DJ · M4A',
    sourceLocalTitle: '本地音乐',
    sourceLocalSub: 'MP3 / WAV / M4A',
    sourceAppsLabel: '程序声音',
    sourceRefresh: '刷新',
    sourceWebNote: '网页版不能直接列出单个程序；请使用系统声音（屏幕共享）或本地音乐。程序级捕获请使用桌面版。',
    sourceNote: '先让播放器开始播放，再刷新列表。只捕获声音，不读取屏幕画面。',
    sourceLoading: '正在读取程序列表…',
    sourceNoPrograms: '没有发现可选的程序。请先打开播放器，或直接使用「系统声音」。',
    sourceError: '无法读取程序列表，请直接使用「系统声音」。',
    sourceConnectFailed: '无法开始捕获：{error}',
    sourceAppFallback: '后台程序',
    langButton: 'EN',
    langTitle: 'Switch to English',
    helpTitleAttr: '操作说明',
    fullTitle: '全屏',
    volumeLabel: '音量',
    mute: '静音',
    unmute: '取消静音',
    statusOnline: 'SYSTEM ONLINE',
    statusStandby: 'STANDBY',
    statusAudioLocked: 'AUDIO LOCKED',
    statusReactive: 'REACTIVE',
    statusTrackArmed: 'TRACK ARMED',
    statusPaused: 'PAUSED',
    statusDemoSignal: 'DEMO SIGNAL',
    statusDemoPaused: 'DEMO PAUSED',
    statusMicInput: 'MIC INPUT',
    statusMicPaused: 'MIC PAUSED',
    statusSystemAudio: 'SYSTEM AUDIO',
    statusAppAudio: 'APP AUDIO',
    statusLive: 'LIVE',
    trackIdle: '等待音轨接入',
    trackDemo: '堆芯脉冲 · CORE PULSE',
    trackMic: '现场声场 · LIVE ROOM',
    trackSystem: '电脑音频 · DESKTOP AUDIO',
    trackApp: '{name} · APP AUDIO',
    specLocal: '本地音频 · AUDIO REACTIVE',
    localPlayback: '本地播放',
    builtinPlayback: '内置音乐',
    specDemo: '112 BPM · A MINOR · 4/4',
    specMic: 'MICROPHONE INPUT · NO MONITOR',
    specSystem: 'WINDOWS LOOPBACK · LIVE',
    specApp: 'APPLICATION CAPTURE · LIVE',
    playStateIdle: '已暂停 / STANDBY',
    playStateFilePlaying: '正在播放 / PLAYING',
    playStateFilePaused: '已暂停 / PAUSED',
    playStateDemoPlaying: '内置合成 / PLAYING',
    playStateDemoPaused: '内置合成 / PAUSED',
    playStateMicPlaying: '实时监听 / LISTENING',
    playStateMicPaused: '监听暂停 / PAUSED',
    playStateSystemPlaying: '正在分析 / LISTENING',
    playStateSystemPaused: '分析暂停 / PAUSED',
    seekTipIdle: '拖入音乐，或点击「电脑声音」捕获电脑播放的音频',
    seekTipFilePlaying: '空格暂停 · 拖拽跳转',
    seekTipFilePaused: '空格继续 · 拖拽跳转',
    seekTipDemoPlaying: '空格暂停 · 点击进度切换段落',
    seekTipDemoPaused: '空格继续',
    seekTipMic: '麦克风不会外放，只用于驱动画面',
    seekTipSystem: '正在捕获电脑播放的声音 · 不读取屏幕画面',
    sourceStateIdle: '等待音源接入 / STANDBY',
    sourceStateFilePlaying: '本地音轨 / REACTIVE',
    sourceStateFilePaused: '音轨已载入 / ARMED',
    sourceStateBuiltin: '内置音乐 / BUILT-IN',
    sourceStateDemoPlaying: '演示节拍 / 112 BPM',
    sourceStateDemoPaused: '演示已暂停 / PAUSED',
    sourceStateMicPlaying: '现场声场 / MICROPHONE',
    sourceStateMicPaused: '麦克风已暂停 / PAUSED',
    sourceStateSystem: '电脑声音 / SYSTEM AUDIO',
    sourceStateApp: '程序音频 / {name}',
    sourceStateSystemPaused: '电脑声音已暂停 / PAUSED',
    sourceStateAppPaused: '程序音频已暂停 / {name}',
    sourceSystemLabel: 'SYSTEM AUDIO',
    sourceAppLabel: 'APP AUDIO',
    sourceLocalLabel: 'LOCAL FILE',
    sourceBuiltinLabel: '内置音轨',
    sourceGeneratedLabel: 'GENERATED SIGNAL',
    sourceLiveLabel: 'LIVE INPUT',
    dropTitle: '松开以接入音轨',
    dropSub: 'DROP AUDIO TO IGNITE THE CORE',
    bootLabel: '校准控制棒阵列',
    title: '控制棒矩阵 · AUDIO REACTIVE CORE',
    toastAudioUnsupported: '这不是可识别的音频文件。请选择 MP3 / WAV / M4A / OGG。',
    toastFileLarge: '文件超过 150 MB，浏览器可能无法流畅解码。',
    toastAutoplayBlocked: '音乐已载入，但浏览器阻止了自动播放。请再点一次播放键。',
    toastCantPlay: '无法播放这首音频，请尝试其他格式。',
    toastDecodeFailed: '音频解码失败，请换一个 MP3 / WAV / M4A 文件。',
    toastPlaybackEnded: '音轨播放结束 · 堆芯正在冷却',
    toastMuted: '已静音 · 堆芯仍会跟随音乐',
    toastUnmuted: '声音已恢复',
    toastDemoStarted: '演示节拍已启动 · 112 BPM',
    toastMicRequest: '正在请求麦克风权限…',
    toastMicUnsupported: '此浏览器不支持麦克风采集。请尝试导入音乐文件。',
    toastMicDenied: '无法访问麦克风。请允许权限；直接双击 HTML 打开时可能被限制，建议通过本地服务器访问。',
    toastMicNotFound: '无法访问麦克风。没有找到可用麦克风。',
    toastMicFailed: '无法访问麦克风。',
    toastMicConnected: '麦克风已接入 · 拍手或说话，让堆芯跳动',
    toastMicClosed: '麦克风已关闭',
    toastSystemSelect: '请在弹窗中选择「整个屏幕」，并勾选「分享系统音频」',
    toastSystemCancelled: '已取消共享。点击「电脑声音」可重新选择。',
    toastSystemUnsupported: '当前浏览器或系统不支持系统音频捕获，请使用桌面版或最新版 Chrome / Edge。',
    toastSystemFailed: '无法捕获电脑声音，请改用导入音乐或麦克风。',
    toastNoAudioTrack: '没有捕获到音频轨道。请重试，并在共享弹窗中选择「整个屏幕」、勾选「分享系统音频」。',
    toastSystemConnected: '已接入电脑声音 · 正在分析系统音频',
    toastSystemStopped: '电脑声音捕获已停止',
    toastSystemShareStopped: '电脑声音共享已停止',
    toastAudioSuspended: '浏览器暂停了音频引擎 · 点按页面任意处即可启用声音',
    toastViewReset: '视角已重置',
    toastFullscreenDenied: '此环境不允许进入全屏。',
    toastWebglLost: 'WebGL 上下文丢失，请刷新页面重新启动。',
    toastNoWebAudio: '当前浏览器不支持 Web Audio，无法分析音乐。',
    toastDropAudio: '这里只接受音频文件：MP3 / WAV / M4A / OGG / FLAC。',
    toastBuiltinMissing: '内置音乐数据缺失，请重新构建或导入本地文件。',
    toastBuiltinFailed: '内置音乐无法播放，请尝试导入本地文件。',
    toastBuiltinLoading: '正在载入内置音乐 · 朋友的酒 DJ'
  },
  en: {
    brandTag: 'NUCLEAR REACTOR · CONTROL ROD ARRAY',
    heroKicker: 'CONTROL ROD MATRIX / UNIT 07',
    title1: 'CONTROL',
    title2: 'ROD MATRIX',
    heroLede: 'Feed music into the core.<br>The control rods become the spectrum.',
    specRods: 'CONTROL RODS',
    specBands: 'FREQUENCY BANDS',
    specLive: 'REAL-TIME / LIVE',
    legendCeramic: 'CERAMIC / REFLECTOR',
    legendAbsorber: 'ABSORBER',
    legendModerator: 'MODERATOR',
    disclaimer: 'ART VISUALIZATION · NOT AN ENGINEERING MODEL',
    telemetryTitle: 'REACTOR',
    excitationLabel: 'ACOUSTIC EXCITATION',
    sensitivity: 'SENSITIVITY',
    sensitivityShort: 'SENS',
    playbackVolume: 'PLAYBACK VOLUME',
    volumeShort: 'VOL',
    volumeNote: 'Controls built-in / local / demo audio. Adjust system audio in its source player.',
    avgLift: 'AVERAGE ROD LIFT',
    igniteTitle: 'SELECT AUDIO',
    igniteSub: 'SYSTEM / APPLICATION / BUILT-IN / LOCAL FILE',
    igniteTitleDesktop: 'SELECT SYSTEM AUDIO OR APP AUDIO',
    igniteSubDesktop: 'SYSTEM AUDIO / APPLICATION AUDIO / BUILT-IN MUSIC',
    shortcutPlay: '<kbd>SPACE</kbd> Play / Pause',
    shortcutSystem: '<kbd>S</kbd> System audio',
    shortcutHide: '<kbd>H</kbd> Hide interface',
    shortcutReset: '<kbd>R</kbd> Reset view',
    shortcutOrbit: 'Drag to orbit · Scroll to zoom',
    defaultSpec: 'AUDIO REACTIVE',
    actionImport: 'Import',
    actionSystem: 'System',
    actionMic: 'Mic',
    actionDemo: 'Demo',
    actionImportTitle: 'Import a local audio file',
    actionSystemTitle: 'Choose system audio or a single application',
    actionMicTitle: 'Capture room sound with the microphone',
    actionDemoTitle: 'Play the built-in demo beat',
    actionStopSystem: 'Stop audio',
    actionStopMic: 'Stop mic',
    actionPauseDemo: 'Pause demo',
    actionResumeDemo: 'Resume demo',
    playLabel: 'Play',
    pauseLabel: 'Pause',
    close: 'Close',
    helpTitle: 'REACTOR CONSOLE',
    helpFoot: 'OFFLINE · THREE.JS LOCAL RENDER',
    helpDemo: 'PLAY DEMO',
    help1Title: 'Import audio',
    help1Body: 'Drop an MP3 / WAV / M4A onto the page, or click Import. Audio is analyzed locally and never uploaded.',
    help2Title: 'System or app audio',
    help2BodyDesktop: 'Click System, then pick the whole system or one running application. The desktop build captures through WASAPI and needs no screen sharing.',
    help2BodyWeb: 'Click System, choose <strong>Entire Screen</strong>, enable <strong>Share system audio</strong>, then click Share.',
    help3Title: 'Microphone',
    help3Body: 'Capture room sound with your microphone. Browsers may require localhost or HTTPS. Stereo Mix is another fallback.',
    help4Title: 'Watch the core',
    help4Body: 'Control rods map frequencies from the core centre outward: bass at the centre, treble at the edge. Drum hits visibly lift the inner bass rods. Use the sensitivity slider to adjust rod travel.',
    help5Title: 'View & shortcuts',
    help5Body: '<kbd>SPACE</kbd> Play / Pause · <kbd>S</kbd> System audio · <kbd>H</kbd> Hide UI · <kbd>R</kbd> Reset view. Drag to orbit, scroll to zoom.',
    help6Title: 'Privacy',
    help6Body: 'All analysis runs locally. The desktop WASAPI capture never reads screen frames; the web build uses only the audio track even when screen sharing.',
    sourceTitle: 'SELECT AUDIO SOURCE',
    sourceIntro: 'Play the built-in track, capture the whole computer, or isolate one application.',
    sourceSystemTitle: 'System Audio',
    sourceSystemSub: 'Capture the entire Windows audio output',
    sourceBuiltinTitle: 'Built-in Music',
    sourceBuiltinSub: '朋友的酒 DJ · M4A',
    sourceLocalTitle: 'Local Music',
    sourceLocalSub: 'MP3 / WAV / M4A',
    sourceAppsLabel: 'Application Audio',
    sourceRefresh: 'Refresh',
    sourceWebNote: 'The web build cannot list individual applications. Use System Audio (screen share) or Local Music. Use the desktop build for per-application capture.',
    sourceNote: 'Start playback first, then refresh. Audio only — no screen frames are read.',
    sourceLoading: 'Reading running applications…',
    sourceNoPrograms: 'No applications found. Start your player first, or use System Audio.',
    sourceError: 'Could not read the application list. Use System Audio instead.',
    sourceConnectFailed: 'Could not start capture: {error}',
    sourceAppFallback: 'Background app',
    langButton: '中',
    langTitle: '切换到中文',
    helpTitleAttr: 'Operation manual',
    fullTitle: 'Fullscreen',
    volumeLabel: 'Volume',
    mute: 'Mute',
    unmute: 'Unmute',
    statusOnline: 'SYSTEM ONLINE',
    statusStandby: 'STANDBY',
    statusAudioLocked: 'AUDIO LOCKED',
    statusReactive: 'REACTIVE',
    statusTrackArmed: 'TRACK ARMED',
    statusPaused: 'PAUSED',
    statusDemoSignal: 'DEMO SIGNAL',
    statusDemoPaused: 'DEMO PAUSED',
    statusMicInput: 'MIC INPUT',
    statusMicPaused: 'MIC PAUSED',
    statusSystemAudio: 'SYSTEM AUDIO',
    statusAppAudio: 'APP AUDIO',
    statusLive: 'LIVE',
    trackIdle: 'WAITING FOR AUDIO',
    trackDemo: 'CORE PULSE · DEMO',
    trackMic: 'LIVE ROOM',
    trackSystem: 'DESKTOP AUDIO',
    trackApp: '{name} · APP AUDIO',
    specLocal: 'LOCAL AUDIO · AUDIO REACTIVE',
    localPlayback: 'LOCAL PLAYBACK',
    builtinPlayback: 'BUILT-IN',
    specDemo: '112 BPM · A MINOR · 4/4',
    specMic: 'MICROPHONE INPUT · NO MONITOR',
    specSystem: 'WINDOWS LOOPBACK · LIVE',
    specApp: 'APPLICATION CAPTURE · LIVE',
    playStateIdle: 'PAUSED / STANDBY',
    playStateFilePlaying: 'PLAYING',
    playStateFilePaused: 'PAUSED',
    playStateDemoPlaying: 'SYNTH LOOP / PLAYING',
    playStateDemoPaused: 'SYNTH LOOP / PAUSED',
    playStateMicPlaying: 'LISTENING',
    playStateMicPaused: 'PAUSED',
    playStateSystemPlaying: 'LISTENING',
    playStateSystemPaused: 'PAUSED',
    seekTipIdle: 'Drop a track, or click System to capture desktop audio',
    seekTipFilePlaying: 'SPACE to pause · drag to seek',
    seekTipFilePaused: 'SPACE to continue · drag to seek',
    seekTipDemoPlaying: 'SPACE to pause · click the bar to jump',
    seekTipDemoPaused: 'SPACE to continue',
    seekTipMic: 'Microphone is analyzed, never monitored',
    seekTipSystem: 'Capturing desktop audio · screen frames are not read',
    sourceStateIdle: 'WAITING FOR INPUT / STANDBY',
    sourceStateFilePlaying: 'LOCAL TRACK / REACTIVE',
    sourceStateFilePaused: 'TRACK LOADED / ARMED',
    sourceStateBuiltin: 'BUILT-IN MUSIC / LOCAL',
    sourceStateDemoPlaying: 'DEMO BEAT / 112 BPM',
    sourceStateDemoPaused: 'DEMO PAUSED / STANDBY',
    sourceStateMicPlaying: 'LIVE ROOM / MICROPHONE',
    sourceStateMicPaused: 'MICROPHONE PAUSED',
    sourceStateSystem: 'DESKTOP AUDIO / SYSTEM',
    sourceStateApp: 'APP AUDIO / {name}',
    sourceStateSystemPaused: 'DESKTOP AUDIO PAUSED',
    sourceStateAppPaused: 'APP AUDIO PAUSED / {name}',
    sourceSystemLabel: 'SYSTEM AUDIO',
    sourceAppLabel: 'APP AUDIO',
    sourceLocalLabel: 'LOCAL FILE',
    sourceBuiltinLabel: 'BUILT-IN',
    sourceGeneratedLabel: 'GENERATED SIGNAL',
    sourceLiveLabel: 'LIVE INPUT',
    dropTitle: 'DROP TO CONNECT AUDIO',
    dropSub: 'DROP AUDIO TO IGNITE THE CORE',
    bootLabel: 'CALIBRATING CORE ARRAY',
    title: 'CONTROL ROD MATRIX · AUDIO REACTIVE CORE',
    toastAudioUnsupported: 'Unsupported audio file. Choose MP3 / WAV / M4A / OGG.',
    toastFileLarge: 'File is over 150 MB and may not decode smoothly.',
    toastAutoplayBlocked: 'Track loaded, but the browser blocked autoplay. Press Play again.',
    toastCantPlay: 'Could not play this audio. Try another format.',
    toastDecodeFailed: 'Audio decoding failed. Try another MP3 / WAV / M4A file.',
    toastPlaybackEnded: 'Track ended · the core is cooling down',
    toastMuted: 'Muted · the core still follows the music',
    toastUnmuted: 'Sound restored',
    toastDemoStarted: 'Demo beat started · 112 BPM',
    toastMicRequest: 'Requesting microphone permission…',
    toastMicUnsupported: 'Microphone capture is not supported in this browser. Import a track instead.',
    toastMicDenied: 'Microphone access denied. Allow permission; file:// pages may be restricted, so try localhost.',
    toastMicNotFound: 'No microphone was found.',
    toastMicFailed: 'Could not access the microphone.',
    toastMicConnected: 'Microphone connected · clap or speak to drive the core',
    toastMicClosed: 'Microphone closed',
    toastSystemSelect: 'Choose Entire Screen and enable Share system audio in the popup',
    toastSystemCancelled: 'Sharing cancelled. Click System to choose again.',
    toastSystemUnsupported: 'System audio capture is not supported here. Use the desktop build or the latest Chrome / Edge.',
    toastSystemFailed: 'Could not capture desktop audio. Import a track or use the microphone.',
    toastNoAudioTrack: 'No audio track was shared. Retry and choose Entire Screen with system audio enabled.',
    toastSystemConnected: 'Desktop audio connected · analyzing system sound',
    toastSystemStopped: 'Desktop audio capture stopped',
    toastSystemShareStopped: 'Desktop audio sharing stopped',
    toastAudioSuspended: 'Audio engine paused · click anywhere to enable sound',
    toastViewReset: 'View reset',
    toastFullscreenDenied: 'Fullscreen is not available in this environment.',
    toastWebglLost: 'WebGL context lost. Refresh to restart the reactor.',
    toastNoWebAudio: 'This browser does not support Web Audio.',
    toastDropAudio: 'Audio files only: MP3 / WAV / M4A / OGG / FLAC.',
    toastBuiltinMissing: 'Built-in audio data is missing. Rebuild or import a local file.',
    toastBuiltinFailed: 'Could not play the built-in track. Try importing a local file.',
    toastBuiltinLoading: 'Loading built-in track · 朋友的酒 DJ'
  }
};

function getSavedLanguage() {
  try {
    const saved = localStorage.getItem('core07.lang');
    return saved === 'en' ? 'en' : 'zh';
  } catch (err) {
    return 'zh';
  }
}

function getSavedSensitivity() {
  try {
    const n = Number(localStorage.getItem('core07.sensitivity'));
    return Number.isFinite(n) && n >= 0.3 && n <= 2.5 ? n : 1;
  } catch (err) {
    return 1;
  }
}

function t(key, vars) {
  const table = I18N[appState.lang] || I18N.zh;
  let value = table[key];
  if (value === undefined) value = I18N.zh[key];
  if (value === undefined) return key;
  if (vars) {
    value = value.replace(/\{(\w+)\}/g, (match, name) => (vars[name] !== undefined ? vars[name] : match));
  }
  return value;
}

const desktopBridge = window.desktopAPI && window.desktopAPI.listAudioSources ? window.desktopAPI : null;

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (current, target, rate, dt) => lerp(current, target, 1 - Math.exp(-rate * dt));
const isFinitePositive = (n) => typeof n === 'number' && isFinite(n) && n > 0;
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function formatTime(seconds) {
  if (!isFinitePositive(seconds)) return '--:--';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

function cleanTrackName(name) {
  return String(name || '未知音轨')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 120) || '未知音轨';
}

function hash11(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function hash21(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function isAudioFile(file) {
  if (!file) return false;
  if (file.type && file.type.indexOf('audio/') === 0) return true;
  return /\.(mp3|wav|m4a|aac|ogg|oga|flac|opus)$/i.test(file.name || '');
}

const appState = {
  ready: false,
  fatal: null,
  active: null,           // 'file' | 'demo' | 'mic' | 'system' | null
  playing: false,
  muted: false,
  volume: 0.65,
  sensitivity: getSavedSensitivity(),
  lang: getSavedLanguage(),
  langAnimating: false,
  mockEnergy: null,
  mockStart: 0,
  seekDragging: false,
  helpOpen: false,
  sourcePickerOpen: false,
  fileFormat: '',
  fileIsBuiltin: false,
  systemKind: null,
  systemName: '',
  lastUIUpdate: 0,
  lastBeatAt: -10,
  beatCount: 0,
  fps: 60,
  startedAt: performance.now()
};

const audioMix = {
  bass: 0,
  low: 0,
  mid: 0,
  high: 0,
  level: 0,
  beat: 0,
  rawBass: 0,
  bpm: 0
};

const view = {
  yaw: 0,
  pitch: THREE.MathUtils.degToRad(37.5),
  userYaw: 0,
  userPitch: 0,
  zoom: 1,
  dist: 27,
  fitDist: 27,
  targetDist: 27,
  pointerX: 0,
  pointerY: 0,
  dragging: false,
  lastX: 0,
  lastY: 0,
  intro: 1,
  cameraY: 1
};

const clock = new THREE.Clock();
const tempMatrix = new THREE.Matrix4();
const tempVec = new THREE.Vector3();

let renderer = null;
let scene = null;
let camera = null;
let pmrem = null;
let envRT = null;
let canvasWidth = 1;
let canvasHeight = 1;
let globalTime = 0;
let frameCount = 0;
let fpsTimer = 0;
let fpsFrames = 0;
let toastTimer = 0;
let artTimer = 0;

const world = {
  coreGroup: null,
  rodGroups: [],
  dotMesh: null,
  socketMesh: null,
  amberBulbs: null,
  rimGlowMats: [],
  glowMats: [],
  dust: null,
  embers: null,
  emberData: [],
  coreGlow: null,
  coreHalo: null,
  ringLineMat: null,
  dotMat: null,
  rods: [],
  gridRadius: 7.54,
  rodCount: 0,
  socketTop: 0.21
};

try {
  renderer = new THREE.WebGLRenderer({
    canvas: dom.canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.74;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x050706, 1);
} catch (err) {
  appState.fatal = err;
  renderer = null;
}

scene = new THREE.Scene();
scene.background = new THREE.Color(0x050706);
scene.fog = new THREE.FogExp2(0x050706, 0.018);

camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 160);
camera.position.set(0, 17, 22);
camera.lookAt(0, 0.5, 0);

if (renderer) {
  pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
}

function showFatal(message) {
  appState.fatal = message;
  if (dom.boot) {
    dom.boot.classList.remove('done');
    const label = dom.boot.querySelector('.boot-label');
    const pct = dom.boot.querySelector('.boot-pct');
    if (label) label.textContent = message || '当前浏览器无法启用 WebGL';
    if (pct) pct.textContent = '';
  }
}
