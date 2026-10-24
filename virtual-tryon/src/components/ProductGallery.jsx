import { useRef, useState } from "react";

export default function ProductGallery({
  products,
  selectedId,
  onSelect,
  onAddProduct,
  onDeleteProduct,
  uploading,
}) {
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("hat");
  const [brokenImages, setBrokenImages] = useState({});
  const fileInputRef = useRef(null);
  const categories = [
    "all",
    ...new Set(products.map((product) => product.category)),
  ];
  const filtered =
    filter === "all"
      ? products
      : products.filter((product) => product.category === filter);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onAddProduct(file, category);
  };

  return (
    <div>
      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Category for uploaded item
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            style={fieldStyle}
          >
            <option value="hat">Hat</option>
            <option value="hijab">Hijab</option>
          </select>
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          style={{
            ...fieldStyle,
            background: uploading ? "#e5e7eb" : "#1a1a1a",
            color: uploading ? "#666" : "#fff",
            cursor: uploading ? "wait" : "pointer",
          }}
        >
          {uploading ? "Converting image…" : "Add image"}
        </button>
        <span style={{ color: "#666", fontSize: 12 }}>
          White and near-white pixels become transparent. Saved in this browser.
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {categories.map((itemCategory) => (
          <button
            key={itemCategory}
            type="button"
            onClick={() => setFilter(itemCategory)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: "1px solid #ddd",
              background: filter === itemCategory ? "#1a1a1a" : "#fff",
              color: filter === itemCategory ? "#fff" : "#333",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {itemCategory}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: "#777", fontSize: 13 }}>
          No objects in this category yet.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
            gap: 10,
          }}
        >
          {filtered.map((product) => (
            <div
              key={product.id}
              style={{
                border:
                  selectedId === product.id
                    ? "2px solid #1a1a1a"
                    : "1px solid #e5e5e5",
                borderRadius: 10,
                padding: 8,
                background: "#fafafa",
                display: "grid",
                gap: 6,
                alignContent: "start",
              }}
            >
              <button
                type="button"
                onClick={() => onSelect(product)}
                aria-pressed={selectedId === product.id}
                style={{
                  padding: 0,
                  border: 0,
                  background: "transparent",
                  cursor: "pointer",
                  display: "grid",
                  justifyItems: "center",
                  gap: 4,
                  color: "#1a1a1a",
                }}
              >
                {brokenImages[product.id] ? (
                  <span
                    style={{
                      width: 80,
                      height: 80,
                      background: "#eee",
                      borderRadius: 6,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 10,
                      color: "#999",
                      textAlign: "center",
                    }}
                  >
                    Missing image
                  </span>
                ) : (
                  <img
                    src={product.image}
                    alt=""
                    width={80}
                    height={80}
                    style={{ objectFit: "contain" }}
                    onError={() =>
                      setBrokenImages((previous) => ({
                        ...previous,
                        [product.id]: true,
                      }))
                    }
                  />
                )}
                <span style={{ fontSize: 12, textAlign: "center" }}>
                  {product.name}
                </span>
              </button>

              {product.userUploaded && (
                <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                  <a
                    href={product.image}
                    download={`${product.fileName}.png`}
                    style={{ color: "#333", fontSize: 11 }}
                  >
                    PNG
                  </a>
                  <button
                    type="button"
                    onClick={() => onDeleteProduct(product)}
                    aria-label={`Remove ${product.name}`}
                    style={{
                      border: 0,
                      padding: 0,
                      background: "transparent",
                      color: "#991b1b",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const fieldStyle = {
  padding: "8px 10px",
  border: "1px solid #ddd",
  borderRadius: 8,
  font: "inherit",
};
