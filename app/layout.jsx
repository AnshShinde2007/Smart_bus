import "./globals.css";

export const metadata = {
  title: "SmartBus — journeys made clearer",
  description: "Find your bus, follow its journey, and save your seat before you leave.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body data-map-tiles={process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png"} data-map-attribution={process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'}>{children}</body>
    </html>
  );
}
