# Three.js Web Engine

A lightweight, zero-build 3D engine wrapper around [Three.js](https://threejs.org/) for web projects and AI-assisted ("vibe") coding. One file, no bundler, no npm install — just open the demo or import the engine.

## Run the demo

Any static server works:

```bash
cd three-engine
npx serve .        # or: python3 -m http.server 8000
```

Then open the printed URL. The demo shows primitives, animation, picking, shadows, and an FPS counter.

## Use in your own page

Add an import map (Three.js is loaded from CDN) and import the engine:

```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
  }
}
</script>
<script type="module">
  import Engine from './src/engine.js';

  const engine = new Engine('#app');
  engine.addBox('crate', { position: [0, 0.5, 0], color: 0x6c8cff, spin: true });
</script>
```

## API

### `new Engine(container, options?)`

| Option | Default | Description |
|---|---|---|
| `background` | `0x11131a` | Scene background color |
| `fog` | `null` | e.g. `{ color: 0x11131a, range: [10, 60] }` |
| `shadows` | `true` | Soft shadow mapping |
| `grid` | `true` | Grid helper + shadow-catching ground |
| `antialias` | `true` | MSAA |
| `pixelRatio` | `min(devicePixelRatio, 2)` | Render resolution |
| `camera` | `{ fov: 60, near: 0.1, far: 2000, position: [5, 5, 8] }` | Camera config |

Sets up hemisphere + directional (shadow-casting) + fill lighting, OrbitControls with damping, and a delta-time render loop. Handles window resize automatically.

### Primitives

All return the added `THREE.Mesh`:

```js
engine.addBox('crate', { size: [1, 2, 1], color, position: [x, y, z], spin: true });
engine.addSphere('orb', { radius: 1, ... });
engine.addCylinder('pipe', { radiusTop, radiusBottom, height, ... });
engine.addTorus('ring', { radius, tube, ... });
engine.addCone('spike', { radius, height, ... });
engine.addPlane('floor', { size: [w, h], ... });
```

`spin: true` registers a per-frame rotation via the update loop.

### Loading models

```js
const model = await engine.loadGLTF('model.glb', { name: 'hero', scale: 2, position: [0, 0, 0] });
const obj = await engine.loadOBJ('model.obj', { name: 'prop', material: myMaterial });
```

Loaded meshes automatically cast/receive shadows.

### Scene management

```js
engine.add(object, 'name');      // add any THREE.Object3D
engine.remove('name');           // remove + dispose geometry/materials
engine.get('name');              // lookup
engine.addGrid(size, divisions); // grid + ground
```

### Per-frame updates

```js
const off = engine.onUpdate((dt, elapsedTime) => {
  mesh.position.y = Math.sin(elapsedTime) * 0.5;
});
off(); // unregister
```

### Picking (raycasting)

```js
engine.onPick = (hit, allHits, event) => { ... };   // pointerdown
engine.onHover = (hit, allHits, event) => { ... };  // pointermove
const hits = engine.raycast(clientX, clientY);      // manual
```

Grid and ground are excluded from raycasts.

### Utilities

```js
engine.screenshot('scene.png'); // downloads a PNG
engine.fps;                     // smoothed FPS number
engine.dispose();               // stop loop, dispose GPU resources
```

## Files

- `src/engine.js` — the engine (~300 lines, single class, no dependencies beyond Three.js)
- `index.html` — demo scene
