import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export class Engine {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    if (!this.container) throw new Error('Engine: container not found');

    const opts = {
      background: 0x11131a,
      fog: null,
      shadows: true,
      grid: true,
      antialias: true,
      pixelRatio: Math.min(window.devicePixelRatio, 2),
      camera: { fov: 60, near: 0.1, far: 2000, position: [5, 5, 8] },
      ...options,
    };
    this.options = opts;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(opts.background);
    if (opts.fog) this.scene.fog = new THREE.Fog(opts.fog.color, ...opts.fog.range);

    this.camera = new THREE.PerspectiveCamera(
      opts.camera.fov,
      this.container.clientWidth / this.container.clientHeight,
      opts.camera.near,
      opts.camera.far
    );
    this.camera.position.set(...opts.camera.position);

    this.renderer = new THREE.WebGLRenderer({ antialias: opts.antialias });
    this.renderer.setPixelRatio(opts.pixelRatio);
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = opts.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.clock = new THREE.Clock();
    this.updatables = [];
    this.objects = new Map();
    this._fps = { frames: 0, last: performance.now(), value: 0 };
    this._disposed = false;

    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
    this._onPointerDown = (e) => this._handlePointer(e, 'down');
    this._onPointerMove = (e) => this._handlePointer(e, 'move');
    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.addEventListener('pointermove', this._onPointerMove);

    this._defaultLights();
    if (opts.grid) this.addGrid();

    this.renderer.setAnimationLoop(() => this._tick());
  }

  _defaultLights() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 0.9);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(6, 10, 4);
    if (this.options.shadows) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -20;
      sun.shadow.camera.right = 20;
      sun.shadow.camera.top = 20;
      sun.shadow.camera.bottom = -20;
    }
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x8899ff, 0.5);
    fill.position.set(-6, 4, -4);
    this.scene.add(fill);
  }

  addGrid(size = 40, divisions = 40) {
    const grid = new THREE.GridHelper(size, divisions, 0x444466, 0x2a2a3a);
    grid.name = '__grid';
    this.scene.add(grid);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 2, size * 2),
      new THREE.ShadowMaterial({ opacity: 0.25 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = '__ground';
    this.scene.add(ground);
    return grid;
  }

  add(object, name) {
    if (name) {
      object.name = name;
      this.objects.set(name, object);
    }
    this.scene.add(object);
    return object;
  }

  remove(nameOrObject) {
    const obj = typeof nameOrObject === 'string'
      ? this.objects.get(nameOrObject)
      : nameOrObject;
    if (!obj) return false;
    this.scene.remove(obj);
    obj.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        (Array.isArray(child.material) ? child.material : [child.material])
          .forEach((m) => m.dispose());
      }
    });
    if (obj.name) this.objects.delete(obj.name);
    return true;
  }

  get(name) {
    return this.objects.get(name) ?? this.scene.getObjectByName(name);
  }

  addBox(name, { size = [1, 1, 1], color = 0x6c8cff, position = [0, 0, 0], spin = false } = {}) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 })
    );
    return this._finishPrimitive(mesh, name, position, spin);
  }

  addSphere(name, { radius = 0.8, color = 0xff6c9d, position = [0, 0, 0], spin = false } = {}) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 48, 32),
      new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1 })
    );
    return this._finishPrimitive(mesh, name, position, spin);
  }

  addCylinder(name, { radiusTop = 0.5, radiusBottom = 0.5, height = 1.5, color = 0x6cffb8, position = [0, 0, 0], spin = false } = {}) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 48),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 })
    );
    return this._finishPrimitive(mesh, name, position, spin);
  }

  addTorus(name, { radius = 0.8, tube = 0.3, color = 0xffc86c, position = [0, 0, 0], spin = false } = {}) {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 32, 96),
      new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.2 })
    );
    return this._finishPrimitive(mesh, name, position, spin);
  }

  addCone(name, { radius = 0.7, height = 1.6, color = 0xb06cff, position = [0, 0, 0], spin = false } = {}) {
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(radius, height, 48),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 })
    );
    return this._finishPrimitive(mesh, name, position, spin);
  }

  addPlane(name, { size = [10, 10], color = 0x33334a, position = [0, 0, 0] } = {}) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(...size),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    return this._finishPrimitive(mesh, name, position, false);
  }

  _finishPrimitive(mesh, name, position, spin) {
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (spin) {
      this.onUpdate((dt) => {
        mesh.rotation.y += dt * 0.8;
        mesh.rotation.x += dt * 0.2;
      });
    }
    return this.add(mesh, name);
  }

  loadGLTF(url, { name, position = [0, 0, 0], scale = 1, onProgress } = {}) {
    return new Promise((resolve, reject) => {
      new GLTFLoader().load(
        url,
        (gltf) => {
          const model = gltf.scene;
          model.position.set(...position);
          model.scale.setScalar(scale);
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          this.add(model, name);
          resolve(model);
        },
        onProgress,
        reject
      );
    });
  }

  loadOBJ(url, { name, position = [0, 0, 0], scale = 1, material, onProgress } = {}) {
    return new Promise((resolve, reject) => {
      new OBJLoader().load(
        url,
        (object) => {
          object.position.set(...position);
          object.scale.setScalar(scale);
          object.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (material) child.material = material;
            }
          });
          this.add(object, name);
          resolve(object);
        },
        onProgress,
        reject
      );
    });
  }

  onUpdate(fn) {
    this.updatables.push(fn);
    return () => {
      const i = this.updatables.indexOf(fn);
      if (i !== -1) this.updatables.splice(i, 1);
    };
  }

  raycast(clientX, clientY, { recursive = true } = {}) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = this.scene.children.filter(
      (c) => c.name !== '__grid' && c.name !== '__ground'
    );
    return this.raycaster.intersectObjects(targets, recursive);
  }

  _handlePointer(event, type) {
    if (!this.onPick && type !== 'move') return;
    const hits = this.raycast(event.clientX, event.clientY);
    if (type === 'move') {
      if (this.onHover) this.onHover(hits[0] ?? null, hits, event);
    } else if (this.onPick) {
      this.onPick(hits[0] ?? null, hits, event);
    }
  }

  screenshot(filename = 'scene.png') {
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }

  get fps() {
    return this._fps.value;
  }

  _resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _tick() {
    if (this._disposed) return;
    const dt = this.clock.getDelta();

    const now = performance.now();
    this._fps.frames++;
    if (now - this._fps.last >= 1000) {
      this._fps.value = Math.round((this._fps.frames * 1000) / (now - this._fps.last));
      this._fps.frames = 0;
      this._fps.last = now;
    }

    for (const fn of this.updatables) fn(dt, this.clock.elapsedTime);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this._disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this._onResize);
    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this._onPointerMove);
    this.controls.dispose();
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        (Array.isArray(obj.material) ? obj.material : [obj.material])
          .forEach((m) => m.dispose());
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export default Engine;
