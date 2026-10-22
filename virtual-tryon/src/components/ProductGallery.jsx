import { useState } from "react";
import { products } from "../data/products";

export default function ProductGallery({ selectedId, onSelect }) {
  const [filter, setFilter] = useState("all");
  const [brokenImages, setBrokenImages] = useState({});

  const filtered =
    filter === "all" ? products : products.filter((p) => p.category === filter);

  const handleImageError = (id) => {
    setBrokenImages((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {["all", "hat", "hijab"].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: "1px solid #ddd",
              background: filter === cat ? "#1a1a1a" : "#fff",
              color: filter === cat ? "#fff" : "#333",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
          gap: 10,
        }}
      >
        {filtered.map((product) => (
          <button
            key={product.id}
            onClick={() => onSelect(product)}
            style={{
              border:
                selectedId === product.id
                  ? "2px solid #1a1a1a"
                  : "1px solid #e5e5e5",
              borderRadius: 10,
              padding: 8,
              background: "#fafafa",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            {brokenImages[product.id] ? (
              <div
                style={{
                  width: 80,
                  height: 80,
                  background: "#eee",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: "#999",
                  textAlign: "center",
                }}
              >
                Missing
                <br />
                Image
              </div>
            ) : (
              <img
                src={product.image}
                alt={product.name}
                width={80}
                height={80}
                style={{ objectFit: "contain" }}
                onError={() => handleImageError(product.id)}
              />
            )}
            <span style={{ fontSize: 12, textAlign: "center" }}>
              {product.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}