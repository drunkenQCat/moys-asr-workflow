// editor/waveform/ 的内部命名空间：各模块把自己的符号 Object.assign 到这里，
// 可变状态用访问器发布，因此跨模块读到的一定是最新值。
// 对外的兼容出口是 window.AsrWaveform，由 editor/waveform/compat-surface.js 最后一并组装；
// 新增内部符号只进 MaweWaveform，不要加进兼容出口。
(function initMaweWaveformNamespace(global) {
  'use strict';

  if (global.MaweWaveform) {
    throw new Error('MaweWaveform 必须在 editor/waveform/ 所有模块之前初始化且只初始化一次');
  }
  global.MaweWaveform = {
    // 原型混入必须逐描述符复制：Object.assign 会调用 getter 并只拷贝它的返回值，
    // 类里唯一的访问器成员会被降级成数据属性。
    defineMethods(target, methods) {
      for (const key of Reflect.ownKeys(methods)) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(methods, key));
      }
      return target;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
