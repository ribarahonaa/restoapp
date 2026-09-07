import { SafeImg } from "./SafeImg.js";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}
function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 55% 45%)`;
}

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const s = { width: size, height: size };
  if (url) {
    return (
      <span className="inline-block overflow-hidden rounded-full bg-bg" style={s}>
        <SafeImg src={url} alt={name} className="h-full w-full object-cover"
          fallback={<Fallback name={name} size={size} />} />
      </span>
    );
  }
  return <Fallback name={name} size={size} />;
}

function Fallback({ name, size }: { name: string; size: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.4 }}>
      {initials(name)}
    </span>
  );
}
