/* ============================================
   VOLTX Racing v0.2
   Three.js Driving Prototype
   ============================================ */

import * as THREE from
  "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

// ============================================
// 1. DOM
// ============================================

const $ = (selector) => document.querySelector(selector);

const game = $("#game");
const speedElement = $("#speed");
const speedBar = $("#speedBar");
const gearElement = $("#gear");
const gearInfo = $("#gearInfo");
const directionElement = $("#direction");
const loadingElement = $("#loading");
const errorElement = $("#error");

const cameraButton = $("#cameraBtn");
const resetButton = $("#resetBtn");
const gearButton = $("#gearBtn");
const tiltButton = $("#tiltBtn");

// ============================================
// 2. SETTINGS AND SAVED DATA
// ============================================

const SETTINGS = {
  maxSpeed: 220 / 3.6,
  maxReverseSpeed: 35 / 3.6,
  acceleration: 12,
  braking: 24,
  drag: 1.8,
  rollingResistance: 0.4,
  steeringSpeed: 1.4,
  roadWidth: 18,
  roadLength: 12000,
  maxPixelRatio: 1.5
};

function loadSettings() {
  try {
    return JSON.parse(
      localStorage.getItem("voltx-settings") || "{}"
    );
  } catch {
    return {};
  }
}

const savedSettings = loadSettings();

function saveSettings() {
  try {
    localStorage.setItem("voltx-settings", JSON.stringify({
      cameraMode,
      reverseGear
    }));
  } catch (error) {
    console.warn("Could not save settings:", error);
  }
}

// ============================================
// 3. GAME STATE
// ============================================

const controls = {
  gas: false,
  brake: false,
  left: false,
  right: false
};

let speed = 0;
let steeringAngle = 0;
let reverseGear = false;
let cameraMode = 0;
let tiltEnabled = false;
let tiltSteering = 0;

const cameraModes = [
  "خلف السيارة",
  "داخل السيارة",
  "مقدمة السيارة",
  "سينمائية"
];

// ============================================
// 4. THREE.JS SETUP
// ============================================

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
  Math.min(window.devicePixelRatio || 1, SETTINGS.maxPixelRatio)
);

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

renderer.domElement.style.position = "absolute";
renderer.domElement.style.inset = "0";
renderer.domElement.style.zIndex = "0";

game.prepend(renderer.domElement);

// ============================================
// 5. LIGHTING
// ============================================

scene.add(new THREE.HemisphereLight(
  0xd8efff,
  0x59664c,
  2
));

const sunlight = new THREE.DirectionalLight(0xfff0d5, 3);
sunlight.position.set(-40, 100, 30);
scene.add(sunlight);

// ============================================
// 6. MATERIALS
// ============================================

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

// ============================================
// 7. WORLD
// ============================================

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(
    2000,
    SETTINGS.roadLength
  ),
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

// Road edges.
for (const side of [-1, 1]) {
  const shoulder = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.45,
      0.04,
      SETTINGS.roadLength
    ),
    materials.shoulder
  );

  shoulder.position.set(
    side * (SETTINGS.roadWidth / 2 + 0.1),
    -0.045,
    -SETTINGS.roadLength / 2 + 500
  );

  scene.add(shoulder);
}

// Center markings.
const roadMarkings = new THREE.Group();
scene.add(roadMarkings);

for (
  let z = 350;
  z > -SETTINGS.roadLength;
  z -= 17
) {
  const dash = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.025, 7),
    materials.line
  );

  dash.position.set(0, -0.035, z);
  roadMarkings.add(dash);
}

// ============================================
// 8. SCENERY
// ============================================

const scenery = new THREE.Group();
scene.add(scenery);

const trunkMaterial = makeMaterial(0x725039);
const leafMaterial = makeMaterial(0x2c693b);

const buildingMaterials = [
  makeMaterial(0xb5b7b8),
  makeMaterial(0xc4ad91),
  makeMaterial(0x8e9eaa),
  makeMaterial(0xd0c7b5)
];

function createTree(x, z, scale = 1) {
  const tree = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.24, 1.7, 6),
    trunkMaterial
  );

  trunk.position.y = 0.85;
  tree.add(trunk);

  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 2.8, 7),
    leafMaterial
  );

  leaves.position.y = 2.65;
  tree.add(leaves);

  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);

  scenery.add(tree);
}

function createBuilding(x, z, width, height, depth, material) {
  const building = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material
  );

  building.position.set(x, height / 2 - 0.1, z);
  scenery.add(building);
}

for (let z = 300; z > -SETTINGS.roadLength + 300; z -= 24) {
  for (const side of [-1, 1]) {
    const x = side * (12 + Math.random() * 20);

    if (Math.random() < 0.78) {
      createTree(
        x,
        z + Math.random() * 12,
        0.75 + Math.random() * 0.7
      );
    }

    if (Math.random() < 0.12) {
      createBuilding(
        side * (30 + Math.random() * 15),
        z - Math.random() * 15,
        5 + Math.random() * 8,
        8 + Math.random() * 20,
        5 + Math.random() * 8,
        buildingMaterials[
          Math.floor(Math.random() * buildingMaterials.length)
        ]
      );
    }
  }
}

// ============================================
// 9. CAR MODEL
// ============================================

const car = new THREE.Group();
const carBody = new THREE.Group();

scene.add(car);
car.add(carBody);

function addBox(parent, width, height, depth, material, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material
  );

  mesh.position.set(x, y, z);
  parent.add(mesh);

  return mesh;
}

// Chassis.
addBox(carBody, 1.9, 0.52, 4.15, materials.body, 0, 0.72, 0);

// Hood.
addBox(carBody, 1.75, 0.2, 1.15, materials.body, 0, 0.99, -1.35);

// Cabin and roof.
addBox(carBody, 1.43, 0.7, 1.85, materials.glass, 0, 1.25, 0.05);
addBox(carBody, 1.28, 0.12, 1.05, materials.body, 0, 1.62, 0.12);

// Bumpers.
for (const z of [-2.12, 2.12]) {
  addBox(carBody, 1.95, 0.18, 0.18, materials.dark, 0, 0.5, z);
}

// Lights.
for (const x of [-0.65, 0.65]) {
  addBox(carBody, 0.38, 0.13, 0.06, materials.headlight, x, 0.88, -2.12);
  addBox(carBody, 0.38, 0.13, 0.06, materials.taillight, x, 0.88, 2.12);
}

const wheels = [];
const frontWheels = [];

function createWheel(x, z, isFront) {
  const pivot = new THREE.Group();
  pivot.position.set(x, 0.43, z);
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

  if (isFront) {
    frontWheels.push(pivot);
  }
}

createWheel(-0.98, -1.35, true);
createWheel(0.98, -1.35, true);
createWheel(-0.98, 1.35, false);
createWheel(0.98, 1.35, false);

car.position.set(0, 0, 0);

// ============================================
// 10. KEYBOARD CONTROLS
// ============================================

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

function releaseControls() {
  Object.keys(controls).forEach(key => {
    controls[key] = false;
  });

  document.querySelectorAll(".control-btn").forEach(button => {
    button.classList.remove("active");
  });
}

window.addEventListener("blur", releaseControls);

// ============================================
// 11. TOUCH CONTROLS
// ============================================

document.querySelectorAll("[data-control]").forEach(button => {
  const action = button.dataset.control;

  function startControl(event) {
    event.preventDefault();

    controls[action] = true;
    button.classList.add("active");

    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional.
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

// ============================================
// 12. MOBILE TILT STEERING
// ============================================

function handleDeviceOrientation(event) {
  if (!tiltEnabled || event.gamma === null) return;

  const gamma = THREE.MathUtils.clamp(
    event.gamma / 25,
    -1,
    1
  );

  tiltSteering = Math.abs(gamma) < 0.08 ? 0 : gamma;
}

async function toggleTiltControl() {
  if (tiltEnabled) {
    tiltEnabled = false;
    tiltSteering = 0;

    tiltButton.textContent = "📱 إمالة الهاتف: OFF";
    tiltButton.classList.remove("enabled");

    window.removeEventListener(
      "deviceorientation",
      handleDeviceOrientation
    );

    return;
  }

  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    try {
      const permission =
        await DeviceOrientationEvent.requestPermission();

      if (permission !== "granted") {
        directionElement.textContent =
          "لم يتم السماح باستخدام مستشعر الهاتف";
        return;
      }
    } catch (error) {
      console.warn("Tilt permission error:", error);
      directionElement.textContent =
        "تعذر تفعيل مستشعر الهاتف";
      return;
    }
  }

  if (!("DeviceOrientationEvent" in window)) {
    directionElement.textContent =
      "المتصفح لا يدعم إمالة الهاتف";
    return;
  }

  tiltEnabled = true;

  window.addEventListener(
    "deviceorientation",
    handleDeviceOrientation
  );

  tiltButton.textContent = "📱 إمالة الهاتف: ON";
  tiltButton.classList.add("enabled");

  directionElement.textContent =
    "أمل الهاتف يمينًا أو يسارًا للتوجيه";
}

tiltButton.addEventListener("click", toggleTiltControl);

// ============================================
// 13. CAMERA
// ============================================

function cycleCamera() {
  cameraMode = (cameraMode + 1) % cameraModes.length;

  cameraButton.textContent = `📷 ${cameraModes[cameraMode]}`;

  saveSettings();
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
    desiredPosition.copy(car.position)
      .addScaledVector(forward, -8);

    desiredPosition.y += 4.1;
    target.addScaledVector(forward, 5);
    target.y += 1.0;

  } else if (cameraMode === 1) {
    desiredPosition.copy(car.position)
      .addScaledVector(forward, 0.45);

    desiredPosition.y += 1.48;
    target.addScaledVector(forward, 15);
    target.y += 1.2;

  } else if (cameraMode === 2) {
    desiredPosition.copy(car.position)
      .addScaledVector(forward, 3.2);

    desiredPosition.y += 1.8;
    target.addScaledVector(forward, 18);
    target.y += 1.0;

  } else {
    desiredPosition.copy(car.position)
      .addScaledVector(forward, -11);

    desiredPosition.y += 8;
    target.addScaledVector(forward, 3);
  }

  const smoothing = 1 - Math.exp(-5 * delta);

  camera.position.lerp(desiredPosition, smoothing);
  camera.lookAt(target);
}

// ============================================
// 14. GEAR AND RESET
// ============================================

gearButton.addEventListener("click", () => {
  reverseGear = !reverseGear;

  speed = 0;
  gearElement.textContent = reverseGear ? "R" : "D";
  gearInfo.textContent = reverseGear ? "REVERSE" : "AUTOMATIC";

  directionElement.textContent = reverseGear
    ? "وضع الرجوع للخلف"
    : "وضع القيادة للأمام";

  saveSettings();
});

function resetCar() {
  car.position.set(0, 0, 0);
  car.rotation.set(0, 0, 0);
  carBody.rotation.set(0, 0, 0);

  speed = 0;
  steeringAngle = 0;
  reverseGear = false;

  gearElement.textContent = "D";
  gearInfo.textContent = "AUTOMATIC";
  directionElement.textContent = "جاهز للانطلاق";

  releaseControls();
  saveSettings();
}

resetButton.addEventListener("click", resetCar);

// ============================================
// 15. DRIVING PHYSICS
// ============================================

function updateDriving(delta) {
  // Acceleration.
  if (controls.gas) {
    const direction = reverseGear ? -1 : 1;
    speed += SETTINGS.acceleration * direction * delta;
  }

  // Braking.
  if (controls.brake) {
    if (Math.abs(speed) > 0.15) {
      speed -= Math.sign(speed) * SETTINGS.braking * delta;
    } else {
      speed = 0;
    }
  }

  // Natural drag.
  if (!controls.gas && !controls.brake) {
    const reduction =
      (SETTINGS.drag * Math.min(Math.abs(speed), 1) +
       SETTINGS.rollingResistance) * delta;

    if (Math.abs(speed) <= reduction) {
      speed = 0;
    } else {
      speed -= Math.sign(speed) * reduction;
    }
  }

  // Speed limits.
  speed = THREE.MathUtils.clamp(
    speed,
    -SETTINGS.maxReverseSpeed,
    SETTINGS.maxSpeed
  );

  // Keyboard steering + optional phone tilt.
  const keyboardSteering =
    Number(controls.left) - Number(controls.right);

  const steeringInput = THREE.MathUtils.clamp(
    keyboardSteering + (tiltEnabled ? tiltSteering : 0),
    -1,
    1
  );

  const speedRatio = Math.min(
    Math.abs(speed) / SETTINGS.maxSpeed,
    1
  );

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

  // Vehicle yaw.
  car.rotation.y +=
    steeringAngle *
    steeringStrength *
    Math.sign(speed) *
    delta;

  // Move the vehicle in its facing direction.
  const forward = new THREE.Vector3(
    Math.sin(car.rotation.y),
    0,
    -Math.cos(car.rotation.y)
  );

  car.position.addScaledVector(forward, speed * delta);

  // Body roll.
  const targetRoll =
    -steeringAngle * speedRatio * 0.08;

  carBody.rotation.z = THREE.MathUtils.damp(
    carBody.rotation.z,
    targetRoll,
    5,
    delta
  );

  // Wheel rotation and front steering angle.
  for (const wheel of wheels) {
    wheel.rotation.x -= speed * delta / 0.39;
  }

  for (const wheel of frontWheels) {
    wheel.rotation.y = -steeringAngle * 0.5;
  }

  // Road boundaries.
  const roadLimit = SETTINGS.roadWidth / 2 - 1.15;

  if (Math.abs(car.position.x) > roadLimit) {
    car.position.x = THREE.MathUtils.clamp(
      car.position.x,
      -roadLimit,
      roadLimit
    );

    speed *= 0.985;
  }

  // Speedometer.
  const speedKmh = Math.round(Math.abs(speed) * 3.6);

  speedElement.textContent =
    String(speedKmh).padStart(3, "0");

  speedBar.style.width =
    `${Math.min(speedKmh / 220 * 100, 100)}%`;

  if (speedKmh > 2) {
    directionElement.textContent = reverseGear
      ? "رجوع للخلف"
      : "السيارة تتحرك";
  } else if (!controls.gas && !controls.brake) {
    directionElement.textContent = "السيارة متوقفة";
  }
}

// ============================================
// 16. RESTORE SETTINGS
// ============================================

if (
  Number.isInteger(savedSettings.cameraMode) &&
  savedSettings.cameraMode >= 0 &&
  savedSettings.cameraMode < cameraModes.length
) {
  cameraMode = savedSettings.cameraMode;
}

reverseGear = savedSettings.reverseGear === true;

cameraButton.textContent = `📷 ${cameraModes[cameraMode]}`;
gearElement.textContent = reverseGear ? "R" : "D";
gearInfo.textContent = reverseGear ? "REVERSE" : "AUTOMATIC";

// ============================================
// 17. RESIZE
// ============================================

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, SETTINGS.maxPixelRatio)
  );
}

window.addEventListener("resize", handleResize);

// ============================================
// 18. GAME LOOP
// ============================================

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.04);

  updateDriving(delta);
  updateCamera(delta);

  renderer.render(scene, camera);
}

// ============================================
// 19. START
// ============================================

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
    "Failed to start the game. Check WebGL support and internet connection.";
}
