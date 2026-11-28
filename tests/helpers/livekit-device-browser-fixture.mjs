import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const require = createRequire(import.meta.url);

/** Bundle installed LiveKit controls and application styles; only device discovery is synthetic. */
export function livekitDeviceBrowserFixture() {
  const aliases = Object.fromEntries(['react', 'react-dom', 'react-dom/client', 'scheduler'].map((name) => {
    const packageName = name === 'react-dom/client' ? 'react-dom' : name;
    const filename = name === 'react-dom/client' ? 'react-dom-client' : name;
    return [name, resolve(dirname(require.resolve(packageName)), `cjs/${filename}.production.js`)];
  }));
  const modules = {};
  const visit = (path) => {
    if (modules[path]) return path;
    let code = readFileSync(path, 'utf8');
    if (/\.tsx?$/.test(path)) {
      code = ts.transpileModule(code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
      }).outputText;
    }
    modules[path] = { code, dependencies: {} };
    for (const [, , name] of code.matchAll(/require\((['"])([^'"]+)\1\)/g)) {
      const localPath = name.startsWith('.') ? resolve(dirname(path), name) : undefined;
      const sourcePath = localPath && ['.tsx', '.ts'].map(extension => `${localPath}${extension}`).find(candidate => existsSync(candidate));
      const dependency = aliases[name] ?? sourcePath ?? require.resolve(name, { paths: [dirname(path)] });
      assert.ok(!dependency.startsWith('node:'), `Unexpected browser dependency: ${name}`);
      modules[path].dependencies[name] = visit(dependency);
    }
    return path;
  };
  const reactId = visit(aliases.react);
  const clientId = visit(aliases['react-dom/client']);
  const livekitId = visit(require.resolve('@livekit/components-react'));
  const transportId = visit(require.resolve('livekit-client'));
  const stylesId = visit(resolve('app/room/[room]/components/shared/LiveKitStyles.tsx'));
  const factories = Object.entries(modules).map(([id, value]) => `${JSON.stringify(id)}: function(module, exports, require) { ${value.code}\n }`).join(',');
  const dependencies = Object.fromEntries(Object.entries(modules).map(([id, value]) => [id, value.dependencies]));
  return `
    window.process = { env: { NODE_ENV: 'production' } };
    const factories = {${factories}};
    const dependencies = ${JSON.stringify(dependencies)};
    const cache = {};
    function load(id) {
      if (cache[id]) return cache[id].exports;
      const module = cache[id] = { exports: {} };
      factories[id](module, module.exports, name => load(dependencies[id][name]));
      return module.exports;
    }
    const React = load(${JSON.stringify(reactId)});
    const { ControlBar, RoomContext } = load(${JSON.stringify(livekitId)});
    const { Room } = load(${JSON.stringify(transportId)});
    const Styles = load(${JSON.stringify(stylesId)}).default;
    const devices = [
      {kind: 'audioinput', deviceId: 'mic-one', groupId: 'audio', label: 'Built-in microphone'},
      {kind: 'audioinput', deviceId: 'mic-two', groupId: 'audio', label: 'USB conference microphone with a long descriptive device name'},
      {kind: 'videoinput', deviceId: 'camera-one', groupId: 'video', label: 'Built-in camera'},
      {kind: 'videoinput', deviceId: 'camera-two', groupId: 'video', label: 'External camera with a long descriptive device name'},
    ];
    Room.getLocalDevices = async (kind) => devices.filter(device => !kind || device.kind === kind);
    const room = new Room();
    room.localParticipant.permissions = {canPublish: true, canPublishData: true, canPublishSources: [], canSubscribe: true, canUpdateMetadata: false, hidden: false, recorder: false};
    window.syntheticRoom = room;
    load(${JSON.stringify(clientId)}).createRoot(document.getElementById('root')).render(
      React.createElement(RoomContext.Provider, {value: room},
        React.createElement(Styles),
        React.createElement('div', {className: 'lk-room-container', 'data-lk-theme': 'default', style: {height: '100dvh', position: 'relative'}},
          React.createElement('p', {style: {padding: '2rem'}}, 'Synthetic device-control test — no consultation connected'),
          React.createElement(ControlBar, {controls: {microphone: true, camera: true, screenShare: false, chat: false, leave: false}})
        )
      )
    );
  `;
}
