
/* ============================================
   VOLTX Racing — Game Engine
   Prototype v0.1
   Three.js + JavaScript
   ============================================ */

import * as THREE from
  "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

// --------------------------------------------
// 1. DOM ELEMENTS
// --------------------------------------------

const game = document.getElementById("game");
const speedElement = document.getElementById("speed");
const speedBar = document.getElementById("speedBar");
const gearElement = document.getElementById("gear");
const directionElement = document.getElementById("direction");
const loadingElement = document.getElementById("loading");
const errorElement = document.getElementById("error");

const cameraButton = document.getElementById("cameraBtn");
const resetButton = document.getElementById("resetBtn");
const gearButton = document.getElementById("gearBtn");

// --------------------------------------------
// 2. GAME SETTINGS
// --------------------------------------------

const SETTINGS = {
  maxSpeed: 220,
  acceleration: 34,
  braking: 85,
  drag: 8,
  steeringSpeed: 1.45,
  roadWidth: 18,
  roadLength: 12000
};

const controls = {
  gas: false,
  brake: false,
  left: false,
  right: false
};

let speed = 0;           // m/s, signed for forward/reverse
let steeringAngle = 0;
let reverseGear = false;
let cameraMode = 0;
let elapsedTime = 0;

// --------------------------------------------
// 3. SCENE, CAMERA AND RENDERER
// --------------------------------------------

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x91c9e9);
scene.fog = new THREE.Fog(0x91c9e9, 100, 650);

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  1500
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio || 1, 1.5)
);

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

// Keep the 3D world behind the game's interface.
renderer.domElement.style.zIndex = "0";
renderer.domElement.style.position = "absolute";
renderer.domElement.style.inset = "0";

game.prepend(renderer.domElement);

document.querySelectorAll(
  ".topbar, .hud, .controls, .utility-buttons, .bottom-info"
).forEach(element => {
  element.style.zIndex = "2";
});

// --------------------------------------------
// 4. LIGHTING
// --------------------------------------------

const hemisphereLight = new THREE.HemisphereLight(
  0xd8efff,
  0x59664c,
  2.0
);

scene.add(hemisphereLight);

const sunlight = new THREE.DirectionalLight(
  0xfff0d5,
  3.0
);

sunlight.position.set(-40, 100, 30);
scene.add(sunlight);

// --------------------------------------------
// 5. MATERIALS
// --------------------------------------------

function makeMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.75,
    metalness: 0.05,
    ...options
  });
}

const materials = {
  grass: makeMaterial(0x527d43),
  asphalt: makeMaterial(0x343a43, { roughness: 0.95 }),
  line: makeMaterial(0xffffff),
  shoulder: makeMaterial(0xb8b8ae),
  body: makeMaterial(0xe21b38, {
    metalness: 0.65,
    roughness: 0.3
  }),
  glass: makeMaterial(0x182c3c, {
    metalness: 0.4,
    roughness: 0.2
  }),
  tire: makeMaterial(0x17191d, { roughness: 0.95 }),
  rim: makeMaterial(0xb8c6d1, {
    metalness: 0.85,
    roughness: 0.25
  }),
  dark: makeMaterial(0x20242a),
  headlight: new THREE.MeshBasicMaterial({ color: 0xfff2ce }),
  taillight: new THREE.MeshBasicMaterial({ color: 0xff172b })
};

// --------------------------------------------
// 6. WORLD AND ROAD
// --------------------------------------------

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2000, SETTINGS.roadLength),
  materials.grass
);

ground.rotation.x = -Math.PI / 2;
ground.position.set(
  0,
  -0.13,
  -SETTINGS.roadLength / 2 + 500
);

scene.add(ground);

const road = new THREE.Mesh(
  new THREE.PlaneGeometry(
    SETTINGS.roadWidth,
    SETTINGS.roadLength
  ),
  materials.asphalt
);

road.rotation.x = -Math.PI / 2;
road.position.set(
  0,
  -0.08,
  -SETTINGS.roadLength / 2 + 500
);

scene.add(road);

// Road shoulders.
for (const side of [-1, 1]) {
  const shoulder = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.04, SETTINGS.roadLength),
    materials.shoulder
  );

  shoulder.position.set(
    side * (SETTINGS.roadWidth / 2 + 0.1),
    -0.045,
    -SETTINGS.roadLength / 2 + 500
  );

  scene.add(shoulder);
}

// Dashed center line.
const roadMarkings = new THREE.Group();
scene.add(roadMarkings);

for (let z = 350; z > -SETTINGS.roadLength; z -= 17) {
  const dash = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.025, 7),
    materials.line
  );

  dash.position.set(0, -0.035, z);
  roadMarkings.add(dash);
}

// --------------------------------------------
// 7. SIMPLE LOW-POLY SCENERY
// --------------------------------------------

const scenery = new THREE.Group();
scene.add(scenery);

const treeTrunkMaterial = makeMaterial(0x725039);
const treeLeafMaterial = makeMaterial(0x2c693b);

function createTree(x, z, scale = 1) {
  const tree = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.24, 1.7, 6),
    treeTrunkMaterial
  );

  trunk.position.y = 0.85;
  tree.add(trunk);

  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 2.8, 7),
    treeLeafMaterial
  );

  leaves.position.y = 2.65;
  tree.add(leaves);

  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);

  scenery.add(tree);
}

const buildingMaterials = [
  makeMaterial(0xb5b7b8),
  makeMaterial(0xc4ad91),
  makeMaterial(0x8e9eaa),
  makeMaterial(0xd0c7b5)
];

function createBuilding(x, z, width, height, depth, material) {
  const building = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material
  );

  building.position.set(x, height / 2 - 0.1, z);
  scenery.add(building);
}

// Seeded-looking, evenly distributed roadside scenery.
for (let z = 300; z > -SETTINGS.roadLength + 300; z -= 24) {
  for (const side of [-1, 1]) {
    const offset = 12 + Math.random() * 20;
    const x = side * offset;

    if (Math.random() < 0.78) {
      createTree(
        x,
        z + Math.random() * 12,
        0.75 + Math.random() * 0.7
      );
    }

    if (Math.random() < 0.12) {
      const width = 5 + Math.random() * 8;
      const height = 8 + Math.random() * 20;
      const depth = 5 + Math.random() * 8;

      createBuilding(
        side * (30 + Math.random() * 15),
        z - Math.random() * 15,
        width,
        height,
        depth,
        buildingMaterials[
          Math.floor(Math.random() * buildingMaterials.length)
        ]
      );
    }
  }
}

// --------------------------------------------
// 8. CAR MODEL
// --------------------------------------------

const car = new THREE.Group();
scene.add(car);

const carBody = new THREE.Group();
car.add(carBody);

// Main chassis.
const chassis = new THREE.Mesh(
  new THREE.BoxGeometry(1.9, 0.52, 4.15),
  materials.body
);

chassis.position.y = 0.72;
carBody.add(chassis);

// Hood.
const hood = new THREE.Mesh(
  new THREE.BoxGeometry(1.75, 0.2, 1.15),
  materials.body
);

hood.position.set(0, 0.99, -1.35);
carBody.add(hood);

// Cabin.
const cabin = new THREE.Mesh(
  new THREE.BoxGeometry(1.43, 0.7, 1.85),
  materials.glass
);

cabin.position.set(0, 1.25, 0.05);
carBody.add(cabin);

// Roof.
const roof = new THREE.Mesh(
  new THREE.BoxGeometry(1.28, 0.12, 1.05),
  materials.body
);

roof.position.set(0, 1.62, 0.12);
carBody.add(roof);

// Front and rear bumpers.
for (const z of [-2.12, 2.12]) {
  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(1.95, 0.18, 0.18),
    materials.dark
  );

  bumper.position.set(0, 0.5, z);
  carBody.add(bumper);
}

// Headlights and taillights.
for (const x of [-0.65, 0.65]) {
  const headlight = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.13, 0.06),
    materials.headlight
  );

  headlight.position.set(x, 0.88, -2.12);
  carBody.add(headlight);

  const taillight = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.13, 0.06),
    materials.taillight
  );

  taillight.position.set(x, 0.88, 2.12);
  carBody.add(taillight);
}

// Wheels rotate as the car moves.
const wheels = [];
const frontWheels = [];

function createWheel(x, z, isFront) {
  const pivot = new THREE.Group();
  pivot.position.set(x, 0.43, z);

  if (isFront) frontWheels.push(pivot);

  car.add(pivot);

  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.39, 0.39, 0.27, 16),
    materials.tire
  );

  tire.rotation.z = Math.PI / 2;
  pivot.add(tire);

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.285, 12),
    materials.rim
  );

  rim.rotation.z = Math.PI / 2;
  pivot.add(rim);

  wheels.push(pivot);
}

createWheel(-0.98, -1.35, true);
createWheel(0.98, -1.35, true);
createWheel(-0.98, 1.35, false);
createWheel(0.98, 1.35, false);

car.position.set(0, 0, 0);

// --------------------------------------------
// 9. INPUT: KEYBOARD AND TOUCH
// --------------------------------------------

const keyMap = {
  ArrowUp: "gas",
  KeyW: "gas",
  ArrowDown: "brake",
  KeyS: "brake",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right"
};

window.addEventListener("keydown", event => {
  const action = keyMap[event.code];

  if (action) {
    controls[action] = true;
    event.preventDefault();
  }

  if (event.code === "KeyC" && !event.repeat) {
    cycleCamera();
  }

  if (event.code === "KeyR" && !event.repeat) {
    resetCar();
  }
});

window.addEventListener("keyup", event => {
  const action = keyMap[event.code];

  if (action) {
    controls[action] = false;
    event.preventDefault();
  }
});

window.addEventListener("blur", releaseControls);

function releaseControls() {
  controls.gas = false;
  controls.brake = false;
  controls.left = false;
  controls.right = false;

  document.querySelectorAll(".control-btn").forEach(button => {
    button.classList.remove("active");
  });
}

// Hold-to-drive touch controls.
document.querySelectorAll("[data-control]").forEach(button => {
  const action = button.dataset.control;

  function startControl(event) {
    event.preventDefault();
    controls[action] = true;
    button.classList.add("active");

    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture may be unavailable on some browsers.
    }
  }

  function stopControl(event) {
    event.preventDefault();
    controls[action] = false;
    button.classList.remove("active");
  }

  button.addEventListener("pointerdown", startControl);
  button.addEventListener("pointerup", stopControl);
  button.addEventListener("pointercancel", stopControl);
  button.addEventListener("lostpointercapture", () => {
    controls[action] = false;
    button.classList.remove("active");
  });

  button.addEventListener("contextmenu", event => {
    event.preventDefault();
  });
});

// --------------------------------------------
// 10. CAMERA MODES
// --------------------------------------------

const cameraModes = [
  "خلف السيارة",
  "داخل السيارة",
  "مقدمة السيارة",
  "سينمائية"
];

function cycleCamera() {
  cameraMode = (cameraMode + 1) % cameraModes.length;
  cameraButton.textContent = `📷 ${cameraModes[cameraMode]}`;
}

cameraButton.addEventListener("click", cycleCamera);

function updateCamera(delta) {
  const forward = new THREE.Vector3(
    Math.sin(car.rotation.y),
    0,
    -Math.cos(car.rotation.y)
  );

  const desiredPosition = new THREE.Vector3();
  const target = car.position.clone();

  if (cameraMode === 0) {
    // Third-person chase camera.
    desiredPosition.copy(car.position)
      .addScaledVector(forward, -8);

    desiredPosition.y += 4.1;
    target.addScaledVector(forward, 5);
    target.y += 1.0;

  } else if (cameraMode === 1) {
    // Approximate cockpit camera.
    desiredPosition.copy(car.position)
      .addScaledVector(forward, 0.45);

    desiredPosition.y += 1.48;
    target.addScaledVector(forward, 15);
    target.y += 1.2;

  } else if (cameraMode === 2) {
    // Front bumper camera.
    desiredPosition.copy(car.position)
      .addScaledVector(forward, 3.2);

    desiredPosition.y += 1.8;
    target.addScaledVector(forward, 18);
    target.y += 1.0;

  } else {
    // Cinematic high-angle camera.
    desiredPosition.copy(car.position)
      .addScaledVector(forward, -11);

    desiredPosition.y += 8;
    target.addScaledVector(forward, 3);
  }

  const smoothing = 1 - Math.exp(-5 * delta);

  camera.position.lerp(desiredPosition, smoothing);
  camera.lookAt(target);
}

// --------------------------------------------
// 11. GEAR AND RESET
// --------------------------------------------

gearButton.addEventListener("click", () => {
  reverseGear = !reverseGear;

  // Avoid a sudden direction change at speed.
  speed = 0;
  gearElement.textContent = reverseGear ? "R" : "D";

  directionElement.textContent = reverseGear
    ? "وضع الرجوع للخلف"
    : "وضع القيادة للأمام";
});

function resetCar() {
  car.position.set(0, 0, 0);
  car.rotation.set(0, 0, 0);

  speed = 0;
  steeringAngle = 0;
  reverseGear = false;

  gearElement.textContent = "D";
  directionElement.textContent = "جاهز للانطلاق";

  releaseControls();
}

resetButton.addEventListener("click", resetCar);

// --------------------------------------------
// 12. DRIVING PHYSICS
// --------------------------------------------

function updateDriving(delta) {
  // Forward or reverse acceleration.
  if (controls.gas) {
    const direction = reverseGear ? -1 : 1;
    speed += SETTINGS.acceleration * direction * delta;
  }

  // Braking reduces the current speed toward zero.
  if (controls.brake) {
    if (Math.abs(speed) > 0.15) {
      speed -= Math.sign(speed) * SETTINGS.braking * delta;
    } else {
      speed = 0;
    }
  }

  // Natural rolling resistance.
  if (!controls.gas && !controls.brake) {
    const reduction = SETTINGS.drag * delta;

    if (Math.abs(speed) <= reduction) {
      speed = 0;
    } else {
      speed -= Math.sign(speed) * reduction;
    }
  }

  // Speed limits for forward and reverse driving.
  const maxReverseSpeed = 35 / 3.6;
  const maxForwardSpeed = SETTINGS.maxSpeed / 3.6;

  speed = THREE.MathUtils.clamp(
    speed,
    -maxReverseSpeed,
    maxForwardSpeed
  );

  const speedRatio = Math.min(
    Math.abs(speed) / maxForwardSpeed,
    1
  );

  const steeringInput =
    Number(controls.left) - Number(controls.right);

  // Steering is less responsive when stationary.
  const steeringStrength = Math.min(
    Math.abs(speed) / 3,
    1
  );

  steeringAngle = THREE.MathUtils.damp(
    steeringAngle,
    steeringInput * SETTINGS.steeringSpeed,
    8,
    delta
  );

  // Reverse steering direction when moving backwards.
  car.rotation.y +=
    steeringAngle *
    steeringStrength *
    Math.sign(speed) *
    delta;

  const forward = new THREE.Vector3(
    Math.sin(car.rotation.y),
    0,
    -Math.cos(car.rotation.y)
  );

  car.position.addScaledVector(forward, speed * delta);

  // Small body roll when steering.
  const targetRoll = -steeringAngle * speedRatio * 0.08;

  carBody.rotation.z = THREE.MathUtils.damp(
    carBody.rotation.z,
    targetRoll,
    5,
    delta
  );

  // Rotate wheels as the vehicle moves.
  for (const wheel of wheels) {
    wheel.rotation.x -= speed * delta / 0.39;
  }

  // Front wheels visually turn with the steering input.
  for (const wheel of frontWheels) {
    wheel.rotation.y = -steeringAngle * 0.5;
  }

  // Keep the car within a simple road boundary.
  const roadLimit = SETTINGS.roadWidth / 2 - 1.15;

  if (Math.abs(car.position.x) > roadLimit) {
    car.position.x = THREE.MathUtils.clamp(
      car.position.x,
      -roadLimit,
      roadLimit
    );

    speed *= 0.985;
  }

  // Update HUD.
  const speedKmh = Math.round(Math.abs(speed) * 3.6);

  speedElement.textContent = String(speedKmh).padStart(3, "0");

  speedBar.style.width =
    `${Math.min(speedKmh / SETTINGS.maxSpeed * 100, 100)}%`;

  if (speedKmh > 2) {
    directionElement.textContent = reverseGear
      ? "رجوع للخلف"
      : "السيارة تتحرك";
  } else if (!controls.gas && !controls.brake) {
    directionElement.textContent = "السيارة متوقفة";
  }
}

// --------------------------------------------
// 13. RESIZE
// --------------------------------------------

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 1.5)
  );
}

window.addEventListener("resize", handleResize);

// --------------------------------------------
// 14. GAME LOOP
// --------------------------------------------

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.04);

  elapsedTime += delta;

  updateDriving(delta);
  updateCamera(delta);

  renderer.render(scene, camera);
}

// --------------------------------------------
// 15. START GAME
// --------------------------------------------

try {
  updateCamera(1);

  renderer.render(scene, camera);
  animate();

  loadingElement.style.opacity = "0";

  setTimeout(() => {
    loadingElement.remove();
  }, 550);

} catch (error) {
  console.error("VOLTX Racing startup error:", error);

  errorElement.hidden = false;
  errorElement.textContent =
    "Failed to start the game. Check browser WebGL support and internet connection.";
}
