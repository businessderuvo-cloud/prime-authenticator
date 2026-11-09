import React, { useState } from "react";
import { View, Image, Text, Pressable } from "react-native";
import { Row } from "./api";
const tile = (lat: number, lon: number, z: number) => ({
  x: ((lon + 180) / 360) * 2 ** z,
  y: ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z,
});
export default function NativeMap({
  rows,
  onSelect,
}: {
  rows: Row[];
  onSelect: (row: Row) => void;
}) {
  const points = rows.filter(
    (r) =>
      r.latitude != null &&
      r.longitude != null &&
      Number.isFinite(Number(r.latitude)) &&
      Number.isFinite(Number(r.longitude)),
  );
  const [z, setZ] = useState(13),
    [offset, setOffset] = useState({ x: 0, y: 0 }),
    [width, setWidth] = useState(340);
  const origin = tile(
    Number(points[0]?.latitude ?? 45.4642),
    Number(points[0]?.longitude ?? 9.19),
    z,
  );
  const center = { x: origin.x + offset.x, y: origin.y + offset.y };
  return (
    <View style={{ gap: 8 }}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{
          height: 280,
          overflow: "hidden",
          borderRadius: 12,
          backgroundColor: "#e5e3dc",
        }}
      >
        {Array.from({ length: 9 }, (_, i) => {
          const x = Math.floor(center.x) + (i % 3) - 1,
            y = Math.floor(center.y) + Math.floor(i / 3) - 1;
          if (y < 0 || y >= 2 ** z) return null;
          return (
            <Image
              key={`${z}/${x}/${y}`}
              source={{
                uri: `https://tile.openstreetmap.org/${z}/${(x + 2 ** z) % 2 ** z}/${y}.png`,
              }}
              style={{
                position: "absolute",
                left: (x - center.x) * 256 + width / 2,
                top: (y - center.y) * 256 + 140,
                width: 256,
                height: 256,
              }}
            />
          );
        })}
        {points.map((r) => {
          const p = tile(Number(r.latitude), Number(r.longitude), z);
          return (
            <Pressable
              key={r.id}
              accessibilityLabel={r.title}
              onPress={() => onSelect(r)}
              style={{
                position: "absolute",
                left: (p.x - center.x) * 256 + width / 2 - 9,
                top: (p.y - center.y) * 256 + 130,
                backgroundColor: "#8d682e",
                borderRadius: 12,
                padding: 5,
                borderColor: "#fff",
                borderWidth: 2,
              }}
            >
              <Text style={{ color: "#fff" }}>●</Text>
            </Pressable>
          );
        })}
        <View
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            backgroundColor: "#fff",
            borderRadius: 8,
          }}
        >
          {["+", "−", "←", "→", "↑", "↓"].map((a, i) => (
            <Pressable
              accessibilityLabel={
                ["Ingrandisci", "Riduci", "Ovest", "Est", "Nord", "Sud"][i]
              }
              key={a}
              onPress={() => {
                if (i < 2) {
                  setZ(Math.min(19, Math.max(2, z + (i === 0 ? 1 : -1))));
                  setOffset({ x: 0, y: 0 });
                } else
                  setOffset({
                    x: offset.x + (i === 2 ? -0.5 : i === 3 ? 0.5 : 0),
                    y: offset.y + (i === 4 ? -0.5 : i === 5 ? 0.5 : 0),
                  });
              }}
              style={{ paddingHorizontal: 12, paddingVertical: 6 }}
            >
              <Text style={{ color: "#222", fontSize: 18 }}>{a}</Text>
            </Pressable>
          ))}
        </View>
        <Text
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            color: "#222",
            backgroundColor: "#ffffffdd",
            fontSize: 10,
            padding: 3,
          }}
        >
          © OpenStreetMap contributors
        </Text>
      </View>
      <Text style={{ fontSize: 12, color: "#999" }}>
        {points.length} immobili geolocalizzati · {rows.length - points.length}{" "}
        senza coordinate
      </Text>
    </View>
  );
}
