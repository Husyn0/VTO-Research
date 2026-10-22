export const products = [
  {
    id: "hat-01",
    name: "Baseball Cap",
    category: "hat",
    image: "/products/hat-01.png",
    scale: 1.15,         // 1.15 × head width
    offsetX: 0,
    offsetY: -0.05,      // raise the cap slightly above the crown
    rotationOffset: 0,
    anchorX: 0.5,
    anchorY: 0.95,       // bottom edge of cap PNG at forehead top
  },
  {
    id: "hat-02",
    name: "Wide-Brim Hat",
    category: "hat",
    image: "/products/hat-02.png",
    scale: 1.3,
    offsetX: 0,
    offsetY: -0.02,
    rotationOffset: 0,
    anchorX: 0.5,
    anchorY: 0.9,
  },
  {
    id: "hijab-01",
    name: "Classic Hijab",
    category: "hijab",
    image: "/products/hijab-01.png",
    scale: 1.45,
    offsetX: 0,
    offsetY: 0.15,       // push down so face opening covers eyes+nose
    rotationOffset: 0,
    anchorX: 0.5,
    anchorY: 0.35,       // attach the upper third of the PNG at forehead top
  },
  {
    id: "hijab-02",
    name: "Printed Hijab",
    category: "hijab",
    image: "/products/hijab-02.png",
    scale: 1.5,
    offsetX: 10,
    offsetY: 1,
    rotationOffset: 0,
    anchorX: 0.5,
    anchorY: 0.35,
  },
];