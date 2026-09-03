// 播放器容器、进度与音量倍速控件。
// 自 web/editor/ui/elements.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweElements；
// 兼容出口 window.MaweDom 仍由 editor/ui/elements/compat-surface.js 统一组装。
(function initMaweElementsPlayer(global) {
  'use strict';

  const U = global.MaweElements;


  const playerEmpty = document.getElementById('player-empty');


  const playerWrap = document.querySelector('.player-wrap');


  const mediaPlayToggle = document.getElementById('media-play-toggle');


  const mediaStepBack = document.getElementById('media-step-back');


  const mediaStepForward = document.getElementById('media-step-forward');


  const mediaSeekStepInput = document.getElementById('media-seek-step');


  let mediaSeekInputLastValue = MaweSettings.EDITOR_SETTINGS.mediaSeekStepMs;


  const mediaCurrentTime = document.getElementById('media-current-time');


  const mediaDuration = document.getElementById('media-duration');


  const mediaSeek = document.getElementById('media-seek');


  const mediaVolume = document.getElementById('media-volume');


  const mediaPlaybackRate = document.getElementById('media-playback-rate');


  const mediaFullscreen = document.getElementById('media-fullscreen');


  // 预览层（字幕/表情包）的定位与几何测量都以 stage 为基准，不含顶部媒体工具栏。
  const playerStage = playerWrap?.querySelector('.player-stage') || playerWrap;

  Object.assign(U, {
    playerEmpty,
    playerWrap,
    mediaPlayToggle,
    mediaStepBack,
    mediaStepForward,
    mediaSeekStepInput,
    mediaCurrentTime,
    mediaDuration,
    mediaSeek,
    mediaVolume,
    mediaPlaybackRate,
    mediaFullscreen,
    playerStage,
  });
  // mediaSeekInputLastValue 是本模块可变状态且兼容出口为它提供 setter（外部经出口赋值）：以 get/set 访问器发布，
  // 语义与拆分前整个闭包共享同一个 let 完全一致。
  Object.defineProperty(U, 'mediaSeekInputLastValue', { enumerable: true, configurable: true,
    get: () => mediaSeekInputLastValue, set: (value) => { mediaSeekInputLastValue = value; } });
})(typeof window !== 'undefined' ? window : globalThis);
